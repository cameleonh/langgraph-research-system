# LangGraph - 논문 연구 Agentic AI 시스템

> LangGraph 기반 상태 머신 워크플로우 논문 연구 시스템

---

## 개요

**LangGraph**를 활용하여 **상태 기반 워크플로우**로 논문 연구 프로세스를 구조화합니다.

---

## 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                      Workflow State                         │
├─────────────────────────────────────────────────────────────┤
│  {                                                              │
│    pdf: File,                                                  │
│    markdown: string,                                          │
│    summary: string,                                           │
│    analysis: object,                                          │
│    draft: string,                                             │
│    status: 'idle' | 'processing' | 'completed' | 'error'      │
│  }                                                             │
└─────────────────────────────────────────────────────────────┘
                         ↓
        ┌─────────────────────────────────────┐
        │                                     │
    ┌───▼────┐    ┌──────────┐    ┌─────────┐
    │ Convert│───→│  Analyze │───→│  Write  │
    │  Node  │    │   Node   │    │  Node   │
    └────────┘    └──────────┘    └─────────┘
        │              │               │
        └──────────────┴───────────────┘
                       ↓
                 ┌─────────┐
                 │  End    │
                 └─────────┘
```

---

## 핵심 개념

### State (상태)

```typescript
interface ResearchState {
  // 입력
  pdf: File;
  query: string;

  // 중간 결과
  markdown: string | null;
  summary: string | null;
  analysis: {
    researchGap: string[];
    relatedPapers: string[];
    keyFindings: string[];
  } | null;
  draft: string | null;

  // 메타데이터
  status: 'idle' | 'processing' | 'completed' | 'error';
  error: string | null;
  timestamp: number;
}
```

### Nodes (노드)

| 노드 | 역할 | 입력 | 출력 |
|------|------|------|------|
| **Convert** | PDF → Markdown 변환 | `state.pdf` | `state.markdown` |
| **Analyze** | 분석 및 요약 | `state.markdown` | `state.summary`, `state.analysis` |
| **Write** | 초안 작성 | `state.summary` | `state.draft` |
| **End** | 종료 | 전체 | 최종 결과 |

---

## 워크플로우 예시

### 1. 단일 논문 처리

```typescript
const workflow = new StateGraph<ResearchState>()
  .addNode("convert", convertNode)
  .addNode("analyze", analyzeNode)
  .addNode("write", writeNode)
  .addEdge("convert", "analyze")
  .addEdge("analyze", "write")
  .addEdge("write", END)
  .setEntryPoint("convert")
  .compile();
```

### 2. 조건부 분기

```typescript
const workflow = new StateGraph<ResearchState>()
  .addNode("convert", convertNode)
  .addNode("qualityCheck", qualityCheckNode)
  .addNode("retry", convertNode)
  .addNode("analyze", analyzeNode)
  .addConditionalEdges(
    "qualityCheck",
    shouldRetry,
    {
      retry: "retry",
      continue: "analyze"
    }
  )
  .compile();
```

### 3. 병렬 처리

```typescript
const workflow = new StateGraph<ResearchState>()
  .addNode("convert", convertNode)
  .addNode("summarize", summarizeNode)
  .addNode("extractCitations", extractCitationsNode)
  .addNode("findRelated", findRelatedPapersNode)
  .addEdge("convert", "summarize")
  .addEdge("convert", "extractCitations")
  .addEdge("convert", "findRelated")
  .addEdge(["summarize", "extractCitations", "findRelated"], "write")
  .compile();
```

---

## 기술 스택

| 구분 | 기술 |
|------|------|
| **프레임워크** | LangGraph (Python/TypeScript) |
| **LLM** | Claude / GPT-4 |
| **상태 관리** | LangGraph State |
| **PDF → MD** | Marker (GPU) |
| **Vector Store** | Chroma / Pinecone |
| **노트 관리** | Obsidian |

---

## 프로젝트 구조

```
LangGraph/
├── src/
│   ├── workflows/
│   │   ├── singlePaper.ts      # 단일 논문 처리
│   │   ├── literatureReview.ts  # 문헌 리뷰
│   │   └── multiPaper.ts        # 다중 논문 처리
│   ├── nodes/
│   │   ├── convertNode.ts
│   │   ├── analyzeNode.ts
│   │   ├── writeNode.ts
│   │   └── qualityCheckNode.ts
│   ├── state/
│   │   ├── schema.ts            # 상태 스키마
│   │   └── reducers.ts          # 상태 리듀서
│   ├── tools/
│   │   ├── MarkerConverter.ts   # Marker GPU
│   │   ├── WebSearch.ts
│   │   └── VectorStore.ts
│   └── graph.ts                 # 워크플로우 정의
├── docs/
├── tests/
└── package.json
```

---

## LangGraph의 장점

| 장점 | 설명 |
|------|------|
| **상태 관리** | 명확한 상태 정의와 추적 |
| **복잡한 흐름** | 조건부 분기, 반복, 병렬 처리 쉬움 |
| **시각화** | 워크플로우 그래프 시각화 지원 |
| **재시도** | 실패 시 특정 노드부터 재시도 가능 |
| **확장성** | 새로운 노드/엣지 쉽게 추가 |

---

## 다른 프로젝트와의 비교

| 프로젝트 | 방식 | 복잡도 | 추천 용도 |
|----------|------|--------|-----------|
| **AgenticAI** | 12개 Agent | 높음 | 대규모 시스템 |
| **3Agent** | 3개 Agent | 낮음 | 빠른 시작 |
| **LangGraph** | 상태 머신 | 중간 | 구조적 워크플로우, 복잡한 조건부 로직 |

---

## 빠른 시작

```bash
# 의존성 설치
bun install

# 환경 설정
cp .env.example .env

# 실행
bun run dev
```

---

## 라이선스

MIT

---

*작성일: 2026-01-31*
