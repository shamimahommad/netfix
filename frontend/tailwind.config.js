/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Primary (Blue 600)
        primary: {
          DEFAULT: '#2563EB',
          hover: '#1D4ED8',
          soft: '#DBEAFE',
        },
        // Status Colors
        success: '#16A34A',
        warning: '#F59E0B',
        error: '#DC2626',
        info: '#0EA5E9',
        // Semantic colors (light mode defaults, dark mode via CSS)
        background: '#F8FAFC',
        card: '#FFFFFF',
        border: '#E5E7EB',
        'text-primary': '#0F172A',
        'text-secondary': '#475569',
        'text-muted': '#94A3B8',
      },
      borderRadius: {
        card: '0.75rem', // rounded-xl
        modal: '1rem', // rounded-2xl
        button: '0.5rem', // rounded-lg
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
      },
      transitionProperty: {
        'colors-transform': 'color, background-color, border-color, transform',
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'fade-in-up': 'fadeInUp 0.5s ease-out',
        'slide-in-left': 'slideInLeft 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInLeft: {
          '0%': { opacity: '0', transform: 'translateX(-8px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
}
