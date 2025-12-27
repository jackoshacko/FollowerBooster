/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0a0a0a",
        panel: "#111111",
        panel2: "#161616",
        border: "#27272a",
        accent: "#22c55e",
        danger: "#ef4444",
        warning: "#f59e0b",
      },
    },
  },
  plugins: [],
};
