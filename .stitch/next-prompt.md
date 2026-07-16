---
page: index
mode: edit
target: public/landing.html
screen: 7e9dea05eed549de9252386588c0bee1
---
Refine the existing TaxBuddy landing page for cohesion and rhythm. This is a targeted polish pass — preserve every section's content, copy, and the scroll-driven "How it works" interaction (the hand-wired pinned scrollytelling in public/landing.html: #howto-stage, the idle auto-advance JS, the upload drag demo, scan line, shimmer). Change only spacing, hierarchy, section framing, and the placement of the "better way" transition.

**GENERATION NOTE:** Do NOT call generate_screen_from_text / edit_screens through the MCP client — it times out and cancels the job. Drive it via curl (see .stitch/metadata.json `_notes`): POST JSON-RPC to https://stitch.googleapis.com/mcp with the X-Goog-Api-Key header and `--max-time 420`. Use projectId 7818467508193013014 and designSystem assets/bc3f6144800f4033861446b28c938c3e. WARNING: Stitch output is static HTML and does NOT contain the hand-wired scroll JS — a full regenerate of the index screen will drop the custom how-it-works interaction. Prefer scoped edit_screens passes, or apply these changes directly to public/landing.html.

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
- Typography: Clean geometric sans-serif (Hanken Grotesk); large bold headlines (tight leading), regular-weight body
- Motion: Subtle fade-and-rise on scroll; smooth, understated micro-animations

**Targeted changes:**

1. **Reposition "There's finally a better way" as a bridge, not a tail.** Pull it out of the bottom of the Problem section and merge the Problem → "How it works" transition into one continuous beat. Make "There's finally a better way." the eyebrow/lead-in that sits directly above the "How it works" headline (as a Deep Green uppercase label or a large connecting line), so the four problem cards resolve into the solution instead of the payoff being stranded above a big gap. Remove the double gap between the two sections — one shared vertical rhythm, not 48px then 80px.

2. **Fix the "How it works" spacing.** Give the intro block ("How it works" + "From documents to a filed return in four steps") symmetric top and bottom breathing room on the same rhythm scale as other sections (~80px top, ~48px before the pinned stage). Inside the pinned split-column: vertically align the left progress rail and the right preview panel to the same baseline (align-start, not one centered against the other), tighten the empty vertical space in the 560px stage so the active step and its preview read as a matched pair, and add clean bottom spacing where the pinned stage releases into the next section so the exit doesn't feel abrupt.

3. **Unify section rhythm across the whole page.** Apply one consistent vertical spacing scale to every top-level section (80px desktop / 48px mobile between sections). Normalize all section headings to the same type token (headline-lg, Deep Green) — including the Problem section heading, which currently drops to headline-md.

4. **Add gentle section framing for cohesion.** The middle of the page is one long undifferentiated cream stretch. Introduce a subtle, repeating rhythm of surface treatment — e.g. alternate select sections (How it works, Features) onto Pure White or a barely-tinted cream surface with hairline top/bottom borders — so sections read as one designed system with a pulse, not stacked unrelated blocks. Keep it whisper-subtle, on-brand, light-theme only.

5. **Preserve:** all copy, the scroll/idle-advance step logic, the mobile 4-step recap, all animations (upload drag demo, scan line, shimmer), the collapsing nav, colors, and the final green CTA band.

**Constraints:** Do not add new sections or restyle components loudly. Every change should reduce visual friction and make the eye flow top-to-bottom without a hitch. Smooth, editorial, trustworthy — never busy.
