/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        void: "#0a0a0a",
        surface: "#141414",
        "surface-light": "#1e1e1e",
        warm: "#f0ede6",
        "warm-muted": "#a09a90",
        amber: "#d4a574",
        "amber-dim": "#b8906a",
      },
      fontFamily: {
        display: ['"Plus Jakarta Sans"', "system-ui", "sans-serif"],
        body: ['"Plus Jakarta Sans"', "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
