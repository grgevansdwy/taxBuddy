# TaxBuddy — "Free Refund Check" pre-signup flow (4 screens)

A no-signup instant tax-refund checker that lets a curious visitor upload their tax documents, get an estimated over/underpayment number, optionally score their already-filed 1040-NR, and convert to signup through quantified FOMO. Warm, trustworthy, editorial-SaaS feel — money + safety cues throughout.

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
- Typography: Clean geometric sans-serif (Hanken Grotesk); large bold headlines (tight leading), regular-weight body; tabular-nums for all dollar figures
- Buttons: Solid Deep Green primary + outline/ghost secondary
- Motion: Subtle fade-and-rise on scroll; smooth, understated micro-animations

---

## SCREEN 1 — Upload (no signup, the hook)

A single focused screen that gets the visitor to drop in their documents with as little friction as possible, while visibly reassuring them about safety.

**Page Structure:**
1. **Slim header:** TaxBuddy logo left; ghost "Sign in" link right. No full nav — keep focus on the tool.
2. **Hero headline block (centered, generous whitespace):**
   - Eyebrow pill (mint bg, forest-green text): "Free · No account needed"
   - Headline: "Did you overpay the IRS? Find out in 2 minutes."
   - Subtext (muted slate): "Upload your U.S. tax documents and we'll estimate your refund. No signup, no card — just your number."
3. **Upload dropzone card (Pure White, 14px radius, soft shadow, dashed inner border):**
   - Large cloud-upload icon in Deep Green
   - "Drag & drop your documents, or browse"
   - Helper line: "W-2, 1042-S, 1099s, and your visa/entry info — PDFs or photos"
   - Below dropzone: a horizontal row of small file-type chips (W-2, 1042-S, 1099-INT, 1099-B, 1098-T) that fill in / check off as files are detected
4. **Trust strip (directly under the card, small):** row of three inline items with lock/shield icons — "Bank-level encryption", "We never sell your data", "Delete anytime". Muted slate text, small.
5. **Primary CTA:** full-width Deep Green button "Estimate my refund →" (disabled until at least one file added).
6. **Reassurance footnote (tiny, muted):** "Estimate only — confirm details later for your exact figure."

---

## SCREEN 2 — Optional: score your filed return (the differentiator)

An optional interstitial that unlocks the "mismatch score" — shown after upload, before results.

**Page Structure:**
1. **Slim header** (same as Screen 1) with a thin progress indicator: step 2 of 3.
2. **Centered prompt card (Pure White):**
   - Headline: "Already filed this year? Let's check your work."
   - Subtext: "Upload the 1040-NR you submitted and we'll score it against our calculation — and show you exactly what you missed."
   - Compact secondary dropzone: "Drop your filed 1040-NR (optional)"
3. **Two clear paths (buttons, side by side on desktop, stacked mobile):**
   - Primary Deep Green: "Score my filed return →"
   - Ghost/outline secondary: "Skip — just show my estimate"
4. **Micro-benefit row:** small mint badges — "Spot missed deductions", "Catch treaty benefits", "See your accuracy score".

---

## SCREEN 3 — Results (the FOMO payoff)

The emotional peak. A big, confident dollar figure up top, then a partially locked breakdown that gates the detail behind signup.

**Page Structure:**
1. **Slim header** (same), progress: step 3 of 3 / "Your result".
2. **Hero result card (full-width, Pure White, generous padding, soft shadow):**
   - Small label (muted): "Estimated result"
   - HUGE headline number in Deep Green, tabular-nums: "+$1,240" with a mint "money found" badge beside it reading "Likely overpaid"
   - Sub-line: "Based on the documents you uploaded. Confirm your details to get your exact figure."
   - (Design an alternate/negative state too: if underpaid, number shows in a calm neutral tone, badge reads "Possible balance due" — never alarmist red.)
3. **Accuracy score module (only when a filed 1040-NR was uploaded):** a circular score gauge (e.g., "72/100") with label "Filing accuracy" and one-line summary "3 issues found on your filed return."
4. **Locked breakdown list ("Where your money is"):** a vertical list of finding rows inside a card. Show 1 row fully unlocked as a teaser (e.g., a mint-badged "Treaty benefit not claimed — est. $840"), then 2–3 rows BLURRED/frosted with a small lock icon and greyed placeholder bars. A soft gradient fade at the bottom of the list into a CTA.
5. **Conversion CTA band (Deep Green background, white text, rounded):**
   - Headline: "See exactly where you left $1,240 on the table."
   - Subtext (mint-tinted): "Create a free account to unlock your full breakdown, save your documents, and generate a corrected return."
   - White primary button: "Unlock my full breakdown →"
   - Small reassurance under button: "Free to see your details. Your uploads are already saved for you."
6. **Loss-framed reinforcement, not blame:** copy should say "the system took more than it should have," never "you made a mistake."
7. **Footer:** tiny disclaimer — "Estimates are informational and not tax advice. Final figures require confirming your details."

---

## SCREEN 4 — Signup gate / unlock

The signup moment, framed as unlocking value the user already earned — not starting over.

**Page Structure:**
1. **Split layout (desktop):**
   - **Left panel (Warm Cream):** a persistent reminder of the prize — small card echoing "+$1,240 waiting to be unlocked", plus a checklist of what they get: "Full line-by-line breakdown", "Documents saved — no re-uploading", "Generate a corrected 1040-X". Mint check icons.
   - **Right panel (Pure White card):** the signup form.
2. **Signup form:** headline "Create your free account", email + password fields (labeled inputs, 10px radius), a "Continue with Google" outline button above a hairline "or" divider.
3. **Primary CTA:** full-width Deep Green "Unlock my breakdown".
4. **Trust footnote:** lock icon + "Your documents are encrypted and never sold. We only ask you to confirm details after you've seen your results."
5. **Micro-copy under CTA:** "Already have an account? Sign in."
