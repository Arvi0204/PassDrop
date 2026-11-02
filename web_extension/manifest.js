// Builds manifest.json at build time, so the backend address comes from the environment
// (VITE_BACKEND) and is never written by hand.

export function buildManifest({ version, backendOrigin }) {
  return {
    manifest_version: 3,
    name: 'PassDrop - Password Manager',
    version,
    description: 'Your PassDrop vault in the browser: look up, copy and autofill your logins.',
    minimum_chrome_version: '102',
    // activeTab: the popup reads the address of the tab you opened it on, to show that site's logins
    // alarms: refresh the vault every few minutes in the background
    permissions: ['storage', 'activeTab', 'alarms'],
    // the one server the extension talks to
    host_permissions: [`${backendOrigin}/*`],
    background: {
      service_worker: 'background.js',
      type: 'module'
    },
    action: {
      default_popup: 'popup.html',
      default_icon: {
        16: 'icons/icon16.png',
        32: 'icons/icon32.png',
        192: 'icons/icon192.png'
      }
    },
    icons: {
      16: 'icons/icon16.png',
      32: 'icons/icon32.png',
      192: 'icons/icon192.png',
      512: 'icons/icon512.png'
    },
    content_scripts: [
      {
        matches: ['<all_urls>'],
        js: ['content.js']
      }
    ]
  };
}
