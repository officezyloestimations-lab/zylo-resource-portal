import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef4ff",
          100: "#d9e6ff",
          200: "#b3cbff",
          300: "#80a8ff",
          400: "#4d7fff",
          500: "#2557f2",
          600: "#1a41c9",
          700: "#17359e",
          800: "#152c7d",
          900: "#132568",
        },
      },
    },
  },
  plugins: [],
};

export default config;
