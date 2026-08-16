/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        zephyra: {
          bg: "var(--bg-primary, #08090D)",
          accent: "var(--accent, #00C9A7)",
          text: {
            primary: "var(--text-primary, #F0F4FF)",
            secondary: "var(--text-secondary, #C8D8F0)",
            muted: "var(--text-muted, #8BA3CC)",
            veryMuted: "var(--text-very-muted, #4A6382)",
          },
          border: {
            hairline: "var(--border-hairline, #0F1420)",
            surface: "var(--border-surface, #1A2235)",
          }
        }
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      animation: {
        'orb-breathe': 'breathe 8s ease-in-out infinite',
        'fade-in': 'fadeIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      },
      keyframes: {
        breathe: {
          '0%, 100%': { transform: 'scale(1) translate(-50%, -50%)', opacity: 0.15 },
          '50%': { transform: 'scale(1.12) translate(-50%, -50%)', opacity: 0.30 },
        },
        fadeIn: {
          '0%': { opacity: 0, transform: 'translateY(8px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        }
      }
    },
  },
  plugins: [],
}
