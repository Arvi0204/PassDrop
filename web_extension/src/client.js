import { createApi } from './api.js';
import { BACKEND } from './config.js';

// the API client pointed at the server this build was made for
export const api = createApi(BACKEND);
