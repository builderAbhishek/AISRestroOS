/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bhagwa: {
          DEFAULT: '#F07818',
          dark: '#C85A0A',
          light: '#FFF0E3',
        },
        primary: {
          DEFAULT: '#F07818',
          dark: '#C85A0A',
          light: '#FFF0E3',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          subtle: '#FAFAFB',
        },
        bg: {
          DEFAULT: '#F7F8FA',
          elevated: '#FFFFFF',
        },
        border: {
          DEFAULT: '#E8EAF0',
          subtle: '#F0F2F6',
          strong: '#D1D5DB',
        },
        text: {
          primary: '#202124',
          secondary: '#6B7280',
          muted: '#9CA3AF',
        },
        status: {
          success: '#16865B',
          warning: '#D98A16',
          danger: '#D94343',
          info: '#2563EB',
        },
      },
      borderRadius: {
        'card': '14px',
        'btn': '10px',
        'modal': '16px',
      },
      boxShadow: {
        'subtle': '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px 0 rgba(0, 0, 0, 0.03)',
        'card': '0 2px 8px -2px rgba(0, 0, 0, 0.06), 0 1px 4px -1px rgba(0, 0, 0, 0.04)',
        'modal': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        'bhagwa': '0 4px 14px 0 rgba(240, 120, 24, 0.25)',
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Noto Sans Devanagari"',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
}
