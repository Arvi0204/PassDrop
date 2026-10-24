import React, { useEffect, useState, useContext, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Search,
    Plus,
    Star,
    ArrowLeft,
    X,
    KeyRound
} from 'lucide-react';
import toast from 'react-hot-toast';
import passwordContext from '../context/passwordContext';
import VaultItemCard from './Vault/VaultItemCard';
import VaultDetail from './Vault/VaultDetail';
import VaultModal from './Vault/VaultModal';
import ConfirmationModal from './ConfirmationModal';

export default function Manager() {
    const navigate = useNavigate();
    const { passwordArray, getPasswords, addPass, editPass, deletePass } =
        useContext(passwordContext);

    const [selectedId, setSelectedId] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'favorites'

    // Modal state for Add/Edit
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [itemToEdit, setItemToEdit] = useState(null);

    // Delete confirmation state
    const [deleteModalState, setDeleteModalState] = useState({
        isOpen: false,
        itemId: null
    });

    // Mobile navigation state ('list' | 'detail')
    const [mobileView, setMobileView] = useState('list');

    // Authentication check & initial data fetch
    useEffect(() => {
        const token = sessionStorage.getItem('token');
        if (!token) {
            navigate('/login');
        } else {
            getPasswords();
        }
    }, []);

    // Filter and search credentials
    const filteredItems = useMemo(() => {
        return passwordArray.filter((item) => {
            if (activeFilter === 'favorites' && !item.isFavorite) {
                return false;
            }
            if (!searchQuery.trim()) return true;

            const query = searchQuery.toLowerCase().trim();
            const title = (item.title || '').toLowerCase();
            const url = (item.url || '').toLowerCase();
            const username = (item.username || '').toLowerCase();

            return title.includes(query) || url.includes(query) || username.includes(query);
        });
    }, [passwordArray, activeFilter, searchQuery]);

    // Keep active item valid
    useEffect(() => {
        if (filteredItems.length > 0) {
            const currentStillExists = filteredItems.some((item) => item._id === selectedId);
            if (!currentStillExists) {
                setSelectedId(filteredItems[0]._id);
            }
        } else {
            setSelectedId(null);
        }
    }, [filteredItems, selectedId]);

    const activeItem = useMemo(() => {
        return passwordArray.find((item) => item._id === selectedId) || null;
    }, [passwordArray, selectedId]);

    // Copy handler with clipboard feedback
    const handleCopy = (text, label) => {
        navigator.clipboard.writeText(text);
        toast.success(`Copied ${label} to clipboard!`);
    };

    // Toggle favorite state
    const handleToggleFavorite = async (item) => {
        const newFavState = !item.isFavorite;
        await editPass(item._id, { isFavorite: newFavState });
        toast(newFavState ? 'Added to favorites ⭐' : 'Removed from favorites', {
            icon: newFavState ? '⭐' : 'ℹ️'
        });
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
            const res = await editPass(formData._id, formData);
            if (res.success) {
                toast.success('Account updated successfully!');
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
        <div className="flex-1 bg-transparent py-8 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto space-y-5">
                {/* Top Action Bar */}
                <div className="bg-[#e1eef5]/70 px-5 py-3.5 rounded-2xl border border-white/80 shadow-[0_14px_35px_-8px_rgba(22,44,58,0.18)] backdrop-blur-xl flex flex-col md:flex-row items-center justify-between gap-4">
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
                                        ? 'bg-[#112838] text-white shadow-xs'
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
                                        ? 'bg-[#112838] text-amber-300 shadow-xs'
                                        : 'text-[#3a5566] hover:text-[#0c1820]'
                                }`}
                            >
                                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                                Favorites ({favoritesCount})
                            </button>
                        </div>

                        <button
                            type="button"
                            onClick={handleOpenCreate}
                            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-[#112838] hover:bg-[#1b3d54] rounded-xl shadow-md shadow-[#112838]/20 active:scale-[0.98] transition-all shrink-0 cursor-pointer"
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
                        <div className="flex items-center justify-between px-1 text-xs font-bold text-[#0c1820] uppercase tracking-wider">
                            <span>
                                {activeFilter === 'favorites' ? 'Favorite Accounts' : 'Vault Accounts'}
                            </span>
                            <span className="text-[#3a5566]">{filteredItems.length} items</span>
                        </div>

                        {filteredItems.length === 0 ? (
                            <div className="p-8 text-center bg-[#e1eef5]/70 rounded-2xl border border-white/80 shadow-[0_14px_35px_-8px_rgba(22,44,58,0.18)] backdrop-blur-xl text-slate-500 space-y-3">
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
                                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#112838] hover:bg-[#1b3d54] rounded-xl transition-colors cursor-pointer shadow-md shadow-[#112838]/20"
                                    >
                                        <Plus className="w-3.5 h-3.5" /> Add Account
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-[calc(100vh-230px)] overflow-y-auto pr-1">
                                {filteredItems.map((item) => (
                                    <VaultItemCard
                                        key={item._id}
                                        item={item}
                                        isSelected={item._id === selectedId}
                                        onSelect={(clickedItem) => {
                                            setSelectedId(clickedItem._id);
                                            setMobileView('detail');
                                        }}
                                        onCopyUsername={(username) => handleCopy(username, 'Username')}
                                        onCopyPassword={(password) => handleCopy(password, 'Password')}
                                    />
                                ))}
                            </div>
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

                        <div className="sticky top-20">
                            <VaultDetail
                                item={activeItem}
                                onEdit={handleOpenEdit}
                                onDelete={handleDeleteClick}
                                onToggleFavorite={handleToggleFavorite}
                                onCopy={handleCopy}
                            />
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

            {/* Confirmation Modal for Deletion */}
            <ConfirmationModal
                isOpen={deleteModalState.isOpen}
                onClose={() => setDeleteModalState({ isOpen: false, itemId: null })}
                onConfirm={handleConfirmDelete}
                message="Are you sure you want to delete this account? This action cannot be undone."
                confirmText="Yes, Delete"
            />
        </div>
    );
}
