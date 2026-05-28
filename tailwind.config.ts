import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "#0A1628",
          deep: "#06101F",
        },
        emerald: {
          accent: "#10B981",
          accentHover: "#0EA372",
          tint: "#F0FDF4",
        },
        soft: "#F8FAFC",
      },
      fontFamily: {
        sans: [
          "Inter",
          "Poppins",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 20px 50px -20px rgba(10, 22, 40, 0.25)",
      },
      keyframes: {
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        fadeInUp: "fadeInUp 0.35s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
