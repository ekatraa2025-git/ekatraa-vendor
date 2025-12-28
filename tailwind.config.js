/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#FF6B00', // Vibrant Orange from logo
          dark: '#E65100',
          light: '#FF9E40',
        },
        secondary: {
          DEFAULT: '#FF3D00', // Deep Orange/Red from logo
          dark: '#DD2C00',
          light: '#FF6E40',
        },
        accent: {
          DEFAULT: '#4B5563', // Gray from logo text
          dark: '#1F2937',
          light: '#9CA3AF',
        },
        background: '#FFFFFF',
        surface: '#F9FAFB',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
