# Next.js + Tailwind CSS 인터랙티브 웹 슬라이드 UI 기술 레퍼런스

> VOD/교육 콘텐츠를 인터랙티브 지식 슬라이드로 전환하기 위한 완전한 기술 구현 가이드
> 기준: Next.js 15 (App Router) · Tailwind CSS v4 · Framer Motion · Zustand

---

## 목차

1. [아키텍처 개요](#1-아키텍처-개요)
2. [Next.js App Router 슬라이드 라우팅 설계](#2-nextjs-app-router-슬라이드-라우팅-설계)
3. [Tailwind CSS 슬라이드 레이아웃 구현](#3-tailwind-css-슬라이드-레이아웃-구현)
4. [상태 관리 전략 (Zustand)](#4-상태-관리-전략-zustand)
5. [Framer Motion 슬라이드 애니메이션](#5-framer-motion-슬라이드-애니메이션)
6. [인터랙티브 컴포넌트 구현](#6-인터랙티브-컴포넌트-구현)
7. [키보드 내비게이션 & 접근성](#7-키보드-내비게이션--접근성)
8. [전체 통합 예시](#8-전체-통합-예시)

---

## 1. 아키텍처 개요

### 전체 디렉토리 구조

```
app/
├── courses/
│   └── [courseId]/
│       ├── layout.tsx              # 코스 레이아웃 (사이드바, 진행률)
│       ├── page.tsx                # 코스 인트로 페이지
│       └── slides/
│           ├── layout.tsx          # 슬라이드 공통 레이아웃 (풀스크린)
│           ├── [slideId]/
│           │   └── page.tsx        # 개별 슬라이드 페이지
│           └── @quiz/              # 병렬 라우트: 퀴즈 패널
│               └── page.tsx
├── components/
│   ├── slides/
│   │   ├── SlideContainer.tsx      # 슬라이드 래퍼 (애니메이션)
│   │   ├── SlideNavigation.tsx     # 이전/다음 버튼, 키보드
│   │   ├── SlideProgress.tsx       # 진행률 바
│   │   └── SlideBookmark.tsx       # 북마크 버튼
│   ├── quiz/
│   │   ├── QuizCard.tsx            # 퀴즈 카드
│   │   ├── QuizOptions.tsx         # 선택지 목록
│   │   └── QuizResult.tsx          # 결과 피드백
│   └── ui/
│       ├── ProgressBar.tsx
│       └── Highlight.tsx           # 텍스트 하이라이트
├── store/
│   ├── useSlideStore.ts            # Zustand 슬라이드 상태
│   ├── useQuizStore.ts             # Zustand 퀴즈 상태
│   └── useBookmarkStore.ts         # Zustand 북마크 + persist
└── lib/
    ├── slides.ts                   # 슬라이드 데이터 타입/fetch
    └── keyboard.ts                 # 키보드 이벤트 유틸
```

### 핵심 설계 원칙

| 원칙 | 설명 |
|---|---|
| **서버/클라이언트 경계 명확화** | 슬라이드 데이터 fetch는 Server Component, 인터랙션은 Client Component |
| **URL = 상태** | 현재 슬라이드 위치를 항상 URL에 반영하여 공유·북마크 가능 |
| **점진적 향상** | JS 비활성화 환경에서도 기본 탐색 동작 보장 |
| **퍼포먼스 우선** | `transform`·`opacity`만 애니메이션, LazyMotion으로 번들 최소화 |

---

## 2. Next.js App Router 슬라이드 라우팅 설계

### 2-1. 동적 라우트 구조

슬라이드 탐색은 `[courseId]/slides/[slideId]` 형태의 중첩 동적 라우트로 표현합니다.

```typescript
// app/courses/[courseId]/slides/[slideId]/page.tsx
import { notFound } from 'next/navigation'
import { getSlide, getCourse } from '@/lib/slides'
import SlideContainer from '@/components/slides/SlideContainer'

// Next.js 15: params는 Promise — 반드시 await
export default async function SlidePage({
  params,
}: {
  params: Promise<{ courseId: string; slideId: string }>
}) {
  const { courseId, slideId } = await params

  const [course, slide] = await Promise.all([
    getCourse(courseId),
    getSlide(courseId, slideId),
  ])

  if (!course || !slide) notFound()

  return (
    <SlideContainer
      slide={slide}
      courseId={courseId}
      totalSlides={course.slideCount}
    />
  )
}

// 빌드 타임에 정적 생성 (선택적)
export async function generateStaticParams() {
  const courses = await fetch('https://api.example.com/courses').then(r => r.json())

  return courses.flatMap((course: { id: string; slides: { id: string }[] }) =>
    course.slides.map(slide => ({
      courseId: course.id,
      slideId: slide.id,
    }))
  )
}
```

### 2-2. 슬라이드 전용 풀스크린 레이아웃

```typescript
// app/courses/[courseId]/slides/layout.tsx
export default function SlidesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 bg-slate-900 overflow-hidden">
      <div className="absolute top-0 left-0 right-0 z-50">
        <SlideProgressBar />
      </div>
      <main
        id="main-content"
        className="h-full w-full"
        aria-live="polite"
        aria-atomic="true"
      >
        {children}
      </main>
      <div className="absolute bottom-0 left-0 right-0 z-50">
        <SlideNavigation />
      </div>
    </div>
  )
}
```

### 2-3. Template.tsx — 페이지 전환 애니메이션

> **중요:** `layout.tsx`는 네비게이션 시 리렌더링되지 않습니다. 페이지 전환 애니메이션은 반드시 `template.tsx`에서 처리해야 합니다.

```typescript
// app/courses/[courseId]/slides/template.tsx
'use client'
import { motion } from 'framer-motion'

export default function SlideTemplate({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 60 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -60 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="h-full w-full"
    >
      {children}
    </motion.div>
  )
}
```

---

## 3. Tailwind CSS 슬라이드 레이아웃 구현

### 3-1. 풀스크린 슬라이드 기본 레이아웃

```tsx
export function SlideLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950">
      {children}
    </div>
  )
}

export function SlideContent({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 py-12 md:px-16 lg:px-24 overflow-y-auto">
      <div className="w-full max-w-4xl mx-auto">
        {children}
      </div>
    </div>
  )
}

export function SlideTitle({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white leading-tight mb-6 tracking-tight">
      {children}
    </h1>
  )
}
```

### 3-2. 스크롤 스냅 기반 세로 슬라이드

```tsx
export function ScrollSnapSlides({ slides }: { slides: Slide[] }) {
  return (
    <div className="h-screen overflow-y-scroll snap-y snap-mandatory scroll-smooth">
      {slides.map((slide, i) => (
        <section
          key={slide.id}
          className={`
            h-screen w-full flex-shrink-0
            snap-start snap-always
            flex flex-col items-center justify-center
            bg-gradient-to-br ${slide.gradient}
          `}
        >
          <div className="max-w-4xl px-8 text-center">
            <SlideTitle>{slide.title}</SlideTitle>
            <SlideBody>{slide.content}</SlideBody>
          </div>
        </section>
      ))}
    </div>
  )
}
```

### 3-3. 슬라이드 타입별 레이아웃

```tsx
// 2단 분할 레이아웃
export function SplitSlide({ title, content, image }: SplitSlideProps) {
  return (
    <SlideLayout>
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-0">
        <div className="flex flex-col justify-center px-8 md:px-12 py-10 border-r border-slate-700/50">
          <SlideTitle>{title}</SlideTitle>
          <SlideBody>{content}</SlideBody>
        </div>
        <div className="relative flex items-center justify-center p-8 bg-slate-800/30">
          <img src={image.src} alt={image.alt} className="max-h-80 w-auto object-contain rounded-xl shadow-2xl" />
        </div>
      </div>
    </SlideLayout>
  )
}

// 불릿 포인트 레이아웃
export function BulletSlide({ title, items }: BulletSlideProps) {
  return (
    <SlideLayout>
      <SlideContent>
        <SlideTitle>{title}</SlideTitle>
        <ul className="space-y-4 mt-6" role="list">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-4 p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-indigo-500/50 transition-colors duration-200">
              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-bold" aria-hidden="true">
                {i + 1}
              </span>
              <span className="text-slate-200 text-lg">{item}</span>
            </li>
          ))}
        </ul>
      </SlideContent>
    </SlideLayout>
  )
}
```

### 3-4. 진행률 바

```tsx
export function ProgressBar({ current, total, className = '' }: ProgressBarProps) {
  const percentage = total > 0 ? Math.round(((current + 1) / total) * 100) : 0

  return (
    <div
      className={`w-full h-1 bg-slate-700 ${className}`}
      role="progressbar"
      aria-valuenow={percentage}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full bg-indigo-500 transition-all duration-500 ease-out rounded-full"
        style={{ width: `${percentage}%` }}
      />
    </div>
  )
}
```

---

## 4. 상태 관리 전략 (Zustand)

### 4-1. 슬라이드 탐색 스토어

```typescript
// store/useSlideStore.ts
import { create } from 'zustand'

interface SlideState {
  currentIndex: number
  totalSlides: number
  slideIds: string[]
  direction: 'forward' | 'backward'
  isTransitioning: boolean
  setSlides: (ids: string[]) => void
  goTo: (index: number) => void
  goNext: () => void
  goPrev: () => void
}

export const useSlideStore = create<SlideState>((set, get) => ({
  currentIndex: 0,
  totalSlides: 0,
  slideIds: [],
  direction: 'forward',
  isTransitioning: false,

  setSlides: (ids) => set({ slideIds: ids, totalSlides: ids.length }),

  goTo: (index) => {
    const { currentIndex, totalSlides, isTransitioning } = get()
    if (isTransitioning || index < 0 || index >= totalSlides) return
    set({
      direction: index > currentIndex ? 'forward' : 'backward',
      currentIndex: index,
    })
  },

  goNext: () => {
    const { currentIndex, totalSlides } = get()
    if (currentIndex < totalSlides - 1) get().goTo(currentIndex + 1)
  },

  goPrev: () => {
    const { currentIndex } = get()
    if (currentIndex > 0) get().goTo(currentIndex - 1)
  },

  setTransitioning: (val: boolean) => set({ isTransitioning: val }),
}))
```

### 4-2. 북마크 + 하이라이트 스토어 (localStorage 영속화)

```typescript
// store/useBookmarkStore.ts
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export const useBookmarkStore = create<BookmarkState>()(
  persist(
    (set, get) => ({
      bookmarks: [],
      highlights: [],
      completedSlides: {},

      addBookmark: (bookmark) =>
        set((state) => ({
          bookmarks: [...state.bookmarks, { ...bookmark, createdAt: new Date().toISOString() }],
        })),

      removeBookmark: (courseId, slideId) =>
        set((state) => ({
          bookmarks: state.bookmarks.filter(
            (b) => !(b.courseId === courseId && b.slideId === slideId)
          ),
        })),

      isBookmarked: (courseId, slideId) =>
        get().bookmarks.some((b) => b.courseId === courseId && b.slideId === slideId),

      markComplete: (courseId, slideId) =>
        set((state) => {
          const current = state.completedSlides[courseId] ?? []
          if (current.includes(slideId)) return state
          return {
            completedSlides: { ...state.completedSlides, [courseId]: [...current, slideId] },
          }
        }),

      getProgress: (courseId, total) => {
        const completed = get().completedSlides[courseId]?.length ?? 0
        return total > 0 ? Math.round((completed / total) * 100) : 0
      },
    }),
    {
      name: 'slide-user-data',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        bookmarks: state.bookmarks,
        highlights: state.highlights,
        completedSlides: state.completedSlides,
      }),
    }
  )
)
```

---

## 5. Framer Motion 슬라이드 애니메이션

### 5-1. 방향 기반 슬라이드 전환 Variants

```typescript
// lib/slideVariants.ts
import { Variants } from 'framer-motion'

export function getSlideVariants(direction: 'forward' | 'backward'): Variants {
  const xOffset = direction === 'forward' ? 100 : -100

  return {
    initial: { x: `${xOffset}%`, opacity: 0 },
    animate: {
      x: 0,
      opacity: 1,
      transition: { type: 'spring', stiffness: 300, damping: 30, mass: 0.8 },
    },
    exit: {
      x: `${-xOffset}%`,
      opacity: 0,
      transition: { duration: 0.2, ease: 'easeIn' },
    },
  }
}

export const staggerContainer: Variants = {
  animate: {
    transition: { staggerChildren: 0.1, delayChildren: 0.2 },
  },
}

export const fadeUpItem: Variants = {
  initial: { y: 20, opacity: 0 },
  animate: {
    y: 0,
    opacity: 1,
    transition: { type: 'spring', stiffness: 200, damping: 20 },
  },
}
```

### 5-2. 슬라이드 전환 컨테이너

```tsx
// components/slides/SlideContainer.tsx
'use client'
import { motion, AnimatePresence, LazyMotion, domAnimation } from 'framer-motion'
import { useSlideStore } from '@/store/useSlideStore'
import { getSlideVariants, staggerContainer } from '@/lib/slideVariants'

export default function SlideContainer({ slide, children }: SlideContainerProps) {
  const { direction } = useSlideStore()
  const variants = getSlideVariants(direction)

  return (
    <LazyMotion features={domAnimation} strict>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={slide.id}
          variants={variants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="h-full w-full"
        >
          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="h-full flex flex-col"
          >
            {children}
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </LazyMotion>
  )
}
```

### 5-3. 퀴즈 피드백 애니메이션

```tsx
export function QuizFeedback({ status }: { status: 'correct' | 'incorrect' | null }) {
  return (
    <AnimatePresence mode="wait">
      {status === 'correct' && (
        <motion.div
          key="correct"
          initial={{ scale: 0.5, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/20 border border-emerald-500/50 text-emerald-300"
          role="alert"
        >
          <span className="text-2xl">✓</span>
          <span className="font-semibold">정답입니다!</span>
        </motion.div>
      )}
      {status === 'incorrect' && (
        <motion.div
          key="incorrect"
          initial={{ x: -10 }}
          animate={{ x: [0, -8, 8, -8, 8, 0] }}
          transition={{ duration: 0.4 }}
          className="flex items-center gap-3 p-4 rounded-xl bg-red-500/20 border border-red-500/50 text-red-300"
          role="alert"
        >
          <span className="text-2xl">✗</span>
          <span className="font-semibold">다시 생각해보세요.</span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

---

## 6. 인터랙티브 컴포넌트 구현

### 6-1. 퀴즈 카드

```tsx
// components/quiz/QuizCard.tsx
'use client'
import { motion } from 'framer-motion'
import { useQuizStore } from '@/store/useQuizStore'

export function QuizCard({ slideId, question, options, correctIndex, explanation }: QuizCardProps) {
  const { status, selectedOption, selectOption, submitAnswer, revealAnswer, resetQuiz } = useQuizStore()
  const isLocked = status === 'correct' || status === 'revealed'

  function getOptionStyle(index: number): string {
    const base = 'w-full text-left p-4 rounded-xl border-2 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500'
    if (isLocked) {
      if (index === correctIndex) return base + ' border-emerald-500 bg-emerald-500/20 text-emerald-200'
      if (index === selectedOption) return base + ' border-red-500 bg-red-500/20 text-red-300'
      return base + ' border-slate-700 bg-slate-800/30 text-slate-500'
    }
    if (selectedOption === index) return base + ' border-indigo-500 bg-indigo-500/20 text-white'
    return base + ' border-slate-600 bg-slate-800/50 text-slate-200 hover:border-slate-400'
  }

  return (
    <div className="w-full p-6 rounded-2xl bg-slate-800/60 border border-slate-700/50 space-y-6" role="group">
      <p className="text-lg md:text-xl font-medium text-white leading-relaxed">{question}</p>
      <div className="space-y-3" role="radiogroup">
        {options.map((option, i) => (
          <motion.button
            key={option.id}
            onClick={() => !isLocked && selectOption(i)}
            className={getOptionStyle(i)}
            disabled={isLocked}
            whileHover={!isLocked ? { scale: 1.01 } : undefined}
            whileTap={!isLocked ? { scale: 0.99 } : undefined}
          >
            {option.text}
          </motion.button>
        ))}
      </div>
      <div className="flex gap-3 pt-2">
        {!isLocked && (
          <>
            <button onClick={() => submitAnswer(correctIndex, slideId)} disabled={selectedOption === null} className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white font-semibold">
              제출하기
            </button>
            <button onClick={revealAnswer} className="px-4 py-3 rounded-xl bg-slate-700 text-slate-300 text-sm">
              정답 보기
            </button>
          </>
        )}
        {isLocked && (
          <button onClick={resetQuiz} className="w-full py-3 rounded-xl bg-slate-700 text-slate-300 font-semibold">
            다시 풀기
          </button>
        )}
      </div>
    </div>
  )
}
```

---

## 7. 키보드 내비게이션 & 접근성

### 7-1. 전역 키보드 훅

```typescript
// hooks/useSlideKeyboard.ts
'use client'
import { useEffect, useCallback } from 'react'
import { useSlideStore } from '@/store/useSlideStore'

export function useSlideKeyboard() {
  const { goNext, goPrev, totalSlides } = useSlideStore()

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const target = e.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return

    switch (e.key) {
      case 'ArrowRight': case 'ArrowDown': case ' ': case 'PageDown':
        e.preventDefault(); goNext(); break
      case 'ArrowLeft': case 'ArrowUp': case 'PageUp':
        e.preventDefault(); goPrev(); break
      case 'Home':
        e.preventDefault(); useSlideStore.getState().goTo(0); break
      case 'End':
        e.preventDefault(); useSlideStore.getState().goTo(totalSlides - 1); break
    }
  }, [goNext, goPrev, totalSlides])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}
```

### 7-2. 접근성 완전 구현

```tsx
export function AccessibleSlideViewer({ children, slideTitle }: AccessibleSlideViewerProps) {
  const { currentIndex, totalSlides } = useSlideStore()

  useSlideKeyboard()

  return (
    <>
      <a
        href="#slide-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-indigo-600 focus:text-white focus:rounded-lg"
      >
        슬라이드 콘텐츠로 건너뛰기
      </a>
      <div
        id="slide-content"
        role="region"
        aria-roledescription="슬라이드"
        aria-label={`슬라이드 ${currentIndex + 1} / ${totalSlides}: ${slideTitle}`}
        tabIndex={-1}
        className="h-full w-full outline-none"
      >
        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {slideTitle}, {currentIndex + 1}번째 슬라이드, 총 {totalSlides}개 중
        </div>
        {children}
      </div>
    </>
  )
}
```

---

## 8. 전체 통합 예시

### 8-1. 슬라이드 데이터 타입

```typescript
// lib/slides.ts
export type SlideType = 'title' | 'content' | 'split' | 'bullet' | 'code' | 'quiz' | 'video'

export interface Slide {
  id: string
  type: SlideType
  title: string
  summary?: string
  content?: string
  image?: { src: string; alt: string }
  items?: string[]
  code?: string
  language?: string
  quiz?: QuizData
  videoUrl?: string
  gradient?: string
  order: number
}
```

### 8-2. 슬라이드 렌더러

```tsx
export function SlideRenderer({ slide, courseId }: { slide: Slide; courseId: string }) {
  switch (slide.type) {
    case 'title': case 'content':
      return <TitleContentSlide title={slide.title} content={slide.content ?? ''} />
    case 'split':
      return <SplitSlide title={slide.title} content={slide.content ?? ''} image={slide.image!} />
    case 'bullet':
      return <BulletSlide title={slide.title} items={slide.items ?? []} />
    case 'code':
      return <CodeSlide title={slide.title} code={slide.code ?? ''} language={slide.language ?? 'tsx'} />
    case 'quiz':
      return <QuizSlide slideId={slide.id} title={slide.title} quiz={slide.quiz!} courseId={courseId} />
    default:
      return <div className="text-slate-500">알 수 없는 슬라이드 타입</div>
  }
}
```

---

## 부록: 핵심 패키지

```bash
npm install next@latest react@latest react-dom@latest
npm install framer-motion
npm install zustand
npm install tailwindcss @tailwindcss/typography
```

| 용도 | 라이브러리 |
|---|---|
| 코드 하이라이팅 | `shiki` |
| 수식 렌더링 | `katex` + `react-katex` |
| 마크다운 | `next-mdx-remote` |
| 차트 | `recharts` |
| 아이콘 | `lucide-react` |
| 비디오 | `react-player` |
