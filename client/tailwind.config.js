/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'aura-breathe': 'aura-breathe 4s ease-in-out infinite',
        'aura-speak': 'aura-speak 1.5s ease-in-out infinite',
        'aura-listen': 'aura-listen 2s ease-in-out infinite',
        'aura-think': 'aura-think 2s linear infinite',
        'gradient-sweep': 'gradient-sweep 3s linear infinite',
        'shimmer': 'shimmer 1.5s linear infinite',
        'radio-wave': 'radio-wave 1.5s ease-out infinite',
        'card-enter': 'card-enter 0.4s ease-out forwards',
        'bubble-enter': 'bubble-enter 0.3s ease-out forwards',
        'overlay-slide-in': 'overlay-slide-in 0.5s ease-out forwards',
        'overlay-fade-out': 'overlay-fade-out 0.5s ease-in forwards',
        'checkmark-draw': 'checkmark-draw 0.4s ease-out forwards',
        'particle-drift': 'particle-drift 8s linear infinite',
        'typewriter': 'typewriter 0.05s steps(1) forwards',
        'step-complete': 'step-complete 0.3s ease-out forwards',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(59, 130, 246, 0.5)' },
          '100%': { boxShadow: '0 0 20px rgba(59, 130, 246, 0.8), 0 0 40px rgba(59, 130, 246, 0.3)' },
        },
        'aura-breathe': {
          '0%, 100%': { opacity: '0.4', transform: 'scale(1)' },
          '50%': { opacity: '0.7', transform: 'scale(1.02)' },
        },
        'aura-speak': {
          '0%, 100%': { opacity: '0.6', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.03)' },
        },
        'aura-listen': {
          '0%, 100%': { opacity: '0.5', transform: 'scale(1)' },
          '50%': { opacity: '0.9', transform: 'scale(1.02)' },
        },
        'aura-think': {
          '0%': { '--aura-angle': '0deg' },
          '100%': { '--aura-angle': '360deg' },
        },
        'gradient-sweep': {
          '0%': { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        'radio-wave': {
          '0%': { transform: 'scale(0.5)', opacity: '1' },
          '100%': { transform: 'scale(2)', opacity: '0' },
        },
        'card-enter': {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'bubble-enter': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'overlay-slide-in': {
          '0%': { opacity: '0', transform: 'translateX(-30px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'overlay-fade-out': {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        'checkmark-draw': {
          '0%': { strokeDashoffset: '20' },
          '100%': { strokeDashoffset: '0' },
        },
        'particle-drift': {
          '0%': { transform: 'translateY(100%) translateX(0)', opacity: '0' },
          '10%': { opacity: '0.6' },
          '90%': { opacity: '0.6' },
          '100%': { transform: 'translateY(-10%) translateX(20px)', opacity: '0' },
        },
        'step-complete': {
          '0%': { transform: 'scale(1.3)', opacity: '0.5' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
