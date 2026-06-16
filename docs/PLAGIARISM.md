# External Work & Design Acknowledgements

This document tracks third-party resources, design inspirations, and code snippets used in Brain-Wiz to ensure proper accountability.

## 1. Animated Gradient Background

- **Source:** [gradients-bg](https://github.com/baunov/gradients-bg)
- **Usage:** We adapted the liquid SVG filter (`#goo`) and CSS radial gradients with `mix-blend-mode: hard-light` to create the premium floating orb background in our welcome screen (`WelcomeScreen.tsx`, `gradients.css`).

## 2. Apple-Style Liquid Glass UI

- **Inspiration:** Apple VisionOS / Apple Material Guidelines
- **Usage:** The translucent interactive elements (in `glass.css` and `.hero-btn`) mimic the Apple liquid glass aesthetic using high saturation CSS backdrop filters (`blur(24px) saturate(180%)`), inner box-shadow highlights, and pseudo-element specular reflections.
