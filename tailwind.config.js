/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'copa-green': '#006600',
        'copa-yellow': '#FFD700',
        'copa-dark': '#004400',
        'copa-light': '#e8f5e9',
      },
    },
  },
  plugins: [],
}
