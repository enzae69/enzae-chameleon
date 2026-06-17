/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Baloo 2"', "system-ui", "sans-serif"],
      },
      colors: {
        cham: {
          50: "#effaf0",
          100: "#d8f3da",
          300: "#8fd99a",
          400: "#5cc06e",
          500: "#37a64f",
          600: "#27853d",
          700: "#216a34",
          900: "#0f291c",
        },
      },
      keyframes: {
        pop: { "0%": { transform: "scale(0.9)", opacity: "0" }, "100%": { transform: "scale(1)", opacity: "1" } },
      },
      animation: { pop: "pop 0.18s ease-out" },
    },
  },
  plugins: [],
};
