# Landing Architecture (landing)

The Landing application is a Next.js public-facing website optimized for SEO and user registration.

---

## 1. Functional Overview

- **Routing:**
  - `login/` & `register/`: Onboarding workflows for fleet owners and drivers.
  - `how-it-works/`: Product informational page.
  - `contact/`: Lead capture page.
- **Styling:**
  - Built with Tailwind CSS v4 and daisyUI theme elements.
- **SSO Login:**
  - Proxies requests to `/auth/login` on the NestJS backend and sets wildcard cookie authentication.
