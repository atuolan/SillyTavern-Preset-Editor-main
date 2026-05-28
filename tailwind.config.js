/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./web/**/*.{html,js,vue}",
    "./src/**/*.{html,js,vue}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#b0562d',
          soft: '#fff0e6',
        },
        bg: {
          DEFAULT: '#f5f0e7',
          soft: '#fbf8f2',
        },
        line: '#d9ccbb',
        text: '#2b2520',
        muted: '#7f6d5c',
      }
    },
  },
  plugins: [],
}
