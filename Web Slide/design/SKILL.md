# Wanted Design System — skill

Use this skill whenever the user wants a design that should look like a **Wanted** (원티드) product surface — the Korean career platform — or any Wanted sub-brand (Wanted Space, Wanted Gigs, Wanted Agent, Wanted+). It is optimized for **job-discovery, recruiter, career-development, and HR** UIs in both Korean and English.

## When to invoke

Reach for this skill when the brief mentions any of:
- Wanted / 원티드 / Wanted Lab / any Wanted sub-product
- a "Korean product" aesthetic (Toss / Kakao / Naver-adjacent)
- a hiring, resume, ATS, recruiter, or career-coaching surface
- a Pretendard-typography look with cool-grey neutrals and royal-blue actions

Do **not** invoke it for general "corporate" or "SaaS" work that has its own brand — the Wanted system is strongly identified (saturated blue CTAs, 32px card radii, Korean-first copy, no emoji).

## How to load it

Every file in this skill is self-contained and reads from one CSS token file. To build a new Wanted artifact:

1. **Link the tokens file** at the top of your HTML. Use a relative path from the file you're writing:
   ```html
   <link rel="stylesheet" href="../colors_and_type.css">
   <!-- or ../../colors_and_type.css from inside ui_kits/<kit>/ -->
   ```
   This pulls in every color, type, spacing, radius, and shadow variable — plus registers the 9 weights of Pretendard via `@font-face` (from `/fonts/`) and Wanted Sans from the jsDelivr CDN.

2. **Browse the reference kits first.** Copy-paste is faster than re-authoring:
   - `ui_kits/product/index.html` — buttons, inputs, cards, nav, alerts, avatars, job cards, list rows, feedback
   - `ui_kits/marketing/index.html` — hero, logo wall, stats band, features, testimonial, pricing, CTA banner, footer
   Each block is heavily commented and every value is tokenised. Lift a block, replace the copy, done.

3. **See tokens in the wild** in `preview/*.html` — one-file cards rendering every color scale, the type specimen, spacing/radii/shadows, and the core components at display size.

4. **Read `README.md`** for the Content Fundamentals + Visual Foundations briefing before you start composing. Voice, casing, line-height, border-alpha conventions, and iconography rules are all there.

## Core principles — do not skip

These are the details that separate a Wanted-looking design from a generic "blue SaaS" mock:

- **Surfaces are white** (`--surface-background`). Grouped content gets `--surface-subtle` — a neutral alpha wash (`rgba(112,115,124,0.05)`), never a tinted blue/grey fill.
- **Borders are always alpha**, not solid grey: `rgba(112, 115, 124, 0.22)`. Use the `--line-subtle / default / strong` tokens.
- **Body text is `#17171A`, not pure black.** Secondary text is `rgb(112,115,124)` — the signature Wanted cool grey.
- **Primary action = `--primary-normal` (`#0066FF`).** Used sparingly for CTAs, focused inputs, link text. Never as a page background.
- **Generous radii.** Cards at product scale = `--radius-3xl` (24px). Flagship marketing cards = `--radius-card` (32px). Buttons = `--radius-md` (8px). Chips and capsule actions = `--radius-pill`.
- **Three-layer shadows.** Stack 2–3 low-alpha layers (`--shadow-normal / emphasize / strong / heavy`) — never one monolithic drop shadow. It reads as soft depth, not glow.
- **Type is Pretendard** with a tiny *positive* body tracking (`+0.006em`) and *negative* heading tracking. Line-height 1.33–1.5 minimum — tight leading destroys Hangul. Use Wanted Sans only for marketing display type and logos.
- **No emoji** in product UI. **No gradients** in chrome or buttons — only in hero art and the occasional Wanted Agent / Wanted+ surface (blue → violet).
- **Icons** come from Wanted's own 300+ set in `assets/icons/`. They use `fill="currentColor"` / `stroke="currentColor"` — tint them by setting `color:` on the parent. Don't reach for Lucide / Heroicons.
- **Motion** is 150–200ms opacity/color cross-fades. No bounces, no scale-on-hover. Press = shift to the next shade (`--primary-hover` → `--primary-press`).

## Copy voice

Wanted's UI is **Korean-first**, polite-formal, sentence-case, no exclamation marks, no emoji. Buttons are verbs ("지원하기" = "Apply", "컴포넌트 보기" = "See component"). English copy is Title Case for product names, sentence case for everything else. Numbers use comma separators (1,230,000). Currency is 원 / KRW. Write copy that leaves ~15% room for Korean to expand into English layouts without clipping.

If the user gives you English-only copy, use it as-is — don't translate unless asked. But match the *register*: warm, functional, direct, no cutesy microcopy.

## Deliverables

Everything this skill produces should end up in one of:

- **A new HTML file** that `<link>`s `colors_and_type.css` and composes blocks lifted from `ui_kits/`.
- **A new screen inside an existing Wanted prototype** — copy whole sections from the UI kits verbatim, then restyle copy.
- **A new variation** exposed as a Tweak or a `<DCArtboard>` inside a design canvas, NOT a new forked file, when the user asks for alternates.

## Known gaps

- The Figma source did not include dark-mode specimens for every component — `colors_and_type.css` defines the dark token mapping but components in the UI kits are light-surface only. If the user asks for dark mode, let them know that dark component styling is partially inferred, then build it by flipping `html[data-theme="dark"]`.
- No illustrations or stock photos ship with this skill. For hero imagery, use the blue→violet gradient blob pattern shown in `ui_kits/marketing/index.html`, or ask the user for art.
- No real motion specs were captured — animation guidance above is inferred from standard Wanted product UI. If the user needs production-accurate motion, flag that.
