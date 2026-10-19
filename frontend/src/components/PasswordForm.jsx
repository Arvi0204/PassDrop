import React, { useRef, useContext, useState } from "react";
import { EyeIcon, EyeOffIcon, X } from 'lucide-react';
import passwordContext from "../context/passwordContext";
import formContext from "../context/formContext";
import toast from 'react-hot-toast';

const initialForm = {
    _id: null,
    title: "",
    url: "",
    username: "",
    password: "",
    notes: "",
    isFavorite: false
};

const PasswordForm = () => {
    const passwordRef = useRef();

    const { addPass, editPass } = useContext(passwordContext);
    const { form, setForm } = useContext(formContext);
    const [showPassword, setShowPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const isEditing = Boolean(form._id);

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        if (!form.url && !form.title) {
            toast.error("Please enter a URL or Title");
            return;
        }
        if (!form.password) {
            toast.error("Password cannot be blank");
            return;
        }

        setIsSubmitting(true);
        try {
            if (isEditing) {
                const res = await editPass(form._id, form);
                if (res.success) {
                    toast.success("Credential updated successfully");
                    setForm(initialForm);
                }
            } else {
                const res = await addPass(form);
                if (res.success) {
                    toast.success("Password added successfully");
                    setForm(initialForm);
                }
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCancel = () => {
        setForm(initialForm);
        toast("Editing cancelled", { icon: "ℹ️" });
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setForm({
            ...form,
            [name]: type === 'checkbox' ? checked : value
        });
    };

    return (
        <div className="md:container md:mx-auto pb-4 md:pb-8 pt-8 md:pt-16 px-8 md:px-40">
            <h1 className="text-4xl font-bold text-center">
                <span className="text-blue-500">&lt;</span>
                Pass
                <span className="text-blue-700">Haven/&gt;</span>
            </h1>
            <p className="text-blue-800 text-lg text-center">Your secure password manager</p>

            <form onSubmit={handleSubmit} className="flex flex-col p-4 w-full text-black gap-6 justify-center items-center">
                {isEditing && (
                    <div className="w-full bg-blue-50 border border-blue-200 text-blue-800 rounded-lg p-3 text-center text-sm font-medium">
                        ✏️ Editing credential: <span className="font-bold underline">{form.title || form.url || form.username}</span>
                    </div>
                )}

                <div className="flex flex-col md:flex-row w-full gap-4">
                    <input
                        className="flex-grow rounded-full border border-blue-600 px-4 py-2"
                        type="text"
                        value={form.title || ""}
                        name="title"
                        onChange={handleChange}
                        placeholder="Title (e.g. GitHub, Netflix)"
                    />
                    <input
                        className="flex-grow rounded-full border border-blue-600 px-4 py-2"
                        type="text"
                        value={form.url || ""}
                        id="url"
                        name="url"
                        onChange={handleChange}
                        placeholder="Website URL (e.g. github.com)"
                    />
                </div>

                <div className="flex flex-col md:flex-row w-full gap-4">
                    <input
                        className="flex-grow rounded-full border border-blue-600 px-4 py-2"
                        type="text"
                        value={form.username || ""}
                        name="username"
                        onChange={handleChange}
                        placeholder="Enter username or email"
                        autoComplete="username"
                    />
                    <div className="relative flex-grow">
                        <input
                            className="rounded-full border border-blue-600 w-full px-4 py-2 pr-10"
                            type={showPassword ? "text" : "password"}
                            ref={passwordRef}
                            value={form.password || ""}
                            id="password"
                            name="password"
                            onChange={handleChange}
                            placeholder="Enter password"
                            autoComplete="new-password"
                        />
                        <button
                            type="button"
                            className="absolute inset-y-0 right-0 pr-3 flex items-center"
                            onClick={() => setShowPassword((prev) => !prev)}
                        >
                            {showPassword ? <EyeOffIcon className="h-5 w-5 text-gray-400" /> : <EyeIcon className="h-5 w-5 text-gray-400" />}
                        </button>
                    </div>
                </div>

                <div className="flex gap-3">
                    <button
                        type="submit"
                        disabled={isSubmitting || (!form.url && !form.title) || !form.password}
                        className={`text-white flex justify-center items-center rounded-full w-fit gap-2 px-6 py-2 transition duration-200 font-medium
                            ${(!form.url && !form.title) || !form.password || isSubmitting
                                ? 'bg-gray-400 cursor-not-allowed'
                                : isEditing
                                    ? 'bg-amber-600 hover:bg-amber-700'
                                    : 'bg-blue-800 hover:bg-blue-700'}`}
                    >
                        {isEditing ? "Update Credential" : "Save Password"}
                    </button>
                    {isEditing && (
                        <button
                            type="button"
                            onClick={handleCancel}
                            className="border border-gray-400 text-gray-700 hover:bg-gray-100 rounded-full px-4 py-2 text-sm font-medium"
                        >
                            Cancel
                        </button>
                    )}
                </div>
            </form>
        </div>
    );
};

export default PasswordForm;
