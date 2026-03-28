import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0a0a0a",
        card: "#121212",
        border: "#3d1515",
        "blood": "#8B0000",
        "blood-light": "#a61a1a",
        "blood-bright": "#b22222",
        input: "#0f0a0a",
        muted: "rgba(255,255,255,0.84)",
      },
      fontFamily: {
        display: ["var(--font-cinzel)", "Georgia", "serif"],
        body: [
          "var(--font-body-sans)",
          "ui-sans-serif",
          "system-ui",
          "Segoe UI",
          "sans-serif",
        ],
      },
      fontSize: {
        /** Slightly larger than default Tailwind for long reading */
        readable: ["1.125rem", { lineHeight: "1.7" }],
      },
      animation: {
        spin: "spin 0.8s linear infinite",
        "flicker": "flicker 3s ease-in-out infinite",
        "float": "float 6s ease-in-out infinite",
      },
      keyframes: {
        flicker: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.92" },
          "52%": { opacity: "1" },
          "54%": { opacity: "0.97" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
