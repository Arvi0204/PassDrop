// How strong a password is, as a score from 0 to 4 and a word for it. Plain logic with no styling,
// so the web app and the browser extension always agree on what "strong" means.

export function strengthOf(password) {
    if (!password) return { score: 0, label: 'Empty' };

    let points = 0;
    if (password.length >= 8) points += 1;
    if (password.length >= 14) points += 1;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) points += 1;
    if (/[0-9]/.test(password)) points += 1;
    if (/[^A-Za-z0-9]/.test(password)) points += 1;

    if (password.length < 8) return { score: 1, label: 'Weak (Too Short)' };
    if (points <= 2) return { score: 2, label: 'Weak' };
    if (points <= 4) return { score: 3, label: 'Good' };
    return { score: 4, label: 'Strong' };
}
