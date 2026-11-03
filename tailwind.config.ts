import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        sumi: {
          950: "#0b0a08",
          900: "#1a1612",
          800: "#2a241e",
          700: "#3b332a",
          600: "#4a4038",
          500: "#6b5d50",
          400: "#8a7a6a",
          300: "#b8a893",
          200: "#d9ccb8",
          100: "#ece2d1",
          50: "#f6efe2",
        },
        washi: {
          DEFAULT: "#f6efe2",
          dark: "#ece2d1",
          deep: "#dfd3bc",
        },
        beni: "#a0352c",
        kincha: "#b7892a",
        matcha: "#5e7a3e",
        ai: "#345672",
        lane: {
          refuse: "#8a3a30",
          risk: "#b7892a",
          wait: "#6b5d50",
          ok: "#5e7a3e",
        },
      },
      fontFamily: {
        fude: ["var(--font-fude)", "serif"],
        mincho: ["var(--font-mincho)", "serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(26, 22, 18, 0.08), 0 8px 24px rgba(26, 22, 18, 0.06)",
      },
      transitionTimingFunction: {
        soft: "cubic-bezier(0.22, 1, 0.36, 1)",
        move: "cubic-bezier(0.65, 0, 0.35, 1)",
      },
    },
  },
  plugins: [],
};
export default config;
