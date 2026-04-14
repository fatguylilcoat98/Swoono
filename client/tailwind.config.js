/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // All tokens resolve to CSS variables set by the active theme class
        // on <html> (.theme-neutral / .theme-guy / .theme-girl). Using the
        // <alpha-value> placeholder keeps Tailwind's opacity modifiers working
        // (e.g. bg-swoono-accent/20).
        swoono: {
          bg: "rgb(var(--swoono-bg) / <alpha-value>)",
          bg2: "rgb(var(--swoono-bg2) / <alpha-value>)",
          ink: "rgb(var(--swoono-ink) / <alpha-value>)",
          dim: "rgb(var(--swoono-dim) / <alpha-value>)",
          accent: "rgb(var(--swoono-accent) / <alpha-value>)",
          accent2: "rgb(var(--swoono-accent2) / <alpha-value>)",
          glow: "rgb(var(--swoono-glow) / <alpha-value>)",
        },
      },
      fontFamily: {
        display: ['"Playfair Display"', "Georgia", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 40px rgb(var(--swoono-accent) / 0.35), 0 0 80px rgb(var(--swoono-accent2) / 0.25)",
        note: "0 10px 30px -10px rgb(0 0 0 / 0.5), 0 2px 8px rgb(0 0 0 / 0.35)",
        glass:
          "inset 0 1px 0 rgb(255 255 255 / 0.08), 0 10px 40px rgb(0 0 0 / 0.35)",
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
};
