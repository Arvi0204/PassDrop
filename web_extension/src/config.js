// Addresses come from web_extension/.env at build time (see .env.example); nothing is hardcoded.

const trimSlash = (url) => url.replace(/\/+$/, '');

export const BACKEND = trimSlash(import.meta.env.VITE_BACKEND);
export const WEB_APP_URL = trimSlash(import.meta.env.VITE_WEB_APP_URL);
