// Bodi.az — Serene Childhood design tokens (from DESIGN.md / Stitch source)
// Loaded right after the Tailwind CDN script.
tailwind.config = {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "surface-tint": "#516350",
        "surface-dim": "#dddad4",
        "on-primary-fixed": "#0f1f10",
        "secondary-fixed-dim": "#fcb69f",
        "surface": "#fdf9f3",
        "primary": "#4f614e",
        "on-primary-container": "#f7fff2",
        "on-error-container": "#93000a",
        "surface-container-lowest": "#ffffff",
        "inverse-on-surface": "#f4f0ea",
        "on-surface": "#1c1c18",
        "error": "#ba1a1a",
        "on-tertiary-fixed-variant": "#474743",
        "secondary-fixed": "#ffdbcf",
        "outline-variant": "#c4c8c0",
        "on-secondary": "#ffffff",
        "tertiary-container": "#767471",
        "inverse-surface": "#31302d",
        "surface-container": "#f1ede7",
        "inverse-primary": "#b8ccb5",
        "tertiary": "#5d5c58",
        "on-primary-fixed-variant": "#3a4b39",
        "primary-fixed": "#d4e8d0",
        "secondary-container": "#ffb9a2",
        "on-secondary-fixed-variant": "#6a3a29",
        "primary-container": "#677965",
        "surface-container-highest": "#e6e2dc",
        "background": "#fdf9f3",
        "primary-fixed-dim": "#b8ccb5",
        "outline": "#747871",
        "on-surface-variant": "#434842",
        "surface-container-low": "#f7f3ed",
        "on-background": "#1c1c18",
        "on-primary": "#ffffff",
        "secondary": "#86503e",
        "on-tertiary-container": "#fcffe3",
        "on-tertiary-fixed": "#1c1c19",
        "tertiary-fixed": "#e5e2dd",
        "on-error": "#ffffff",
        "tertiary-fixed-dim": "#c9c6c2",
        "on-secondary-container": "#7a4735",
        "on-secondary-fixed": "#351004",
        "surface-container-high": "#ebe8e2",
        "surface-variant": "#e6e2dc",
        "surface-bright": "#fdf9f3",
        "on-tertiary": "#ffffff",
        "error-container": "#ffdad6"
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        lg: "0.5rem",
        xl: "0.75rem",
        "2xl": "1rem",
        "3xl": "1.5rem",
        full: "9999px"
      },
      spacing: {
        xs: "4px",
        sm: "12px",
        md: "24px",
        lg: "48px",
        xl: "80px",
        gutter: "24px",
        base: "8px",
        "container-max": "1280px"
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "sans-serif"],
        body: ['"Plus Jakarta Sans"', "sans-serif"]
      },
      fontSize: {
        "body-md": ["16px", { lineHeight: "24px", fontWeight: "400" }],
        "label-md": ["14px", { lineHeight: "16px", letterSpacing: "0.02em", fontWeight: "600" }],
        "body-sm": ["14px", { lineHeight: "20px", fontWeight: "400" }],
        "headline-md": ["24px", { lineHeight: "32px", fontWeight: "600" }],
        "headline-sm": ["20px", { lineHeight: "28px", fontWeight: "600" }],
        "body-lg": ["18px", { lineHeight: "28px", fontWeight: "400" }],
        "label-sm": ["12px", { lineHeight: "14px", letterSpacing: "0.04em", fontWeight: "600" }],
        "display-lg": ["48px", { lineHeight: "56px", letterSpacing: "-0.02em", fontWeight: "700" }],
        "display-lg-mobile": ["32px", { lineHeight: "40px", letterSpacing: "-0.01em", fontWeight: "700" }]
      },
      boxShadow: {
        ambient: "0px 10px 30px rgba(62, 61, 57, 0.05)",
        "ambient-md": "0px 14px 40px rgba(62, 61, 57, 0.08)"
      }
    }
  }
};
