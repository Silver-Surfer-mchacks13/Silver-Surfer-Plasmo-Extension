/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{tsx,html}"],

  // IMPORTANT: you toggle dark mode manually in React
  darkMode: "class",

  theme: {
    extend: {
      colors: {
        primary: "#3b82f6",
        "comic-yellow": "#facc15",
        "comic-red": "#ef4444",
        "comic-bg": "#ffffff",
        ink: "#000000",

        "kirby-blue": "#7dd3fc",
        "cosmic-blue": "#2563eb"
      },
      fontFamily: {
        display: ["Bangers", "cursive"],
        body: ["Comic Neue", "Roboto", "sans-serif"]
      },
      boxShadow: {
        comic: "4px 4px 0px 0px #000000",
        "comic-hover": "2px 2px 0px 0px #000000",
        "comic-lg": "8px 8px 0px 0px #000000",
        "comic-inner": "inset 2px 2px 4px rgba(0,0,0,0.1)",
        "glow-blue": "0 0 15px 2px rgba(37, 99, 235, 0.4)",
        "glow-red": "0 0 20px 5px rgba(239, 68, 68, 0.5)"
      },
      backgroundImage: {
        "halftone-light": "radial-gradient(#cbd5e1 2px, transparent 2.5px)",
        "halftone-dark": "radial-gradient(#334155 2px, transparent 2.5px)"
      }
    }
  },

  plugins: [require("@tailwindcss/forms"), require("@tailwindcss/container-queries")]
}