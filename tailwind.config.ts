import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        hemote: {
          red: "#C8102E",
          dark: "#1a1a2e",
          card: "#16213e",
          border: "#0f3460",
        },
      },
    },
  },
  plugins: [],
};

export default config;
