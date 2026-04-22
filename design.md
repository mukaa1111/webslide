# Web Slide — Design System Reference

원본 소스: `Web Slide/` 폴더 (Wanted Design System 기반)
CSS 토큰 파일: `Web Slide/design-system/colors_and_type.css` (뷰어/홈에서 실제 사용)
참고용 원본: `Web Slide/design/colors_and_type.css` + `README.md` + `SKILL.md`

---

## 1. 핵심 원칙

- **Wanted (원티드)** 디자인 시스템 — 한국 커리어 플랫폼 UI 언어
- 서피스는 순백(`#FFFFFF`). 그룹 콘텐츠는 중립 알파 워시(`rgba(112,115,124,0.05)`)
- 보더는 항상 알파: `rgba(112, 115, 124, 0.22)` — solid grey 사용 금지
- 본문 텍스트는 `#17171A` (near-black), 순수 검정 사용 안 함
- 프라이머리 액션 = `#0066FF` — CTA, 포커스 인풋, 링크에만 사용. 배경 배제
- 이모지 사용 금지, 그라데이션은 버튼·크롬에 사용 금지 (히어로 아트, Agent/+ 서피스만)
- 아이콘은 Wanted 자체 셋(`assets/icons/`), Lucide/Heroicons 사용 금지

---

## 2. CSS 토큰 파일 로드

```html
<!-- viewer.html / Home.html 기준 -->
<link rel="stylesheet" href="design-system/colors_and_type.css">
```

---

## 3. 컬러 — 원자 스케일

### Neutral (Cool Grey)
| Token | Value |
|---|---|
| `--c-neutral-0` | `rgb(255, 255, 255)` |
| `--c-neutral-50` | `rgb(247, 247, 248)` |
| `--c-neutral-100` | `rgb(244, 244, 245)` |
| `--c-neutral-200` | `rgb(219, 220, 223)` |
| `--c-neutral-300` | `rgb(194, 196, 200)` |
| `--c-neutral-400` | `rgb(174, 176, 182)` |
| `--c-neutral-500` | `rgb(152, 155, 162)` |
| `--c-neutral-600` | `rgb(112, 115, 124)` | ← 시그니처 보조 텍스트 회색 |
| `--c-neutral-700` | `rgb(70, 72, 79)` |
| `--c-neutral-800` | `rgb(55, 56, 60)` |
| `--c-neutral-850` | `rgb(46, 47, 51)` |
| `--c-neutral-900` | `rgb(27, 28, 30)` |
| `--c-neutral-950` | `rgb(23, 23, 25)` | ← near-black 본문 |
| `--c-neutral-1000` | `rgb(20, 25, 30)` |
| `--c-black` | `rgb(0, 0, 0)` |

### Brand Blue (Primary)
| Token | Value |
|---|---|
| `--c-blue-50` | `rgb(234, 242, 254)` |
| `--c-blue-100` | `rgb(213, 228, 253)` |
| `--c-blue-200` | `rgb(170, 202, 252)` |
| `--c-blue-300` | `rgb(127, 177, 251)` |
| `--c-blue-400` | `rgb(51, 133, 255)` |
| `--c-blue-500` | `rgb(0, 102, 255)` | ← **PRIMARY** |
| `--c-blue-600` | `rgb(0, 94, 235)` |
| `--c-blue-700` | `rgb(0, 78, 194)` |
| `--c-blue-800` | `rgb(0, 62, 153)` |

### Violet (AI/Premium)
| Token | Value |
|---|---|
| `--c-violet-50` | `rgb(240, 236, 254)` |
| `--c-violet-400` | `rgb(151, 71, 255)` |
| `--c-violet-500` | `rgb(101, 65, 242)` |
| `--c-violet-600` | `rgb(82, 48, 219)` |

### Status
| Token | Value | 용도 |
|---|---|---|
| `--c-red-400` | `rgb(255, 66, 66)` | 에러/부정 |
| `--c-green-400` | `rgb(0, 191, 64)` | 성공/긍정 |
| `--c-yellow-400` | `rgb(255, 200, 0)` | 경고 |
| `--c-cyan-500` | `rgb(0, 152, 178)` | 보조 |

---

## 4. 컬러 — 시맨틱 토큰

### Surface / Background
| Token | Light | 용도 |
|---|---|---|
| `--surface-background` | `--c-neutral-0` | 페이지 배경 |
| `--surface-subtle` | `rgba(112,115,124,0.05)` | 그룹/호버 배경 |
| `--surface-muted` | `rgba(112,115,124,0.08)` | 약간 진한 배경 |
| `--surface-elevated` | `--c-neutral-0` | 카드/패널 |
| `--surface-inverse` | `--c-neutral-950` | 다크 서피스 |
| `--surface-primary-subtle` | `--c-blue-50` | 파란 강조 배경 |

### Line / Border
| Token | Value |
|---|---|
| `--line-subtle` | `rgba(112,115,124,0.12)` |
| `--line-default` | `rgba(112,115,124,0.22)` | ← 표준 보더 |
| `--line-strong` | `rgba(112,115,124,0.4)` |
| `--line-inverse` | `rgba(255,255,255,0.22)` |

### Label / Text
| Token | Value | 용도 |
|---|---|---|
| `--label-strong` | `--c-neutral-950` | 제목, 1차 본문 |
| `--label-normal` | `rgb(23,23,25)` | 기본 본문 |
| `--label-neutral` | `--c-neutral-800` | 2차 본문 |
| `--label-alternative` | `--c-neutral-600` | 메타, 캡션 |
| `--label-assistive` | `--c-neutral-500` | 힌트, 비활성 |
| `--label-disable` | `--c-neutral-400` | 비활성화 |
| `--label-inverse` | `--c-neutral-0` | 다크 배경 위 텍스트 |
| `--label-primary` | `--c-blue-500` | 링크, 브랜드 라벨 |
| `--label-negative` | `--c-red-400` | 에러 |
| `--label-positive` | `--c-green-400` | 성공 |

### Primary (Action)
| Token | Value |
|---|---|
| `--primary-normal` | `--c-blue-500` (`#0066FF`) |
| `--primary-hover` | `--c-blue-600` |
| `--primary-press` | `--c-blue-700` |
| `--primary-subtle` | `--c-blue-50` |
| `--primary-contrast` | `--c-neutral-0` (버튼 위 흰 텍스트) |

### Status
| Token | Value |
|---|---|
| `--status-positive` | `--c-green-400` |
| `--status-negative` | `--c-red-400` |
| `--status-caution` | `--c-yellow-400` |
| `--status-info` | `--c-blue-500` |

---

## 5. 그림자 (Shadows)

항상 2–3 레이어 스택, 단일 모노리식 그림자 사용 금지.

```css
--shadow-normal:     0 0 1px rgba(23,23,23,0.07), 0 1px 2px rgba(23,23,23,0.06);
--shadow-emphasize:  0 1px 2px rgba(23,23,23,0.06), 0 2px 4px rgba(23,23,23,0.06), 0 4px 8px rgba(23,23,23,0.04);
--shadow-strong:     0 2px 4px rgba(23,23,23,0.06), 0 8px 20px rgba(0,0,0,0.08), 0 16px 32px rgba(0,0,0,0.04);
--shadow-heavy:      0 8px 16px rgba(0,0,0,0.08), 0 24px 48px rgba(0,0,0,0.12);
```

| 토큰 | 사용처 |
|---|---|
| `--shadow-normal` | 기본 카드 |
| `--shadow-emphasize` | 호버 카드 |
| `--shadow-strong` | 플로팅 패널/팝오버 |
| `--shadow-heavy` | 모달 |

---

## 6. 반지름 (Border Radius)

```css
--radius-xs:   4px
--radius-sm:   6px
--radius-md:   8px    /* 버튼, 인풋 */
--radius-lg:   12px
--radius-xl:   16px
--radius-2xl:  20px
--radius-3xl:  24px   /* 프로덕트 스케일 카드 */
--radius-card: 32px   /* 플래그십 마케팅 카드 */
--radius-pill: 9999px /* 캡슐 버튼, 칩 */
```

---

## 7. 스페이싱 (4pt Grid)

```css
--space-0:  0
--space-1:  4px
--space-2:  8px
--space-3:  12px
--space-4:  16px
--space-5:  20px
--space-6:  24px
--space-8:  32px
--space-10: 40px
--space-12: 48px
--space-16: 64px
--space-24: 96px
--space-32: 128px
```

---

## 8. 타이포그래피

### 폰트 스택
| 변수 | 폰트 | 용도 |
|---|---|---|
| `--font-sans` | Pretendard (자체 호스팅, `/fonts/`) | 기본 UI |
| `--font-display` | Wanted Sans (jsDelivr CDN) | 마케팅 헤드라인, 로고 |
| `--font-mono` | SF Mono / JetBrains Mono | 코드 |

### 타입 스케일

| 분류 | Token | 크기/행간 | weight | tracking |
|---|---|---|---|---|
| Display | `--font-display-1` | 72px / 1.14 | 700 | -0.033em |
| Display | `--font-display-2` | 56px / 1.18 | 700 | -0.033em |
| Title | `--font-title-1` | 36px / 1.334 | 700 | -0.025em |
| Title | `--font-title-2` | 28px / 1.358 | 700 | -0.025em |
| Title | `--font-title-3` | 24px / 1.375 | 700 | -0.025em |
| Heading | `--font-heading-1` | 20px / 1.4 | 600 | -0.019em |
| Heading | `--font-heading-2` | 17px / 1.411 | 600 | -0.019em |
| Body | `--font-body-lg` | 16px / 1.5 | 500 | +0.006em |
| Body | `--font-body-md` | 15px / 1.47 | 500 | +0.006em |
| Body | `--font-body-sm` | 14px / 1.5 | 500 | +0.006em |
| Label | `--font-label-md` | 13px / 1.46 | 600 | — |
| Label | `--font-label-sm` | 12px / 1.5 | 600 | — |
| Caption | `--font-caption` | 11px / 1.45 | 500 | — |
| Code | `--font-code` | 14px / 1.5 | — | — |

> 한글 레이더빌리티: 행간 최소 1.33 이상 필수. heading은 음수 트래킹, body는 양수 트래킹(+0.006em).

### 헤딩 매핑
```css
h1 → --font-title-1   (700, -0.025em)
h2 → --font-title-2   (700, -0.025em)
h3 → --font-title-3   (700, -0.025em)
h4 → --font-heading-1 (600, -0.019em)
h5 → --font-heading-2 (600, -0.019em)
h6 → --font-body-lg   (600, +0.006em)
```

---

## 9. 다크 테마

토글: `html[data-theme="dark"]` 또는 `.theme-dark`

```css
--surface-background: --c-neutral-950
--surface-elevated:   --c-neutral-900
--label-strong:       --c-neutral-0
--label-normal:       rgb(234, 234, 237)
```

---

## 10. 인터랙션 규칙

| 상태 | 동작 |
|---|---|
| Hover (버튼) | `--primary-hover` (blue-600)로 색상 전환 |
| Hover (링크) | opacity 0.72 |
| Hover (리스트 행) | background → `--surface-subtle` |
| Press | `--primary-press` (blue-700) |
| Focus | 2px outer ring, `--primary-normal` 40% alpha, 2px offset |
| Disabled | opacity 0.4, `cursor: not-allowed` |
| 트랜지션 | 150–200ms, opacity/color 크로스페이드. 스케일업 / 바운스 금지 |

---

## 11. 레이아웃

| 컨텍스트 | 최대 너비 | 거터 |
|---|---|---|
| 마케팅/문서 | 1280–1536px | 넉넉한 페이지 거터 |
| 프로덕트 앱 | 1200–1440px | 24–32px |
| 모바일 | — | 16px 사이드 거터 |

Web Slide 실제 값:
```css
--page-max:    1280px
--gutter:      40px       /* viewer */
--page-gutter: 40px       /* home */
--rail-w:      280px      /* viewer 사이드 레일 */
```

---

## 12. Web Slide 프로젝트 전용 컴포넌트 패턴

### Top Bar (viewer.html / Home.html 공통)
```css
position: sticky; top: 0; z-index: 20–30;
background: color-mix(in oklab, var(--surface-background) 82–84%, transparent);
backdrop-filter: saturate(140%) blur(16px);
border-bottom: 1px solid var(--line-subtle);
```

### 아이콘 버튼
```css
width/height: 36px; border-radius: var(--radius-pill);
color: var(--label-neutral);
hover → background: var(--surface-subtle); color: var(--label-strong);
active → background: var(--primary-subtle); color: var(--primary-normal);
```

### 브랜드 마크 (Home)
```css
width/height: 30px; border-radius: 8px;
background: var(--c-neutral-950); color: var(--c-neutral-0);
font-family: var(--font-display); font-weight: 800;
```

### 카드
- 프로덕트 스케일: `--radius-3xl` (24px), `--shadow-normal` → hover `--shadow-emphasize`
- 플래그십: `--radius-card` (32px)
- 썸네일: `--thumb-radius: var(--radius-3xl)`

### 검색 인풋
```css
height: 42px; padding: 0 14px 0 42px;
background: var(--surface-subtle); border: 1px solid transparent;
border-radius: var(--radius-pill);
focus → border-color: var(--primary-normal);
```

---

## 13. 아이콘

- 소스: `Web Slide/design/assets/icons/` (SVG, `fill="currentColor"`)
- 그리드: 24×24px
- 색상: CSS `color:` 속성으로 제어 (`fill="currentColor"`)
- FillFalse(아웃라인) / FillTrue(솔리드) 두 가지 변형
- 외부 아이콘 라이브러리 사용 금지

---

## 14. 유틸리티 클래스

```css
.u-display-1 / .u-display-2
.u-title-1 / .u-title-2 / .u-title-3
.u-heading-1 / .u-heading-2
.u-body-lg / .u-body-md / .u-body-sm
.u-label-md / .u-label-sm
.u-caption
.u-mono
```

---

## 15. 코드 레퍼런스

| 목적 | 파일 |
|---|---|
| CSS 토큰 (실사용) | `Web Slide/design-system/colors_and_type.css` |
| CSS 토큰 (원본/설명) | `Web Slide/design/colors_and_type.css` |
| 디자인 시스템 설명 | `Web Slide/design/README.md` |
| 스킬 가이드라인 | `Web Slide/design/SKILL.md` |
| 프로덕트 UI 키트 | `Web Slide/design/ui_kits/product/index.html` |
| 마케팅 UI 키트 | `Web Slide/design/ui_kits/marketing/index.html` |
| 홈 화면 | `Web Slide/Home.html` |
| 뷰어 화면 | `Web Slide/viewer.html` |
