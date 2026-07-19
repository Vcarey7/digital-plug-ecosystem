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
        champagne: "#cda86a",
        gold: "#d9b45b",
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
