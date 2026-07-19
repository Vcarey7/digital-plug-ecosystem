export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0b0a0d",
        charcoal: "#17151a",
        panel: "#1e1b22",
        ivory: "#f6f1e7",
        parchment: "#ece4d3",
        crimson: "#8f1d2c",
        scarlet: "#d1263f",
        wine: "#5c1a2b",
      },
      fontFamily: {
        display: ['"Playfair Display"', "serif"],
        body: ['"Inter"', "sans-serif"],
      },
      letterSpacing: {
        widest2: "0.28em",
      },
    },
  },
  plugins: [],
};
