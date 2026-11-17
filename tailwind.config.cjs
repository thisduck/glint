module.exports = {
  content: ["./src/**/*.{tsx,html}"],
  theme: {
    extend: {
      colors: Object.fromEntries(
        [
          "paper",
          "rail",
          "ink",
          "muted",
          "line",
          "accent",
          "tint",
          "glass",
          "deep",
          "shine",
        ].map((name) => [name, "var(--" + name + ")"]),
      ),
      fontFamily: { display: ["var(--display)"], sans: ["var(--body)"] },
    },
  },
};
