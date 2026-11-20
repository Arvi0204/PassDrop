import { useEffect, useState } from 'react';
import PasswordContext from "./passwordContext";
import toast from "react-hot-toast";
import authFetch from "../lib/authFetch";
import { getToken, getUserId, getVaultKey, hasVaultKey, subscribe } from "../lib/session";
import { decryptItem, encryptItem } from "../lib/vaultCrypto";

// What goes inside an encrypted login; the server only ever sees the encrypted blob
const FIELDS = ['title', 'url', 'username', 'password', 'notes', 'isFavorite'];
const plainOf = (item) => Object.fromEntries(FIELDS.filter((f) => item[f] !== undefined).map((f) => [f, item[f]]));
const NO_KEY = 'Your vault is locked';

// A login from the server: decrypted, or { _id, unreadable } when its blob cannot be opened (so one bad item never hides the rest)
async function openItem(vaultKey, userId, record) {
    try {
        const { _id, createdAt, updatedAt } = record;
        return { ...(await decryptItem(vaultKey, record.blob, userId)), _id, createdAt, updatedAt };
    } catch {
        return { _id: record._id, unreadable: true };
    }
}

const PasswordState = (props) => {
    const host = import.meta.env.VITE_BACKEND;
    const [passwordArray, setPasswordArray] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    // locked = no vault key in this tab (a reopened tab, or after Lock). Nothing is fetched or shown until it is unlocked.
    const [locked, setLocked] = useState(!hasVaultKey());
    useEffect(() => subscribe(() => {
        const nowLocked = !hasVaultKey();
        setLocked(nowLocked);
        if (nowLocked) setPasswordArray([]);
    }), []);

    const headers = () => ({ 'Content-Type': 'application/json', 'auth-token': getToken() });

    // Fetch all credentials from backend and decrypt them
    const getPasswords = async () => {
        const vaultKey = await getVaultKey();
        if (!getToken() || !vaultKey) return;

        setIsLoading(true);
        try {
            const response = await authFetch(`${host}/api/passwords`, { method: 'GET', headers: headers() });

            if (!response.ok) {
                throw new Error('Failed to fetch passwords');
            }

            const json = await response.json();
            const userId = getUserId();
            setPasswordArray(Array.isArray(json) ? await Promise.all(json.map((record) => openItem(vaultKey, userId, record))) : []);
        } catch (error) {
            console.error("Fetch passwords error:", error.message);
            toast.error(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    // Add a credential (supports either individual args or a data object)
    const addPass = async (urlOrItem, username, password, title = '', notes = '', isFavorite = false) => {
        const payload = typeof urlOrItem === 'object'
            ? urlOrItem
            : { url: urlOrItem, username, password, title, notes, isFavorite };

        try {
            const vaultKey = await getVaultKey();
            if (!vaultKey) return { success: false, error: NO_KEY };
            const item = { title: '', url: '', username: '', password: '', notes: '', isFavorite: false, ...plainOf(payload) };
            const response = await authFetch(`${host}/api/passwords`, {
                method: 'POST',
                headers: headers(),
                body: JSON.stringify({ blob: await encryptItem(vaultKey, item, getUserId()) })
            });

            const saved = await response.json();
            if (response.ok && saved._id) {
                const savedItem = await openItem(vaultKey, getUserId(), saved);
                setPasswordArray(prevArray => [savedItem, ...prevArray]);
                return { success: true, item: savedItem };
            } else {
                const errorMsg = saved.error || saved.errors?.[0]?.msg || 'Failed to save password';
                toast.error(errorMsg);
                return { success: false, error: errorMsg };
            }
        } catch (error) {
            console.error("Add password error:", error.message);
            toast.error("Failed to connect to server");
            return { success: false, error: error.message };
        }
    };

    // Edit an existing credential
    const editPass = async (id, urlOrUpdates, username, password, title, notes, isFavorite) => {
        let payload = {};
        if (typeof urlOrUpdates === 'object') {
            payload = urlOrUpdates;
        } else {
            payload = { url: urlOrUpdates, username, password };
            if (title !== undefined) payload.title = title;
            if (notes !== undefined) payload.notes = notes;
            if (isFavorite !== undefined) payload.isFavorite = isFavorite;
        }

        try {
            const vaultKey = await getVaultKey();
            const existing = passwordArray.find(pass => pass._id === id);
            if (!vaultKey || !existing || existing.unreadable) return { success: false, error: NO_KEY };
            // the whole login is encrypted again, so a partial update (like the favorite star) is merged into what is saved
            const merged = plainOf({ ...existing, ...plainOf(payload) });
            const response = await authFetch(`${host}/api/passwords/${id}`, {
                method: 'PUT',
                headers: headers(),
                body: JSON.stringify({ blob: await encryptItem(vaultKey, merged, getUserId()) })
            });

            const updated = await response.json();
            if (response.ok && updated._id) {
                const updatedItem = await openItem(vaultKey, getUserId(), updated);
                setPasswordArray(prevArray =>
                    prevArray.map(pass => (pass._id === id ? updatedItem : pass))
                );
                return { success: true, item: updatedItem };
            } else {
                const errorMsg = updated.error || updated.errors?.[0]?.msg || 'Failed to update credential';
                toast.error(errorMsg);
                return { success: false, error: errorMsg };
            }
        } catch (error) {
            console.error("Edit password error:", error.message);
            toast.error("Failed to connect to server");
            return { success: false, error: error.message };
        }
    };

    // Delete a single credential
    const deletePass = async (id) => {
        try {
            const response = await authFetch(`${host}/api/passwords/${id}`, {
                method: 'DELETE',
                headers: headers()
            });

            const json = await response.json();
            if (response.ok && json.success) {
                setPasswordArray(prevArray => prevArray.filter(pass => pass._id !== id));
                return { success: true };
            } else {
                toast.error(json.error || "Failed to delete item");
                return { success: false };
            }
        } catch (error) {
            console.error("Delete password error:", error.message);
            toast.error("Failed to connect to server");
            return { success: false };
        }
    };

    // Delete all credentials (the server wants the proof of the master password: see accountApi.reauthKey)
    const deleteAllPasswords = async (currentAuthKey) => {
        try {
            const response = await authFetch(`${host}/api/passwords`, {
                method: 'DELETE',
                headers: headers(),
                body: JSON.stringify({ currentAuthKey })
            });

            const json = await response.json();
            if (response.ok && json.success) {
                setPasswordArray([]);
                return { success: true, message: json.message };
            } else {
                toast.error(json.error || "Failed to delete passwords");
                return { success: false };
            }
        } catch (error) {
            console.error("Delete all passwords error:", error.message);
            toast.error("Failed to connect to server");
            return { success: false };
        }
    };

    return (
        <PasswordContext.Provider value={{
            passwordArray,
            setPasswordArray,
            isLoading,
            locked,
            getPasswords,
            addPass,
            editPass,
            deletePass,
            deleteAllPasswords
        }}>
            {props.children}
        </PasswordContext.Provider>
    );
};

export default PasswordState;
