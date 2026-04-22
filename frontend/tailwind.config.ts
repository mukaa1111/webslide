import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#0066FF",
        "primary-hover": "#005EEB",
      },
      fontFamily: {
        sans: ["Pretendard", "var(--font-sans)", "system-ui", "sans-serif"],
        display: ["'Wanted Sans'", "var(--font-display)", "sans-serif"],
        mono: ["'SF Mono'", "JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
