/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'dark-primary': '#222831',
        'dark-secondary': '#393E46', 
        'accent-teal': '#00ADB5',
        'light-grey': '#EEEEEE',
      }
    },
  },
  plugins: [],
}
