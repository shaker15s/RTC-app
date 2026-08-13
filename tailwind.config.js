/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './app.js',
    './js/**/*.js',
    './verify.html',
    './privacy.html',
    './terms.html'
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        primary: 'var(--primary)',
        'primary-2': 'var(--primary-2)',
        teald: 'var(--teal)',
        teal: 'var(--teal)',
        gold: 'var(--gold)',
        'on-surface': 'var(--txt)',
        'on-surface-variant': 'var(--mut)',
        muted: 'var(--mut)',
        line: 'var(--line)',
        'outline-variant': 'var(--line)',
        'card-2': 'var(--card-2)',
        surface: 'var(--card)',
        card: 'var(--card)',
        main: 'var(--txt)'
      },
      fontFamily: {
        sans: ['"IBM Plex Sans Arabic"', 'Inter', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
};
