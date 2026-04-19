/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0a0a0a',
        card: '#1a1a1a',
        border: '#333333',
        primary: '#0066ff',
        success: '#00ff88',
        warning: '#ffaa00',
        danger: '#ff4444',
        'text-primary': '#e0e0e0',
        'text-secondary': '#999999',
      },
      fontFamily: {
        mono: ['Monaco', 'Menlo', 'monospace'],
      },
      maxWidth: {
        content: '1600px',
      },
    },
  },
  plugins: [],
};
