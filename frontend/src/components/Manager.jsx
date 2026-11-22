import { useEffect, useLayoutEffect, useRef, useState, useContext, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Search,
    Plus,
    Star,
    ArrowLeft,
    X,
    KeyRound,
    Share2
} from 'lucide-react';
import toast from 'react-hot-toast';
import passwordContext from '../context/passwordContext';
import VaultItemCard from './Vault/VaultItemCard';
import VaultDetail from './Vault/VaultDetail';
import VaultModal from './Vault/VaultModal';
import ConfirmationModal from './ConfirmationModal';
import ShareDropModal from './ShareDropModal';
import SharedLinks from './Vault/SharedLinks';
import useDrops from './Vault/useDrops';
import FrozenVault from './FrozenVault';
import FrozenRows from './Vault/FrozenRows';
import { getToken } from '../lib/session';
import { fingerprintOf } from '../lib/drop';
import { useTide } from '../context/useTide';
import { playVaultEntrance } from '../lib/vaultEntrance';
import { motion, AnimatePresence } from 'framer-motion';
import { variants, spring, ease, duration } from '../lib/motion';

export default function Manager() {
    const navigate = useNavigate();
    const { passwordArray, locked, getPasswords, addPass, editPass, deletePass } =
        useContext(passwordContext);

    const [selectedId, setSelectedId] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'favorites' | 'shared'

    // Modal state for Add/Edit
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [itemToEdit, setItemToEdit] = useState(null);
    const [shareItem, setShareItem] = useState(null); // the login being shared as a drop

    // Delete confirmation state
    const [deleteModalState, setDeleteModalState] = useState({
        isOpen: false,
        itemId: null
    });

    // Mobile navigation state ('list' | 'detail')
    const [mobileView, setMobileView] = useState('list');

    // Entrance animation: only after a fresh login/signup, once the vault data has arrived
    const tide = useTide();
    const rootRef = useRef(null);
    const [fetched, setFetched] = useState(false);

    // the live drops (links that share a login), grouped by the login they were made from
    const { drops, history, reload: reloadDrops } = useDrops(fetched);
    // The server ends a login's links with it, so none can outlive its login. The only ones that can have no login here
    // are links made in earlier versions, before logins were recorded: they are listed one by one under Shared.
    const { dropsByLogin, orphanDrops } = useMemo(() => {
        const logins = new Set(passwordArray.map((item) => item._id));
        const byLogin = new Map(), orphans = [];
        drops.forEach((drop) => {
            if (logins.has(drop.login)) byLogin.set(drop.login, [...(byLogin.get(drop.login) || []), drop]);
            else orphans.push(drop);
        });
        return { dropsByLogin: byLogin, orphanDrops: orphans };
    }, [drops, passwordArray]);
    const sharedCount = dropsByLogin.size + orphanDrops.length; // everything the Shared view lists
    const pastByLogin = useMemo(() => {
        const byLogin = new Map();
        history.forEach((entry) => byLogin.set(entry.login, [...(byLogin.get(entry.login) || []), entry]));
        return byLogin;
    }, [history]);

    // Rows animate in only after the first load, so the login entrance isn't doubled up
    const animateEnter = useRef(false);
    useEffect(() => {
        if (fetched) animateEnter.current = true;
    }, [fetched]);

    // Frozen = signed in but no vault key. The frost stays up (covered) until the thaw has finished, even though the
    // vault is already unlocked underneath by then.
    const frozen = locked && Boolean(getToken());
    const [covered, setCovered] = useState(frozen);
    useEffect(() => {
        if (frozen) setCovered(true);
    }, [frozen]);
    useEffect(() => {
        if (locked) setFetched(false); // a vault that is locked again fetches and surfaces afresh
    }, [locked]);
    // nothing behind the frost can be reached from the keyboard
    useEffect(() => {
        if (covered) rootRef.current?.setAttribute('inert', '');
        else rootRef.current?.removeAttribute('inert');
    }, [covered]);

    // hide the targets before the first paint so nothing flashes under the water
    useLayoutEffect(() => {
        if (tide.peekEntrance()) rootRef.current?.classList.add('entrance-pending');
    }, [tide, locked]);

    useEffect(() => {
        if (!fetched || covered || !tide.peekEntrance()) return undefined;
        tide.release(); // clear the water as the vault surfaces
        return playVaultEntrance(rootRef.current, { onDone: tide.finishEntrance });
    }, [fetched, covered, tide]);

    // Authentication check & initial data fetch (a locked vault fetches nothing until it is unlocked)
    useEffect(() => {
        if (!getToken()) {
            navigate('/login');
        } else if (!locked) {
            getPasswords().then(() => setFetched(true));
        }
    }, [locked]);

    // Filter and search credentials
    const filteredItems = useMemo(() => {
        return passwordArray.filter((item) => {
            if (activeFilter === 'favorites' && !item.isFavorite) {
                return false;
            }
            if (activeFilter === 'shared' && !dropsByLogin.has(item._id)) {
                return false;
            }
            if (!searchQuery.trim()) return true;

            const query = searchQuery.toLowerCase().trim();
            const title = (item.title || '').toLowerCase();
            const url = (item.url || '').toLowerCase();
            const username = (item.username || '').toLowerCase();

            return title.includes(query) || url.includes(query) || username.includes(query);
        });
    }, [passwordArray, activeFilter, searchQuery, dropsByLogin]);

    // Keep active item valid (a login that could not be decrypted has nothing to show, so it is never selected)
    useEffect(() => {
        const selectable = filteredItems.filter((item) => !item.unreadable);
        if (selectable.length > 0) {
            const currentStillExists = selectable.some((item) => item._id === selectedId);
            if (!currentStillExists) {
                setSelectedId(selectable[0]._id);
            }
        } else {
            setSelectedId(null);
        }
    }, [filteredItems, selectedId]);

    const activeItem = useMemo(() => {
        return passwordArray.find((item) => item._id === selectedId) || null;
    }, [passwordArray, selectedId]);

    // Copy and favorite are confirmed in place (the icon becomes a check, the star pops), so they
    // no longer raise a toast. This message is for screen readers, which can't see those cues.
    const [announcement, setAnnouncement] = useState({ id: 0, text: '' });
    const announce = (text) => setAnnouncement((prev) => ({ id: prev.id + 1, text }));

    const handleCopy = (text, label) => {
        navigator.clipboard.writeText(text);
        announce(`${label} copied to clipboard`);
    };

    // Toggle favorite state
    const handleToggleFavorite = async (item) => {
        const newFavState = !item.isFavorite;
        const res = await editPass(item._id, { isFavorite: newFavState });
        if (res?.success) {
            announce(newFavState ? 'Added to favorites' : 'Removed from favorites');
        }
    };

    // Open Edit modal
    const handleOpenEdit = (item) => {
        setItemToEdit(item);
        setIsModalOpen(true);
    };

    // Open Create modal
    const handleOpenCreate = () => {
        setItemToEdit(null);
        setIsModalOpen(true);
    };

    // Save modal action (Add or Edit)
    const handleSaveModal = async (formData) => {
        if (formData._id) {
            // a link shows the login as it was when it was shared: say so when an edit changes what a link shows
            const links = dropsByLogin.get(formData._id) || [];
            const before = links.length ? await fingerprintOf(passwordArray.find((item) => item._id === formData._id) || {}) : null;
            const res = await editPass(formData._id, formData);
            if (res.success) {
                toast.success('Account updated successfully!');
                if (links.length && before !== await fingerprintOf(res.item)) {
                    toast(`${links.length} shared ${links.length === 1 ? 'link still shows' : 'links still show'} the old details. Revoke ${links.length === 1 ? 'it' : 'them'} under Shared links if that matters.`, { duration: 8000 });
                }
            }
        } else {
            const res = await addPass(formData);
            if (res.success && res.item) {
                toast.success('Account saved to vault!');
                setSelectedId(res.item._id);
            }
        }
    };

    // Delete trigger
    const handleDeleteClick = (id) => {
        setDeleteModalState({
            isOpen: true,
            itemId: id
        });
    };

    // Confirm Delete
    const handleConfirmDelete = async () => {
        if (!deleteModalState.itemId) return;
        const res = await deletePass(deleteModalState.itemId);
        if (res.success) {
            reloadDrops(); // the server ended the login's links with it
            toast.success('Account deleted successfully');
            setDeleteModalState({ isOpen: false, itemId: null });
            if (mobileView === 'detail') {
                setMobileView('list');
            }
        }
    };

    const favoritesCount = useMemo(() => {
        return passwordArray.filter((i) => i.isFavorite).length;
    }, [passwordArray]);

    return (
        <>
        {/* outside the page's own container, which is inert while the frost is up */}
        {covered && <FrozenVault unlocked={!frozen} onGone={() => setCovered(false)} />}
        <div ref={rootRef} className="flex-1 bg-transparent py-8 px-4 sm:px-6 lg:px-8">
            <div role="status" aria-live="polite" className="sr-only">
                <span key={announcement.id}>{announcement.text}</span>
            </div>
            <div className="max-w-7xl mx-auto space-y-5">
                {/* Top Action Bar */}
                <div data-entrance className="bg-[#e1eef5]/70 px-5 py-3.5 rounded-2xl border border-white/80 shadow-[0_14px_35px_-8px_rgba(22,44,58,0.18)] backdrop-blur-xl flex flex-col md:flex-row items-center justify-between gap-4">
                    {/* Search Input */}
                    <div className="relative w-full md:w-96">
                        <Search className="w-4 h-4 text-[#5c7788] absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Search accounts, URLs, or usernames..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-8 py-2.5 text-sm bg-[#f5fafc]/85 border border-white/90 text-[#0c1820] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#112838]/20 focus:border-[#112838] transition-all placeholder:text-[#5c7788] shadow-xs"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#5c7788] hover:text-[#0c1820] p-0.5 cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    {/* Filter Pills & Add Button */}
                    <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
                        <div className="flex items-center gap-1.5 p-1 bg-white/40 border border-white/60 rounded-xl">
                            <button
                                type="button"
                                onClick={() => setActiveFilter('all')}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                                    activeFilter === 'all'
                                        ? 'bg-gradient-to-r from-[#0284c7] to-[#0077b6] text-white shadow-xs'
                                        : 'text-[#3a5566] hover:text-[#0c1820]'
                                }`}
                            >
                                All ({passwordArray.length})
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveFilter('favorites')}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                                    activeFilter === 'favorites'
                                        ? 'bg-gradient-to-r from-[#0284c7] to-[#0077b6] text-amber-200 shadow-xs'
                                        : 'text-[#3a5566] hover:text-[#0c1820]'
                                }`}
                            >
                                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                                Favorites ({favoritesCount})
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveFilter('shared')}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                                    activeFilter === 'shared'
                                        ? 'bg-gradient-to-r from-[#0284c7] to-[#0077b6] text-white shadow-xs'
                                        : 'text-[#3a5566] hover:text-[#0c1820]'
                                }`}
                            >
                                <Share2 className="w-3.5 h-3.5" />
                                Shared ({sharedCount})
                            </button>
                        </div>

                        <button
                            type="button"
                            onClick={handleOpenCreate}
                            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-[#0284c7] to-[#0077b6] hover:from-[#0369a1] hover:to-[#005f92] rounded-xl shadow-md shadow-[#0284c7]/25 active:scale-[0.98] transition-all shrink-0 cursor-pointer"
                        >
                            <Plus className="w-4 h-4" />
                            <span>New Item</span>
                        </button>
                    </div>
                </div>

                {/* Main Workspace Layout */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
                    {/* Master Vault List */}
                    <div
                        className={`md:col-span-5 lg:col-span-4 space-y-2.5 ${
                            mobileView === 'detail' ? 'hidden md:block' : 'block'
                        }`}
                    >
                        <div data-entrance className="flex items-center justify-between px-1 text-xs font-bold text-[#0c1820] uppercase tracking-wider">
                            <span>
                                {activeFilter === 'favorites' ? 'Favorite Accounts' : activeFilter === 'shared' ? 'Shared Accounts' : 'Vault Accounts'}
                            </span>
                            <span className="text-[#3a5566]">{fetched ? `${filteredItems.length} items` : ''}</span>
                        </div>

                        {frozen ? <FrozenRows /> : filteredItems.length === 0 && !fetched ? null : filteredItems.length === 0 ? (
                            <motion.div
                                key={searchQuery ? 'no-match' : 'empty'}
                                data-entrance
                                variants={variants.fadeUp}
                                initial={animateEnter.current ? 'hidden' : false}
                                animate="visible"
                                transition={{ duration: duration.slow, ease: ease.out }}
                                className="p-8 text-center bg-[#e1eef5]/70 rounded-2xl border border-white/80 shadow-[0_14px_35px_-8px_rgba(22,44,58,0.18)] backdrop-blur-xl text-slate-500 space-y-3"
                            >
                                <div className="w-12 h-12 rounded-xl bg-[#d0e4ee] border border-[#b8d6e5] mx-auto flex items-center justify-center text-[#112838] shadow-xs">
                                    <KeyRound className="w-6 h-6" />
                                </div>
                                <p className="text-sm font-bold text-[#0c1820]">
                                    {searchQuery ? 'No matching accounts found' : 'Your vault is empty'}
                                </p>
                                <p className="text-xs text-[#3a5566] max-w-xs mx-auto">
                                    {searchQuery
                                        ? 'Try searching with a different term or clear the filter.'
                                        : 'Add your first login, website credential, or secure note.'}
                                </p>
                                {!searchQuery && (
                                    <button
                                        type="button"
                                        onClick={handleOpenCreate}
                                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-[#0284c7] to-[#0077b6] hover:from-[#0369a1] hover:to-[#005f92] rounded-xl transition-colors cursor-pointer shadow-md shadow-[#0284c7]/25"
                                    >
                                        <Plus className="w-3.5 h-3.5" /> Add Account
                                    </button>
                                )}
                            </motion.div>
                        ) : (
                            <div className="relative space-y-2 max-h-[calc(100vh-230px)] overflow-y-auto pr-1">
                                <AnimatePresence initial={false} mode="popLayout">
                                    {filteredItems.map((item) => (
                                        <motion.div
                                            key={item._id}
                                            layout="position"
                                            variants={variants.listItem}
                                            initial={animateEnter.current ? 'hidden' : false}
                                            animate="visible"
                                            exit="exit"
                                            transition={{
                                                layout: spring.soft,
                                                default: { duration: duration.base, ease: ease.out }
                                            }}
                                        >
                                            {item.unreadable ? (
                                                <div className="p-3.5 rounded-xl border bg-[#e1eef5]/65 border-white/70 shadow-xs flex items-center justify-between gap-3">
                                                    <span className="text-xs text-[#3a5566]">This login could not be decrypted</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteClick(item._id)}
                                                        className="text-xs font-semibold text-rose-600 hover:underline cursor-pointer shrink-0"
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            ) : (
                                                <VaultItemCard
                                                    item={item}
                                                    isSelected={item._id === selectedId}
                                                    shared={dropsByLogin.get(item._id)?.length || 0}
                                                    onSelect={(clickedItem) => {
                                                        setSelectedId(clickedItem._id);
                                                        setMobileView('detail');
                                                    }}
                                                    onCopyUsername={(username) => handleCopy(username, 'Username')}
                                                    onCopyPassword={(password) => handleCopy(password, 'Password')}
                                                />
                                            )}
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </div>
                        )}

                        {activeFilter === 'shared' && orphanDrops.length > 0 && (
                            <SharedLinks drops={orphanDrops} onChanged={reloadDrops} heading="Links without a login" showTitle />
                        )}
                    </div>

                    {/* Detail Inspector Pane */}
                    <div
                        className={`md:col-span-7 lg:col-span-8 ${
                            mobileView === 'list' ? 'hidden md:block' : 'block'
                        }`}
                    >
                        {/* Mobile Back Button */}
                        <div className="md:hidden mb-3">
                            <button
                                type="button"
                                onClick={() => setMobileView('list')}
                                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#112838] bg-[#e1eef5]/90 px-3.5 py-2 rounded-xl border border-white/80 shadow-xs transition-all cursor-pointer"
                            >
                                <ArrowLeft className="w-3.5 h-3.5" /> Back to Accounts List
                            </button>
                        </div>

                        <div data-entrance className="sticky top-20">
                            <AnimatePresence mode="wait" initial={false}>
                                <motion.div
                                    key={activeItem?._id ?? 'none'}
                                    variants={variants.pane}
                                    initial="hidden"
                                    animate="visible"
                                    exit="exit"
                                    transition={{ duration: duration.base, ease: ease.out }}
                                >
                                    <VaultDetail
                                        item={activeItem}
                                        onEdit={handleOpenEdit}
                                        onDelete={handleDeleteClick}
                                        onShare={setShareItem}
                                        sharedLinks={activeItem && <SharedLinks drops={dropsByLogin.get(activeItem._id) || []} past={pastByLogin.get(activeItem._id)} item={activeItem} onChanged={reloadDrops} />}
                                        onToggleFavorite={handleToggleFavorite}
                                        onCopy={handleCopy}
                                    />
                                </motion.div>
                            </AnimatePresence>
                        </div>
                    </div>
                </div>
            </div>

            {/* Slide-over / Modal for Create & Edit */}
            <VaultModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                initialData={itemToEdit}
                onSave={handleSaveModal}
            />

            {shareItem && <ShareDropModal key={shareItem._id} item={shareItem} onClose={() => setShareItem(null)} onMade={reloadDrops} />}

            {/* Confirmation Modal for Deletion */}
            <ConfirmationModal
                isOpen={deleteModalState.isOpen}
                onClose={() => setDeleteModalState({ isOpen: false, itemId: null })}
                onConfirm={handleConfirmDelete}
                message={`Are you sure you want to delete this account? This action cannot be undone.${
                    dropsByLogin.get(deleteModalState.itemId)?.length ? ' Its shared links will stop working.' : ''
                }`}
                confirmText="Yes, Delete"
            />
        </div>
        </>
    );
}
