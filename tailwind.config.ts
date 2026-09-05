import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#0b1f3a',
          900: '#0e2440',
          800: '#122a4d',
          700: '#1c3358'
        },
        brand: {
          blue: '#2563eb',
          blueLight: '#3b82f6',
          bluePale: '#eaf1ff'
        },
        surface: {
          DEFAULT: '#ffffff',
          muted: '#f4f6f9',
          border: '#e4e9f0'
        },
        status: {
          success: '#16a34a',
          successBg: '#eaf7ee',
          warning: '#ea580c',
          warningBg: '#fef1e6',
          caution: '#ca8a04',
          cautionBg: '#fdf7e2',
          critical: '#dc2626',
          criticalBg: '#fdecec'
        }
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Inter', 'Helvetica', 'Arial', 'sans-serif']
      },
      borderRadius: {
        card: '14px'
      },
      boxShadow: {
        card: '0 4px 18px rgba(11,31,58,0.08)',
        cardLg: '0 12px 40px rgba(11,31,58,0.18)'
      }
    }
  },
  plugins: []
};

export default config;
