# 교육용 슬라이드 애니메이션 & UX 디자인 패턴 기술 레퍼런스

## 목차

1. [Reveal.js 핵심 기능 및 설정](#1-revealjs-핵심-기능-및-설정)
2. [대안 라이브러리 비교 분석](#2-대안-라이브러리-비교-분석)
3. [학습 UX 패턴 이론 및 구현](#3-학습-ux-패턴-이론-및-구현)
4. [애니메이션 구현 패턴](#4-애니메이션-구현-패턴)
5. [인지 부하 최소화 디자인 원칙](#5-인지-부하-최소화-디자인-원칙)
6. [게이미피케이션 요소](#6-게이미피케이션-요소)
7. [CSS 애니메이션 & Framer Motion 패턴](#7-css-애니메이션--framer-motion-패턴)
8. [실무 적용 컴포넌트 패턴](#8-실무-적용-컴포넌트-패턴)

---

## 1. Reveal.js 핵심 기능 및 설정

### 1.1 기본 구조 및 초기화

Reveal.js는 HTML 기반의 프레젠테이션 프레임워크로, 2D 슬라이드 네비게이션(수평 + 수직)을 지원한다. 교육 콘텐츠에서는 수직 슬라이드를 "개념 드릴다운"에 활용하는 것이 효과적이다.

```html
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="dist/reveal.css">
  <link rel="stylesheet" href="dist/theme/black.css">
</head>
<body>
  <div class="reveal">
    <div class="slides">

      <!-- 수평 슬라이드 (주제 단위) -->
      <section>
        <h1>모듈 1: 개념 소개</h1>
      </section>

      <!-- 수직 슬라이드 (세부 내용 드릴다운) -->
      <section>
        <section>
          <h2>핵심 원리</h2>
          <p>개요</p>
        </section>
        <section>
          <h2>심화 설명</h2>
          <p>세부 내용</p>
        </section>
        <section>
          <h2>실습 예제</h2>
          <p>적용하기</p>
        </section>
      </section>

    </div>
  </div>

  <script src="dist/reveal.js"></script>
  <script>
    Reveal.initialize({
      // 핵심 설정
      hash: true,              // URL 해시로 슬라이드 위치 추적
      history: true,           // 브라우저 히스토리 연동
      progress: true,          // 하단 진행 바
      slideNumber: 'c/t',      // 현재/전체 슬라이드 번호

      // 교육용 최적화 설정
      autoPlayMedia: false,    // 자동 미디어 재생 비활성화 (학습자 제어권)
      preloadIframes: false,   // 성능 최적화
      viewDistance: 2,         // 인접 슬라이드만 사전 로드

      // 전환 효과
      transition: 'slide',     // none, fade, slide, convex, concave, zoom
      transitionSpeed: 'default', // default, fast, slow
      backgroundTransition: 'fade',

      // 개요 모드 (학습 맵 역할)
      overview: true,

      // 키보드 단축키
      keyboard: {
        13: 'next',  // Enter → 다음
        27: () => { Reveal.toggleOverview(); } // ESC → 개요
      },

      // 플러그인
      plugins: [RevealMarkdown, RevealHighlight, RevealNotes, RevealMath]
    });
  </script>
</body>
</html>
```

### 1.2 Fragment 애니메이션 (점진적 공개)

Fragment는 교육적 점진적 공개(Progressive Disclosure)의 핵심 메커니즘이다. 한 번에 하나의 개념만 노출하여 인지 부하를 조절한다.

```html
<!-- 기본 fragment 클래스들 -->
<section>
  <h2>학습 단계</h2>

  <!-- 순차적 등장 -->
  <ul>
    <li class="fragment">1단계: 개념 이해</li>
    <li class="fragment">2단계: 예시 적용</li>
    <li class="fragment">3단계: 직접 실습</li>
    <li class="fragment">4단계: 복습 및 정리</li>
  </ul>
</section>

<!-- 다양한 fragment 스타일 -->
<section>
  <!-- fade-up: 아래에서 위로 등장 (주의 집중 유도) -->
  <p class="fragment fade-up">핵심 개념 A</p>

  <!-- highlight-current-blue: 현재 항목 강조 -->
  <p class="fragment highlight-current-blue">현재 학습 중인 내용</p>

  <!-- fade-in-then-out: 잠깐 등장 후 사라짐 (힌트 제공) -->
  <p class="fragment fade-in-then-out">⚡ 힌트: 다음 단계를 생각해보세요</p>

  <!-- grow: 강조를 위한 확대 -->
  <strong class="fragment grow">핵심 포인트!</strong>

  <!-- highlight-red: 오류/주의 강조 -->
  <code class="fragment highlight-red">주의해야 할 코드</code>
</section>

<!-- 동시 등장 (index 활용) -->
<section>
  <p class="fragment" data-fragment-index="1">A와 B가 동시에</p>
  <p class="fragment" data-fragment-index="1">등장합니다</p>
  <p class="fragment" data-fragment-index="2">그 다음 C가 등장</p>
</section>
```

```javascript
// Fragment 이벤트 활용 - 학습 진도 추적
Reveal.on('fragmentshown', event => {
  const fragment = event.fragment;
  const slideIndex = Reveal.getIndices();

  // 학습 진도 기록
  trackLearningProgress({
    slide: slideIndex,
    fragmentId: fragment.dataset.fragmentIndex,
    timestamp: Date.now()
  });

  // 특정 fragment에서 사운드/피드백
  if (fragment.classList.contains('key-concept')) {
    playChime(); // 핵심 개념 등장 시 효과음
  }
});

Reveal.on('fragmenthidden', event => {
  // 뒤로 갔을 때 진도 롤백
  rollbackProgress(event.fragment);
});
```

### 1.3 커스텀 테마 설계

교육용 테마는 학습자의 집중력과 가독성을 최우선으로 설계해야 한다.

```scss
// custom-edu-theme.scss
// Reveal.js SCSS 변수 오버라이드

// ============================================
// 색상 시스템 (교육 심리학 기반)
// ============================================
$mainColor: #2C3E50;          // 배경: 어두운 네이비 (집중력 향상)
$headingColor: #ECF0F1;       // 제목: 밝은 화이트
$linkColor: #3498DB;          // 링크: 신뢰감 있는 블루
$linkColorHover: #5DADE2;
$selectionBackgroundColor: #F39C12; // 선택: 경고/강조 오렌지

// 의미론적 색상
$color-correct: #2ECC71;      // 정답/완료: 그린
$color-incorrect: #E74C3C;    // 오답/오류: 레드
$color-warning: #F39C12;      // 주의: 오렌지
$color-info: #3498DB;         // 정보: 블루
$color-highlight: #9B59B6;    // 강조: 퍼플

// ============================================
// 타이포그래피 (가독성 최적화)
// ============================================
$mainFont: 'Noto Sans KR', 'Pretendard', sans-serif;
$headingFont: 'Pretendard', 'Noto Sans KR', sans-serif;
$codeFont: 'JetBrains Mono', 'Fira Code', monospace;
$mainFontSize: 38px;           // 강의실 기준 최소 크기

// 행간 - 한국어는 더 넓은 행간 필요
$line-height-normal: 1.7;
$line-height-heading: 1.3;

// ============================================
// 레이아웃 변수
// ============================================
$content-max-width: 960px;
$padding-horizontal: 60px;

// ============================================
// 커스텀 스타일
// ============================================

// 학습 카드 컴포넌트
.concept-card {
  background: rgba(255, 255, 255, 0.05);
  border-left: 4px solid $color-info;
  border-radius: 0 8px 8px 0;
  padding: 1.2rem 1.5rem;
  margin: 1rem 0;
  backdrop-filter: blur(10px);

  &.correct { border-left-color: $color-correct; }
  &.warning { border-left-color: $color-warning; }
  &.highlight { border-left-color: $color-highlight; }
}

// 강조 배지
.badge {
  display: inline-block;
  padding: 0.2em 0.6em;
  border-radius: 20px;
  font-size: 0.65em;
  font-weight: 700;
  letter-spacing: 0.05em;
  vertical-align: middle;

  &.new { background: $color-highlight; color: white; }
  &.important { background: $color-warning; color: white; }
  &.tip { background: $color-correct; color: white; }
}

// 진행 표시 향상
.reveal .progress {
  height: 4px;
  background: rgba(255,255,255,0.1);

  span {
    background: linear-gradient(
      90deg,
      $color-info,
      $color-highlight
    );
    transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  }
}

// 슬라이드 번호 스타일링
.reveal .slide-number {
  background: rgba(0,0,0,0.4);
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 0.75em;
}
```

### 1.4 핵심 플러그인 활용

```javascript
// 플러그인 상세 설정

// 1. Highlight.js - 코드 강조
Reveal.initialize({
  plugins: [RevealHighlight],
  highlight: {
    highlightOnLoad: true,
    beforeHighlight: (hljs) => {
      // 커스텀 언어 등록
      hljs.registerLanguage('pseudocode', pseudocodeDefinition);
    }
  }
});

// 코드 블록에서 특정 줄 강조 (교육적 주목 유도)
// data-line-numbers="1-3|5|7-9" → 단계적 줄 강조
```

```html
<!-- 코드 단계적 강조 예시 -->
<section>
  <h2>알고리즘 이해하기</h2>
  <pre>
    <code class="javascript" data-line-numbers="1-2|4-6|8-10|1-10">
// Step 1: 변수 초기화
let result = 0;

// Step 2: 반복 처리
for (let i = 1; i <= n; i++) {
  result += i;
}

// Step 3: 결과 반환
return result;
    </code>
  </pre>
</section>

<!-- Speaker Notes (학습자용 가이드) -->
<section>
  <h2>핵심 개념</h2>
  <p>메인 내용</p>

  <aside class="notes">
    강사 노트: 이 슬라이드에서 학습자들이 자주 헷갈리는 부분은...
    - 개념 A와 B의 차이점 강조
    - 실생활 예시 3가지 준비
    - 예상 소요 시간: 5분
  </aside>
</section>
```

```javascript
// 자동 진행 타이머 (시간 기반 학습)
Reveal.initialize({
  autoSlide: 5000,          // 5초 자동 전환
  autoSlideStoppable: true, // 사용자 조작 시 정지
  autoSlideMethod: () => Reveal.next(), // 커스텀 진행 로직
});

// 자동 진행 상태 이벤트
Reveal.on('autoslideresumed', () => {
  showTimerIndicator();
});
Reveal.on('autoslidepaused', () => {
  hideTimerIndicator();
});

// 2. Markdown 플러그인 - 콘텐츠 분리
// 외부 마크다운 파일에서 슬라이드 로드
```

```html
<section data-markdown="content/module1.md"
         data-separator="^\n---\n"
         data-separator-vertical="^\n--\n"
         data-separator-notes="^Note:"
         data-charset="utf-8">
</section>
```

---

## 2. 대안 라이브러리 비교 분석

### 2.1 라이브러리 비교표

| 기준 | Reveal.js | Swiper.js | Embla Carousel | Custom CSS |
|------|-----------|-----------|----------------|------------|
| **번들 크기** | ~450KB | ~35KB | ~7KB | 0KB |
| **2D 네비게이션** | ✅ 기본 지원 | ❌ | ❌ | 구현 필요 |
| **Fragment 지원** | ✅ 내장 | ❌ | ❌ | 구현 필요 |
| **프레젠테이션 특화** | ✅ 최적화 | ❌ | ❌ | - |
| **터치/모바일** | ✅ | ✅ 최적화 | ✅ 최적화 | 구현 필요 |
| **커스터마이징** | 중간 | 높음 | 매우 높음 | 완전 자유 |
| **러닝커브** | 낮음 | 낮음 | 중간 | 높음 |
| **React 통합** | 보통 | 좋음 | 훌륭함 | 완벽 |
| **접근성** | 중간 | 좋음 | 좋음 | 직접 구현 |
| **교육 기능** | ✅ 풍부 | 부족 | 부족 | 직접 구현 |

### 2.2 Swiper.js 교육 슬라이드 구현

```javascript
// Swiper.js - 모바일 우선 학습 카드
import Swiper from 'swiper';
import { Navigation, Pagination, EffectCards, A11y } from 'swiper/modules';

const learningSwiper = new Swiper('.learning-swiper', {
  modules: [Navigation, Pagination, EffectCards, A11y],

  // 카드 효과 (플래시카드 스타일)
  effect: 'cards',
  grabCursor: true,
  centeredSlides: true,

  // 접근성
  a11y: {
    prevSlideMessage: '이전 카드',
    nextSlideMessage: '다음 카드',
    firstSlideMessage: '첫 번째 카드',
    lastSlideMessage: '마지막 카드',
  },

  // 진행 표시
  pagination: {
    el: '.swiper-pagination',
    type: 'progressbar',
    renderProgressbar: (progressbarFillClass) => {
      return `
        <div class="custom-progress">
          <span class="${progressbarFillClass}"></span>
          <div class="progress-label">학습 진도</div>
        </div>
      `;
    }
  },

  // 이벤트
  on: {
    slideChange: (swiper) => {
      updateLearningState(swiper.activeIndex);
      announceForScreenReader(`카드 ${swiper.activeIndex + 1}/${swiper.slides.length}`);
    },
    reachEnd: () => {
      triggerCompletionAnimation();
      saveProgress('module-complete');
    }
  }
});
```

```css
/* Swiper 플래시카드 스타일 */
.learning-swiper {
  width: 100%;
  padding: 50px 0;
}

.swiper-slide {
  background: linear-gradient(135deg, #1a1a2e, #16213e);
  border-radius: 16px;
  padding: 40px;
  color: white;
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.4);

  /* 카드 앞/뒤 플립 효과 */
  &.is-flipped .card-back {
    transform: rotateY(0);
  }

  &.is-flipped .card-front {
    transform: rotateY(180deg);
  }
}

.card-inner {
  position: relative;
  transform-style: preserve-3d;
  transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

.card-front,
.card-back {
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}

.card-back {
  transform: rotateY(180deg);
}
```

### 2.3 Embla Carousel 교육 슬라이드

```typescript
// Embla Carousel - 고성능 커스텀 슬라이드
import EmblaCarousel, { EmblaCarouselType } from 'embla-carousel';

class EduSlideshow {
  private embla: EmblaCarouselType;
  private progressEl: HTMLElement;
  private currentFragmentIndex: number = 0;

  constructor(container: HTMLElement) {
    this.embla = EmblaCarousel(container, {
      loop: false,
      dragFree: false,
      containScroll: 'trimSnaps',

      // 스크롤 스냅 - 슬라이드 정밀 제어
      align: 'center',
      skipSnaps: false,
    });

    this.setupEvents();
    this.setupKeyboard();
  }

  private setupEvents(): void {
    this.embla.on('select', () => {
      const index = this.embla.selectedScrollSnap();
      this.updateProgress(index);
      this.resetFragments(index);
      this.announceSlide(index);
    });

    this.embla.on('settle', () => {
      // 슬라이드 안착 후 입장 애니메이션
      this.triggerEntryAnimations();
    });
  }

  private setupKeyboard(): void {
    document.addEventListener('keydown', (e) => {
      switch (e.key) {
        case 'ArrowRight':
        case ' ':
          this.nextOrFragment();
          break;
        case 'ArrowLeft':
          this.prevOrFragment();
          break;
      }
    });
  }

  // Fragment 로직 수동 구현
  private nextOrFragment(): void {
    const slide = this.embla.slideNodes()[this.embla.selectedScrollSnap()];
    const fragments = slide.querySelectorAll<HTMLElement>('[data-fragment]');
    const hiddenFragments = Array.from(fragments).filter(
      f => f.dataset.state !== 'shown'
    );

    if (hiddenFragments.length > 0) {
      hiddenFragments[0].dataset.state = 'shown';
      hiddenFragments[0].classList.add('fragment-shown');
      this.currentFragmentIndex++;
    } else {
      this.embla.scrollNext();
    }
  }

  private updateProgress(index: number): void {
    const total = this.embla.scrollSnapList().length;
    const percent = ((index + 1) / total) * 100;
    this.progressEl.style.width = `${percent}%`;
  }
}
```

### 2.4 순수 CSS 슬라이드 시스템

```css
/* CSS-only 슬라이드 - JavaScript 불필요 */
.slide-container {
  display: flex;
  overflow: hidden;
  scroll-snap-type: x mandatory;
  scroll-behavior: smooth;
  height: 100vh;
}

.slide {
  min-width: 100vw;
  height: 100vh;
  scroll-snap-align: start;
  scroll-snap-stop: always; /* 슬라이드 건너뛰기 방지 */

  display: grid;
  place-items: center;
  padding: 2rem;
}

/* CSS :target 기반 네비게이션 */
.slide:target {
  animation: slideIn 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(30px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

/* CSS Counter 기반 진행 표시 */
.slides-wrapper {
  counter-reset: slide-counter;
}

.slide {
  counter-increment: slide-counter;
}

.slide::after {
  content: counter(slide-counter) ' / ' attr(data-total);
  position: absolute;
  bottom: 20px;
  right: 20px;
  font-size: 0.8rem;
  opacity: 0.6;
}
```

---

## 3. 학습 UX 패턴 이론 및 구현

### 3.1 점진적 공개 (Progressive Disclosure)

**이론적 배경**: Miller의 법칙 - 단기 기억은 7±2 청크를 처리할 수 있다. 교육 콘텐츠는 한 슬라이드당 3-5개 핵심 포인트로 제한해야 한다.

```typescript
// Progressive Disclosure 컴포넌트
interface DisclosureItem {
  id: string;
  title: string;
  preview: string;    // 항상 표시
  detail: string;     // 클릭 시 표시
  complexity: 'basic' | 'intermediate' | 'advanced';
}

const ProgressiveDisclosure: React.FC<{items: DisclosureItem[]}> = ({ items }) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [learnerLevel, setLearnerLevel] = useState<string>('basic');

  // 학습자 수준에 따른 자동 필터링
  const visibleItems = items.filter(item => {
    const levels = ['basic', 'intermediate', 'advanced'];
    return levels.indexOf(item.complexity) <= levels.indexOf(learnerLevel);
  });

  return (
    <div className="disclosure-container">
      {/* 학습자 수준 선택 */}
      <LevelSelector
        current={learnerLevel}
        onChange={setLearnerLevel}
      />

      <AnimatePresence mode="popLayout">
        {visibleItems.map((item, index) => (
          <motion.div
            key={item.id}
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{
              delay: index * 0.08,
              type: 'spring',
              stiffness: 300,
              damping: 30
            }}
            className={`disclosure-item ${item.complexity}`}
          >
            {/* 항상 표시되는 미리보기 */}
            <div className="preview">
              <h3>{item.title}</h3>
              <p>{item.preview}</p>
            </div>

            {/* 확장 시 표시되는 상세 내용 */}
            <AnimatePresence>
              {expanded.has(item.id) && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                  className="detail"
                >
                  <div>{item.detail}</div>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              onClick={() => toggleExpand(item.id)}
              aria-expanded={expanded.has(item.id)}
              aria-controls={`detail-${item.id}`}
            >
              {expanded.has(item.id) ? '접기 ▲' : '더 보기 ▼'}
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
```

### 3.2 마이크로 인터랙션 (Micro-interactions)

마이크로 인터랙션은 즉각적인 피드백을 제공하여 학습자가 "올바른 길을 가고 있다"는 확신을 준다.

```typescript
// 학습 피드백 마이크로 인터랙션
const useLearningFeedback = () => {
  const [ripples, setRipples] = useState<Ripple[]>([]);

  // 정답 확인 시 파장 효과
  const triggerCorrectFeedback = useCallback((element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    const ripple = {
      id: Date.now(),
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      type: 'correct'
    };

    setRipples(prev => [...prev, ripple]);

    // 연쇄 피드백: 시각 → 촉각(진동) → 청각
    element.classList.add('feedback-correct');
    if ('vibrate' in navigator) navigator.vibrate([50, 30, 50]);
    playFeedbackSound('correct');

    setTimeout(() => {
      setRipples(prev => prev.filter(r => r.id !== ripple.id));
      element.classList.remove('feedback-correct');
    }, 1000);
  }, []);

  return { triggerCorrectFeedback };
};

// 호버 마이크로 인터랙션
const InteractiveCard: React.FC = ({ children, onLearn }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: MouseEvent) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setMousePos({ x, y });
  };

  return (
    <motion.div
      ref={cardRef}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => { setIsHovered(false); setMousePos({ x: 0, y: 0 }); }}
      onMouseMove={handleMouseMove}
      animate={{
        rotateX: isHovered ? mousePos.y * -10 : 0,
        rotateY: isHovered ? mousePos.x * 10 : 0,
        scale: isHovered ? 1.02 : 1,
        boxShadow: isHovered
          ? '0 20px 40px rgba(0,0,0,0.3)'
          : '0 4px 12px rgba(0,0,0,0.1)',
      }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      style={{ transformStyle: 'preserve-3d', cursor: 'pointer' }}
    >
      {children}

      {/* 광택 효과 오버레이 */}
      <motion.div
        className="gloss-overlay"
        animate={{
          background: isHovered
            ? `radial-gradient(circle at ${50 + mousePos.x * 100}% ${50 + mousePos.y * 100}%, rgba(255,255,255,0.15), transparent 60%)`
            : 'none'
        }}
      />
    </motion.div>
  );
};
```

### 3.3 시각적 계층 구조 (Visual Hierarchy)

```css
/* F-패턴 레이아웃 - 자연스러운 시선 흐름 */
.slide-content {
  display: grid;
  grid-template-areas:
    "title   title   title"
    "primary secondary tertiary"
    "cta     cta     cta";
  grid-template-columns: 2fr 1.5fr 1fr;
  gap: 1.5rem;
}

/* 주목도 계층 - 크기, 색상, 위치로 표현 */
.level-1 { /* 핵심 메시지 */
  font-size: clamp(2rem, 5vw, 4rem);
  font-weight: 800;
  color: var(--color-primary);
  text-shadow: 0 2px 20px rgba(52, 152, 219, 0.3);
}

.level-2 { /* 지원 내용 */
  font-size: clamp(1.2rem, 2.5vw, 1.8rem);
  font-weight: 500;
  color: var(--color-secondary);
}

.level-3 { /* 보조 정보 */
  font-size: clamp(0.9rem, 1.8vw, 1.2rem);
  font-weight: 400;
  color: var(--color-tertiary);
  opacity: 0.75;
}

/* Gestalt 원리: 근접성 */
.concept-group {
  display: flex;
  flex-direction: column;
  gap: 0.4rem; /* 관련 항목은 좁게 */
  margin-bottom: 2rem; /* 그룹 간 넓게 */
}

/* 시선 유도 화살표 효과 */
.visual-flow::after {
  content: '';
  display: block;
  width: 2px;
  height: 40px;
  background: linear-gradient(to bottom, var(--color-primary), transparent);
  margin: 0.5rem auto;
  animation: flowDown 1.5s ease-in-out infinite;
}

@keyframes flowDown {
  0%, 100% { opacity: 0.3; transform: scaleY(0.8); }
  50% { opacity: 1; transform: scaleY(1); }
}
```

### 3.4 인지적 부하 측정 및 적응형 UI

```typescript
// 학습자 행동 기반 인지 부하 추정
class CognitiveLoadMonitor {
  private metrics = {
    timeOnSlide: 0,
    scrollDepth: 0,
    clickRate: 0,
    errorRate: 0,
    pauseCount: 0,
  };

  private thresholds = {
    overloaded: 0.7,  // 70% 이상이면 과부하
    optimal: 0.4,     // 40% 대가 최적
    underloaded: 0.2, // 20% 미만이면 지루함
  };

  // 행동 신호를 인지 부하 점수로 변환
  calculateLoadScore(): number {
    const {
      timeOnSlide,
      scrollDepth,
      clickRate,
      errorRate,
      pauseCount
    } = this.metrics;

    // 각 지표의 가중 합산
    return (
      (timeOnSlide > 120 ? 0.3 : 0) +     // 2분 이상 체류
      (scrollDepth < 0.5 ? 0.2 : 0) +      // 절반도 안 읽음
      (errorRate > 0.3 ? 0.3 : 0) +         // 오류율 높음
      (pauseCount > 5 ? 0.2 : 0)            // 잦은 정지
    );
  }

  // 부하 수준에 따른 UI 적응
  adaptUI(score: number): UIAdaptation {
    if (score >= this.thresholds.overloaded) {
      return {
        action: 'simplify',
        suggestions: [
          '현재 슬라이드의 정보량 줄이기',
          '개념 분할 제안 팝업 표시',
          '요약 카드 활성화',
          '예시 추가 제공',
        ]
      };
    }

    if (score <= this.thresholds.underloaded) {
      return {
        action: 'enrich',
        suggestions: [
          '심화 내용 언락',
          '챌린지 문제 제시',
          '관련 개념 링크 노출',
        ]
      };
    }

    return { action: 'maintain', suggestions: [] };
  }
}
```

---

## 4. 애니메이션 구현 패턴

### 4.1 슬라이드 전환 효과

```css
/* 교육적 맥락에 맞는 전환 효과 모음 */

/* 1. 개념 심화: 아래로 내려가는 느낌 */
.transition-drill-down {
  animation: drillDown 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes drillDown {
  from {
    opacity: 0;
    transform: translateY(-30px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* 2. 개념 확장: 퍼지는 느낌 */
.transition-expand {
  animation: expandIn 0.4s ease-out;
}

@keyframes expandIn {
  from {
    opacity: 0;
    transform: scale(0.9);
    filter: blur(4px);
  }
  to {
    opacity: 1;
    transform: scale(1);
    filter: blur(0);
  }
}

/* 3. 주제 전환: 슬라이드 인 */
.transition-chapter {
  animation: chapterIn 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes chapterIn {
  from {
    opacity: 0;
    transform: translateX(60px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

/* 4. 복습 슬라이드: 페이드 (부드러운 전환) */
.transition-review {
  animation: gentleFade 0.8s ease;
}

@keyframes gentleFade {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* 5. 퀴즈 결과: 드라마틱 효과 */
.transition-result {
  animation: resultReveal 0.7s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes resultReveal {
  from {
    opacity: 0;
    transform: scale(0.5) rotate(-10deg);
  }
  to {
    opacity: 1;
    transform: scale(1) rotate(0);
  }
}
```

### 4.2 콘텐츠 등장 애니메이션

```css
/* 스태거드(순차) 등장 - CSS 변수 활용 */
.stagger-container > * {
  opacity: 0;
  transform: translateY(20px);
  animation: staggerAppear 0.5s ease forwards;
}

.stagger-container > *:nth-child(1) { animation-delay: 0.1s; }
.stagger-container > *:nth-child(2) { animation-delay: 0.2s; }
.stagger-container > *:nth-child(3) { animation-delay: 0.3s; }
.stagger-container > *:nth-child(4) { animation-delay: 0.4s; }
.stagger-container > *:nth-child(5) { animation-delay: 0.5s; }

/* CSS 변수로 동적 딜레이 */
.stagger-item {
  animation-delay: calc(var(--item-index, 0) * 0.1s);
}

@keyframes staggerAppear {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 타이핑 효과 - 핵심 문장 강조 */
.typewriter {
  overflow: hidden;
  white-space: nowrap;
  border-right: 3px solid var(--color-primary);
  width: 0;
  animation:
    typing 2s steps(40) forwards,
    blink 0.75s step-end infinite;
}

@keyframes typing {
  to { width: 100%; }
}

@keyframes blink {
  0%, 100% { border-color: transparent; }
  50% { border-color: var(--color-primary); }
}

/* 핵심 개념 하이라이트 - 마커 효과 */
.highlight-marker {
  position: relative;
  display: inline;
}

.highlight-marker::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: -4px;
  right: -4px;
  height: 35%;
  background: rgba(255, 235, 59, 0.5);
  z-index: -1;
  transform: scaleX(0);
  transform-origin: left;
  border-radius: 2px;
  animation: highlightReveal 0.6s ease 0.3s forwards;
}

@keyframes highlightReveal {
  to { transform: scaleX(1); }
}

/* 숫자 카운트업 효과 */
.count-up {
  font-variant-numeric: tabular-nums;
  animation: countUp 1.5s ease-out forwards;
}

@property --num {
  syntax: '<integer>';
  initial-value: 0;
  inherits: false;
}

.count-up {
  counter-reset: num var(--num);
  animation: count 2s ease-out forwards;
  content: counter(num);
}

@keyframes count {
  from { --num: 0; }
  to { --num: var(--target); }
}
```

### 4.3 강조 및 주목 효과

```css
/* 주목 유도 애니메이션 패턴 */

/* 1. 펄스 링 - 중요 요소 주목 */
.attention-ring {
  position: relative;
}

.attention-ring::before {
  content: '';
  position: absolute;
  inset: -8px;
  border: 2px solid var(--color-primary);
  border-radius: inherit;
  animation: pulseRing 2s ease-out infinite;
}

@keyframes pulseRing {
  0% {
    opacity: 1;
    transform: scale(1);
  }
  100% {
    opacity: 0;
    transform: scale(1.3);
  }
}

/* 2. 흔들기 - 오류/경고 피드백 */
.shake {
  animation: shake 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97);
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-8px); }
  20%, 40%, 60%, 80% { transform: translateX(8px); }
}

/* 3. 점프 - 정답/성공 피드백 */
.bounce-success {
  animation: bounceSuccess 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes bounceSuccess {
  0% { transform: scale(1); }
  40% { transform: scale(1.15); }
  70% { transform: scale(0.95); }
  100% { transform: scale(1); }
}

/* 4. 글로우 - 핵심 개념 강조 유지 */
.glow-emphasis {
  animation: glowPulse 3s ease-in-out infinite;
}

@keyframes glowPulse {
  0%, 100% {
    box-shadow: 0 0 10px rgba(52, 152, 219, 0.3);
  }
  50% {
    box-shadow: 0 0 30px rgba(52, 152, 219, 0.7),
                0 0 60px rgba(52, 152, 219, 0.3);
  }
}

/* 5. 스캔라인 - 정보 처리 중 표시 */
.scanning {
  position: relative;
  overflow: hidden;
}

.scanning::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(
    90deg,
    transparent,
    var(--color-primary),
    transparent
  );
  animation: scan 1.5s ease-in-out infinite;
}

@keyframes scan {
  0% { transform: translateY(0); }
  100% { transform: translateY(var(--element-height, 200px)); }
}
```

---

## 5. 인지 부하 최소화 디자인 원칙

### 5.1 이중 부호화 이론 구현

**이론**: 언어 정보와 시각 정보를 함께 제시하면 기억 보존율이 65%까지 향상된다 (Paivio, 1971).

```typescript
// 이중 부호화 컴포넌트 - 텍스트 + 시각화 동기화
const DualCodingSlide: React.FC<{
  concept: string;
  explanation: string;
  visualData: ChartData;
}> = ({ concept, explanation, visualData }) => {
  const [activePoint, setActivePoint] = useState<number | null>(null);

  return (
    <div className="dual-coding-layout">
      {/* 좌측: 언어 정보 */}
      <div className="verbal-channel">
        <h2>{concept}</h2>
        <ExplanationList
          items={explanation}
          onItemHover={(index) => setActivePoint(index)}
          activeItem={activePoint}
        />
      </div>

      {/* 우측: 시각 정보 - 텍스트와 동기화 */}
      <div className="visual-channel">
        <AnimatedChart
          data={visualData}
          highlightedPoint={activePoint}
          onPointHover={(index) => setActivePoint(index)}
        />
      </div>

      {/* 연결선 - 두 채널 연결 시각화 */}
      <ConnectionLines
        leftCount={explanation.length}
        rightCount={visualData.length}
        activeIndex={activePoint}
      />
    </div>
  );
};
```

### 5.2 청킹(Chunking) 레이아웃

```css
/* 정보 청킹 - 시각적 그룹화 */
.chunk-container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  margin: 2rem 0;
}

.chunk-item {
  /* 시각적 경계로 청크 분리 */
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 1.5rem;
  border: 1px solid rgba(255, 255, 255, 0.1);

  /* 최대 3-5개 항목 원칙 */
  & ul {
    list-style: none;
    padding: 0;
  }

  & li {
    padding: 0.4rem 0;
    border-bottom: 1px solid rgba(255,255,255,0.05);

    /* 청크 내 항목은 최대 5개 */
    &:nth-child(n+6) {
      display: none; /* 6번째부터 숨김 */
    }
  }
}

/* 청크 수 경고 - 인지 부하 시각화 */
.chunk-item[data-items="6"],
.chunk-item[data-items="7"] {
  border-color: rgba(243, 156, 18, 0.4);
}

.chunk-item[data-items="8"],
.chunk-item[data-items="9"] {
  border-color: rgba(231, 76, 60, 0.4);
}
```

### 5.3 관련성 신호 (Signaling) 구현

```css
/* 관련 정보 연결 시각화 */

/* 1. 연결선 애니메이션 */
.connection-line {
  stroke-dasharray: 1000;
  stroke-dashoffset: 1000;
  animation: drawLine 1s ease forwards;
}

@keyframes drawLine {
  to { stroke-dashoffset: 0; }
}

/* 2. 색상 코딩 시스템 */
:root {
  /* 개념 카테고리별 색상 */
  --cat-definition: #3498DB;   /* 정의: 파랑 */
  --cat-example: #2ECC71;      /* 예시: 초록 */
  --cat-warning: #E74C3C;      /* 주의: 빨강 */
  --cat-tip: #F39C12;          /* 팁: 주황 */
  --cat-recap: #9B59B6;        /* 복습: 보라 */
}

[data-type="definition"] {
  border-left: 4px solid var(--cat-definition);
  background: rgba(52, 152, 219, 0.08);
}

[data-type="example"] {
  border-left: 4px solid var(--cat-example);
  background: rgba(46, 204, 113, 0.08);
}

/* 3. 시각적 가중치 계층 */
.info-hierarchy {
  /* 제목: 가장 높은 시각적 가중치 */
  & h2 {
    font-size: 1em;
    font-weight: 800;
    letter-spacing: -0.02em;
  }

  /* 본문: 중간 가중치 */
  & p {
    font-size: 0.65em;
    font-weight: 400;
    line-height: 1.7;
  }

  /* 부연설명: 낮은 가중치 */
  & small {
    font-size: 0.5em;
    opacity: 0.6;
  }
}
```

### 5.4 작업 기억 지원 패턴

```typescript
// 컨텍스트 유지 - 현재 위치 항상 표시
const BreadcrumbNavigation: React.FC<{
  module: string;
  section: string;
  topic: string;
}> = ({ module, section, topic }) => {
  return (
    <motion.nav
      className="learning-breadcrumb"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      aria-label="학습 위치"
    >
      <ol>
        <motion.li layout>{module}</motion.li>
        <motion.li layout className="separator">›</motion.li>
        <motion.li layout>{section}</motion.li>
        <motion.li layout className="separator">›</motion.li>
        <motion.li layout className="current" aria-current="page">
          {topic}
        </motion.li>
      </ol>

      {/* 학습 맵 미리보기 */}
      <MiniMap currentPath={[module, section, topic]} />
    </motion.nav>
  );
};

// 핵심 개념 고정 패널 - 스크롤해도 보임
const StickyConceptPanel: React.FC<{concepts: string[]}> = ({ concepts }) => {
  const [isMinimized, setIsMinimized] = useState(false);

  return (
    <motion.aside
      className="sticky-concepts"
      animate={{ width: isMinimized ? 48 : 220 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <button onClick={() => setIsMinimized(v => !v)}>
        {isMinimized ? '📌' : '핵심 개념 ×'}
      </button>

      <AnimatePresence>
        {!isMinimized && (
          <motion.ul
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {concepts.map((concept, i) => (
              <motion.li
                key={concept}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: i * 0.05 }}
              >
                {concept}
              </motion.li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </motion.aside>
  );
};
```

---

## 6. 게이미피케이션 요소

### 6.1 진행 바 및 마일스톤 시스템

```typescript
// 다층 진행 표시 시스템
interface ProgressSystem {
  overall: number;      // 전체 과정 진도
  module: number;       // 현재 모듈 진도
  section: number;      // 현재 섹션 진도
  streak: number;       // 연속 학습 일수
  xp: number;          // 경험치
}

const LearningProgressBar: React.FC<{progress: ProgressSystem}> = ({ progress }) => {
  const prevXP = useRef(progress.xp);

  // XP 변화 감지 및 애니메이션
  useEffect(() => {
    if (progress.xp > prevXP.current) {
      triggerXPAnimation(progress.xp - prevXP.current);
      prevXP.current = progress.xp;
    }
  }, [progress.xp]);

  return (
    <div className="progress-system">
      {/* 전체 진도 */}
      <div className="progress-track overall">
        <label>전체 과정</label>
        <div className="bar-container">
          <motion.div
            className="bar-fill gradient-overall"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: progress.overall / 100 }}
            transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
          />
          {/* 마일스톤 마커 */}
          {[25, 50, 75].map(milestone => (
            <MilestoneMarker
              key={milestone}
              position={milestone}
              achieved={progress.overall >= milestone}
            />
          ))}
        </div>
        <span className="percent">{Math.round(progress.overall)}%</span>
      </div>

      {/* 섹션 진도 */}
      <div className="progress-track section">
        <label>현재 섹션</label>
        <SegmentedProgress
          segments={10}
          filled={Math.round(progress.section / 10)}
        />
      </div>

      {/* 연속 학습 스트릭 */}
      <StreakCounter count={progress.streak} />

      {/* XP 바 */}
      <XPBar current={progress.xp} nextLevel={calculateNextLevel(progress.xp)} />
    </div>
  );
};

// 세그먼트형 진행 바 (게이지 스타일)
const SegmentedProgress: React.FC<{segments: number; filled: number}> = ({
  segments,
  filled
}) => {
  return (
    <div className="segmented-bar">
      {Array.from({ length: segments }).map((_, i) => (
        <motion.div
          key={i}
          className={`segment ${i < filled ? 'filled' : ''}`}
          initial={false}
          animate={{
            backgroundColor: i < filled
              ? 'var(--color-primary)'
              : 'rgba(255,255,255,0.1)',
            scale: i === filled - 1 ? [1, 1.2, 1] : 1,
          }}
          transition={{
            delay: i < filled ? i * 0.05 : 0,
            scale: { duration: 0.3 }
          }}
        />
      ))}
    </div>
  );
};
```

### 6.2 업적 및 뱃지 애니메이션

```typescript
// 업적 잠금 해제 시스템
interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  condition: (stats: LearningStats) => boolean;
}

const AchievementUnlock: React.FC<{achievement: Achievement}> = ({ achievement }) => {
  const rarityConfig = {
    common:    { color: '#95A5A6', particles: 10, glow: false },
    rare:      { color: '#3498DB', particles: 20, glow: true },
    epic:      { color: '#9B59B6', particles: 35, glow: true },
    legendary: { color: '#F39C12', particles: 60, glow: true },
  };

  const config = rarityConfig[achievement.rarity];

  return (
    <motion.div
      className={`achievement-popup ${achievement.rarity}`}
      initial={{ y: 100, opacity: 0, scale: 0.5 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ y: -50, opacity: 0, scale: 0.9 }}
      transition={{
        type: 'spring',
        stiffness: 260,
        damping: 20,
      }}
    >
      {/* 파티클 효과 */}
      <ParticleExplosion
        count={config.particles}
        color={config.color}
        origin="center"
      />

      {/* 아이콘 */}
      <motion.div
        className="achievement-icon"
        animate={{
          rotate: [0, -15, 15, -10, 10, 0],
          scale: [1, 1.2, 1],
        }}
        transition={{ delay: 0.3, duration: 0.6 }}
      >
        {achievement.icon}
      </motion.div>

      {/* 레어도 글로우 */}
      {config.glow && (
        <motion.div
          className="glow-ring"
          animate={{
            boxShadow: [
              `0 0 20px ${config.color}40`,
              `0 0 60px ${config.color}80`,
              `0 0 20px ${config.color}40`,
            ]
          }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      )}

      <div className="achievement-text">
        <span className="unlock-label">업적 달성!</span>
        <h3>{achievement.title}</h3>
        <p>{achievement.description}</p>
      </div>
    </motion.div>
  );
};
```

```css
/* 업적 뱃지 스타일 */
.achievement-badge {
  position: relative;
  width: 80px;
  height: 80px;
  display: grid;
  place-items: center;

  /* 레어도별 테두리 */
  &.legendary {
    &::before {
      content: '';
      position: absolute;
      inset: -3px;
      border-radius: 50%;
      background: conic-gradient(
        #F39C12, #E67E22, #F1C40F, #E67E22, #F39C12
      );
      animation: rotateBorder 3s linear infinite;
    }
  }
}

@keyframes rotateBorder {
  to { transform: rotate(360deg); }
}

/* 업적 카운터 */
.achievement-counter {
  font-variant-numeric: tabular-nums;

  /* 숫자 변경 시 롤 애니메이션 */
  &.rolling {
    animation: numberRoll 0.3s ease;
  }
}

@keyframes numberRoll {
  0% { transform: translateY(-50%); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}
```

### 6.3 완료 효과 (Completion Effects)

```typescript
// 모듈 완료 축하 화면
const CompletionCelebration: React.FC<{
  moduleName: string;
  score: number;
  timeSpent: number;
}> = ({ moduleName, score, timeSpent }) => {
  const controls = useAnimation();

  useEffect(() => {
    // 단계별 축하 시퀀스
    const sequence = async () => {
      await controls.start('confetti');    // 1. 컨페티 폭발
      await controls.start('scoreReveal'); // 2. 점수 공개
      await controls.start('badgeReveal'); // 3. 뱃지 등장
      await controls.start('summaryShow'); // 4. 요약 표시
    };

    sequence();
  }, []);

  return (
    <div className="completion-screen">
      {/* 컨페티 */}
      <ConfettiExplosion
        force={0.8}
        duration={3000}
        particleCount={250}
        colors={['#3498DB', '#2ECC71', '#F39C12', '#9B59B6']}
      />

      {/* 완료 메시지 */}
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{
          type: 'spring',
          stiffness: 200,
          damping: 15,
          delay: 0.2
        }}
        className="completion-badge"
      >
        🏆
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        {moduleName} 완료!
      </motion.h1>

      {/* 점수 카운트업 */}
      <motion.div
        className="score-display"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        <AnimatedCounter
          from={0}
          to={score}
          duration={1.5}
          suffix="점"
        />
      </motion.div>

      {/* 학습 통계 */}
      <motion.div
        className="learning-stats"
        variants={{
          hidden: { opacity: 0 },
          visible: {
            opacity: 1,
            transition: { staggerChildren: 0.1, delayChildren: 1.2 }
          }
        }}
        initial="hidden"
        animate="visible"
      >
        {[
          { label: '소요 시간', value: formatTime(timeSpent), icon: '⏱' },
          { label: '정확도', value: `${score}%`, icon: '🎯' },
          { label: '연속 학습', value: '5일', icon: '🔥' },
        ].map(stat => (
          <motion.div
            key={stat.label}
            className="stat-item"
            variants={{
              hidden: { y: 20, opacity: 0 },
              visible: { y: 0, opacity: 1 }
            }}
          >
            <span>{stat.icon}</span>
            <strong>{stat.value}</strong>
            <label>{stat.label}</label>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
};
```

### 6.4 퀴즈 인터랙션 패턴

```typescript
// 실시간 피드백 퀴즈 컴포넌트
const InteractiveQuiz: React.FC<{question: Question}> = ({ question }) => {
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);

  const handleAnswer = (index: number) => {
    if (revealed) return;
    setSelected(index);
    setRevealed(true);

    const isCorrect = index === question.correctIndex;

    if (isCorrect) {
      // 정답: 즉각적인 긍정 피드백
      playSound('correct');
      triggerConfetti({ origin: { y: 0.7 }, particleCount: 50 });
      updateXP(+10);
    } else {
      // 오답: 부드러운 수정 피드백 (처벌적이지 않게)
      playSound('incorrect');
      showExplanation(question.explanation);
    }
  };

  return (
    <div className="quiz-container">
      {/* 타이머 바 */}
      <motion.div
        className="timer-bar"
        initial={{ scaleX: 1 }}
        animate={{ scaleX: 0 }}
        transition={{ duration: timeLeft, ease: 'linear' }}
        style={{ transformOrigin: 'left' }}
        onAnimationComplete={() => !revealed && handleAnswer(-1)}
      />

      <h2 className="question">{question.text}</h2>

      <div className="options">
        {question.options.map((option, index) => (
          <motion.button
            key={index}
            className={`option ${
              revealed
                ? index === question.correctIndex
                  ? 'correct'
                  : index === selected
                    ? 'incorrect'
                    : 'dimmed'
                : ''
            }`}
            onClick={() => handleAnswer(index)}
            whileHover={!revealed ? { scale: 1.02, x: 8 } : {}}
            whileTap={!revealed ? { scale: 0.98 } : {}}
            animate={
              revealed && index === question.correctIndex
                ? { scale: [1, 1.05, 1] }
                : {}
            }
            transition={{ duration: 0.3 }}
          >
            <span className="option-label">
              {String.fromCharCode(65 + index)}
            </span>
            {option}

            {/* 정오답 아이콘 */}
            <AnimatePresence>
              {revealed && (
                <motion.span
                  className="result-icon"
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', delay: 0.1 }}
                >
                  {index === question.correctIndex ? '✓' : index === selected ? '✗' : ''}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        ))}
      </div>

      {/* 해설 패널 */}
      <AnimatePresence>
        {revealed && (
          <motion.div
            className="explanation-panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
          >
            <h3>해설</h3>
            <p>{question.explanation}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
```

---

## 7. CSS 애니메이션 & Framer Motion 패턴

### 7.1 교육 맥락 Framer Motion 훅

```typescript
// 교육용 공통 애니메이션 훅
export const useEduAnimations = () => {
  // 슬라이드 입장 변형
  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? '100%' : '-100%',
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction < 0 ? '100%' : '-100%',
      opacity: 0,
    }),
  };

  // 콘텐츠 스태거 변형
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: 'spring',
        stiffness: 300,
        damping: 30,
      },
    },
  };

  // 강조 펄스
  const emphasisVariants = {
    normal: { scale: 1, opacity: 1 },
    highlight: {
      scale: 1.05,
      opacity: 1,
      transition: {
        repeat: 3,
        repeatType: 'reverse' as const,
        duration: 0.4,
      },
    },
  };

  return { slideVariants, containerVariants, itemVariants, emphasisVariants };
};

// 페이지 전환 래퍼
export const SlideTransition: React.FC<{
  children: React.ReactNode;
  slideIndex: number;
}> = ({ children, slideIndex }) => {
  const [prevIndex, setPrevIndex] = useState(slideIndex);
  const direction = slideIndex > prevIndex ? 1 : -1;

  useEffect(() => {
    setPrevIndex(slideIndex);
  }, [slideIndex]);

  const { slideVariants } = useEduAnimations();

  return (
    <AnimatePresence initial={false} custom={direction} mode="wait">
      <motion.div
        key={slideIndex}
        custom={direction}
        variants={slideVariants}
        initial="enter"
        animate="center"
        exit="exit"
        transition={{
          x: { type: 'spring', stiffness: 300, damping: 30 },
          opacity: { duration: 0.15 },
        }}
        className="slide-page"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};
```

### 7.2 고급 CSS 애니메이션 패턴

```css
/* 교육 콘텐츠 전용 애니메이션 라이브러리 */

/* ===== 입장 효과 ===== */

/* 지식 빌드업 - 아래에서 쌓이는 효과 */
.build-up {
  animation: buildUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

@keyframes buildUp {
  from {
    opacity: 0;
    transform: translateY(40px) scaleY(0.8);
    filter: blur(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0) scaleY(1);
    filter: blur(0);
  }
}

/* 개념 결정화 - 흐림에서 선명으로 */
.crystallize {
  animation: crystallize 0.8s ease-out both;
}

@keyframes crystallize {
  from {
    opacity: 0;
    filter: blur(20px) saturate(0);
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    filter: blur(0) saturate(1);
    transform: scale(1);
  }
}

/* ===== 강조 효과 ===== */

/* 네온 하이라이트 */
.neon-highlight {
  text-shadow:
    0 0 7px var(--color-primary),
    0 0 10px var(--color-primary),
    0 0 21px var(--color-primary);
  animation: neonFlicker 1.5s ease-in-out;
}

@keyframes neonFlicker {
  0%, 19%, 21%, 23%, 25%, 54%, 56%, 100% {
    text-shadow:
      0 0 7px var(--color-primary),
      0 0 10px var(--color-primary),
      0 0 21px var(--color-primary);
  }
  20%, 24%, 55% {
    text-shadow: none;
  }
}

/* 마커 펜 강조 */
.marker-highlight {
  background-image: linear-gradient(
    120deg,
    transparent 0%,
    transparent 50%,
    #FFEAA7 50%
  );
  background-size: 200% 100%;
  background-position: 0 0;
  animation: markerDraw 0.5s ease forwards 0.3s;
}

@keyframes markerDraw {
  to { background-position: -100% 0; }
}

/* ===== 숫자/통계 효과 ===== */

/* 숫자 드럼롤 */
.drum-roll {
  animation: drumRoll 0.8s steps(10) both;
}

@keyframes drumRoll {
  from { transform: translateY(-200%); }
  to { transform: translateY(0); }
}

/* ===== 관계 시각화 ===== */

/* SVG 경로 그리기 */
.path-draw {
  stroke-dasharray: var(--path-length);
  stroke-dashoffset: var(--path-length);
  animation: drawPath 1.5s ease-in-out forwards;
}

@keyframes drawPath {
  to { stroke-dashoffset: 0; }
}

/* 연결 노드 효과 */
.node-appear {
  animation: nodeAppear 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

@keyframes nodeAppear {
  from {
    transform: scale(0);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

/* ===== 접근성 - 모션 감소 모드 ===== */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }

  .build-up,
  .crystallize,
  .neon-highlight {
    animation: none;
    opacity: 1;
    transform: none;
    filter: none;
  }
}
```

### 7.3 Framer Motion 고급 패턴

```typescript
// 레이아웃 전환 - 리스트 아이템 추가/제거 시 자연스러운 이동
const AnimatedConceptList: React.FC<{items: ConceptItem[]}> = ({ items }) => {
  return (
    <motion.ul layout>
      <AnimatePresence>
        {items.map(item => (
          <motion.li
            key={item.id}
            layout                          // 레이아웃 변경 시 자동 보간
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{
              layout: { duration: 0.3 },
              opacity: { duration: 0.2 },
              height: { duration: 0.3 },
            }}
          >
            {item.content}
          </motion.li>
        ))}
      </AnimatePresence>
    </motion.ul>
  );
};

// 공유 레이아웃 - 상세 페이지 확장 효과
const ConceptCard: React.FC<{concept: Concept}> = ({ concept }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <>
      <motion.div
        layoutId={`card-${concept.id}`}  // 공유 layoutId
        className={`concept-card ${isExpanded ? 'expanded' : ''}`}
        onClick={() => setIsExpanded(true)}
        style={{ borderRadius: 12 }}
      >
        <motion.h3 layoutId={`title-${concept.id}`}>
          {concept.title}
        </motion.h3>

        {/* 축소 상태에서만 보이는 미리보기 */}
        <AnimatePresence>
          {!isExpanded && (
            <motion.p
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="preview"
            >
              {concept.preview}
            </motion.p>
          )}
        </AnimatePresence>
      </motion.div>

      {/* 확장 오버레이 */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div className="overlay" onClick={() => setIsExpanded(false)}>
            <motion.div
              layoutId={`card-${concept.id}`}  // 동일 layoutId로 연결
              className="concept-card expanded-view"
              style={{ borderRadius: 12 }}
            >
              <motion.h3 layoutId={`title-${concept.id}`}>
                {concept.title}
              </motion.h3>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ delay: 0.15 }}
              >
                {concept.fullContent}
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

// 물리 기반 드래그 - 직관적인 학습 카드 정렬
const DraggableFlashCard: React.FC<{card: FlashCard}> = ({ card }) => {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-30, 30]);
  const opacity = useTransform(
    x,
    [-200, -100, 0, 100, 200],
    [0.5, 1, 1, 1, 0.5]
  );

  // 드래그 방향으로 색상 변경
  const backgroundColor = useTransform(
    x,
    [-100, 0, 100],
    ['rgba(231, 76, 60, 0.2)', 'rgba(0,0,0,0)', 'rgba(46, 204, 113, 0.2)']
  );

  const handleDragEnd = (event: any, info: PanInfo) => {
    if (info.offset.x > 100) {
      // 오른쪽: 알고 있음
      markAsKnown(card.id);
    } else if (info.offset.x < -100) {
      // 왼쪽: 모름 (복습 대기열에 추가)
      addToReviewQueue(card.id);
    }
    // 중앙 복귀
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      className="flashcard"
      style={{ x, y, rotate, opacity, backgroundColor }}
      drag
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      dragElastic={0.7}
      onDragEnd={handleDragEnd}
      whileDrag={{ cursor: 'grabbing', scale: 1.05 }}
    >
      {/* 방향 힌트 표시 */}
      <motion.div
        className="swipe-hint left"
        style={{ opacity: useTransform(x, [0, -50], [0, 1]) }}
      >
        모르겠어요 ←
      </motion.div>
      <motion.div
        className="swipe-hint right"
        style={{ opacity: useTransform(x, [0, 50], [0, 1]) }}
      >
        → 알고 있어요
      </motion.div>

      <div className="card-content">
        <h3>{card.question}</h3>
      </div>
    </motion.div>
  );
};
```

---

## 8. 실무 적용 컴포넌트 패턴

### 8.1 완성형 교육 슬라이드 시스템

```typescript
// 전체 학습 슬라이드 시스템 아키텍처
interface LearningSlide {
  id: string;
  type: 'intro' | 'concept' | 'example' | 'practice' | 'quiz' | 'summary';
  title: string;
  content: SlideContent;
  fragments?: Fragment[];
  notes?: string;
  duration?: number;         // 예상 소요 시간(초)
  prerequisites?: string[];  // 선수 슬라이드 ID
}

const EduSlideSystem: React.FC<{slides: LearningSlide[]}> = ({ slides }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [fragmentIndex, setFragmentIndex] = useState(0);
  const [completedSlides, setCompletedSlides] = useState<Set<string>>(new Set());
  const [startTime] = useState(Date.now());

  const currentSlide = slides[currentIndex];
  const progress = (currentIndex / (slides.length - 1)) * 100;

  // 키보드 네비게이션
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        advanceSlide();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        retreatSlide();
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [currentIndex, fragmentIndex]);

  const advanceSlide = () => {
    const hasMoreFragments = currentSlide.fragments &&
      fragmentIndex < currentSlide.fragments.length - 1;

    if (hasMoreFragments) {
      setFragmentIndex(f => f + 1);
    } else {
      // 슬라이드 완료 기록
      setCompletedSlides(prev => new Set([...prev, currentSlide.id]));

      if (currentIndex < slides.length - 1) {
        setCurrentIndex(i => i + 1);
        setFragmentIndex(0);
      }
    }
  };

  return (
    <div className="edu-slide-system">
      {/* 진행 헤더 */}
      <header className="slide-header">
        <BreadcrumbNavigation slide={currentSlide} />
        <ProgressBar value={progress} />
        <SlideCounter current={currentIndex + 1} total={slides.length} />
      </header>

      {/* 슬라이드 영역 */}
      <main className="slide-area">
        <SlideTransition slideIndex={currentIndex}>
          <SlideRenderer
            slide={currentSlide}
            activeFragmentIndex={fragmentIndex}
            onComplete={() => setCompletedSlides(
              prev => new Set([...prev, currentSlide.id])
            )}
          />
        </SlideTransition>
      </main>

      {/* 네비게이션 */}
      <nav className="slide-nav">
        <button
          onClick={retreatSlide}
          disabled={currentIndex === 0 && fragmentIndex === 0}
          aria-label="이전으로"
        >
          ←
        </button>

        {/* 슬라이드 점 네비게이션 */}
        <DotNavigation
          slides={slides}
          currentIndex={currentIndex}
          completedSlides={completedSlides}
          onNavigate={setCurrentIndex}
        />

        <button onClick={advanceSlide} aria-label="다음으로">
          {currentIndex === slides.length - 1 ? '완료' : '→'}
        </button>
      </nav>

      {/* 학습 노트 (강사 모드) */}
      {isInstructorMode && (
        <SpeakerPanel notes={currentSlide.notes} />
      )}
    </div>
  );
};
```

### 8.2 개념 맵 시각화 컴포넌트

```typescript
// 지식 그래프 - 개념 간 관계 시각화
const ConceptMap: React.FC<{nodes: ConceptNode[]; edges: ConceptEdge[]}> = ({
  nodes,
  edges
}) => {
  const [activeNode, setActiveNode] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // D3-like 포스 레이아웃 (CSS transform 기반)
  const positions = useForceLayout(nodes, edges, {
    width: 800,
    height: 500,
    strength: -200,
    linkDistance: 100,
  });

  return (
    <div className="concept-map-container">
      <svg ref={svgRef} viewBox="0 0 800 500">
        {/* 연결선 */}
        {edges.map(edge => (
          <ConceptEdgeLine
            key={`${edge.source}-${edge.target}`}
            edge={edge}
            sourcePos={positions[edge.source]}
            targetPos={positions[edge.target]}
            isHighlighted={
              activeNode === edge.source || activeNode === edge.target
            }
          />
        ))}

        {/* 노드 */}
        {nodes.map(node => (
          <ConceptNodeCircle
            key={node.id}
            node={node}
            position={positions[node.id]}
            isActive={activeNode === node.id}
            isRelated={
              activeNode
                ? edges.some(
                    e => (e.source === activeNode && e.target === node.id) ||
                         (e.target === activeNode && e.source === node.id)
                  )
                : false
            }
            onClick={() => setActiveNode(
              activeNode === node.id ? null : node.id
            )}
          />
        ))}
      </svg>

      {/* 선택된 노드 상세 */}
      <AnimatePresence>
        {activeNode && (
          <motion.div
            className="node-detail"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
          >
            <NodeDetail node={nodes.find(n => n.id === activeNode)!} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
```

### 8.3 반응형 코드 하이라이터 (교육용)

```typescript
// 단계별 코드 설명 컴포넌트
const StepByStepCode: React.FC<{
  code: string;
  steps: CodeStep[];
}> = ({ code, steps }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const step = steps[currentStep];

  return (
    <div className="step-code-container">
      {/* 코드 패널 */}
      <div className="code-panel">
        <pre>
          {code.split('\n').map((line, lineNum) => (
            <motion.div
              key={lineNum}
              className={`code-line ${
                step.highlightLines.includes(lineNum + 1) ? 'highlighted' : ''
              }`}
              animate={{
                backgroundColor: step.highlightLines.includes(lineNum + 1)
                  ? 'rgba(52, 152, 219, 0.2)'
                  : 'transparent',
                x: step.highlightLines.includes(lineNum + 1) ? 4 : 0,
              }}
              transition={{ duration: 0.3 }}
            >
              <span className="line-number">{lineNum + 1}</span>
              <code dangerouslySetInnerHTML={{ __html: highlightSyntax(line) }} />
            </motion.div>
          ))}
        </pre>
      </div>

      {/* 설명 패널 */}
      <div className="explanation-panel">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="step-explanation"
          >
            <span className="step-badge">Step {currentStep + 1}</span>
            <h3>{step.title}</h3>
            <p>{step.explanation}</p>

            {step.analogy && (
              <div className="analogy-box">
                <span>💡 비유</span>
                <p>{step.analogy}</p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* 스텝 네비게이션 */}
        <div className="step-controls">
          <button
            onClick={() => setCurrentStep(s => Math.max(0, s - 1))}
            disabled={currentStep === 0}
          >
            ← 이전 단계
          </button>

          <div className="step-dots">
            {steps.map((_, i) => (
              <motion.button
                key={i}
                className={`dot ${i === currentStep ? 'active' : ''} ${
                  i < currentStep ? 'completed' : ''
                }`}
                onClick={() => setCurrentStep(i)}
                whileHover={{ scale: 1.3 }}
                animate={{
                  scale: i === currentStep ? 1.2 : 1,
                }}
              />
            ))}
          </div>

          <button
            onClick={() => setCurrentStep(s => Math.min(steps.length - 1, s + 1))}
            disabled={currentStep === steps.length - 1}
          >
            다음 단계 →
          </button>
        </div>
      </div>
    </div>
  );
};
```

### 8.4 성능 최적화 패턴

```typescript
// GPU 가속 애니메이션 - will-change 관리
const useGPUAcceleration = (isAnimating: boolean) => {
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!elementRef.current) return;

    if (isAnimating) {
      // 애니메이션 직전에만 will-change 설정
      elementRef.current.style.willChange = 'transform, opacity';
    } else {
      // 애니메이션 완료 후 즉시 해제 (메모리 회수)
      elementRef.current.style.willChange = 'auto';
    }
  }, [isAnimating]);

  return elementRef;
};

// 가상화된 슬라이드 렌더링 - 대규모 슬라이드 덱 최적화
const VirtualizedSlides: React.FC<{
  slides: LearningSlide[];
  currentIndex: number;
}> = ({ slides, currentIndex }) => {
  // 현재 ± 2 슬라이드만 렌더링
  const RENDER_BUFFER = 2;

  const visibleSlides = slides
    .map((slide, index) => ({ slide, index }))
    .filter(({ index }) =>
      Math.abs(index - currentIndex) <= RENDER_BUFFER
    );

  return (
    <div className="slide-viewport">
      {visibleSlides.map(({ slide, index }) => (
        <div
          key={slide.id}
          className="slide-slot"
          style={{
            transform: `translateX(${(index - currentIndex) * 100}%)`,
            // GPU 합성 레이어로 분리
            transform: `translate3d(${(index - currentIndex) * 100}%, 0, 0)`,
            willChange: Math.abs(index - currentIndex) <= 1 ? 'transform' : 'auto',
          }}
        >
          <Suspense fallback={<SlideLoader />}>
            <LazySlide slide={slide} isActive={index === currentIndex} />
          </Suspense>
        </div>
      ))}
    </div>
  );
};

// CSS containment - 렌더링 격리
```

```css
/* CSS Containment - 슬라이드 렌더링 최적화 */
.slide {
  contain: layout style paint; /* 레이아웃 경계 격리 */
  content-visibility: auto;     /* 뷰포트 밖 렌더링 스킵 */
  contain-intrinsic-size: 100vw 100vh; /* 크기 힌트 */
}

/* 활성 슬라이드만 풀 렌더링 */
.slide.active {
  contain: none;
  content-visibility: visible;
}

/* 애니메이션 성능 - 컴포지터 레이어만 사용 */
.slide-animated {
  transform: translateZ(0);    /* GPU 레이어 생성 */
  backface-visibility: hidden; /* 3D 렌더링 최적화 */

  /* 피해야 할 속성 (리플로우 유발) */
  /* width, height, margin, padding, top, left 애니메이션 금지 */

  /* 사용 권장 속성 (컴포지터) */
  /* transform, opacity, filter 사용 */
}
```

---

## 핵심 원칙 요약

### 교육 효과를 높이는 7가지 설계 원칙

| 원칙 | 설명 | 구현 방법 |
|------|------|----------|
| **점진적 공개** | 한 번에 하나의 개념만 | Fragment 시스템, 단계별 공개 |
| **이중 부호화** | 시각 + 언어 동시 제공 | 아이콘, 다이어그램, 텍스트 동기화 |
| **즉각 피드백** | 행동 직후 반응 제공 | 마이크로 인터랙션, 사운드 피드백 |
| **인지 부하 최적화** | 7±2 법칙 준수 | 청킹, 색상 코딩, 공백 활용 |
| **자기 효능감 지원** | 성취 경험 설계 | 진행 바, 업적, 긍정적 피드백 |
| **능동적 학습 유도** | 수동 → 능동 전환 | 퀴즈, 드래그, 예측 활동 |
| **접근성 보장** | 모든 학습자 포용 | ARIA, 키보드 네비, 모션 감소 |

### 성능 목표

- 슬라이드 전환: **< 16ms** (60fps 유지)
- 첫 콘텐츠 로드: **< 1.5초**
- Fragment 애니메이션: **< 300ms**
- 사용자 입력 반응: **< 100ms**
- 번들 크기 (Reveal.js 기준): **< 500KB gzip**

---

*참고 라이브러리 버전: Reveal.js 5.x, Framer Motion 11.x, Swiper.js 11.x, Embla Carousel 8.x*