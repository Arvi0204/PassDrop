// A countdown that follows the server's clock, not the visitor's. The server says what time it is (`serverNow`) and when the drop
// ends (`expiresAt`); from then on it is counted locally, so no more requests are needed. Time passed is the larger of what the
// page's own stopwatch and the system clock say: a laptop that slept still counts it, setting the clock back gains nothing, and
// setting it forward only makes the end come sooner for that visitor.
export function countdown(expiresAt, serverNow, { perf = () => performance.now(), wall = () => Date.now() } = {}) {
    const total = Date.parse(expiresAt) - Date.parse(serverNow);
    const [p0, w0] = [perf(), wall()];
    return () => Math.max(0, (total - Math.max(perf() - p0, wall() - w0)) / 1000);
}

/** "42 min", "3 h 20 min", or "6 min 05 s" once under 10 minutes; never "0 min" (it says "under a minute" first). */
export function formatLeft(seconds) {
    if (seconds >= 600) {
        const minutes = Math.ceil(seconds / 60), h = Math.floor(minutes / 60), m = minutes % 60;
        return h ? (m ? `${h} h ${m} min` : `${h} h`) : `${minutes} min`;
    }
    if (seconds >= 60) return `${Math.floor(seconds / 60)} min ${String(Math.floor(seconds % 60)).padStart(2, '0')} s`;
    return `${Math.max(1, Math.ceil(seconds))} s`;
}
