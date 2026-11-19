// Where to get a site's icon: Google's favicon service. The browser keeps each icon for a week (about half a
// kilobyte each), so this is one small download per site, not one per view.
// The service is told the site's name, so only public names are sent: names without a dot (intranet hosts
// such as "jira"), localhost and IP addresses have no public icon and are nobody else's business.
// Returns '' for those, and the caller shows a letter tile instead. Shared by the web app and the extension.

export function iconUrlForHost(host) {
    if (!host || !host.includes('.') || /^[\d.]+$/.test(host)) return '';
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`;
}
