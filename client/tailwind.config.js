/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        teal: {
          primary: '#1A6B5C',
          light: '#22876E',
          dark: '#145548',
        },
        charcoal: '#2D2D2D',
        amber: {
          accent: '#F5A623',
          light: '#F7B84B',
          dark: '#D4901F',
        },
        success: '#34C759',
        warning: '#E07A5F',
        bg: {
          light: '#F7F5F0',
          dark: '#121212',
        },
        card: {
          light: '#FFFFFF',
          dark: '#1E1E1E',
        },
      },
      fontFamily: {
        heading: ['"Plus Jakarta Sans"', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['"Space Grotesk"', 'sans-serif'],
      },
      animation: {
        'score-fill': 'scoreFill 1.5s ease-out forwards',
        'fade-up': 'fadeUp 0.5s ease-out forwards',
        'slide-in': 'slideIn 0.4s ease-out forwards',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
      },
      keyframes: {
        scoreFill: {
          '0%': { strokeDashoffset: '339.29' },
          '100%': { strokeDashoffset: 'var(--score-offset)' },
        },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          '0%': { opacity: '0', transform: 'translateX(-20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(26, 107, 92, 0.4)' },
          '50%': { boxShadow: '0 0 0 12px rgba(26, 107, 92, 0)' },
        },
      },
    },
  },
  plugins: [],
}
