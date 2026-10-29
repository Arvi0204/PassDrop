import { createContext, useContext } from 'react';

export const TideContext = createContext(null);

export const useTide = () => {
    const ctx = useContext(TideContext);
    if (!ctx) {
        throw new Error('useTide must be used inside <TideProvider>');
    }
    return ctx;
};
