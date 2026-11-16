/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // Readability floor for older users: with the 18px root, xs = 16.2px and
      // sm = 16.9px, so the ~690 existing text-xs / text-sm uses grow without edits.
      // Large sizes get line-height 1.2 (Tailwind's 4xl-6xl default is 1.0-1.11).
      fontSize: {
        xs: ["0.9rem", { lineHeight: "1.5" }],
        sm: ["0.9375rem", { lineHeight: "1.5" }],
        "4xl": ["2.25rem", { lineHeight: "1.2" }],
        "5xl": ["3rem", { lineHeight: "1.2" }],
        "6xl": ["3.75rem", { lineHeight: "1.2" }],
      },
      colors: {
        help: {
          DEFAULT: "hsl(var(--help) / <alpha-value>)",
          foreground: "hsl(var(--help-foreground) / <alpha-value>)",
          border: "hsl(var(--help-border) / <alpha-value>)",
        },
        bar: {
          DEFAULT: "hsl(var(--bar) / <alpha-value>)",
          foreground: "hsl(var(--bar-foreground) / <alpha-value>)",
          subtle: "hsl(var(--bar-subtle) / <alpha-value>)",
        },
        tile: "hsl(var(--tile) / <alpha-value>)",
        icon: {
          main: "hsl(var(--icon-main) / <alpha-value>)",
          accent: "hsl(var(--icon-accent) / <alpha-value>)",
        },
        cta: {
          DEFAULT: "hsl(var(--cta) / <alpha-value>)",
          foreground: "hsl(var(--cta-foreground) / <alpha-value>)",
          border: "hsl(var(--cta-border) / <alpha-value>)",
        },
        count: {
          DEFAULT: "hsl(var(--count) / <alpha-value>)",
          foreground: "hsl(var(--count-foreground) / <alpha-value>)",
        },
        success: {
          DEFAULT: "hsl(var(--success) / <alpha-value>)",
          foreground: "hsl(var(--success-foreground) / <alpha-value>)",
          soft: "hsl(var(--success-soft) / <alpha-value>)",
        },
        warning: {
          DEFAULT: "hsl(var(--warning) / <alpha-value>)",
          foreground: "hsl(var(--warning-foreground) / <alpha-value>)",
          soft: "hsl(var(--warning-soft) / <alpha-value>)",
        },
        "danger-soft": "hsl(var(--danger-soft) / <alpha-value>)",
        chart: {
          1: "hsl(var(--chart-1) / <alpha-value>)",
          2: "hsl(var(--chart-2) / <alpha-value>)",
          3: "hsl(var(--chart-3) / <alpha-value>)",
          4: "hsl(var(--chart-4) / <alpha-value>)",
          5: "hsl(var(--chart-5) / <alpha-value>)",
          6: "hsl(var(--chart-6) / <alpha-value>)",
          7: "hsl(var(--chart-7) / <alpha-value>)",
          grid: "hsl(var(--chart-grid) / <alpha-value>)",
        },
        border: "hsl(var(--border) / <alpha-value>)",
        input: "hsl(var(--input) / <alpha-value>)",
        ring: {
          DEFAULT: "hsl(var(--ring) / <alpha-value>)",
          inner: "hsl(var(--ring-inner) / <alpha-value>)",
        },
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        primary: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary) / <alpha-value>)",
          foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "hsl(var(--accent) / <alpha-value>)",
          foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "hsl(var(--popover) / <alpha-value>)",
          foreground: "hsl(var(--popover-foreground) / <alpha-value>)",
        },
        card: {
          DEFAULT: "hsl(var(--card) / <alpha-value>)",
          foreground: "hsl(var(--card-foreground) / <alpha-value>)",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background) / <alpha-value>)",
          foreground: "hsl(var(--sidebar-foreground) / <alpha-value>)",
          primary: "hsl(var(--sidebar-primary) / <alpha-value>)",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground) / <alpha-value>)",
          accent: "hsl(var(--sidebar-accent) / <alpha-value>)",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground) / <alpha-value>)",
          border: "hsl(var(--sidebar-border) / <alpha-value>)",
          ring: "hsl(var(--sidebar-ring) / <alpha-value>)",
        },
      },
      // 6px controls, 8px panels; the large sizes are 8px so no page keeps a
      // large radius (fixed px, so they do not grow with the text size).
      borderRadius: {
        "3xl": "8px",
        "2xl": "8px",
        xl: "8px",
        lg: "8px",
        md: "6px",
        sm: "4px",
        xs: "2px",
      },
      boxShadow: {
        xs: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "caret-blink": {
          "0%,70%,100%": { opacity: "1" },
          "20%,50%": { opacity: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "caret-blink": "caret-blink 1.25s ease-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}