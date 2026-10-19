import React, { useState } from "react";
import PasswordContext from "./passwordContext";
import toast from "react-hot-toast";

const PasswordState = (props) => {
    const host = import.meta.env.VITE_BACKEND;
    const [passwordArray, setPasswordArray] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    // Fetch all credentials from backend
    const getPasswords = async () => {
        const token = sessionStorage.getItem('token');
        if (!token) return;

        setIsLoading(true);
        try {
            const response = await fetch(`${host}/api/passwords`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'auth-token': token
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch passwords');
            }

            const json = await response.json();
            setPasswordArray(Array.isArray(json) ? json : []);
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
            const response = await fetch(`${host}/api/passwords`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'auth-token': sessionStorage.getItem('token')
                },
                body: JSON.stringify(payload)
            });

            const savedItem = await response.json();
            if (response.ok && savedItem._id) {
                setPasswordArray(prevArray => [savedItem, ...prevArray]);
                return { success: true, item: savedItem };
            } else {
                const errorMsg = savedItem.error || savedItem.errors?.[0]?.msg || 'Failed to save password';
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
            const response = await fetch(`${host}/api/passwords/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'auth-token': sessionStorage.getItem('token')
                },
                body: JSON.stringify(payload)
            });

            const updatedItem = await response.json();
            if (response.ok && updatedItem._id) {
                setPasswordArray(prevArray =>
                    prevArray.map(pass => (pass._id === id ? { ...pass, ...updatedItem } : pass))
                );
                return { success: true, item: updatedItem };
            } else {
                const errorMsg = updatedItem.error || 'Failed to update credential';
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
            const response = await fetch(`${host}/api/passwords/${id}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'auth-token': sessionStorage.getItem('token')
                }
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

    // Delete all credentials
    const deleteAllPasswords = async () => {
        try {
            const response = await fetch(`${host}/api/passwords`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'auth-token': sessionStorage.getItem('token')
                }
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