/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#FF7A00', // Match ekatraa user app
          dark: '#E66A00',
          light: '#FFA040',
        },
        secondary: {
          DEFAULT: '#1E3A8A', // Secondary blue from user app
          dark: '#1E3A8A',
          light: '#3B82F6',
        },
        accent: {
          DEFAULT: '#1E3A8A',
          dark: '#3B82F6',
          light: '#60A5FA',
        },
        background: '#F7F8FA',
        surface: '#FFFFFF',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
