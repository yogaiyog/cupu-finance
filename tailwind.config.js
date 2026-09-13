/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        warm: {
          canvas: "#edede9",
          card: "#f5ebe0",
          subtle: "#e3d5ca",
          border: "#d6ccc2",
          primary: "#d5bdaf",
          'primary-dark': "#b89f8f",
          ink: "#2d2825",
          mute: "#6b635b",
          faint: "#9e9389",
        },
        cat: {
          food: "#d48b6a",
          'food-soft': "#faeae1",
          transport: "#7097c2",
          'transport-soft': "#e8eff7",
          shopping: "#a688b8",
          'shopping-soft': "#f3edf7",
          bills: "#c47171",
          'bills-soft': "#fae8e8",
          entertainment: "#c77d99",
          'entertainment-soft': "#f7eaef",
          others: "#8d877e",
          'others-soft': "#eeebe6",
        },
        sync: {
          synced: "#5a9e78",
          pending: "#c98a4b",
          syncing: "#7097c2",
          error: "#c47171",
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
