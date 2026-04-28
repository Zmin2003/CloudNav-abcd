/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#3b82f6',
        'primary-hover': '#2563eb',
        'primary-active': '#1d4ed8',
        secondary: '#64748b',
        dark: '#0f172a',
        card: '#1e293b',
        'flat-bg': '#f9fafb',
        'flat-bg-dark': '#111827',
        'flat-border': '#e5e7eb',
        'flat-border-dark': '#374151',
      },
      spacing: {
        '4.5': '1.125rem',
      },
      borderRadius: {
        'flat': '0.75rem',
        'flat-lg': '1rem',
        'flat-xl': '1.25rem',
      },
      boxShadow: {
        'flat': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        'flat-md': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'flat-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      },
      animation: {
        'fade-in': 'fadeIn 0.25s ease-out',
        'fade-up': 'fadeUp 0.4s cubic-bezier(0.22, 1, 0.36, 1)',
        'scale-in': 'scaleIn 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
        'slide-down': 'slideDown 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
      },
      keyframes: {
        fadeIn: {
          'from': { opacity: '0' },
          'to': { opacity: '1' },
        },
        fadeUp: {
          'from': { opacity: '0', transform: 'translateY(12px)' },
          'to': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          'from': { opacity: '0', transform: 'scale(0.95)' },
          'to': { opacity: '1', transform: 'scale(1)' },
        },
        slideDown: {
          'from': { opacity: '0', transform: 'translateY(-8px)' },
          'to': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
