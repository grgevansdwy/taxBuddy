# TaxBuddy — Site Vision & Roadmap

## 1. Vision

A clean, modern B2C marketing site for **TaxBuddy** — self-prep U.S. tax filing built for international students. Core promise: *file your 1040-NR in under 10 minutes by uploading documents — no manual data entry, no $50 filing fees.* Emphasize the pain of having no tax support as an international student, the speed, the money reclaimed (refunds), and data privacy/encryption.

## 2. Stitch Project

- **Project ID:** `7818467508193013014` (`projects/7818467508193013014`)
- **Design System asset:** `assets/bc3f6144800f4033861446b28c938c3e`
- **Device:** DESKTOP
- **Theme source:** `.stitch/DESIGN.md` (mirrors `app/globals.css`)
- **NOTE — generation must be driven via curl, not the MCP client.** Claude Code's MCP HTTP client aborts requests before Stitch's multi-minute generation finishes (and the abort cancels the server-side job). Call `generate_screen_from_text` / `edit_screens` by POSTing JSON-RPC to `https://stitch.googleapis.com/mcp` with `--max-time 420`. See `.stitch/metadata.json` `_notes`.

## 3. Voice

Short, punchy, reassuring. Minimal text. Speak directly to a stressed international student. No jargon.

## 4. Sitemap

- [x] `index` — landing page (hero, pain points, how-it-works, video demo, features, security, backstory, FAQ, CTA, footer). Staged at `site/public/index.html`. Stitch screen `7e9dea05eed549de9252386588c0bee1`.

## 5. Roadmap (backlog)

- Pricing page (positioned near USPS-paper cost; contrast vs Glacier ~$49 / Sprintax ~$55 / CPA $300+) — **queued as the active baton in `next-prompt.md`**
- Security & Privacy deep-dive page
- About / founders story page
- FAQ standalone page
- Blog / resource hub for international-student tax topics

## 6. Creative Freedom (idea pool)

- "Am I eligible?" interactive checker (visa status, country, years in US)
- Refund-estimator teaser
- Testimonials / campus ambassador section
- Supported forms explainer (1040-NR, Schedule NEC/OI/A, 8843, 8833)
