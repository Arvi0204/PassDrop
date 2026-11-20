import { signOut } from './session';

// fetch for signed-in calls: a 401 means the token is dead (password changed elsewhere, account
// deleted, expired), so sign out and send the user to the login page instead of showing errors.
export default async function authFetch(url, options) {
    const response = await fetch(url, options);
    if (response.status === 401) {
        signOut();
        window.location.assign('/login');
        await new Promise(() => {}); // the page is leaving; never hand callers an error to toast
    }
    return response;
}
