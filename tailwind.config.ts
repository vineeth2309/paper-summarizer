import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#111111",
        panel: "#191919",
        panelSoft: "#202020",
        line: "#2d2d2d",
        mist: "#a8a8a8",
        glow: "#ece5da",
        ember: "#cf7843"
      },
      boxShadow: {
        halo: "0 0 0 1px rgba(255,255,255,0.06), 0 24px 80px rgba(0,0,0,0.35)"
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "sans-serif"
        ]
      },
      backgroundImage: {
        grain: "radial-gradient(circle at top, rgba(255,255,255,0.08), transparent 35%), linear-gradient(180deg, #1a1a1a 0%, #111111 100%)"
      }
    }
  },
  plugins: []
};

export default config;
