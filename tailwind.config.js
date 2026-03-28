/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      boxShadow: {
        soft: '0 16px 40px rgba(37, 99, 235, 0.12)',
      },
    },
  },
  plugins: [],
};
