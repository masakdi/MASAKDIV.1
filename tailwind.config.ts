import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",   // ✅ เพิ่มบรรทัดนี้
  ],
  theme: {
    extend: {}, // จะเพิ่ม custom theme ทีหลังได้
  },
  plugins: [],
};

export default config;
