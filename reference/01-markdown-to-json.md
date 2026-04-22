# 마크다운(.md) 파일을 구조화된 JSON으로 파싱하기: 기술 참조 가이드

---

## 목차

1. [핵심 라이브러리 소개 및 선택 기준](#1-핵심-라이브러리-소개-및-선택-기준)
2. [라이브러리 상세 분석](#2-라이브러리-상세-분석)
3. [마크다운 파싱 → JSON 변환 코드 예시](#3-마크다운-파싱--json-변환-코드-예시)
4. [교육 콘텐츠용 JSON 스키마 설계 패턴](#4-교육-콘텐츠용-json-스키마-설계-패턴)
5. [실무 적용 시 고려사항](#5-실무-적용-시-고려사항)
6. [전체 통합 예제](#6-전체-통합-예제)

---

## 1. 핵심 라이브러리 소개 및 선택 기준

### 1.1 라이브러리 생태계 개요

마크다운을 JSON으로 변환하는 생태계는 크게 두 계층으로 나뉩니다.

```
[파싱 계층]                    [변환/활용 계층]
──────────────────────         ──────────────────────
remark / unified               커스텀 visitor 함수
marked                         AST 순회 로직
markdown-it                    gray-matter (frontmatter)
micromark                      rehype (HTML 변환)
```

**unified 생태계**는 마크다운 → AST(MDAST) → JSON 변환의 표준 경로입니다. `remark`는 unified의 마크다운 처리 플러그인으로, MDAST 사양을 따르는 트리를 생성합니다.

### 1.2 라이브러리 선택 기준 매트릭스

| 라이브러리 | 목적 | 복잡도 | 확장성 | 번들 크기 | 추천 용도 |
|-----------|------|--------|--------|----------|----------|
| **remark + unified** | AST 파싱 및 변환 | 중~고 | 매우 높음 | ~50KB | 복잡한 변환 파이프라인 |
| **gray-matter** | frontmatter 추출 | 낮음 | 낮음 | ~10KB | YAML/TOML 메타데이터 파싱 |
| **marked** | MD → HTML/텍스트 | 낮음 | 중간 | ~25KB | 빠른 렌더링, 간단한 파싱 |
| **mdast** | AST 타입 정의 | - | - | 타입만 | TypeScript 타입 참조 |
| **remark-parse** | MD → MDAST | 중간 | 높음 | unified 포함 | AST 기반 분석 |
| **remark-stringify** | MDAST → MD | 중간 | 높음 | unified 포함 | 역변환 필요 시 |

### 1.3 사용 시나리오별 추천

```
시나리오 A: "빠른 구조화 (frontmatter + 섹션 추출)"
  → gray-matter + 커스텀 heading 파서

시나리오 B: "정밀한 AST 기반 변환 (블록 단위 제어)"
  → unified + remark-parse + 커스텀 플러그인

시나리오 C: "대용량 배치 처리 (속도 우선)"
  → marked (renderer 커스터마이징)

시나리오 D: "교육 콘텐츠 CMS (slides/chapters/sections)"
  → gray-matter + remark + 커스텀 스키마 매핑
```

---

## 2. 라이브러리 상세 분석

### 2.1 unified / remark — AST 파이프라인의 핵심

`unified`는 소스 텍스트를 파싱하여 AST로 변환하고, 이를 다시 다른 형식으로 직렬화하는 파이프라인 프레임워크입니다. `remark`는 unified 위에서 마크다운을 처리하는 도구 모음입니다.

**설치:**
```bash
npm install unified remark-parse remark-stringify remark-frontmatter
npm install gray-matter
npm install @types/mdast  # TypeScript 사용 시
```

**MDAST 노드 타입 구조:**

MDAST(Markdown Abstract Syntax Tree)는 [unist](https://github.com/syntax-tree/unist) 사양을 따르며, 모든 노드는 다음 기본 형태를 가집니다.

```typescript
// MDAST 기본 노드 인터페이스
interface Node {
  type: string;
  data?: Record<string, unknown>;
  position?: Position;
}

interface Parent extends Node {
  children: Node[];
}

// 주요 노드 타입 예시
type MdastNode =
  | Root          // 문서 루트
  | Heading       // # ~ ######
  | Paragraph     // 일반 단락
  | Text          // 텍스트 리프 노드
  | List          // 순서/비순서 목록
  | ListItem      // 목록 항목
  | Code          // 코드 블록
  | InlineCode    // 인라인 코드
  | Image         // 이미지
  | Link          // 링크
  | Blockquote    // 인용구
  | Table         // 테이블
  | TableRow      // 테이블 행
  | TableCell     // 테이블 셀
  | ThematicBreak // 수평선 ---
  | Strong        // **굵게**
  | Emphasis;     // *기울임*
```

**remark로 MDAST 생성 예시:**

```javascript
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkFrontmatter from 'remark-frontmatter';

const markdown = `---
title: JavaScript 기초
author: 홍길동
level: beginner
---

# 1장: 변수와 자료형

## 1.1 변수 선언

JavaScript에서 변수를 선언하는 방법은 세 가지입니다.

\`\`\`javascript
const name = "Alice";  // 재할당 불가
let age = 30;          // 재할당 가능
var legacy = true;     // 구식 방식 (비권장)
\`\`\`

## 1.2 자료형 종류

- **원시 타입**: string, number, boolean, null, undefined, symbol
- **참조 타입**: object, array, function
`;

const processor = unified()
  .use(remarkParse)
  .use(remarkFrontmatter, ['yaml']); // YAML frontmatter 파싱 활성화

const ast = processor.parse(markdown);
console.log(JSON.stringify(ast, null, 2));
```

**생성되는 MDAST 구조 (요약):**

```json
{
  "type": "root",
  "children": [
    {
      "type": "yaml",
      "value": "title: JavaScript 기초\nauthor: 홍길동\nlevel: beginner"
    },
    {
      "type": "heading",
      "depth": 1,
      "children": [{ "type": "text", "value": "1장: 변수와 자료형" }]
    },
    {
      "type": "heading",
      "depth": 2,
      "children": [{ "type": "text", "value": "1.1 변수 선언" }]
    },
    {
      "type": "paragraph",
      "children": [
        { "type": "text", "value": "JavaScript에서 변수를 선언하는 방법은 세 가지입니다." }
      ]
    },
    {
      "type": "code",
      "lang": "javascript",
      "value": "const name = \"Alice\";  // 재할당 불가\nlet age = 30;          // 재할당 가능\nvar legacy = true;     // 구식 방식 (비권장)"
    }
  ]
}
```

### 2.2 gray-matter — frontmatter 전문 파서

`gray-matter`는 마크다운 파일 상단의 YAML, TOML, JSON frontmatter를 추출하는 가장 신뢰할 수 있는 라이브러리입니다. Jekyll, Hugo, Gatsby 등 대부분의 정적 사이트 생성기와 호환됩니다.

```javascript
import matter from 'gray-matter';
import { readFileSync } from 'fs';

const fileContent = readFileSync('./chapter-01.md', 'utf-8');
const { data, content, excerpt } = matter(fileContent, {
  excerpt: true,           // 첫 단락을 excerpt로 추출
  excerpt_separator: '<!-- more -->', // 커스텀 구분자
});

// data: frontmatter 객체
// content: frontmatter를 제거한 순수 마크다운
// excerpt: 첫 단락 (설정 시)

console.log(data);
// {
//   title: 'JavaScript 기초',
//   author: '홍길동',
//   level: 'beginner'
// }
```

**지원하는 frontmatter 형식:**

```markdown
<!-- YAML (기본) -->
---
title: 제목
tags: [javascript, tutorial]
date: 2026-04-20
---

<!-- TOML -->
+++
title = "제목"
tags = ["javascript", "tutorial"]
+++

<!-- JSON -->
---json
{
  "title": "제목",
  "tags": ["javascript", "tutorial"]
}
---
```

```javascript
// TOML frontmatter 파싱 설정
import matter from 'gray-matter';
import toml from '@iarna/toml';

const result = matter(content, {
  engines: {
    toml: toml.parse.bind(toml),
  },
  language: 'toml',
  delimiters: '+++',
});
```

### 2.3 marked — 빠른 파싱과 커스텀 렌더러

`marked`는 속도가 빠르고 API가 단순하여 빠른 프로토타이핑에 적합합니다. 커스텀 렌더러(Renderer)를 통해 JSON 빌드도 가능합니다.

```javascript
import { marked, Renderer } from 'marked';

// JSON 구조를 빌드하는 커스텀 렌더러
class JsonRenderer extends Renderer {
  constructor() {
    super();
    this.sections = [];
    this.currentSection = null;
  }

  heading(token) {
    const { depth, text } = token;
    if (depth === 1) {
      this.currentSection = { title: text, depth, subsections: [], content: [] };
      this.sections.push(this.currentSection);
    } else if (depth === 2 && this.currentSection) {
      const sub = { title: text, depth, content: [] };
      this.currentSection.subsections.push(sub);
      this.currentSubSection = sub;
    }
    return '';
  }

  paragraph(token) {
    const target = this.currentSubSection || this.currentSection;
    if (target) {
      target.content.push({ type: 'paragraph', text: token.text });
    }
    return '';
  }

  code(token) {
    const target = this.currentSubSection || this.currentSection;
    if (target) {
      target.content.push({ type: 'code', lang: token.lang, text: token.text });
    }
    return '';
  }

  getJSON() {
    return this.sections;
  }
}

const renderer = new JsonRenderer();
marked(markdownContent, { renderer });
const json = renderer.getJSON();
```

---

## 3. 마크다운 파싱 → JSON 변환 코드 예시

### 3.1 기본 패턴: Heading 기반 청킹(Chunking)

마크다운을 교육 콘텐츠로 구조화할 때 가장 많이 쓰이는 패턴입니다. H1은 챕터, H2는 섹션, H3는 서브섹션으로 매핑합니다.

```javascript
// mdToJson.js
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkFrontmatter from 'remark-frontmatter';
import { visit } from 'unist-util-visit';
import { toString } from 'mdast-util-to-string';
import yaml from 'js-yaml';

/**
 * MDAST 노드에서 텍스트 콘텐츠를 추출합니다.
 * 코드 블록, 단락, 목록 등 다양한 블록 타입을 처리합니다.
 */
function extractBlocks(nodes) {
  const blocks = [];

  for (const node of nodes) {
    switch (node.type) {
      case 'paragraph':
        blocks.push({
          type: 'paragraph',
          text: toString(node),
        });
        break;

      case 'code':
        blocks.push({
          type: 'code',
          lang: node.lang || null,
          value: node.value,
          meta: node.meta || null,
        });
        break;

      case 'list':
        blocks.push({
          type: 'list',
          ordered: node.ordered,
          items: node.children.map((item) => ({
            text: toString(item),
            checked: item.checked ?? null,
          })),
        });
        break;

      case 'blockquote':
        blocks.push({
          type: 'blockquote',
          text: toString(node),
        });
        break;

      case 'table':
        const [headerRow, ...bodyRows] = node.children;
        const headers = headerRow.children.map((cell) => toString(cell));
        blocks.push({
          type: 'table',
          headers,
          rows: bodyRows.map((row) =>
            row.children.map((cell) => toString(cell))
          ),
        });
        break;

      case 'image':
        blocks.push({
          type: 'image',
          url: node.url,
          alt: node.alt || '',
          title: node.title || null,
        });
        break;

      case 'thematicBreak':
        blocks.push({ type: 'divider' });
        break;

      default:
        // heading 등 다른 노드는 상위 로직에서 처리
        break;
    }
  }

  return blocks;
}

/**
 * MDAST의 flat한 children 배열을 헤딩 기반 계층 구조로 변환합니다.
 */
function buildHierarchy(nodes) {
  const result = {
    chapters: [],
  };

  let currentChapter = null;
  let currentSection = null;
  let currentSubsection = null;
  let pendingNodes = []; // 헤딩 이전의 노드들 (서문 등)

  for (const node of nodes) {
    if (node.type === 'heading') {
      const title = toString(node);
      const depth = node.depth;

      if (depth === 1) {
        // 이전 pending 노드를 서문으로 처리
        if (pendingNodes.length > 0) {
          result.preamble = extractBlocks(pendingNodes);
          pendingNodes = [];
        }
        currentSubsection = null;
        currentSection = null;
        currentChapter = {
          id: slugify(title),
          title,
          depth: 1,
          sections: [],
          content: [],
        };
        result.chapters.push(currentChapter);

      } else if (depth === 2) {
        currentSubsection = null;
        currentSection = {
          id: slugify(title),
          title,
          depth: 2,
          subsections: [],
          content: [],
        };
        if (currentChapter) {
          currentChapter.sections.push(currentSection);
        } else {
          // 챕터 없이 섹션이 나오는 경우
          if (!result.topLevelSections) result.topLevelSections = [];
          result.topLevelSections.push(currentSection);
        }

      } else if (depth === 3) {
        currentSubsection = {
          id: slugify(title),
          title,
          depth: 3,
          content: [],
        };
        if (currentSection) {
          currentSection.subsections.push(currentSubsection);
        } else if (currentChapter) {
          if (!currentChapter.subsections) currentChapter.subsections = [];
          currentChapter.subsections.push(currentSubsection);
        }
      }

    } else {
      // 콘텐츠 노드: 현재 활성 컨테이너에 추가
      const blocks = extractBlocks([node]);
      if (blocks.length === 0) continue;

      if (currentSubsection) {
        currentSubsection.content.push(...blocks);
      } else if (currentSection) {
        currentSection.content.push(...blocks);
      } else if (currentChapter) {
        currentChapter.content.push(...blocks);
      } else {
        pendingNodes.push(node);
      }
    }
  }

  // 마지막 pending 처리
  if (pendingNodes.length > 0 && !result.preamble) {
    result.preamble = extractBlocks(pendingNodes);
  }

  return result;
}

/**
 * 제목 문자열을 URL-safe한 slug로 변환합니다.
 */
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s가-힣]/g, '')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * 마크다운 문자열을 구조화된 JSON으로 변환하는 메인 함수
 */
export function markdownToJson(markdownContent, options = {}) {
  const {
    filename = null,
    includePositions = false, // AST 위치 정보 포함 여부
  } = options;

  const processor = unified()
    .use(remarkParse)
    .use(remarkFrontmatter, ['yaml', 'toml']);

  const ast = processor.parse(markdownContent);

  // frontmatter 추출
  let frontmatter = {};
  const contentNodes = [];

  for (const node of ast.children) {
    if (node.type === 'yaml') {
      try {
        frontmatter = yaml.load(node.value) || {};
      } catch (e) {
        console.warn('frontmatter 파싱 오류:', e.message);
      }
    } else {
      if (!includePositions) {
        delete node.position;
      }
      contentNodes.push(node);
    }
  }

  const hierarchy = buildHierarchy(contentNodes);

  return {
    meta: {
      filename,
      parsedAt: new Date().toISOString(),
      ...frontmatter,
    },
    ...hierarchy,
  };
}
```

**사용 예시:**

```javascript
import { readFileSync } from 'fs';
import { markdownToJson } from './mdToJson.js';

const content = readFileSync('./course/chapter-01.md', 'utf-8');
const json = markdownToJson(content, { filename: 'chapter-01.md' });

console.log(JSON.stringify(json, null, 2));
```

**출력 결과 예시:**

```json
{
  "meta": {
    "filename": "chapter-01.md",
    "parsedAt": "2026-04-20T09:00:00.000Z",
    "title": "JavaScript 기초",
    "author": "홍길동",
    "level": "beginner",
    "tags": ["javascript", "tutorial"],
    "duration": 45
  },
  "chapters": [
    {
      "id": "1장-변수와-자료형",
      "title": "1장: 변수와 자료형",
      "depth": 1,
      "content": [],
      "sections": [
        {
          "id": "11-변수-선언",
          "title": "1.1 변수 선언",
          "depth": 2,
          "content": [
            {
              "type": "paragraph",
              "text": "JavaScript에서 변수를 선언하는 방법은 세 가지입니다."
            },
            {
              "type": "code",
              "lang": "javascript",
              "value": "const name = \"Alice\";\nlet age = 30;\nvar legacy = true;",
              "meta": null
            }
          ],
          "subsections": []
        },
        {
          "id": "12-자료형-종류",
          "title": "1.2 자료형 종류",
          "depth": 2,
          "content": [
            {
              "type": "list",
              "ordered": false,
              "items": [
                { "text": "원시 타입: string, number, boolean, null, undefined, symbol", "checked": null },
                { "text": "참조 타입: object, array, function", "checked": null }
              ]
            }
          ],
          "subsections": []
        }
      ]
    }
  ]
}
```

### 3.2 remark 플러그인 방식: 재사용 가능한 변환기

unified 파이프라인에 맞는 커스텀 플러그인으로 변환 로직을 캡슐화합니다.

```javascript
// remarkToJson.plugin.js
import { visit } from 'unist-util-visit';
import { toString } from 'mdast-util-to-string';

/**
 * remark 플러그인: MDAST를 JSON 스키마로 변환
 * 사용법: processor.use(remarkToJsonPlugin, options)
 */
export function remarkToJsonPlugin(options = {}) {
  const {
    headingMap = { 1: 'chapter', 2: 'section', 3: 'subsection' },
    maxDepth = 3,
  } = options;

  return function transformer(tree, file) {
    const structure = {
      nodes: [],
    };

    const stack = [structure]; // 현재 컨텍스트 스택

    function getCurrentContainer() {
      return stack[stack.length - 1];
    }

    visit(tree, (node) => {
      if (node.type === 'root') return; // root는 건너뜀

      if (node.type === 'heading' && node.depth <= maxDepth) {
        const level = headingMap[node.depth] || `h${node.depth}`;
        const title = toString(node);

        const container = {
          type: level,
          id: generateId(title),
          title,
          children: [],
          blocks: [],
        };

        // 스택 조정: 현재 depth보다 같거나 깊은 항목을 팝
        while (
          stack.length > 1 &&
          getDepthFromType(headingMap, stack[stack.length - 1].type) >= node.depth
        ) {
          stack.pop();
        }

        getCurrentContainer().nodes
          ? getCurrentContainer().nodes.push(container)
          : getCurrentContainer().children.push(container);

        stack.push(container);
        return 'skip'; // children은 직접 처리했으므로 건너뜀
      }

      // 콘텐츠 블록 처리
      const block = nodeToBlock(node);
      if (block) {
        const container = getCurrentContainer();
        const target = container.blocks || container.nodes;
        if (Array.isArray(target)) {
          // blocks 배열에 추가
          if (container.blocks) {
            container.blocks.push(block);
          }
        }
        return 'skip';
      }
    });

    // 결과를 file.data에 저장 (unified 컨벤션)
    file.data.json = structure;
  };
}

function getDepthFromType(headingMap, type) {
  return Object.entries(headingMap).find(([, v]) => v === type)?.[0] ?? 999;
}

function generateId(title) {
  return title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
}

function nodeToBlock(node) {
  switch (node.type) {
    case 'paragraph':
      return { type: 'paragraph', text: toString(node) };
    case 'code':
      return { type: 'code', lang: node.lang, value: node.value };
    case 'blockquote':
      return { type: 'blockquote', text: toString(node) };
    case 'list':
      return {
        type: node.ordered ? 'orderedList' : 'unorderedList',
        items: node.children.map((li) => toString(li)),
      };
    case 'image':
      return { type: 'image', url: node.url, alt: node.alt };
    default:
      return null;
  }
}

// 사용 예시
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkFrontmatter from 'remark-frontmatter';

async function parseWithPlugin(markdownText) {
  const processor = unified()
    .use(remarkParse)
    .use(remarkFrontmatter)
    .use(remarkToJsonPlugin, {
      headingMap: { 1: 'chapter', 2: 'section', 3: 'subsection' },
    });

  const file = await processor.process(markdownText);
  return file.data.json;
}
```

### 3.3 슬라이드 형식 파싱: `---` 구분자 기반 청킹

프레젠테이션 도구(예: Marp, Reveal.js)처럼 `---`으로 슬라이드를 구분하는 마크다운을 처리하는 패턴입니다.

```javascript
// slideParser.js
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { toString } from 'mdast-util-to-string';

/**
 * 슬라이드 분리 마크다운을 JSON 슬라이드 배열로 변환합니다.
 * 각 슬라이드는 --- (ThematicBreak)로 구분됩니다.
 */
export function parseSlideDeck(markdownContent) {
  const processor = unified().use(remarkParse);
  const ast = processor.parse(markdownContent);

  const slides = [];
  let currentSlide = { index: 0, title: null, blocks: [], notes: '' };
  let slideIndex = 0;

  for (const node of ast.children) {
    // --- 구분자를 만나면 새 슬라이드 시작
    if (node.type === 'thematicBreak') {
      if (currentSlide.blocks.length > 0 || currentSlide.title) {
        slides.push(finalizeSlide(currentSlide));
      }
      slideIndex++;
      currentSlide = { index: slideIndex, title: null, blocks: [], notes: '' };
      continue;
    }

    // 슬라이드 노트: <!-- notes --> 주석 처리
    if (node.type === 'html' && node.value.startsWith('<!-- notes')) {
      currentSlide.notes = node.value
        .replace(/<!--\s*notes\s*/, '')
        .replace(/\s*-->/, '')
        .trim();
      continue;
    }

    // 첫 번째 heading을 슬라이드 제목으로
    if (node.type === 'heading' && !currentSlide.title) {
      currentSlide.title = toString(node);
      currentSlide.titleDepth = node.depth;
      continue;
    }

    // 나머지 콘텐츠를 blocks로 추가
    const block = convertNodeToSlideBlock(node);
    if (block) currentSlide.blocks.push(block);
  }

  // 마지막 슬라이드 처리
  if (currentSlide.blocks.length > 0 || currentSlide.title) {
    slides.push(finalizeSlide(currentSlide));
  }

  return {
    totalSlides: slides.length,
    slides,
  };
}

function finalizeSlide(slide) {
  return {
    index: slide.index,
    title: slide.title,
    layout: detectLayout(slide.blocks),
    blocks: slide.blocks,
    notes: slide.notes || null,
  };
}

function detectLayout(blocks) {
  const hasCode = blocks.some((b) => b.type === 'code');
  const hasImage = blocks.some((b) => b.type === 'image');
  const hasList = blocks.some((b) => b.type === 'list');

  if (hasCode && blocks.length === 1) return 'code-only';
  if (hasImage && blocks.length <= 2) return 'image-focus';
  if (hasList) return 'bullet-list';
  if (blocks.length === 0) return 'title-only';
  return 'default';
}

function convertNodeToSlideBlock(node) {
  switch (node.type) {
    case 'paragraph':
      return { type: 'paragraph', text: toString(node) };
    case 'code':
      return { type: 'code', lang: node.lang || 'text', value: node.value };
    case 'list':
      return {
        type: 'list',
        ordered: node.ordered,
        items: node.children.map((item) => ({
          text: toString(item),
          subItems: item.children
            .filter((c) => c.type === 'list')
            .flatMap((subList) =>
              subList.children.map((subItem) => toString(subItem))
            ),
        })),
      };
    case 'image':
      return { type: 'image', url: node.url, alt: node.alt };
    case 'blockquote':
      return { type: 'quote', text: toString(node) };
    case 'table':
      const [header, ...body] = node.children;
      return {
        type: 'table',
        headers: header.children.map((c) => toString(c)),
        rows: body.map((row) => row.children.map((c) => toString(c))),
      };
    default:
      return null;
  }
}
```

**입력 마크다운:**

```markdown
# JavaScript 기초 강의

강사: 홍길동 | 2026년 4월

---

## 변수란 무엇인가?

프로그램에서 데이터를 저장하는 공간입니다.

- 이름이 있는 메모리 공간
- 값을 변경할 수 있음
- 타입을 가짐

<!-- notes 변수의 개념을 일상의 박스에 비유하여 설명하세요. -->

---

## 변수 선언 방법

```javascript
const PI = 3.14;     // 상수
let count = 0;       // 변수
```

변수 이름은 의미 있게 작성하세요.

---
```

**출력 JSON:**

```json
{
  "totalSlides": 3,
  "slides": [
    {
      "index": 0,
      "title": "JavaScript 기초 강의",
      "layout": "default",
      "blocks": [
        { "type": "paragraph", "text": "강사: 홍길동 | 2026년 4월" }
      ],
      "notes": null
    },
    {
      "index": 1,
      "title": "변수란 무엇인가?",
      "layout": "bullet-list",
      "blocks": [
        { "type": "paragraph", "text": "프로그램에서 데이터를 저장하는 공간입니다." },
        {
          "type": "list",
          "ordered": false,
          "items": [
            { "text": "이름이 있는 메모리 공간", "subItems": [] },
            { "text": "값을 변경할 수 있음", "subItems": [] },
            { "text": "타입을 가짐", "subItems": [] }
          ]
        }
      ],
      "notes": "변수의 개념을 일상의 박스에 비유하여 설명하세요."
    },
    {
      "index": 2,
      "title": "변수 선언 방법",
      "layout": "code-only",
      "blocks": [
        { "type": "code", "lang": "javascript", "value": "const PI = 3.14;\nlet count = 0;" },
        { "type": "paragraph", "text": "변수 이름은 의미 있게 작성하세요." }
      ],
      "notes": null
    }
  ]
}
```

### 3.4 TypeScript 타입 안전 파서

```typescript
// types.ts
export interface ContentBlock {
  type: 'paragraph' | 'code' | 'list' | 'blockquote' | 'image' | 'table' | 'divider' | 'quote';
  text?: string;
  value?: string;
  lang?: string | null;
  meta?: string | null;
  url?: string;
  alt?: string;
  ordered?: boolean;
  items?: ListItem[];
  headers?: string[];
  rows?: string[][];
}

export interface ListItem {
  text: string;
  checked: boolean | null;
  subItems?: string[];
}

export interface Subsection {
  id: string;
  title: string;
  depth: 3;
  content: ContentBlock[];
}

export interface Section {
  id: string;
  title: string;
  depth: 2;
  content: ContentBlock[];
  subsections: Subsection[];
}

export interface Chapter {
  id: string;
  title: string;
  depth: 1;
  content: ContentBlock[];
  sections: Section[];
}

export interface DocumentMeta {
  filename: string | null;
  parsedAt: string;
  title?: string;
  author?: string;
  tags?: string[];
  level?: 'beginner' | 'intermediate' | 'advanced';
  duration?: number;
  [key: string]: unknown;
}

export interface ParsedDocument {
  meta: DocumentMeta;
  preamble?: ContentBlock[];
  chapters: Chapter[];
}

// 타입 안전한 파서 함수
export function typedMarkdownToJson(
  content: string,
  filename?: string
): ParsedDocument {
  // ... 구현은 위 markdownToJson 함수와 동일
}
```

---

## 4. 교육 콘텐츠용 JSON 스키마 설계 패턴

### 4.1 계층형 코스 스키마

교육 콘텐츠는 대부분 `Course → Module → Chapter → Lesson → Slide` 계층을 가집니다.

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://example.com/schemas/course.json",
  "title": "교육 코스 스키마",
  "type": "object",
  "required": ["meta", "modules"],
  "properties": {
    "meta": {
      "type": "object",
      "required": ["id", "title", "version"],
      "properties": {
        "id": { "type": "string", "description": "코스 고유 ID (slug 형식)" },
        "title": { "type": "string" },
        "description": { "type": "string" },
        "version": { "type": "string", "pattern": "^\\d+\\.\\d+\\.\\d+$" },
        "author": {
          "type": "object",
          "properties": {
            "name": { "type": "string" },
            "email": { "type": "string", "format": "email" }
          }
        },
        "level": { "enum": ["beginner", "intermediate", "advanced", "expert"] },
        "language": { "type": "string", "default": "ko" },
        "tags": { "type": "array", "items": { "type": "string" } },
        "totalDuration": { "type": "integer", "description": "분 단위" },
        "createdAt": { "type": "string", "format": "date-time" },
        "updatedAt": { "type": "string", "format": "date-time" }
      }
    },
    "modules": {
      "type": "array",
      "items": { "$ref": "#/definitions/Module" }
    }
  },
  "definitions": {
    "Module": {
      "type": "object",
      "required": ["id", "title", "chapters"],
      "properties": {
        "id": { "type": "string" },
        "title": { "type": "string" },
        "description": { "type": "string" },
        "order": { "type": "integer" },
        "chapters": {
          "type": "array",
          "items": { "$ref": "#/definitions/Chapter" }
        }
      }
    },
    "Chapter": {
      "type": "object",
      "required": ["id", "title", "lessons"],
      "properties": {
        "id": { "type": "string" },
        "title": { "type": "string" },
        "order": { "type": "integer" },
        "duration": { "type": "integer" },
        "objectives": {
          "type": "array",
          "items": { "type": "string" },
          "description": "학습 목표 목록"
        },
        "prerequisites": {
          "type": "array",
          "items": { "type": "string" },
          "description": "선수 챕터 ID 목록"
        },
        "lessons": {
          "type": "array",
          "items": { "$ref": "#/definitions/Lesson" }
        }
      }
    },
    "Lesson": {
      "type": "object",
      "required": ["id", "title", "content"],
      "properties": {
        "id": { "type": "string" },
        "title": { "type": "string" },
        "type": {
          "enum": ["lecture", "exercise", "quiz", "project", "reading"],
          "description": "수업 유형"
        },
        "duration": { "type": "integer", "description": "분 단위" },
        "content": {
          "type": "array",
          "items": { "$ref": "#/definitions/ContentBlock" }
        },
        "slides": {
          "type": "array",
          "items": { "$ref": "#/definitions/Slide" }
        },
        "quiz": { "$ref": "#/definitions/Quiz" }
      }
    },
    "ContentBlock": {
      "type": "object",
      "required": ["type"],
      "discriminator": { "propertyName": "type" },
      "oneOf": [
        {
          "properties": {
            "type": { "const": "paragraph" },
            "text": { "type": "string" }
          },
          "required": ["text"]
        },
        {
          "properties": {
            "type": { "const": "code" },
            "lang": { "type": "string" },
            "value": { "type": "string" },
            "filename": { "type": "string" },
            "highlight": { "type": "array", "items": { "type": "integer" } }
          },
          "required": ["value"]
        },
        {
          "properties": {
            "type": { "const": "callout" },
            "variant": { "enum": ["info", "warning", "danger", "tip", "note"] },
            "title": { "type": "string" },
            "text": { "type": "string" }
          },
          "required": ["variant", "text"]
        }
      ]
    },
    "Slide": {
      "type": "object",
      "required": ["index", "blocks"],
      "properties": {
        "index": { "type": "integer" },
        "title": { "type": "string" },
        "layout": {
          "enum": ["title-only", "default", "two-column", "code-only", "image-focus", "bullet-list"]
        },
        "blocks": {
          "type": "array",
          "items": { "$ref": "#/definitions/ContentBlock" }
        },
        "notes": { "type": "string", "description": "발표자 노트" }
      }
    },
    "Quiz": {
      "type": "object",
      "properties": {
        "questions": {
          "type": "array",
          "items": { "$ref": "#/definitions/Question" }
        }
      }
    },
    "Question": {
      "type": "object",
      "required": ["id", "type", "text"],
      "properties": {
        "id": { "type": "string" },
        "type": { "enum": ["multiple-choice", "true-false", "short-answer", "code"] },
        "text": { "type": "string" },
        "options": { "type": "array", "items": { "type": "string" } },
        "answer": {},
        "explanation": { "type": "string" },
        "points": { "type": "integer", "default": 1 }
      }
    }
  }
}
```

### 4.2 마크다운 frontmatter 규약 설계

교육 콘텐츠 마크다운 파일에서 일관된 frontmatter 규약을 정의하면 파서가 표준화된 JSON을 생성할 수 있습니다.

**챕터 파일 (`chapter-01.md`) frontmatter 규약:**

```yaml
---
# 식별 정보
id: js-basics-ch01
courseId: javascript-fundamentals
moduleId: module-01-basics

# 표시 정보
title: "변수와 자료형"
subtitle: "JavaScript의 데이터 저장 방식 이해하기"
description: "JavaScript에서 변수를 선언하고 다양한 자료형을 활용하는 방법을 학습합니다."

# 분류
order: 1
type: lecture  # lecture | exercise | quiz | project
level: beginner

# 시간
duration: 45  # 분 단위

# 학습 목표 (LearningObjectives)
objectives:
  - "const, let, var의 차이점을 설명할 수 있다"
  - "JavaScript의 7가지 원시 타입을 나열할 수 있다"
  - "타입 변환(형변환)을 올바르게 수행할 수 있다"

# 선수 지식
prerequisites:
  - js-intro-ch00

# 태그 및 키워드
tags: [javascript, variables, datatypes, beginner]
keywords: [var, let, const, string, number, boolean, null, undefined]

# 미디어
thumbnail: /images/ch01-variables.png
videoUrl: null

# 메타
author: "홍길동"
reviewers: ["김철수", "이영희"]
version: "1.2.0"
createdAt: "2026-01-15"
updatedAt: "2026-04-20"
status: published  # draft | review | published | archived
---
```

### 4.3 frontmatter 기반 동적 스키마 생성

```javascript
// courseBuilder.js
import matter from 'gray-matter';
import { markdownToJson } from './mdToJson.js';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';

/**
 * 디렉토리 내 모든 마크다운 파일을 스캔하여
 * 코스 전체 구조를 JSON으로 빌드합니다.
 *
 * 디렉토리 구조 예시:
 * course/
 * ├── course.json         <- 코스 메타 설정
 * ├── module-01/
 * │   ├── module.json     <- 모듈 메타 설정
 * │   ├── chapter-01.md
 * │   └── chapter-02.md
 * └── module-02/
 *     ├── module.json
 *     └── chapter-01.md
 */
export function buildCourseFromDirectory(courseDir) {
  const courseMeta = JSON.parse(
    readFileSync(join(courseDir, 'course.json'), 'utf-8')
  );

  const modules = readdirSync(courseDir)
    .filter((name) => {
      const fullPath = join(courseDir, name);
      return statSync(fullPath).isDirectory() && name.startsWith('module-');
    })
    .sort()
    .map((moduleName) => {
      const moduleDir = join(courseDir, moduleName);
      return buildModule(moduleDir, moduleName);
    });

  return {
    meta: {
      ...courseMeta,
      parsedAt: new Date().toISOString(),
      totalChapters: modules.reduce((sum, m) => sum + m.chapters.length, 0),
      totalDuration: modules.reduce(
        (sum, m) => sum + m.chapters.reduce((s, c) => s + (c.meta.duration || 0), 0),
        0
      ),
    },
    modules,
  };
}

function buildModule(moduleDir, moduleName) {
  let moduleMeta = { id: moduleName, title: moduleName };
  try {
    moduleMeta = JSON.parse(readFileSync(join(moduleDir, 'module.json'), 'utf-8'));
  } catch (_) {}

  const chapters = readdirSync(moduleDir)
    .filter((f) => f.endsWith('.md'))
    .sort()
    .map((filename) => {
      const filePath = join(moduleDir, filename);
      const content = readFileSync(filePath, 'utf-8');
      return markdownToJson(content, { filename });
    });

  return {
    ...moduleMeta,
    chapters,
  };
}
```

### 4.4 퀴즈 및 연습문제 마크다운 파싱

교육 콘텐츠에서 자주 쓰이는 퀴즈 형식의 마크다운을 JSON으로 변환하는 패턴입니다.

**퀴즈 마크다운 규약:**

```markdown
---
type: quiz
title: "변수와 자료형 퀴즈"
passingScore: 70
---

## Q1. 다음 중 올바른 변수 선언 방법은?

> type: multiple-choice
> points: 2

- [ ] var 1name = "test"
- [x] const firstName = "test"
- [ ] let 123abc = 100
- [ ] const = "value"

**해설**: 변수 이름은 숫자로 시작할 수 없으며, `=` 앞에 변수명이 있어야 합니다.

---

## Q2. `typeof null`의 결과는?

> type: multiple-choice
> points: 1

- [ ] "null"
- [ ] "undefined"
- [x] "object"
- [ ] "boolean"

**해설**: JavaScript의 오래된 버그로, `typeof null`은 `"object"`를 반환합니다.

---

## Q3. `const`로 선언된 변수를 재할당할 수 있는가?

> type: true-false
> answer: false
> points: 1

**해설**: `const`는 재할당이 불가능합니다. 단, 객체나 배열의 내부 속성은 변경 가능합니다.
```

**퀴즈 파서:**

```javascript
// quizParser.js
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkFrontmatter from 'remark-frontmatter';
import { toString } from 'mdast-util-to-string';
import yaml from 'js-yaml';

export function parseQuizMarkdown(markdownContent) {
  const processor = unified().use(remarkParse).use(remarkFrontmatter, ['yaml']);
  const ast = processor.parse(markdownContent);

  let quizMeta = {};
  const questions = [];
  let currentQuestion = null;
  let blockBuffer = [];

  for (const node of ast.children) {
    if (node.type === 'yaml') {
      quizMeta = yaml.load(node.value) || {};
      continue;
    }

    // 구분자로 이전 문제 확정
    if (node.type === 'thematicBreak') {
      if (currentQuestion) {
        questions.push(finalizeQuestion(currentQuestion, blockBuffer));
      }
      currentQuestion = null;
      blockBuffer = [];
      continue;
    }

    // H2를 문제 시작으로 인식
    if (node.type === 'heading' && node.depth === 2) {
      const rawTitle = toString(node);
      // "Q1. 문제 텍스트" 패턴 파싱
      const match = rawTitle.match(/^Q(\d+)\.\s*(.+)$/);
      currentQuestion = {
        id: match ? `q${match[1]}` : `q${questions.length + 1}`,
        text: match ? match[2] : rawTitle,
        type: 'multiple-choice', // 기본값
        options: [],
        answer: null,
        points: 1,
        explanation: null,
      };
      blockBuffer = [];
      continue;
    }

    if (!currentQuestion) continue;

    // 블록쿼트에서 메타데이터 추출 (> type: ..., > points: ...)
    if (node.type === 'blockquote') {
      const meta = parseQuestionMeta(toString(node));
      Object.assign(currentQuestion, meta);
      continue;
    }

    // 체크박스 목록에서 선택지 추출
    if (node.type === 'list') {
      for (const item of node.children) {
        const text = toString(item).replace(/^\[[ x]\]\s*/, '');
        const isCorrect = item.children.some(
          (child) => child.type === 'paragraph' &&
            child.children[0]?.type === 'text' &&
            item.spread === false &&
            toString(item).startsWith('[x]') // 체크된 항목
        );

        // 실제 체크박스 상태 확인
        const rawText = toString(item);
        const checked = rawText.startsWith('[x]') || rawText.startsWith('[X]');

        currentQuestion.options.push({
          id: String.fromCharCode(97 + currentQuestion.options.length), // a, b, c, d
          text: text.replace(/^\[[ xX]\]\s*/, ''),
          correct: checked,
        });

        if (checked) {
          currentQuestion.answer = String.fromCharCode(97 + currentQuestion.options.length - 1);
        }
      }
      continue;
    }

    // 볼드 단락을 해설로 인식
    if (node.type === 'paragraph') {
      const hasStrong = node.children.some((c) => c.type === 'strong');
      if (hasStrong) {
        currentQuestion.explanation = toString(node).replace(/^해설[:\s]*/, '');
      }
    }
  }

  // 마지막 문제 처리
  if (currentQuestion) {
    questions.push(finalizeQuestion(currentQuestion, blockBuffer));
  }

  return {
    meta: quizMeta,
    totalPoints: questions.reduce((sum, q) => sum + q.points, 0),
    questionCount: questions.length,
    questions,
  };
}

function parseQuestionMeta(text) {
  const meta = {};
  const lines = text.split('\n');
  for (const line of lines) {
    const [key, ...rest] = line.trim().split(':');
    if (key && rest.length) {
      const value = rest.join(':').trim();
      meta[key.trim()] = isNaN(value) ? value : Number(value);
    }
  }
  return meta;
}

function finalizeQuestion(question, _buffer) {
  // true-false 타입의 경우 answer 정규화
  if (question.type === 'true-false' && typeof question.answer === 'string') {
    question.answer = question.answer.toLowerCase() === 'true';
  }
  return question;
}
```

---

## 5. 실무 적용 시 고려사항

### 5.1 성능 최적화

**대용량 파일 처리:**

```javascript
import { createReadStream } from 'fs';
import { createInterface } from 'readline';

/**
 * 스트리밍 방식으로 대용량 마크다운 파일을 처리합니다.
 * 헤딩을 기준으로 청크를 분리하여 메모리 사용량을 줄입니다.
 */
async function* streamMarkdownChunks(filePath) {
  const rl = createInterface({
    input: createReadStream(filePath, { encoding: 'utf-8' }),
    crlfDelay: Infinity,
  });

  let currentChunk = [];
  let chunkTitle = null;

  for await (const line of rl) {
    if (line.startsWith('# ') || line.startsWith('## ')) {
      if (currentChunk.length > 0) {
        yield { title: chunkTitle, content: currentChunk.join('\n') };
      }
      chunkTitle = line.replace(/^#+\s*/, '');
      currentChunk = [line];
    } else {
      currentChunk.push(line);
    }
  }

  if (currentChunk.length > 0) {
    yield { title: chunkTitle, content: currentChunk.join('\n') };
  }
}

// 사용 예시
for await (const chunk of streamMarkdownChunks('./large-textbook.md')) {
  const json = markdownToJson(chunk.content);
  await saveToDatabase(json);
}
```

**파서 인스턴스 재사용:**

```javascript
// 파서를 한 번 생성하고 여러 파일에 재사용 (성능 개선)
class MarkdownParser {
  #processor;

  constructor(options = {}) {
    this.#processor = unified()
      .use(remarkParse)
      .use(remarkFrontmatter, ['yaml']);
    // 옵션에 따라 플러그인 추가
  }

  parse(content, filename) {
    const ast = this.#processor.parse(content);
    return this.#transformAst(ast, filename);
  }

  // 배치 처리
  async parseBatch(files, concurrency = 4) {
    const results = [];
    for (let i = 0; i < files.length; i += concurrency) {
      const batch = files.slice(i, i + concurrency);
      const parsed = await Promise.all(
        batch.map(({ path, content }) => this.parse(content, path))
      );
      results.push(...parsed);
    }
    return results;
  }

  #transformAst(ast, filename) {
    // ... 변환 로직
  }
}

// 싱글톤으로 사용
export const parser = new MarkdownParser();
```

### 5.2 에러 처리 및 검증

```javascript
import Ajv from 'ajv';
import courseSchema from './schemas/course.json' assert { type: 'json' };

const ajv = new Ajv({ allErrors: true });
const validate = ajv.compile(courseSchema);

/**
 * 파싱된 JSON의 스키마 유효성을 검사합니다.
 */
export function validateParsedContent(json) {
  const valid = validate(json);
  if (!valid) {
    const errors = validate.errors.map((err) => ({
      path: err.instancePath,
      message: err.message,
      params: err.params,
    }));
    throw new ValidationError('스키마 검증 실패', errors);
  }
  return true;
}

class ValidationError extends Error {
  constructor(message, errors) {
    super(message);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

/**
 * frontmatter 필수 필드 검사
 */
export function validateFrontmatter(meta, requiredFields = ['id', 'title']) {
  const missing = requiredFields.filter((field) => !(field in meta));
  if (missing.length > 0) {
    throw new Error(`frontmatter 필수 필드 누락: ${missing.join(', ')}`);
  }
}

/**
 * 안전한 파싱 래퍼 (에러 격리)
 */
export async function safeParseMarkdown(filePath, content) {
  try {
    const json = markdownToJson(content, { filename: filePath });
    validateFrontmatter(json.meta);
    return { success: true, data: json, filePath };
  } catch (error) {
    return {
      success: false,
      error: {
        type: error.name,
        message: error.message,
        filePath,
      },
    };
  }
}
```

### 5.3 증분 업데이트와 캐싱

```javascript
import { createHash } from 'crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';

/**
 * 파일 해시 기반 캐싱으로 불필요한 재파싱을 방지합니다.
 */
class CachedParser {
  #cacheDir;
  #parser;
  #cacheIndex = new Map();

  constructor(cacheDir = './.parse-cache') {
    this.#cacheDir = cacheDir;
    this.#parser = new MarkdownParser();
    this.#loadCacheIndex();
  }

  parseWithCache(filePath, content) {
    const hash = this.#computeHash(content);
    const cached = this.#cacheIndex.get(filePath);

    if (cached && cached.hash === hash) {
      // 캐시 히트: 저장된 JSON 반환
      const cachePath = this.#getCachePath(filePath);
      if (existsSync(cachePath)) {
        return JSON.parse(readFileSync(cachePath, 'utf-8'));
      }
    }

    // 캐시 미스: 파싱 후 저장
    const json = this.#parser.parse(content, filePath);
    this.#saveToCache(filePath, hash, json);
    return json;
  }

  #computeHash(content) {
    return createHash('sha256').update(content).digest('hex').slice(0, 16);
  }

  #getCachePath(filePath) {
    const safeFilename = filePath.replace(/[/\\:]/g, '_');
    return `${this.#cacheDir}/${safeFilename}.json`;
  }

  #saveToCache(filePath, hash, json) {
    this.#cacheIndex.set(filePath, { hash, cachedAt: Date.now() });
    writeFileSync(this.#getCachePath(filePath), JSON.stringify(json));
    this.#saveCacheIndex();
  }

  #loadCacheIndex() {
    const indexPath = `${this.#cacheDir}/index.json`;
    if (existsSync(indexPath)) {
      const data = JSON.parse(readFileSync(indexPath, 'utf-8'));
      this.#cacheIndex = new Map(Object.entries(data));
    }
  }

  #saveCacheIndex() {
    const indexPath = `${this.#cacheDir}/index.json`;
    writeFileSync(indexPath, JSON.stringify(Object.fromEntries(this.#cacheIndex)));
  }
}
```

### 5.4 마크다운 인코딩 및 특수문자 처리

```javascript
/**
 * 마크다운 텍스트에서 HTML 엔티티 및 특수문자를 정규화합니다.
 */
export function normalizeMarkdownText(text) {
  return text
    // HTML 엔티티 디코딩
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // 마크다운 이스케이프 제거
    .replace(/\\([*_`\[\]()#+\-.!])/g, '$1')
    // 연속 공백 정규화
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 한국어 slug 생성 (한글 유지 또는 로마자 변환)
 */
export function createKoreanSlug(text, options = { preserveHangul: true }) {
  if (options.preserveHangul) {
    return text
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w가-힣ㄱ-ㅎ-]/g, '')
      .replace(/^-+|-+$/g, '');
  }
  // 로마자 변환이 필요한 경우 'hangul-romanize' 라이브러리 사용
  return text.toLowerCase().replace(/[^\w]/g, '-').replace(/-+/g, '-');
}
```

### 5.5 다국어 및 RTL 지원

```javascript
// 다국어 frontmatter 처리
const multilingualMatter = matter(content);

const meta = {
  ...multilingualMatter.data,
  // 언어별 타이틀 지원
  titles: {
    ko: multilingualMatter.data.title_ko || multilingualMatter.data.title,
    en: multilingualMatter.data.title_en || null,
    ja: multilingualMatter.data.title_ja || null,
  },
  // 텍스트 방향
  direction: ['ar', 'he', 'fa', 'ur'].includes(multilingualMatter.data.language)
    ? 'rtl'
    : 'ltr',
};
```

### 5.6 CI/CD 파이프라인에서의 활용

```yaml
# .github/workflows/parse-content.yml
name: Parse Markdown Content

on:
  push:
    paths:
      - 'content/**/*.md'

jobs:
  parse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Parse and validate markdown
        run: |
          node scripts/parse-content.js \
            --input ./content \
            --output ./dist/content.json \
            --validate \
            --fail-on-error

      - name: Upload parsed content
        uses: actions/upload-artifact@v4
        with:
          name: parsed-content
          path: dist/content.json
```

```javascript
// scripts/parse-content.js
import { glob } from 'glob';
import { readFileSync, writeFileSync } from 'fs';
import { safeParseMarkdown } from '../src/parser/index.js';

async function main() {
  const args = process.argv.slice(2);
  const inputDir = args[args.indexOf('--input') + 1] || './content';
  const outputFile = args[args.indexOf('--output') + 1] || './dist/content.json';
  const failOnError = args.includes('--fail-on-error');

  const files = await glob(`${inputDir}/**/*.md`);
  console.log(`발견된 파일: ${files.length}개`);

  const results = await Promise.all(
    files.map(async (filePath) => {
      const content = readFileSync(filePath, 'utf-8');
      return safeParseMarkdown(filePath, content);
    })
  );

  const errors = results.filter((r) => !r.success);
  const successes = results.filter((r) => r.success).map((r) => r.data);

  if (errors.length > 0) {
    console.error(`\n파싱 오류 ${errors.length}건:`);
    errors.forEach((e) => {
      console.error(`  [${e.error.type}] ${e.error.filePath}: ${e.error.message}`);
    });
    if (failOnError) process.exit(1);
  }

  writeFileSync(outputFile, JSON.stringify({ documents: successes }, null, 2));
  console.log(`\n완료: ${successes.length}개 파싱 성공 → ${outputFile}`);
}

main().catch((err) => {
  console.error('치명적 오류:', err);
  process.exit(1);
});
```

---

## 6. 전체 통합 예제

### 6.1 완성형 교육 콘텐츠 파이프라인

아래는 마크다운 파일 디렉토리를 입력받아 완전한 코스 JSON을 생성하는 최종 통합 예제입니다.

**디렉토리 구조:**

```
course-js-fundamentals/
├── course.json
├── module-01-basics/
│   ├── module.json
│   ├── chapter-01-variables.md
│   ├── chapter-02-functions.md
│   └── chapter-03-quiz.md
└── module-02-advanced/
    ├── module.json
    └── chapter-01-closures.md
```

**`course.json`:**

```json
{
  "id": "javascript-fundamentals",
  "title": "JavaScript 기초 완성",
  "version": "2.0.0",
  "language": "ko",
  "level": "beginner",
  "author": { "name": "홍길동", "email": "hong@example.com" }
}
```

**`chapter-01-variables.md`:**

```markdown
---
id: js-basics-ch01
title: "변수와 자료형"
type: lecture
duration: 45
order: 1
objectives:
  - "const, let, var의 차이를 설명할 수 있다"
  - "JavaScript 원시 자료형 7가지를 나열할 수 있다"
tags: [javascript, variables, beginner]
---

# 변수와 자료형

JavaScript에서 데이터를 다루는 가장 기본적인 개념인 변수와 자료형을 학습합니다.

## 변수 선언 키워드

ES6 이후 `const`와 `let`을 주로 사용합니다.

```javascript
// 상수 (재할당 불가)
const MAX_SIZE = 100;
const API_URL = "https://api.example.com";

// 변수 (재할당 가능)
let count = 0;
count = count + 1;

// 구식 방식 (지양)
var oldStyle = "deprecated";
\```

> **주의**: `const`는 재할당이 불가능하지만, 객체나 배열의 내부 값은 변경할 수 있습니다.

## 원시 자료형

JavaScript에는 7가지 원시 자료형이 있습니다.

| 자료형 | 예시 | 설명 |
|--------|------|------|
| string | `"hello"` | 문자열 |
| number | `42`, `3.14` | 숫자 (정수/실수 구분 없음) |
| boolean | `true`, `false` | 참/거짓 |
| null | `null` | 의도적 빈 값 |
| undefined | `undefined` | 값 없음 |
| symbol | `Symbol('id')` | 고유 식별자 |
| bigint | `9007199254740991n` | 큰 정수 |

### typeof 연산자

```javascript
typeof "hello"     // "string"
typeof 42          // "number"
typeof true        // "boolean"
typeof null        // "object" ← JavaScript 버그!
typeof undefined   // "undefined"
typeof Symbol()    // "symbol"
\```
```

**통합 파이프라인 실행:**

```javascript
// pipeline.js
import { buildCourseFromDirectory } from './courseBuilder.js';
import { validateParsedContent } from './validator.js';
import { writeFileSync } from 'fs';

async function runPipeline(courseDir, outputPath) {
  console.log(`파이프라인 시작: ${courseDir}`);
  const startTime = performance.now();

  // 1단계: 파싱
  const courseJson = buildCourseFromDirectory(courseDir);
  console.log(`파싱 완료: ${courseJson.modules.length}개 모듈`);

  // 2단계: 검증
  try {
    validateParsedContent(courseJson);
    console.log('스키마 검증 통과');
  } catch (err) {
    console.error('검증 실패:', err.errors);
    throw err;
  }

  // 3단계: 저장
  writeFileSync(outputPath, JSON.stringify(courseJson, null, 2), 'utf-8');

  const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
  console.log(`완료: ${outputPath} (${elapsed}초)`);

  return courseJson;
}

// 실행
runPipeline('./course-js-fundamentals', './dist/course.json')
  .then((json) => {
    console.log('\n요약:');
    console.log(`  총 챕터: ${json.meta.totalChapters}개`);
    console.log(`  총 학습시간: ${json.meta.totalDuration}분`);
  })
  .catch((err) => {
    console.error('파이프라인 오류:', err);
    process.exit(1);
  });
```

**최종 출력 JSON 구조:**

```json
{
  "meta": {
    "id": "javascript-fundamentals",
    "title": "JavaScript 기초 완성",
    "version": "2.0.0",
    "language": "ko",
    "level": "beginner",
    "author": { "name": "홍길동", "email": "hong@example.com" },
    "parsedAt": "2026-04-20T09:00:00.000Z",
    "totalChapters": 4,
    "totalDuration": 180
  },
  "modules": [
    {
      "id": "module-01-basics",
      "title": "기초 모듈",
      "order": 1,
      "chapters": [
        {
          "meta": {
            "id": "js-basics-ch01",
            "title": "변수와 자료형",
            "type": "lecture",
            "duration": 45,
            "objectives": [
              "const, let, var의 차이를 설명할 수 있다",
              "JavaScript 원시 자료형 7가지를 나열할 수 있다"
            ],
            "tags": ["javascript", "variables", "beginner"]
          },
          "chapters": [
            {
              "id": "변수와-자료형",
              "title": "변수와 자료형",
              "depth": 1,
              "content": [
                {
                  "type": "paragraph",
                  "text": "JavaScript에서 데이터를 다루는 가장 기본적인 개념인 변수와 자료형을 학습합니다."
                }
              ],
              "sections": [
                {
                  "id": "변수-선언-키워드",
                  "title": "변수 선언 키워드",
                  "depth": 2,
                  "content": [
                    { "type": "paragraph", "text": "ES6 이후 const와 let을 주로 사용합니다." },
                    { "type": "code", "lang": "javascript", "value": "const MAX_SIZE = 100;\n..." },
                    { "type": "blockquote", "text": "주의: const는 재할당이 불가능하지만..." }
                  ],
                  "subsections": []
                },
                {
                  "id": "원시-자료형",
                  "title": "원시 자료형",
                  "depth": 2,
                  "content": [
                    { "type": "paragraph", "text": "JavaScript에는 7가지 원시 자료형이 있습니다." },
                    {
                      "type": "table",
                      "headers": ["자료형", "예시", "설명"],
                      "rows": [
                        ["string", "\"hello\"", "문자열"],
                        ["number", "42, 3.14", "숫자 (정수/실수 구분 없음)"]
                      ]
                    }
                  ],
                  "subsections": [
                    {
                      "id": "typeof-연산자",
                      "title": "typeof 연산자",
                      "depth": 3,
                      "content": [
                        { "type": "code", "lang": "javascript", "value": "typeof \"hello\"  // \"string\"\n..." }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

### 6.2 라이브러리 의존성 요약

```json
{
  "dependencies": {
    "unified": "^11.0.0",
    "remark-parse": "^11.0.0",
    "remark-stringify": "^11.0.0",
    "remark-frontmatter": "^5.0.0",
    "remark-gfm": "^4.0.0",
    "unist-util-visit": "^5.0.0",
    "mdast-util-to-string": "^4.0.0",
    "gray-matter": "^4.0.3",
    "marked": "^12.0.0",
    "js-yaml": "^4.1.0",
    "ajv": "^8.12.0"
  },
  "devDependencies": {
    "@types/mdast": "^4.0.0",
    "@types/unist": "^3.0.0"
  }
}
```

### 6.3 핵심 의사결정 가이드

```
마크다운 파싱 라이브러리를 선택할 때:

Q1. frontmatter(YAML 헤더)가 필요한가?
  → YES: gray-matter를 반드시 포함
  → NO: remark-parse만으로 충분

Q2. 마크다운 구조를 세밀하게 제어해야 하는가?
  → YES (AST 수준 제어): unified + remark-parse
  → NO (단순 텍스트 추출): marked 또는 정규식

Q3. 플러그인 생태계가 중요한가?
  → YES: unified 생태계 (remark-gfm, remark-math, rehype 등)
  → NO: 단독 라이브러리 (gray-matter + 커스텀 로직)

Q4. 번들 크기가 중요한가? (브라우저 환경)
  → YES: marked (가장 작음) 또는 micromark
  → NO: unified 전체 생태계

Q5. 타입 안전성이 필요한가?
  → YES: @types/mdast 포함 unified 생태계
  → NO: 모든 라이브러리 가능
```

---

이 문서는 마크다운 파싱과 JSON 변환의 실무 전반을 다루며, `unified/remark` 기반의 AST 파이프라인을 중심으로 교육 콘텐츠 특화 패턴을 제시합니다. 프로젝트 규모와 요구사항에 따라 적절한 라이브러리 조합을 선택하고, frontmatter 규약과 JSON 스키마를 팀 내에서 먼저 합의한 후 파서를 구현하는 순서를 권장합니다.