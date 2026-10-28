export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  // Hover styles only apply on devices that can hover, so taps on phones don't leave cards "stuck".
  future: { hoverOnlyWhenSupported: true },
  theme: {
    extend: {
      colors: {
        ink: '#26282B', paper: '#F6F4EF', forest: '#2F4A3A', olive: '#6B7A55', line: '#E3DFD6', muted: '#6C6F72',
        night: '#141815', sand: '#ECE7DD', brass: '#A8834F',
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
        serif: ['"Instrument Serif"', 'Georgia', 'serif'],
        sans: ['"Instrument Sans"', 'system-ui', 'sans-serif'],
      },
      transitionTimingFunction: { out: 'cubic-bezier(0.23, 1, 0.32, 1)', 'in-out-strong': 'cubic-bezier(0.77, 0, 0.175, 1)' },
    },
  },
  plugins: [],
};
