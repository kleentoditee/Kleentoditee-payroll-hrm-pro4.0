import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#0f3a46", soft: "#1f6b73" },
        accent: "#d7a74d"
      }
    }
  },
  plugins: []
} satisfies Config;
