# 마크다운 → 인터랙티브 JSON 변환: Python 기술 레퍼런스

> NotebookLM 추출 교육 콘텐츠(VOD) → 슬라이드 JSON 변환 파이프라인

---

## 목차

1. [파싱 라이브러리 비교 개요](#1)
2. [`markdown` 라이브러리 — HTML AST 파싱](#2)
3. [`mistune` — 커스텀 렌더러 기반 파싱](#3)
4. [`marko` — AST 구조 파싱](#4)
5. [`python-frontmatter` — YAML 프론트매터 추출](#5)
6. [헤딩 기반 청킹 전략](#6)
7. [슬라이드 구분자(`---`) 파싱](#7)
8. [인터랙티브 JSON 스키마 설계](#8)
9. [통합 파이프라인 구현](#9)
10. [퀴즈 데이터 추출](#10)
11. [실전 예제: NotebookLM 콘텐츠 변환](#11)

---

## 1. 파싱 라이브러리 비교 개요

| 라이브러리 | 방식 | 속도 | AST 접근 | 커스텀 렌더러 | 추천 용도 |
|---|---|---|---|---|---|
| `markdown` | HTML 변환 | 보통 | 제한적 | Extension API | HTML 중간 파싱 |
| `mistune` 3.x | 토큰 AST | 빠름 | 토큰 트리 | 완전 지원 | 커스텀 출력 |
| `marko` | CommonMark AST | 보통 | 완전 지원 | Renderer 클래스 | 구조 분석 |
| `python-frontmatter` | YAML 헤더 | 빠름 | 메타데이터만 | 없음 | 메타 추출 |

```bash
pip install markdown mistune marko python-frontmatter PyYAML beautifulsoup4 lxml
```

---

## 2. `markdown` 라이브러리 — HTML AST 파싱

`markdown` 라이브러리는 마크다운을 HTML로 변환한 뒤, BeautifulSoup으로 구조를 파싱하는 2단계 방식을 사용한다.

### 2.1 기본 변환 및 Extension 활용

```python
import markdown
from markdown.extensions.toc import TocExtension
from markdown.extensions.tables import TableExtension
from markdown.extensions.fenced_code import FencedCodeExtension

def md_to_html_ast(md_text: str) -> dict:
    """
    마크다운 텍스트를 HTML로 변환하고 메타데이터를 추출한다.
    
    Args:
        md_text: 원본 마크다운 문자열
    Returns:
        html 문자열과 메타데이터를 담은 딕셔너리
    """
    md = markdown.Markdown(
        extensions=[
            TocExtension(baselevel=1),   # 목차 자동 생성
            TableExtension(),             # 테이블 지원
            FencedCodeExtension(),        # ```코드블록``` 지원
            'meta',                       # 메타데이터 블록 지원
            'admonition',                 # 경고/노트 블록 지원
            'attr_list',                  # HTML 속성 지원
        ]
    )
    html = md.convert(md_text)
    
    # meta 확장으로 추출된 메타데이터 (파일 상단 key: value 형식)
    meta = {k: ' '.join(v) for k, v in md.Meta.items()} if hasattr(md, 'Meta') else {}
    toc = md.toc if hasattr(md, 'toc') else ''
    
    return {
        'html': html,
        'meta': meta,
        'toc': toc
    }

# 사용 예시
sample_md = """
Title: Python 기초 강의
Author: 홍길동
Date: 2026-04-20

# 파이썬 소개

파이썬은 **간결하고 읽기 쉬운** 프로그래밍 언어입니다.

## 역사

1991년 귀도 반 로섬이 개발하였습니다.

### 주요 특징

- 인터프리터 언어
- 동적 타이핑
- 풍부한 표준 라이브러리

```python
print("Hello, World!")
```
"""

result = md_to_html_ast(sample_md)
print(result['meta'])   # {'title': 'Python 기초 강의', 'author': '홍길동', ...}
```

### 2.2 BeautifulSoup을 이용한 HTML → 구조 JSON 변환

```python
from bs4 import BeautifulSoup, Tag
from typing import Any

def html_to_structured_blocks(html: str) -> list[dict]:
    """
    HTML을 파싱해 콘텐츠 블록 리스트로 변환한다.
    각 블록은 type, content, metadata를 포함한다.
    """
    soup = BeautifulSoup(html, 'lxml')
    blocks = []
    
    TAG_TYPE_MAP = {
        'h1': 'heading1', 'h2': 'heading2', 'h3': 'heading3',
        'h4': 'heading4', 'h5': 'heading5', 'h6': 'heading6',
        'p': 'paragraph', 'ul': 'list', 'ol': 'ordered_list',
        'pre': 'code', 'table': 'table', 'blockquote': 'quote',
        'hr': 'divider', 'img': 'image',
    }
    
    def parse_list_items(tag: Tag) -> list[str]:
        """중첩 리스트를 포함한 리스트 아이템 추출"""
        items = []
        for li in tag.find_all('li', recursive=False):
            nested_ul = li.find(['ul', 'ol'])
            if nested_ul:
                text = li.get_text(separator=' ', strip=True)
                items.append({
                    'text': text,
                    'children': parse_list_items(nested_ul)
                })
            else:
                items.append({'text': li.get_text(strip=True), 'children': []})
        return items
    
    def parse_table(tag: Tag) -> dict:
        """테이블을 헤더/행 구조로 변환"""
        headers = [th.get_text(strip=True) for th in tag.find_all('th')]
        rows = []
        for tr in tag.find_all('tr'):
            cells = [td.get_text(strip=True) for td in tr.find_all('td')]
            if cells:
                rows.append(cells)
        return {'headers': headers, 'rows': rows}
    
    def parse_code_block(tag: Tag) -> dict:
        """코드 블록에서 언어 정보와 내용 추출"""
        code_tag = tag.find('code')
        if code_tag:
            classes = code_tag.get('class', [])
            # 언어 클래스 추출: "language-python" → "python"
            lang = next(
                (c.replace('language-', '') for c in classes if c.startswith('language-')),
                'text'
            )
            return {'language': lang, 'code': code_tag.get_text()}
        return {'language': 'text', 'code': tag.get_text()}
    
    for element in soup.body.children if soup.body else soup.children:
        if not isinstance(element, Tag):
            continue
        
        tag_name = element.name.lower()
        block_type = TAG_TYPE_MAP.get(tag_name, 'unknown')
        
        if block_type == 'unknown':
            continue
        
        block: dict[str, Any] = {'type': block_type}
        
        if block_type in ('heading1', 'heading2', 'heading3', 'heading4'):
            block['text'] = element.get_text(strip=True)
            block['id'] = element.get('id', '')
            
        elif block_type == 'paragraph':
            # 인라인 포맷(bold, italic, code, link) 보존
            block['text'] = element.get_text(strip=True)
            block['html'] = str(element)
            
        elif block_type in ('list', 'ordered_list'):
            block['items'] = parse_list_items(element)
            
        elif block_type == 'code':
            block.update(parse_code_block(element))
            
        elif block_type == 'table':
            block.update(parse_table(element))
            
        elif block_type == 'quote':
            block['text'] = element.get_text(strip=True)
            
        elif block_type == 'divider':
            block['type'] = 'divider'
            
        elif block_type == 'image':
            block['src'] = element.get('src', '')
            block['alt'] = element.get('alt', '')
        
        blocks.append(block)
    
    return blocks
```

---

## 3. `mistune` — 커스텀 렌더러 기반 파싱

`mistune` 3.x는 토큰 기반 AST를 생성하며, 커스텀 렌더러를 통해 JSON을 직접 출력할 수 있다.

### 3.1 mistune AST 토큰 구조 이해

```python
import mistune
import json

def inspect_mistune_ast(md_text: str) -> None:
    """mistune AST 구조를 확인한다."""
    # create_markdown() 대신 내부 파서 직접 사용
    md = mistune.create_markdown(renderer=None)  # renderer=None → AST 반환
    tokens = md(md_text)
    print(json.dumps(tokens, indent=2, ensure_ascii=False))

# AST 샘플 출력 예시:
# [
#   {
#     "type": "heading",
#     "attrs": {"level": 1},
#     "children": [{"type": "text", "raw": "파이썬 소개"}]
#   },
#   {
#     "type": "paragraph",
#     "children": [
#       {"type": "text", "raw": "파이썬은 "},
#       {"type": "strong", "children": [{"type": "text", "raw": "간결하고"}]},
#       {"type": "text", "raw": " 읽기 쉬운 언어입니다."}
#     ]
#   }
# ]
```

### 3.2 JSON 출력 커스텀 렌더러 구현

```python
import mistune
from mistune.renderers.base import BaseRenderer
from typing import Optional

class JSONBlockRenderer(BaseRenderer):
    """
    mistune AST를 슬라이드 블록 JSON으로 변환하는 커스텀 렌더러.
    각 마크다운 요소를 구조화된 블록 딕셔너리로 직렬화한다.
    """
    
    NAME = 'json_block'
    
    def __init__(self):
        super().__init__()
        self._blocks: list[dict] = []
    
    def get_blocks(self) -> list[dict]:
        return self._blocks
    
    def reset(self):
        self._blocks = []
    
    # ─── 인라인 요소 ────────────────────────────────────────────────
    
    def text(self, token: dict, state) -> str:
        return token.get('raw', '')
    
    def strong(self, token: dict, state) -> str:
        children = self.render_children(token, state)
        return f'**{children}**'
    
    def emphasis(self, token: dict, state) -> str:
        children = self.render_children(token, state)
        return f'_{children}_'
    
    def codespan(self, token: dict, state) -> str:
        return f'`{token["raw"]}`'
    
    def link(self, token: dict, state) -> str:
        label = self.render_children(token, state)
        url = token['attrs']['url']
        return f'[{label}]({url})'
    
    def image(self, token: dict, state) -> str:
        alt = token['attrs'].get('alt', '')
        src = token['attrs']['url']
        self._blocks.append({'type': 'image', 'src': src, 'alt': alt})
        return ''
    
    def linebreak(self, token: dict, state) -> str:
        return '\n'
    
    def softline(self, token: dict, state) -> str:
        return ' '
    
    def inline_html(self, token: dict, state) -> str:
        return token.get('raw', '')
    
    # ─── 블록 요소 ────────────────────────────────────────────────
    
    def paragraph(self, token: dict, state) -> str:
        text = self.render_children(token, state)
        self._blocks.append({'type': 'paragraph', 'text': text.strip()})
        return ''
    
    def heading(self, token: dict, state) -> str:
        level = token['attrs']['level']
        text = self.render_children(token, state)
        self._blocks.append({
            'type': f'heading{level}',
            'level': level,
            'text': text.strip()
        })
        return ''
    
    def blank_line(self, token: dict, state) -> str:
        return ''
    
    def thematic_break(self, token: dict, state) -> str:
        self._blocks.append({'type': 'divider'})
        return ''
    
    def block_code(self, token: dict, state) -> str:
        attrs = token.get('attrs', {})
        info = attrs.get('info', '') or ''
        # "python run" → 언어만 추출
        lang = info.split()[0] if info else 'text'
        self._blocks.append({
            'type': 'code',
            'language': lang,
            'code': token['raw']
        })
        return ''
    
    def block_quote(self, token: dict, state) -> str:
        # 중첩 블록 처리를 위해 임시 블록 저장
        saved = self._blocks
        self._blocks = []
        self.render_children(token, state)
        inner_blocks = self._blocks
        self._blocks = saved
        self._blocks.append({
            'type': 'quote',
            'blocks': inner_blocks
        })
        return ''
    
    def list(self, token: dict, state) -> str:
        ordered = token['attrs']['ordered']
        items = self._render_list_items(token, state)
        self._blocks.append({
            'type': 'ordered_list' if ordered else 'list',
            'ordered': ordered,
            'items': items
        })
        return ''
    
    def _render_list_items(self, token: dict, state) -> list[dict]:
        items = []
        for child in token.get('children', []):
            if child['type'] == 'list_item':
                saved = self._blocks
                self._blocks = []
                self.render_token(child, state)
                inner = self._blocks
                self._blocks = saved
                
                # 텍스트만 있는 아이템은 단순 문자열로
                text_only = all(b['type'] == 'paragraph' for b in inner)
                if text_only:
                    text = ' '.join(b['text'] for b in inner)
                    items.append({'text': text, 'children': []})
                else:
                    items.append({'blocks': inner, 'children': []})
        return items
    
    def list_item(self, token: dict, state) -> str:
        self.render_children(token, state)
        return ''
    
    def table(self, token: dict, state) -> str:
        head = token['children'][0]  # table_head
        body = token['children'][1]  # table_body
        
        headers = []
        for th in head.get('children', [{}])[0].get('children', []):
            saved = self._blocks
            self._blocks = []
            self.render_children(th, state)
            text = ' '.join(b.get('text', '') for b in self._blocks)
            self._blocks = saved
            headers.append(text.strip())
        
        rows = []
        for tr in body.get('children', []):
            row = []
            for td in tr.get('children', []):
                saved = self._blocks
                self._blocks = []
                self.render_children(td, state)
                text = ' '.join(b.get('text', '') for b in self._blocks)
                self._blocks = saved
                row.append(text.strip())
            rows.append(row)
        
        self._blocks.append({
            'type': 'table',
            'headers': headers,
            'rows': rows
        })
        return ''
    
    def render_token(self, token: dict, state) -> str:
        """단일 토큰 렌더링 (list_item 처리용)"""
        func = self._get_method(token['type'])
        if func:
            return func(token, state)
        return self.render_children(token, state)
    
    def _get_method(self, name: str):
        try:
            return object.__getattribute__(self, name)
        except AttributeError:
            return None
    
    def render_children(self, token: dict, state) -> str:
        children = token.get('children', [])
        if isinstance(children, list):
            return ''.join(
                self.render_token(child, state) for child in children
            )
        return ''
    
    def __call__(self, tokens, state) -> list[dict]:
        self.reset()
        for token in tokens:
            self.render_token(token, state)
        return self._blocks


def parse_with_mistune(md_text: str) -> list[dict]:
    """mistune으로 마크다운을 파싱해 블록 리스트를 반환한다."""
    renderer = JSONBlockRenderer()
    md = mistune.create_markdown(renderer=renderer)
    md(md_text)
    return renderer.get_blocks()
```

---

## 4. `marko` — AST 구조 파싱

`marko`는 CommonMark 표준을 완전히 구현하며, 노드 트리를 직접 순회할 수 있다.

### 4.1 marko AST 순회

```python
import marko
from marko import block, inline
from marko.ast_renderer import ASTRenderer

def inspect_marko_ast(md_text: str) -> dict:
    """marko AST 딕셔너리 구조를 반환한다."""
    md = marko.Markdown(renderer=ASTRenderer)
    ast_dict = md(md_text)
    return ast_dict


def marko_node_to_blocks(md_text: str) -> list[dict]:
    """
    marko의 AST를 순회해 블록 리스트로 변환한다.
    재귀적으로 중첩 노드를 처리한다.
    """
    doc = marko.parse(md_text)
    blocks = []
    
    def get_inline_text(node) -> str:
        """인라인 노드에서 평문 텍스트를 재귀 추출한다."""
        if isinstance(node, marko.inline.RawText):
            return node.children
        if isinstance(node, str):
            return node
        if hasattr(node, 'children'):
            if isinstance(node.children, list):
                return ''.join(get_inline_text(c) for c in node.children)
            elif isinstance(node.children, str):
                return node.children
        return ''
    
    def process_node(node) -> Optional[dict]:
        """단일 노드를 블록 딕셔너리로 변환한다."""
        node_type = type(node).__name__
        
        if node_type == 'Heading':
            return {
                'type': f'heading{node.level}',
                'level': node.level,
                'text': get_inline_text(node)
            }
        
        elif node_type == 'Paragraph':
            return {
                'type': 'paragraph',
                'text': get_inline_text(node)
            }
        
        elif node_type == 'FencedCode':
            lang = node.lang or 'text'
            code = node.children[0].children if node.children else ''
            return {
                'type': 'code',
                'language': lang.strip(),
                'code': code
            }
        
        elif node_type == 'CodeBlock':
            code = node.children[0].children if node.children else ''
            return {'type': 'code', 'language': 'text', 'code': code}
        
        elif node_type == 'List':
            items = []
            for list_item in node.children:
                item_text_parts = []
                for child in list_item.children:
                    text = get_inline_text(child)
                    if text.strip():
                        item_text_parts.append(text.strip())
                items.append({
                    'text': ' '.join(item_text_parts),
                    'children': []
                })
            return {
                'type': 'ordered_list' if node.ordered else 'list',
                'ordered': node.ordered,
                'items': items
            }
        
        elif node_type == 'Quote':
            inner = []
            for child in node.children:
                b = process_node(child)
                if b:
                    inner.append(b)
            return {'type': 'quote', 'blocks': inner}
        
        elif node_type in ('ThematicBreak', 'SetextHeading'):
            if node_type == 'ThematicBreak':
                return {'type': 'divider'}
            return process_node(node)  # SetextHeading은 Heading으로 처리됨
        
        elif node_type == 'HTMLBlock':
            return {'type': 'html', 'content': node.children}
        
        return None
    
    if hasattr(doc, 'children'):
        for child in doc.children:
            block_data = process_node(child)
            if block_data:
                blocks.append(block_data)
    
    return blocks
```

---

## 5. `python-frontmatter` — YAML 프론트매터 추출

교육 콘텐츠 메타데이터(강의명, 강사, 날짜, 태그 등)를 파일 상단 YAML 블록으로 정의하고 추출한다.

### 5.1 프론트매터 구조 및 파싱

```python
import frontmatter
from datetime import date, datetime
from typing import Any
import yaml

SAMPLE_FRONTMATTER_MD = """---
title: "파이썬 기초 과정 - 1강"
author: "홍길동"
date: 2026-04-20
tags:
  - python
  - beginner
  - programming
course_id: "PY-101"
chapter: 1
duration_minutes: 45
thumbnail: "https://example.com/thumb.jpg"
quiz_enabled: true
---

# 파이썬 소개

파이썬은 1991년에 개발된 언어입니다.
"""

def extract_frontmatter(md_text: str) -> dict[str, Any]:
    """
    YAML 프론트매터를 파싱해 메타데이터와 본문을 분리한다.
    
    Returns:
        {
            'meta': { title, author, date, ... },
            'content': '프론트매터 제거된 본문 마크다운'
        }
    """
    post = frontmatter.loads(md_text)
    
    meta = dict(post.metadata)
    
    # 날짜 타입 정규화
    for key, value in meta.items():
        if isinstance(value, (date, datetime)):
            meta[key] = value.isoformat()
    
    return {
        'meta': meta,
        'content': post.content  # 프론트매터 제거된 순수 마크다운
    }

# 사용 예시
parsed = extract_frontmatter(SAMPLE_FRONTMATTER_MD)
print(parsed['meta']['title'])      # "파이썬 기초 과정 - 1강"
print(parsed['meta']['tags'])       # ['python', 'beginner', 'programming']
print(parsed['meta']['chapter'])    # 1
```

### 5.2 커스텀 메타데이터 핸들러

```python
def build_slide_meta(raw_meta: dict) -> dict:
    """
    raw 프론트매터를 슬라이드 메타 스키마에 맞게 정규화한다.
    필수 필드 누락 시 기본값을 채운다.
    """
    return {
        'title': raw_meta.get('title', '제목 없음'),
        'author': raw_meta.get('author', ''),
        'date': raw_meta.get('date', date.today().isoformat()),
        'course_id': raw_meta.get('course_id', ''),
        'chapter': int(raw_meta.get('chapter', 0)),
        'tags': list(raw_meta.get('tags', [])),
        'thumbnail': raw_meta.get('thumbnail', None),
        'duration_minutes': int(raw_meta.get('duration_minutes', 0)),
        'quiz_enabled': bool(raw_meta.get('quiz_enabled', False)),
        'language': raw_meta.get('language', 'ko'),
    }
```

---

## 6. 헤딩 기반 청킹 전략

NotebookLM에서 추출된 콘텐츠는 H1=챕터, H2=섹션, H3=서브섹션 계층으로 분리해 각 슬라이드로 변환한다.

### 6.1 계층적 청킹 알고리즘

```python
from dataclasses import dataclass, field
from typing import Optional

@dataclass
class ContentChunk:
    """헤딩 기반으로 분리된 콘텐츠 청크"""
    level: int              # 헤딩 레벨 (1=H1, 2=H2, 3=H3)
    title: str              # 헤딩 텍스트
    blocks: list[dict]      # 해당 섹션의 콘텐츠 블록들
    children: list['ContentChunk'] = field(default_factory=list)
    slide_index: int = 0
    
    def to_dict(self) -> dict:
        return {
            'level': self.level,
            'title': self.title,
            'blocks': self.blocks,
            'children': [c.to_dict() for c in self.children]
        }


def chunk_by_headings(
    blocks: list[dict],
    max_level: int = 3,
    min_level: int = 1
) -> list[ContentChunk]:
    """
    블록 리스트를 헤딩 기준으로 계층적 청크로 분리한다.
    
    전략:
    - H1 → 최상위 챕터 (새 섹션 시작)
    - H2 → 섹션 (H1 하위)
    - H3 → 서브섹션 (H2 하위)
    - H1/H2/H3 이전의 블록 → 'intro' 청크
    
    Args:
        blocks: parse 결과 블록 리스트
        max_level: 슬라이드로 분리할 최대 헤딩 레벨 (기본값 3)
        min_level: 슬라이드로 분리할 최소 헤딩 레벨 (기본값 1)
    Returns:
        계층 구조를 가진 ContentChunk 리스트
    """
    
    def is_heading(block: dict, level: Optional[int] = None) -> bool:
        if level:
            return block.get('type') == f'heading{level}'
        return block.get('type', '').startswith('heading')
    
    def get_heading_level(block: dict) -> int:
        t = block.get('type', '')
        if t.startswith('heading'):
            try:
                return int(t[-1])
            except ValueError:
                return 0
        return 0
    
    chunks: list[ContentChunk] = []
    current_chunk: Optional[ContentChunk] = None
    intro_blocks: list[dict] = []
    
    for block in blocks:
        level = get_heading_level(block)
        
        if is_heading(block) and min_level <= level <= max_level:
            # 이전 청크가 있으면 저장
            if current_chunk is not None:
                chunks.append(current_chunk)
            # 새 청크 시작
            current_chunk = ContentChunk(
                level=level,
                title=block.get('text', ''),
                blocks=[]
            )
        else:
            if current_chunk is None:
                # 첫 헤딩 이전 블록들은 intro에 모음
                intro_blocks.append(block)
            else:
                current_chunk.blocks.append(block)
    
    # 마지막 청크 저장
    if current_chunk is not None:
        chunks.append(current_chunk)
    
    # intro 블록이 있으면 맨 앞에 추가
    if intro_blocks:
        chunks.insert(0, ContentChunk(
            level=0,
            title='소개',
            blocks=intro_blocks
        ))
    
    return chunks


def build_hierarchy(chunks: list[ContentChunk]) -> list[ContentChunk]:
    """
    평탄한 청크 리스트를 계층 트리로 재구성한다.
    예: [H1, H2, H2, H3, H2] → H1 아래 H2들, H2 아래 H3
    """
    if not chunks:
        return []
    
    root_chunks: list[ContentChunk] = []
    stack: list[ContentChunk] = []  # 현재 조상 스택
    
    for chunk in chunks:
        # 스택에서 현재 레벨보다 높거나 같은 레벨 제거
        while stack and stack[-1].level >= chunk.level:
            stack.pop()
        
        if stack:
            # 부모가 있으면 자식으로 추가
            stack[-1].children.append(chunk)
        else:
            # 루트 레벨 청크
            root_chunks.append(chunk)
        
        stack.append(chunk)
    
    return root_chunks


def flatten_chunks_to_slides(
    chunks: list[ContentChunk],
    include_children: bool = True
) -> list[ContentChunk]:
    """
    계층 트리를 다시 평탄화해 슬라이드 순서 리스트로 만든다.
    각 슬라이드에 순서 인덱스를 부여한다.
    """
    slides: list[ContentChunk] = []
    
    def flatten(chunk: ContentChunk):
        slides.append(chunk)
        if include_children:
            for child in chunk.children:
                flatten(child)
    
    for chunk in chunks:
        flatten(chunk)
    
    for i, slide in enumerate(slides):
        slide.slide_index = i
    
    return slides
```

---

## 7. 슬라이드 구분자(`---`) 파싱

`---` 구분자로 슬라이드를 명시적으로 나누는 Reveal.js 스타일을 지원한다.

### 7.1 구분자 기반 분리

```python
import re

def split_by_slide_separator(
    md_text: str,
    separator: str = r'^---$',
    vertical_separator: str = r'^___$'
) -> list[dict]:
    """
    마크다운 텍스트를 슬라이드 구분자(`---`)로 분리한다.
    
    - `---` : 수평 슬라이드 구분 (다음 슬라이드)
    - `___` : 수직 슬라이드 구분 (서브 슬라이드, 선택적)
    
    주의: YAML 프론트매터의 `---`와 충돌을 피하기 위해
          프론트매터를 먼저 제거한 본문에만 적용한다.
    
    Args:
        md_text: 프론트매터 제거된 본문 마크다운
        separator: 수평 구분자 정규식
        vertical_separator: 수직 구분자 정규식
    Returns:
        슬라이드 딕셔너리 리스트
    """
    
    # 수평 구분: `---` 단독 줄
    horiz_pattern = re.compile(separator, re.MULTILINE)
    # 수직 구분: `___` 단독 줄
    vert_pattern = re.compile(vertical_separator, re.MULTILINE)
    
    # 먼저 수평으로 분리
    horizontal_sections = horiz_pattern.split(md_text)
    
    slides = []
    slide_index = 0
    
    for h_idx, h_section in enumerate(horizontal_sections):
        h_section = h_section.strip()
        if not h_section:
            continue
        
        # 수직 슬라이드가 있는지 확인
        vertical_sections = vert_pattern.split(h_section)
        
        if len(vertical_sections) > 1:
            # 수직 슬라이드 그룹
            v_slides = []
            for v_idx, v_section in enumerate(vertical_sections):
                v_section = v_section.strip()
                if not v_section:
                    continue
                v_slides.append({
                    'index': slide_index,
                    'h_index': h_idx,
                    'v_index': v_idx,
                    'type': 'vertical',
                    'raw_md': v_section,
                })
                slide_index += 1
            slides.extend(v_slides)
        else:
            slides.append({
                'index': slide_index,
                'h_index': h_idx,
                'v_index': 0,
                'type': 'horizontal',
                'raw_md': h_section,
            })
            slide_index += 1
    
    return slides


def enrich_slide_sections(
    slide_sections: list[dict],
    parser_fn
) -> list[dict]:
    """
    각 슬라이드 섹션의 raw_md를 파싱해 blocks를 추가한다.
    
    Args:
        slide_sections: split_by_slide_separator() 결과
        parser_fn: md_text → list[dict] 블록 파서 함수
    Returns:
        blocks가 추가된 슬라이드 리스트
    """
    enriched = []
    for section in slide_sections:
        blocks = parser_fn(section['raw_md'])
        
        # 첫 번째 heading 블록을 슬라이드 타이틀로 추출
        title = ''
        content_blocks = []
        for block in blocks:
            if not title and block.get('type', '').startswith('heading'):
                title = block.get('text', '')
            else:
                content_blocks.append(block)
        
        enriched.append({
            **section,
            'title': title,
            'blocks': content_blocks,
        })
    return enriched
```

---

## 8. 인터랙티브 JSON 스키마 설계

### 8.1 완전한 스키마 정의

```python
from dataclasses import dataclass, field
from typing import Literal, Union, Optional
import json

# ─── 블록 타입 정의 ────────────────────────────────────────────────

SlideType = Literal[
    'cover',        # 표지 슬라이드
    'content',      # 일반 콘텐츠
    'section',      # 섹션 구분
    'quiz',         # 퀴즈
    'summary',      # 요약
    'image',        # 이미지 전용
    'code',         # 코드 전용
    'blank',        # 빈 슬라이드
]

BlockType = Literal[
    'heading1', 'heading2', 'heading3',
    'paragraph', 'list', 'ordered_list',
    'code', 'table', 'quote',
    'image', 'divider', 'callout',
    'quiz_question', 'quiz_options',
]


def build_full_json_schema() -> dict:
    """
    슬라이드 JSON 전체 스키마 구조를 반환한다.
    교육 VOD → 슬라이드 변환에 최적화된 구조.
    """
    return {
        # ─── 문서 메타데이터 ───────────────────────────────────────
        "meta": {
            "title": "강의 제목",
            "author": "강사명",
            "date": "2026-04-20",
            "course_id": "COURSE-001",
            "chapter": 1,
            "tags": ["python", "beginner"],
            "thumbnail": None,
            "duration_minutes": 45,
            "quiz_enabled": True,
            "language": "ko",
            "version": "1.0.0",
            "generated_at": "2026-04-20T00:00:00",
            "source": "notebooklm_vod"
        },
        
        # ─── 슬라이드 배열 ─────────────────────────────────────────
        "slides": [
            
            # 표지 슬라이드 예시
            {
                "index": 0,
                "id": "slide-0",
                "type": "cover",
                "title": "파이썬 기초 과정",
                "subtitle": "1강: 파이썬 소개",
                "blocks": [],
                "notes": "강사 노트: 수강생 배경 파악 필요",
                "duration_seconds": None,
                "bg_color": "#1a1a2e",
                "transition": "fade",
            },
            
            # 일반 콘텐츠 슬라이드 예시
            {
                "index": 1,
                "id": "slide-1",
                "type": "content",
                "title": "파이썬의 역사",
                "subtitle": None,
                "blocks": [
                    {
                        "type": "paragraph",
                        "text": "파이썬은 1991년 귀도 반 로섬이 개발하였습니다.",
                        "html": "<p>파이썬은 1991년...</p>"
                    },
                    {
                        "type": "list",
                        "ordered": False,
                        "items": [
                            {"text": "인터프리터 언어", "children": []},
                            {"text": "동적 타이핑", "children": []},
                            {"text": "풍부한 표준 라이브러리", "children": []}
                        ]
                    },
                    {
                        "type": "code",
                        "language": "python",
                        "code": 'print("Hello, Python!")',
                        "caption": "첫 번째 파이썬 코드"
                    }
                ],
                "notes": None,
                "duration_seconds": 120,
                "bg_color": None,
                "transition": "slide",
            },
            
            # 퀴즈 슬라이드 예시
            {
                "index": 2,
                "id": "slide-2",
                "type": "quiz",
                "title": "확인 퀴즈",
                "subtitle": None,
                "blocks": [],
                "quiz": {
                    "question_id": "q-001",
                    "question": "파이썬이 처음 발표된 연도는?",
                    "type": "single_choice",  # single_choice | multi_choice | short_answer | true_false
                    "options": [
                        {"id": "a", "text": "1985년", "correct": False},
                        {"id": "b", "text": "1991년", "correct": True},
                        {"id": "c", "text": "1995년", "correct": False},
                        {"id": "d", "text": "2000년", "correct": False},
                    ],
                    "explanation": "파이썬은 1991년 귀도 반 로섬이 처음 발표했습니다.",
                    "hint": "1990년대 초반에 발표되었습니다.",
                    "points": 10,
                    "time_limit_seconds": 30,
                },
                "notes": None,
                "duration_seconds": 60,
                "bg_color": None,
                "transition": "zoom",
            },
        ],
        
        # ─── 퀴즈 목록 (별도 인덱스) ──────────────────────────────
        "quizzes": [
            {
                "question_id": "q-001",
                "slide_index": 2,
                "question": "파이썬이 처음 발표된 연도는?",
                "correct_answer": "b",
            }
        ],
        
        # ─── 목차 ──────────────────────────────────────────────────
        "toc": [
            {
                "slide_index": 0,
                "title": "파이썬 기초 과정",
                "level": 1,
                "children": [
                    {"slide_index": 1, "title": "파이썬의 역사", "level": 2, "children": []}
                ]
            }
        ]
    }
```

---

## 9. 통합 파이프라인 구현

### 9.1 전체 파이프라인 클래스

```python
import json
import uuid
import re
from datetime import datetime
from typing import Callable, Optional
import frontmatter
import mistune


class MarkdownToSlidesConverter:
    """
    마크다운 파일을 슬라이드 JSON으로 변환하는 통합 파이프라인.
    
    처리 순서:
    1. YAML 프론트매터 추출 (python-frontmatter)
    2. 슬라이드 구분자(`---`) 감지 방식 결정
    3. 적절한 파서로 블록 변환
    4. 슬라이드 타입 자동 판별
    5. JSON 스키마 생성
    """
    
    SLIDE_SEPARATOR = re.compile(r'(?m)^---$')
    SPEAKER_NOTES_SEPARATOR = re.compile(r'(?m)^Note:(.*)$', re.DOTALL)
    
    def __init__(
        self,
        parser: Literal['mistune', 'marko', 'markdown'] = 'mistune',
        heading_split_level: int = 2,
        use_separator: bool = True,
    ):
        """
        Args:
            parser: 사용할 파서 종류
            heading_split_level: 슬라이드 분리 기준 헤딩 레벨 (구분자 없을 때 사용)
            use_separator: `---` 구분자 우선 사용 여부
        """
        self.parser_name = parser
        self.heading_split_level = heading_split_level
        self.use_separator = use_separator
        self._setup_parser()
    
    def _setup_parser(self):
        """파서 초기화"""
        if self.parser_name == 'mistune':
            self._renderer = JSONBlockRenderer()
            self._md = mistune.create_markdown(renderer=self._renderer)
        # marko, markdown 파서는 각 메서드에서 직접 호출
    
    def parse_blocks(self, md_text: str) -> list[dict]:
        """마크다운 텍스트를 블록 리스트로 변환한다."""
        if self.parser_name == 'mistune':
            self._md(md_text)
            return self._renderer.get_blocks()
        elif self.parser_name == 'marko':
            return marko_node_to_blocks(md_text)
        else:
            result = md_to_html_ast(md_text)
            return html_to_structured_blocks(result['html'])
    
    def detect_slide_type(self, blocks: list[dict], title: str) -> SlideType:
        """
        블록 내용을 분석해 슬라이드 타입을 자동 판별한다.
        
        판별 규칙:
        - quiz 키워드 포함 → 'quiz'
        - 블록이 없거나 제목만 → 'section'
        - 첫 번째 블록이 cover 키워드 → 'cover'
        - 코드 블록만 있음 → 'code'
        - 이미지 블록만 있음 → 'image'
        - 나머지 → 'content'
        """
        QUIZ_KEYWORDS = {'퀴즈', 'quiz', '문제', 'question', '질문', 'Q.'}
        COVER_KEYWORDS = {'소개', 'introduction', 'intro', 'welcome', '시작', '개요'}
        
        title_lower = title.lower()
        
        if any(kw in title_lower for kw in QUIZ_KEYWORDS):
            return 'quiz'
        
        if not blocks:
            return 'section'
        
        if any(kw in title_lower for kw in COVER_KEYWORDS) and len(blocks) == 0:
            return 'cover'
        
        block_types = {b.get('type') for b in blocks}
        
        if block_types == {'code'}:
            return 'code'
        
        if block_types == {'image'}:
            return 'image'
        
        summary_keywords = {'요약', 'summary', '정리', 'conclusion', '마무리'}
        if any(kw in title_lower for kw in summary_keywords):
            return 'summary'
        
        return 'content'
    
    def extract_speaker_notes(self, raw_md: str) -> tuple[str, Optional[str]]:
        """
        슬라이드 마크다운에서 강사 노트(Note: ...)를 분리한다.
        
        Reveal.js 규칙:
        `Note:` 이후 텍스트는 발표자 노트로 처리
        """
        match = self.SPEAKER_NOTES_SEPARATOR.search(raw_md)
        if match:
            notes = match.group(1).strip()
            content = raw_md[:match.start()].strip()
            return content, notes
        return raw_md, None
    
    def build_toc(self, slides: list[dict]) -> list[dict]:
        """슬라이드 목록에서 목차(TOC)를 생성한다."""
        toc = []
        stack = []  # (level, toc_item) 스택
        
        for slide in slides:
            title = slide.get('title', '')
            level = {'cover': 0, 'section': 1, 'content': 2}.get(
                slide.get('type', 'content'), 2
            )
            
            toc_item = {
                'slide_index': slide['index'],
                'title': title,
                'level': level,
                'children': []
            }
            
            while stack and stack[-1][0] >= level:
                stack.pop()
            
            if stack:
                stack[-1][1]['children'].append(toc_item)
            else:
                toc.append(toc_item)
            
            stack.append((level, toc_item))
        
        return toc
    
    def convert(self, md_text: str) -> dict:
        """
        메인 변환 메서드.
        마크다운 문자열을 받아 완전한 슬라이드 JSON을 반환한다.
        """
        # 1단계: 프론트매터 추출
        try:
            parsed_fm = extract_frontmatter(md_text)
            meta = build_slide_meta(parsed_fm['meta'])
            content_md = parsed_fm['content']
        except Exception:
            meta = build_slide_meta({})
            content_md = md_text
        
        # 2단계: 슬라이드 분리 방식 결정
        has_separator = bool(self.SLIDE_SEPARATOR.search(content_md))
        
        if self.use_separator and has_separator:
            # `---` 구분자 방식
            raw_sections = split_by_slide_separator(content_md)
        else:
            # 헤딩 기반 분리
            all_blocks = self.parse_blocks(content_md)
            flat_chunks = flatten_chunks_to_slides(
                build_hierarchy(
                    chunk_by_headings(all_blocks, max_level=self.heading_split_level)
                )
            )
            raw_sections = [
                {
                    'index': c.slide_index,
                    'raw_md': '',  # 이미 파싱됨
                    'h_index': c.slide_index,
                    'v_index': 0,
                    'type': 'horizontal',
                    '_blocks': c.blocks,
                    '_title': c.title,
                }
                for c in flat_chunks
            ]
        
        # 3단계: 각 섹션을 슬라이드로 변환
        slides = []
        quizzes = []
        
        for i, section in enumerate(raw_sections):
            # raw_md가 있으면 파싱, 없으면 이미 파싱된 블록 사용
            if section.get('raw_md'):
                clean_md, notes = self.extract_speaker_notes(section['raw_md'])
                blocks = self.parse_blocks(clean_md)
                
                # 첫 번째 heading을 타이틀로 추출
                title = ''
                content_blocks = []
                for block in blocks:
                    if not title and block.get('type', '').startswith('heading'):
                        title = block.get('text', '')
                    else:
                        content_blocks.append(block)
            else:
                content_blocks = section.get('_blocks', [])
                title = section.get('_title', '')
                notes = None
            
            slide_type = self.detect_slide_type(content_blocks, title)
            
            # 퀴즈 슬라이드면 퀴즈 데이터 추출
            quiz_data = None
            if slide_type == 'quiz':
                quiz_data, content_blocks = extract_quiz_from_blocks(
                    content_blocks, question_id=f'q-{i:03d}'
                )
                if quiz_data:
                    quizzes.append({**quiz_data, 'slide_index': i})
            
            slide = {
                'index': i,
                'id': f'slide-{i}',
                'type': slide_type,
                'title': title or f'슬라이드 {i + 1}',
                'subtitle': None,
                'blocks': content_blocks,
                'notes': notes,
                'duration_seconds': None,
                'bg_color': None,
                'transition': 'slide',
            }
            
            if quiz_data:
                slide['quiz'] = quiz_data
            
            slides.append(slide)
        
        # 4단계: 목차 생성
        toc = self.build_toc(slides)
        
        # 5단계: 최종 JSON 조립
        return {
            'meta': {
                **meta,
                'generated_at': datetime.utcnow().isoformat(),
                'source': 'notebooklm_vod',
                'total_slides': len(slides),
                'total_quizzes': len(quizzes),
            },
            'slides': slides,
            'quizzes': quizzes,
            'toc': toc,
        }
    
    def convert_file(self, filepath: str, encoding: str = 'utf-8') -> dict:
        """파일에서 직접 변환한다."""
        with open(filepath, 'r', encoding=encoding) as f:
            return self.convert(f.read())
    
    def to_json(self, md_text: str, indent: int = 2) -> str:
        """변환 결과를 JSON 문자열로 반환한다."""
        result = self.convert(md_text)
        return json.dumps(result, ensure_ascii=False, indent=indent)
```

---

## 10. 퀴즈 데이터 추출

### 10.1 마크다운 퀴즈 형식 정의 및 파서

NotebookLM에서 추출한 퀴즈 콘텐츠의 표준 마크다운 형식과 파서:

```python
import re
from typing import Optional

# 지원되는 퀴즈 마크다운 형식 예시:
QUIZ_MD_EXAMPLE = """
## 퀴즈: 파이썬 기초

**Q. 파이썬이 처음 발표된 연도는?**

- (A) 1985년
- (B) 1991년 ✓
- (C) 1995년
- (D) 2000년

> **해설:** 파이썬은 1991년 귀도 반 로섬이 처음 발표했습니다.
> **힌트:** 1990년대 초반에 발표되었습니다.
"""

# 다지선다형 마크다운 형식 2 (체크박스 스타일):
QUIZ_MD_EXAMPLE_2 = """
## 퀴즈

?> 다음 중 파이썬의 특징이 **아닌** 것은?

- [ ] 인터프리터 언어
- [ ] 동적 타이핑
- [x] 정적 컴파일
- [ ] 오픈소스

>> 파이썬은 인터프리터 언어이며 동적 타이핑을 사용합니다.
"""


def extract_quiz_from_blocks(
    blocks: list[dict],
    question_id: str = 'q-000'
) -> tuple[Optional[dict], list[dict]]:
    """
    블록 리스트에서 퀴즈 데이터를 추출하고 남은 블록을 반환한다.
    
    탐지 패턴:
    1. 리스트 아이템에 (A), (B) 또는 [x]/[ ] 패턴 존재
    2. 단락에 "Q." 또는 "?>" 접두사 존재
    
    Returns:
        (quiz_dict, remaining_blocks) 튜플
    """
    
    OPTION_PATTERNS = [
        # (A), (B), a), b) 스타일
        re.compile(r'^[\(\[]([A-Da-d])\)?\]?\s+(.+?)(\s*✓)?$'),
        # [ ] / [x] 체크박스 스타일
        re.compile(r'^\[( |x|X)\]\s+(.+)$'),
    ]
    QUESTION_PATTERNS = [
        re.compile(r'^Q\.\s+(.+)$'),
        re.compile(r'^\?>\s+(.+)$'),
        re.compile(r'^\*\*Q\.\s+(.+)\*\*$'),
    ]
    EXPLANATION_PATTERNS = [
        re.compile(r'^\*\*해설[:\s]\*\*\s*(.+)$'),
        re.compile(r'^해설[:\s]\s*(.+)$'),
        re.compile(r'^>>\s*(.+)$'),
    ]
    HINT_PATTERNS = [
        re.compile(r'^\*\*힌트[:\s]\*\*\s*(.+)$'),
        re.compile(r'^힌트[:\s]\s*(.+)$'),
    ]
    
    question_text = None
    options = []
    explanation = None
    hint = None
    remaining = []
    
    i = 0
    while i < len(blocks):
        block = blocks[i]
        
        # 문제 텍스트 탐지
        if block.get('type') == 'paragraph':
            text = block.get('text', '').strip()
            for pat in QUESTION_PATTERNS:
                m = pat.match(text)
                if m:
                    question_text = m.group(1).strip().rstrip('**').strip()
                    i += 1
                    break
            else:
                # 해설/힌트 탐지
                found_special = False
                for pat in EXPLANATION_PATTERNS:
                    m = pat.match(text)
                    if m:
                        explanation = m.group(1).strip()
                        found_special = True
                        break
                if not found_special:
                    for pat in HINT_PATTERNS:
                        m = pat.match(text)
                        if m:
                            hint = m.group(1).strip()
                            found_special = True
                            break
                if not found_special:
                    remaining.append(block)
                i += 1
        
        # quote 블록에서 해설/힌트 탐지
        elif block.get('type') == 'quote':
            for inner in block.get('blocks', []):
                text = inner.get('text', '')
                for pat in EXPLANATION_PATTERNS:
                    m = pat.match(text)
                    if m:
                        explanation = m.group(1).strip()
                        break
                for pat in HINT_PATTERNS:
                    m = pat.match(text)
                    if m:
                        hint = m.group(1).strip()
                        break
            i += 1
        
        # 리스트 블록에서 선택지 탐지
        elif block.get('type') == 'list':
            items = block.get('items', [])
            parsed_options = []
            is_quiz_list = False
            
            for item in items:
                text = item.get('text', '').strip()
                
                # 체크박스 스타일: [ ] / [x]
                cb_match = re.match(r'^\[( |x|X)\]\s+(.+)$', text)
                if cb_match:
                    is_correct = cb_match.group(1).lower() == 'x'
                    option_text = cb_match.group(2).strip()
                    parsed_options.append({
                        'id': chr(ord('a') + len(parsed_options)),
                        'text': option_text,
                        'correct': is_correct
                    })
                    is_quiz_list = True
                    continue
                
                # (A), (B) 스타일
                alpha_match = re.match(
                    r'^[\(\[]?([A-Da-d])[\)\]]?\s+(.+?)(\s*[✓✗\*])?$', text
                )
                if alpha_match:
                    option_id = alpha_match.group(1).lower()
                    option_text = alpha_match.group(2).strip()
                    is_correct = bool(alpha_match.group(3))
                    parsed_options.append({
                        'id': option_id,
                        'text': option_text,
                        'correct': is_correct
                    })
                    is_quiz_list = True
                    continue
                
                parsed_options.append({
                    'id': chr(ord('a') + len(parsed_options)),
                    'text': text,
                    'correct': False
                })
            
            if is_quiz_list:
                options = parsed_options
            else:
                remaining.append(block)
            i += 1
        
        else:
            remaining.append(block)
            i += 1
    
    # 퀴즈 데이터 조립
    if question_text and options:
        # 정답 수에 따라 타입 결정
        correct_count = sum(1 for o in options if o.get('correct'))
        q_type = 'multi_choice' if correct_count > 1 else 'single_choice'
        
        # 정답이 명시되지 않은 경우 첫 번째를 기본 정답으로
        if correct_count == 0 and options:
            options[0]['correct'] = True
        
        quiz = {
            'question_id': question_id,
            'question': question_text,
            'type': q_type,
            'options': options,
            'explanation': explanation,
            'hint': hint,
            'points': 10,
            'time_limit_seconds': 30,
        }
        return quiz, remaining
    
    return None, blocks
```

---

## 11. 실전 예제: NotebookLM 콘텐츠 변환

### 11.1 NotebookLM 스타일 마크다운 샘플

```python
NOTEBOOKLM_SAMPLE = """---
title: "머신러닝 기초 - 1강: 지도학습"
author: "AI 강사"
date: 2026-04-20
course_id: "ML-101"
chapter: 1
tags:
  - machine-learning
  - supervised-learning
  - beginner
duration_minutes: 60
quiz_enabled: true
---

# 지도학습 (Supervised Learning)

지도학습은 레이블이 있는 데이터를 사용해 모델을 훈련하는 방식입니다.

---

## 핵심 개념

지도학습의 두 가지 주요 유형:

- **분류(Classification)**: 이산적 레이블 예측
- **회귀(Regression)**: 연속적 값 예측

| 유형 | 알고리즘 | 출력 |
|------|----------|------|
| 분류 | 로지스틱 회귀, SVM | 클래스 레이블 |
| 회귀 | 선형 회귀, 랜덤 포레스트 | 숫자 값 |

Note: 실제 사례를 들어 설명할 것. 예: 스팸 필터(분류), 주가 예측(회귀)

---

## 선형 회귀 예시

```python
from sklearn.linear_model import LinearRegression
import numpy as np

# 훈련 데이터
X = np.array([[1], [2], [3], [4], [5]])
y = np.array([2, 4, 6, 8, 10])

# 모델 훈련
model = LinearRegression()
model.fit(X, y)

# 예측
print(model.predict([[6]]))  # [12.]
```

---

## 퀴즈: 지도학습 이해도 확인

Q. 이메일 스팸 필터는 다음 중 어떤 유형의 지도학습인가?

- (A) 회귀
- (B) 분류 ✓
- (C) 클러스터링
- (D) 강화학습

> **해설:** 스팸/비스팸으로 이산적 분류를 하므로 분류 문제입니다.
> **힌트:** 출력이 '스팸이다/아니다'처럼 범주형입니다.

---

## 요약

이번 강의에서 학습한 내용:

1. 지도학습의 정의와 특징
2. 분류와 회귀의 차이
3. 선형 회귀 실습

다음 강의: 비지도학습(Unsupervised Learning)
"""
```

### 11.2 변환 실행 및 결과

```python
import json

def run_full_pipeline():
    """전체 파이프라인 실행 예시"""
    
    converter = MarkdownToSlidesConverter(
        parser='mistune',
        heading_split_level=2,
        use_separator=True,
    )
    
    result = converter.convert(NOTEBOOKLM_SAMPLE)
    
    print(f"총 슬라이드 수: {result['meta']['total_slides']}")
    print(f"총 퀴즈 수: {result['meta']['total_quizzes']}")
    print()
    
    for slide in result['slides']:
        print(f"[{slide['index']}] {slide['type'].upper()} — {slide['title']}")
        print(f"  블록 수: {len(slide['blocks'])}")
        if slide.get('notes'):
            print(f"  노트: {slide['notes'][:50]}...")
        if slide.get('quiz'):
            print(f"  퀴즈: {slide['quiz']['question'][:40]}...")
    
    # JSON 파일로 저장
    output_path = 'slides_output.json'
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    
    print(f"\n저장 완료: {output_path}")
    return result


# 실행
if __name__ == '__main__':
    result = run_full_pipeline()
    
    # 예상 출력:
    # 총 슬라이드 수: 5
    # 총 퀴즈 수: 1
    #
    # [0] CONTENT — 지도학습 (Supervised Learning)
    #   블록 수: 1
    # [1] CONTENT — 핵심 개념
    #   블록 수: 2
    #   노트: 실제 사례를 들어 설명할 것. 예: 스팸 필터(분류), 주가 예측(회귀)
    # [2] CODE — 선형 회귀 예시
    #   블록 수: 1
    # [3] QUIZ — 퀴즈: 지도학습 이해도 확인
    #   블록 수: 0
    #   퀴즈: 이메일 스팸 필터는 다음 중 어떤 유형의 지...
    # [4] SUMMARY — 요약
    #   블록 수: 2
```

### 11.3 예상 JSON 출력 구조

```json
{
  "meta": {
    "title": "머신러닝 기초 - 1강: 지도학습",
    "author": "AI 강사",
    "date": "2026-04-20",
    "course_id": "ML-101",
    "chapter": 1,
    "tags": ["machine-learning", "supervised-learning", "beginner"],
    "duration_minutes": 60,
    "quiz_enabled": true,
    "language": "ko",
    "generated_at": "2026-04-20T00:00:00",
    "source": "notebooklm_vod",
    "total_slides": 5,
    "total_quizzes": 1
  },
  "slides": [
    {
      "index": 0,
      "id": "slide-0",
      "type": "content",
      "title": "지도학습 (Supervised Learning)",
      "blocks": [
        {
          "type": "paragraph",
          "text": "지도학습은 레이블이 있는 데이터를 사용해 모델을 훈련하는 방식입니다."
        }
      ],
      "notes": null,
      "transition": "slide"
    },
    {
      "index": 1,
      "id": "slide-1",
      "type": "content",
      "title": "핵심 개념",
      "blocks": [
        {
          "type": "paragraph",
          "text": "지도학습의 두 가지 주요 유형:"
        },
        {
          "type": "list",
          "ordered": false,
          "items": [
            {"text": "분류(Classification): 이산적 레이블 예측", "children": []},
            {"text": "회귀(Regression): 연속적 값 예측", "children": []}
          ]
        },
        {
          "type": "table",
          "headers": ["유형", "알고리즘", "출력"],
          "rows": [
            ["분류", "로지스틱 회귀, SVM", "클래스 레이블"],
            ["회귀", "선형 회귀, 랜덤 포레스트", "숫자 값"]
          ]
        }
      ],
      "notes": "실제 사례를 들어 설명할 것. 예: 스팸 필터(분류), 주가 예측(회귀)",
      "transition": "slide"
    },
    {
      "index": 3,
      "id": "slide-3",
      "type": "quiz",
      "title": "퀴즈: 지도학습 이해도 확인",
      "blocks": [],
      "quiz": {
        "question_id": "q-003",
        "question": "이메일 스팸 필터는 다음 중 어떤 유형의 지도학습인가?",
        "type": "single_choice",
        "options": [
          {"id": "a", "text": "회귀", "correct": false},
          {"id": "b", "text": "분류", "correct": true},
          {"id": "c", "text": "클러스터링", "correct": false},
          {"id": "d", "text": "강화학습", "correct": false}
        ],
        "explanation": "스팸/비스팸으로 이산적 분류를 하므로 분류 문제입니다.",
        "hint": "출력이 '스팸이다/아니다'처럼 범주형입니다.",
        "points": 10,
        "time_limit_seconds": 30
      },
      "notes": null
    }
  ],
  "quizzes": [
    {
      "question_id": "q-003",
      "slide_index": 3,
      "question": "이메일 스팸 필터는 다음 중 어떤 유형의 지도학습인가?",
      "correct_answer": "b"
    }
  ],
  "toc": [
    {
      "slide_index": 0,
      "title": "지도학습 (Supervised Learning)",
      "level": 1,
      "children": [
        {"slide_index": 1, "title": "핵심 개념", "level": 2, "children": []},
        {"slide_index": 2, "title": "선형 회귀 예시", "level": 2, "children": []},
        {"slide_index": 3, "title": "퀴즈: 지도학습 이해도 확인", "level": 2, "children": []},
        {"slide_index": 4, "title": "요약", "level": 2, "children": []}
      ]
    }
  ]
}
```

---

## 부록: 라이브러리 선택 가이드

| 시나리오 | 권장 라이브러리 | 이유 |
|---|---|---|
| 빠른 프로토타이핑 | `mistune` + `JSONBlockRenderer` | 커스텀 렌더러 설계가 가장 직관적 |
| CommonMark 정확성 | `marko` | 표준 완전 준수, AST 구조 명확 |
| HTML 재사용 | `markdown` + `beautifulsoup4` | 기존 HTML 파이프라인과 연동 용이 |
| 메타데이터 중심 | `python-frontmatter` | YAML 헤더 처리 특화 |
| 프로덕션 파이프라인 | `python-frontmatter` + `mistune` | 두 라이브러리 조합이 최적 균형 |

### 성능 벤치마크 (100KB 마크다운 파일 기준, 참고값)

```
mistune 3.x   : ~12ms  (가장 빠름)
marko         : ~28ms  (CommonMark 정확, 균형)
markdown      : ~45ms  + BeautifulSoup ~30ms = ~75ms
python-frontmatter: ~3ms (메타 추출만)
```

---

*이 레퍼런스는 NotebookLM VOD 콘텐츠를 웹 슬라이드로 변환하는 실제 파이프라인 구현을 위한 기술 가이드입니다. 각 라이브러리의 버전 변경에 따라 API가 달라질 수 있으므로 공식 문서를 병행 참조하십시오.*