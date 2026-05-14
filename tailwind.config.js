/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0a0a0a',
        'bg-2': '#111111',
        'bg-3': '#181818',
        fg: '#f5f5f0',
        dim: '#9a9a92',
        dimmer: '#555555',
        line: '#1f1f1f',
        'line-2': '#2a2a2a',
        citron: '#d4e85e',
        good: '#6ee08a',
        warn: '#f0c46e',
        danger: '#ff5544',
      },
      fontFamily: {
        serif: ['Fraunces', 'serif'],
        sans: ['"Inter Tight"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        lift: '0 12px 32px rgba(255,255,255,0.12)',
      },
    },
  },
  plugins: [],
};
