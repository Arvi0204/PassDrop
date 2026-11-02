/** @type {import('tailwindcss').Config} */
export default {
  content: ['./popup.html', './src/**/*.js'],
  theme: {
    extend: {
      fontFamily: {
        // bundled with the extension (see main.js): a password manager should not call out to a font server
        sans: ['"Plus Jakarta Sans Variable"', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'sans-serif'],
        mono: ['"JetBrains Mono Variable"', 'ui-monospace', 'Consolas', 'monospace']
      }
    }
  },
  plugins: []
};
