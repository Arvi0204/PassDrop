// A release build must talk to the live site over https. Vite lets shell variables and the host's project
// settings override .env.production, so check the final values instead of trusting the file.
const LOCAL = new Set(['localhost', '127.0.0.1', '[::1]']);

export function releaseEnvProblems(env) {
  const problems = [];
  for (const name of ['VITE_BACKEND', 'VITE_WEB_APP_URL']) {
    let url;
    try { url = new URL(env[name]); } catch { problems.push(`${name} is not an address (${env[name]})`); continue; }
    if (url.protocol !== 'https:' || LOCAL.has(url.hostname)) problems.push(`${name} must be a public https:// address, not ${env[name]}`);
  }
  return problems;
}
