# TaxBuddy — Design System

Derived from the live app tokens in `app/globals.css`. Keep this in sync with that file — it is the source of truth for the running product.

## 1. Brand

- **Product:** TaxBuddy — self-prep U.S. tax filing for international students / nonresident aliens.
- **Personality:** Clean, modern, trustworthy, warm (not corporate). Money + safety cues.
- **Audience:** University & community-college international students (first 5 years, nonresident), incl. OPT year 1. B2C.

## 2. Color Palette

| Role | Name | Hex | Usage |
|------|------|-----|-------|
| Background | Warm Cream | `#FAFAF8` | Page background |
| Foreground | Ink Navy | `#1A1A2E` | Headlines, body text |
| Primary | Deep Green | `#1F5C4D` | CTAs, links, highlights (trust + money) |
| Primary text | White | `#FFFFFF` | Text on primary buttons/bands |
| Surface / Card | Pure White | `#FFFFFF` | Cards, panels |
| Accent (positive) BG | Mint | `#E8F5E9` | "money found" / success badges |
| Accent (positive) text | Forest Green | `#2E7D32` | Text on mint badges, success states |
| Secondary text | Muted Slate | `#6B7280` | Subtext, captions |
| Border | Warm Light Gray | `#E7E5E0` | Hairline borders, dividers |

Dark mode exists in the app (deep navy `#13182E` bg, brighter green primary) but the **landing page is light-theme only** unless specified.

## 3. Typography

- **Font:** Clean geometric sans-serif (app uses Geist / system sans via `--font-sans`).
- **Headlines:** Bold, tight leading, large hero scale.
- **Body:** Regular weight, comfortable line-height.
- **Numbers:** tabular-nums for any figures/pricing.

## 4. Shape & Elevation

- **Base radius:** `0.75rem` (12px). Buttons ~10px, cards ~14px, pills fully rounded.
- **Shadows:** Soft, low-opacity elevation only. No harsh drop shadows.
- **Borders:** Hairline `#E7E5E0`.

## 5. Motion

- Subtle fade-and-rise on scroll.
- Understated micro-animations; smooth, never bouncy or loud.
- Step-flow / upload animations are welcome as the centerpiece but stay clean.

## 6. Design System Notes for Stitch Generation (copy this block into every baton)

**DESIGN SYSTEM (REQUIRED):**
- Platform: Web, desktop-first, fully responsive to mobile
- Theme: Light, minimal, editorial SaaS
- Background: Warm Cream (#FAFAF8) for page background
- Surface / Cards: Pure White (#FFFFFF), gently rounded (12px), soft low-opacity shadow
- Primary Accent: Deep Green (#1F5C4D) for CTAs, links, key highlights — signals trust & money
- Primary CTA text: White (#FFFFFF)
- Text Primary: Ink Navy (#1A1A2E) for headlines and body
- Text Secondary: Muted Slate Gray (#6B7280) for subtext and captions
- Positive / "money-found" Accent: Mint background (#E8F5E9) with Forest Green (#2E7D32) text for badges and success states
- Borders: Warm Light Gray (#E7E5E0), hairline weight
- Corner radius: 12px base (buttons ~10px, cards ~14px, pills fully rounded)
- Typography: Clean geometric sans-serif; large bold headlines (tight leading), regular-weight body
- Buttons: Solid Deep Green primary + outline/ghost secondary
- Motion: Subtle fade-and-rise on scroll; smooth, understated micro-animations
