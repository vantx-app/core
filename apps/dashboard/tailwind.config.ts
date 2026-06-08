import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}", // Si tienes esta carpeta
  ],
  theme: {
    extend: {},
  },
  // plugins: [require('daisyui')],
};
export default config;
