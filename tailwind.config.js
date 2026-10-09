/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        paper: '#F4F1EA',
        sunken: '#ECE8DE',
        line: '#DDD7C9',
        ink: { DEFAULT: '#1D1B17', 2: '#55514A', 3: '#8A857A' },
        accent: { DEFAULT: '#D6451F', hover: '#B83A19', soft: '#FBE9E2' },
        good: '#2E7D4F',
        warn: '#B7791F',
        bad: '#C0392B',
      },
      fontFamily: {
        sans: ['"IBM Plex Sans Arabic"', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        sheet: '0 -8px 30px rgba(29,27,23,.14)',
        pop: '0 10px 40px rgba(29,27,23,.18)',
      },
    },
  },
  plugins: [],
};
