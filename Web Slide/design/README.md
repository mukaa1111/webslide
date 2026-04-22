# Wanted Design System

A design system extracted from the **Wanted Design System (Community)** Figma file. Wanted (원티드) is a South-Korean career platform — job search, career development, and HR/recruitment tooling. This system represents the shared visual foundation used across Wanted's product surfaces (Wanted, Wanted Space, Wanted Gigs, Wanted Agent, Wanted+).

## Sources

- **Figma (mounted VFS):** _Wanted Design System (Community)_ — 25 pages, 36 top-level frames. Includes color (atomic + semantic), typography, icons (300+), logos, spacing, component library, guidelines, principles.
- No codebase was attached. Component behaviours below are inferred from the Figma component specs and standard Wanted product UI.

## Products represented

The file shows Wanted treats these as sub-brands sharing a single system:

- **Wanted** — main job/career platform (the default)
- **Wanted Space** — workspace/collaboration surface
- **Wanted Gigs** — freelance/gig marketplace
- **Wanted Agent** — AI recruiter assistant
- **Wanted+** (Partnerships) — premium membership / LaaS

Each has its own horizontal + circle logo variants (light / dark / white / black).

---

## Index — what's in this folder

```
README.md                    ← you are here
SKILL.md                     ← lets this system be used as a Claude skill
colors_and_type.css          ← CSS variables: colors, type, spacing, shadow, radius
assets/
  logos/                     ← Wanted wordmark + symbol, PNG + SVG
  icons/                     ← 90+ SVG icons (fill=currentColor)
preview/                     ← cards rendered in the Design System tab
ui_kits/
  product/                   ← Product-surface UI kit (buttons, inputs, cards, nav)
  marketing/                 ← Marketing-surface UI kit (hero, pricing, CTA, footer)
fonts/                       ← Self-hosted Pretendard .otf files (9 weights)
```

---

## CONTENT FUNDAMENTALS

Wanted's voice is **warm, professional, Korean-first**. The Figma text samples are almost entirely Korean (한국어), with English reserved for product names, job titles, and technical affordances ("Google로 계속하기" = "Continue with Google").

- **Tone.** Polite formal (-습니다 / -합니다) style in product UI. Microcopy is direct and functional, never cute. Buttons are verbs ("컴포넌트 보기" = "See component", "지원하기" = "Apply"). No exclamation marks, no emoji.
- **Casing.** Sentence case everywhere, including buttons. English product names (Wanted, Wanted Agent) are Title Case; section labels are lowercase English ("Normal", "Short").
- **Address.** Users addressed obliquely — 3rd-person framing rather than "you / 당신". Product narrates rather than commands.
- **Numbers.** Comma-separated (1,230,000). Currency 원 / KRW. Company size tiers stated plainly ("500명 이상").
- **Emoji.** None in the UI. Occasional emoji in illustrations-as-copy contexts, but never in buttons, nav, labels.
- **English fallback.** Every product screen should work in both Korean and English. Keep copy short enough for Korean to expand ~15% without breaking.

Example copy from the system (raw from Figma):
- "Google로 계속하기" — Continue with Google (auth button)
- "단순하며 상징적인 기호를 통해 특정 개념을 빠르게 전달합니다." — "Communicate a concept quickly through a simple, symbolic mark." (Icon principle)
- "원칙" / "속성" / "예시" — Principle / Properties / Example (doc section headers)

---

## VISUAL FOUNDATIONS

### Colors
- **Brand primary:** `rgb(0, 102, 255)` — a saturated royal blue (`--primary-normal`). This is the action color; used sparingly for CTAs, links, focused inputs. Not a background wash.
- **Accent violet:** `rgb(151, 71, 255)` / `rgb(101, 65, 242)` — reserved for AI/premium surfaces (Wanted Agent, Wanted+).
- **Neutral core:** cool greys from `#F7F7F8` → `#17171A`. The signature secondary-text grey is `rgb(112, 115, 124)`. Body text is `#17171A` (near-black), not pure black.
- **Status:** red `rgb(255, 66, 66)`, green `rgb(0, 191, 64)`.
- **Alpha borders:** lines are almost always `rgba(112, 115, 124, 0.22)` — never solid grey. Creates a soft, low-contrast card boundary.

### Typography
- **Primary:** [Pretendard](https://github.com/orioncactus/pretendard) — open-source Korean/CJK/Latin sans designed for product UI. Handles Hangul + Latin in one family with consistent vertical metrics. **Self-hosted** — the 9-weight OTF family lives in `/fonts/` and is wired up as `@font-face` rules in `colors_and_type.css`. Weights: Thin 100 → Black 900.
- **Display / Brand:** [Wanted Sans](https://wantedsans.com) — Wanted's own open-source display face, used in logos and marketing headlines.
- **Mono:** SF Mono (code, numeric data).
- **Tracking:** negative (`-0.027em`, `-0.024em`, `-0.019em`) for headings. Body uses a tiny positive tracking (`+0.006em`) — a Korean-type convention that loosens Hangul rhythm at small sizes.
- **Line height:** generous (1.33 – 1.5). Korean characters are full-width; cramped leading hurts them badly.

### Spacing
Strict **4-pt grid**. Observed paddings in the Figma: 4, 8, 12, 16, 20, 24, 32, 48, 64, 128. Cards use **64px internal padding** at the system-doc scale and **32px** at the product scale. Gaps between sibling blocks are typically 24 or 48.

### Backgrounds
- Dominant surface is **pure white** (`#FFFFFF`) with large amounts of negative space.
- Secondary/grouped surfaces use `rgba(112, 115, 124, 0.05)` — a neutral tinted wash that reads as "grouped content" without a hard border.
- **No full-bleed illustrations**, **no repeating patterns**, **no noise textures** in product UI. Imagery is rectangular photos or flat color fills behind cards.
- Gradients are used sparingly — only in brand artwork (Wanted Agent logo aura) and occasional hero accents. Never in buttons or chrome.

### Animation
- Subtle and functional. Color/opacity cross-fades (150-200ms), not bounces or springs.
- Hover: lower opacity OR shift to the next shade (blue-500 → blue-600). Never scale-up on hover.
- Press: darker shade (`--primary-press` = blue-700). No shrink animation; the compression is purely colorimetric.
- Page transitions and modal in/out are fade + tiny Y-translate (~8px), ~200ms, `ease-out`.

### Hover / Press / Focus
- **Hover:** on primary actions, step one shade darker (`--primary-hover`). On text links, reduce opacity to ~0.72. On list rows, background becomes `--surface-subtle`.
- **Press:** another shade down (`--primary-press`).
- **Focus:** 2px outer ring in `--primary-normal` at 40% alpha, with a 2px offset.
- **Disabled:** opacity 0.4, `cursor: not-allowed`.

### Borders
- Standard border is **1px `rgba(112,115,124,0.22)`** — identical everywhere. Not `#E5E5E5`; always alpha.
- Strong borders (form fields focused, selected cards) become 1.5px solid `--primary-normal`.
- Cards often prefer shadow over border, but both are common.

### Shadows
Three-layer soft system. No single monolithic shadow — always a stack of 2-3 low-alpha layers to create depth without "glow":
- `--shadow-normal` — resting card
- `--shadow-emphasize` — hover card
- `--shadow-strong` — floating panel / popover
- `--shadow-heavy` — modals

### Corner radii
Wanted has an unusually **generous radius system**.
- Buttons: `8–12px` (small) or pill (rounded chip actions).
- Input fields: `8px`.
- Cards: `16–24px` at product scale, **`32px`** for the flagship doc cards.
- Logo circle: `50%`.

### Transparency / Blur
Used sparingly:
- Sticky nav: white background at 80% opacity + `backdrop-filter: blur(16px)`.
- Modal scrim: `rgba(0,0,0,0.48)`.
- Focus ring alpha (40%) as noted above.

### Imagery
- Clean photography, warm but not saturated. No B&W, no aggressive grading.
- Profile photos are square with `16–24px` radius. Never true circles for user avatars (circles are reserved for logos and status dots).
- Company logos sit on a light-grey tile (`--surface-muted`) with 8-16px padding.

### Layout rules
- Marketing/doc: 1280–1536px content width inside a generous page gutter.
- Product app: 1200–1440px content width, 24-32px gutter.
- Mobile: 16px side gutter. Bottom tab-bar is fixed, 64px tall.

---

## ICONOGRAPHY

Wanted ships its **own** 300+ icon set inside the Figma library (`/1-Theme/components/Name*`). The system is:

- **Grid:** 24×24 pixel box.
- **Style:** geometric, rounded joins, 1.8px stroke baseline — but most icons are filled shape outlines (a single `<path>` with `fill-rule="evenodd"`). This makes them scale perfectly without stroke misalignment.
- **Fill:** every icon uses `fill="currentColor"` — so CSS `color:` tints the whole icon. No hard-coded colors.
- **Variants:** most concept icons have a `FillFalse` (outline) and `FillFillTrue` (solid) variant. Toolbar icons follow the outline variant; active/selected states swap to filled.
- **Naming:** `NameXxx` in Figma → flat kebab-case filenames in `assets/icons/`.
- **Logo icons:** brand SVGs for Google, Apple, Facebook, LinkedIn, Instagram, YouTube, Naver Blog, Brunch, Microsoft are included and kept in their brand colors (these are the only icons where `fill` is NOT `currentColor`).
- **No emoji, no unicode glyphs** used as icons anywhere in product UI.

Roughly 90 of the most common icons are pre-copied into `assets/icons/`. If you need an icon not listed, find it at `/1-Theme/components/NameXxx/` in the Figma VFS and copy its `Normal.svg` (or extract the inline `<path>` from its `.jsx` file).

**Substitutions / flags:**
- **Fonts:** Pretendard is **self-hosted** from `/fonts/` (9 weights, OTF). Wanted Sans loads from jsDelivr CDN (wantedsans.com). No substitution needed.
- **Icons:** all icons are from Wanted's own Figma library. No external icon CDN is used — do not reach for Lucide / Heroicons / etc.

---

## How to use

```html
<link rel="stylesheet" href="../colors_and_type.css">
<style>
  .cta {
    background: var(--primary-normal);
    color: var(--primary-contrast);
    padding: 12px 20px;
    border-radius: var(--radius-md);
    font-weight: 600;
  }
  .cta:hover { background: var(--primary-hover); }
</style>
```

For icons:

```html
<img src="../assets/icons/search.svg" width="24" height="24"
     style="color: var(--label-strong);">
```

See `ui_kits/product/` and `ui_kits/marketing/` for working demos that wire all of this together.
