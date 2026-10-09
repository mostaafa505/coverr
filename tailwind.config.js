/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        brand: {
          50: "#f0f9ff",
          100: "#e0f2fe",
          500: "#0284c7",
          600: "#0369a1",
          700: "#075985",
        },
        print: {
          cyan: "#00a8e8",
          magenta: "#ec008c",
          yellow: "#ffea00",
          key: "#212529",
          bleed: "#ef4444",
          safe: "#10b981",
          cut: "#f59e0b",
        }
      },
      fontFamily: {
        cairo: ["var(--font-cairo)", "sans-serif"],
        tajawal: ["var(--font-tajawal)", "sans-serif"],
      }
    },
  },
  plugins: [],
};
