# External Work & Design Acknowledgements

This document tracks third-party resources, design inspirations, code snippets, frameworks, and assets used in Brain-Wiz to ensure proper accountability and express gratitude to the open-source community and original creators.

## 1. Design & UI Inspiration

- **Animated Gradient Background:**
  - **Source:** [gradients-bg](https://github.com/baunov/gradients-bg)
  - **Usage:** We adapted the liquid SVG filter (`#goo`) and CSS radial gradients with `mix-blend-mode: hard-light` to create the premium floating orb background in our welcome screen (`WelcomeScreen.tsx`, `gradients.css`).
- **Apple-Style Liquid Glass UI:**
  - **Inspiration:** Apple VisionOS / Apple Material Guidelines
  - **Usage:** The translucent interactive elements (in `glass.css` and `.hero-btn`) mimic the Apple liquid glass aesthetic using high saturation CSS backdrop filters (`blur(24px) saturate(180%)`), inner box-shadow highlights, and pseudo-element specular reflections.
- **Typography:**
  - **Source:** [Google Fonts](https://fonts.google.com/)
  - **Usage:** **Space Grotesk** is used for modern, quirky geometric standard text, while **Outfit** is utilized for bold, impactful headings and primary game branding.

## 2. Core Frameworks & Toolstacks

Brain-Wiz stands on the shoulders of modern web development frameworks:

- **Node.js & TypeScript:** The underlying runtime and strictly-typed language bridging both client and server development.
- **NestJS:** The progressive server-side framework managing our backend logic, WebSocket gateways, and API routes.
- **React (v19):** The foundational UI library powering the player clients and the host display screens.
- **Vite:** The lightning-fast frontend tooling and bundler for React.
- **TypeORM:** Our Object-Relational Mapper, streamlining interactions with PostgreSQL.

## 3. Notable Node Modules

Key functional pieces of the application rely on the following specialized packages:

- **`ws` (WebSockets):** Enabling real-time, low-latency, bidirectional communication between the server and player phones.
- **`qrcode`:** Used to dynamically generate joining QR codes for the host screen to ensure frictionless player onboarding.
- **`use-sound`:** A React Hook wrapping Howler.js used for playing all SFX interactions, game timers, and reward sounds in the host and client applications.
- **`an-array-of-english-words`:** A lightweight dictionary dependency utilized within the Minigames logic (like Woordle) to validate english words.
- **`class-validator` & `class-transformer`:** Employed for strict runtime validation of DTOs and incoming WebSocket payloads.

## 4. Infrastructure & DevOps

Our robust production and local deployment strategy is powered by:

- **Docker & Docker Compose:** Containerization, environment isolation, and deployment orchestration.
- **Nginx (`nginxinc/nginx-unprivileged`):** Acting as a highly secure, unprivileged reverse proxy and static asset server.
- **PostgreSQL:** The primary relational database backing the system.
- **pgAdmin (`dpage/pgadmin4`):** Database management tooling interface.
- **Grafana Stack (Loki, Promtail, Grafana):** Employed for deep observability, log aggregation, and real-time metric dashboards.

## 5. Game Assets (Audio & Visuals)

- **Sound Effects (SFX):** Audio cues (including `start-game.wav`, `reveal.mp3`, `correct.mp3`, `wrong.mp3`, `vault-rush.mp3`, `synthwave.mp3`) found in `src/shared/SFX/` are sourced from royalty-free libraries or synthesized specifically for the Brain-Wiz experience.
- **Icons & Images:** Category illustrations (e.g., `science.png`, `art.png`, `gaming.png`) and Minigame icons located in `assets/images/` provide the core visual vocabulary of our UI.
