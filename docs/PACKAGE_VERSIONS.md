# 패키지 버전 목록

## 시스템 환경

| 항목 | 값 |
|------|------|
| OS | Windows |
| GPU | NVIDIA GeForce RTX 3090 (24GB) |
| CUDA Version | 12.7 |
| Driver Version | 566.36 |
| Python | 3.12 |
| Node.js 런타임 | Bun |

---

## Node.js / Bun 패키지

### 프로젝트 정보
- **프로젝트명**: langgraph-research-system
- **버전**: 0.1.0
- **타입**: ES Module

### 핵심 Dependencies

| 패키지 | 버전 | 용도 |
|--------|------|------|
| `@anthropic-ai/sdk` | ^0.32.1 | Claude AI API |
| `@langchain/core` | ^0.3.0 | LangChain Core |
| `@langchain/langgraph` | ^0.2.0 | LangGraph 상태 머신 |
| `chromadb` | ^2.0.0 | 벡터 데이터베이스 |
| `commander` | ^12.0.0 | CLI 명령어 처리 |
| `dotenv` | ^17.2.3 | 환경변수 관리 |
| `express` | ^4.18.0 | 웹 서버 |

### DevDependencies

| 패키지 | 버전 | 용도 |
|--------|------|------|
| `@types/express` | ^4.17.21 | Express 타입 정의 |
| `@types/node` | ^22.10.5 | Node.js 타입 정의 |
| `bun-types` | latest | Bun 타입 정의 |
| `tsx` | ^4.21.0 | TypeScript 실행자 |
| `typescript` | ^5.7.2 | TypeScript 컴파일러 |

### NPM Scripts

| 명령 | 동작 |
|------|------|
| `bun run dev` | 개발 모드 실행 |
| `bun run build` | TypeScript 컴파일 |
| `bun run api` | API 서버 시작 |
| `bun run orchestrator` | Orchestrator CLI 시작 |
| `bun run evaluate <file>` | 연구계획서 평가 |

---

## Python 패키지 (marker-pdf)

### 핵심 Dependencies

| 패키지 | 버전 | 용도 |
|--------|------|------|
| `marker-pdf` | 1.10.2 | PDF → Markdown 변환 (GPU 지원) |
| `torch` | 2.5.1+cu121 | PyTorch (CUDA 12.1) |
| `torchaudio` | 2.5.1+cu121 | PyTorch Audio |
| `torchvision` | 0.20.1+cu121 | PyTorch Vision |
| `transformers` | 4.57.6 | Hugging Face Transformers |

### Marker 실행 경로
```
C:\Users\honey\AppData\Local\Programs\Python\Python312\Scripts\marker_single.exe
```

---

## Python Conda 환경 (예정)

### 필요한 패키지 목록

```yaml
# langgraph 환경
name: langgraph
channels:
  - conda-forge
dependencies:
  - python=3.10
  - pandas=2.0.*
  - numpy=1.24.*
  - geopandas=0.13.*
  - shapely=2.0.*
  - networkx=3.1.*
  - scipy=1.10.*
  - statsmodels=0.14.*
  - scikit-learn=1.3.*
  - matplotlib=3.7.*
  - seaborn=0.12.*
  - jupyter=1.0.*
  - pyproj=3.5.*
  - spreg=1.5.*
  - libpysal=4.7.*
  - openpyxl=3.1.*
  - pip:
    - linearmodels
    - pylogit
    - matplotlib-scalebar
    - contextily
```

---

## 버전 확인 명령어

### Node.js / Bun
```bash
# Bun 버전
bun --version

# 프로젝트 의존성 확인
cat package.json

# 설치된 패키지 확인
bun pm ls
```

### Python
```bash
# Python 버전
py -3.12 --version

# PyTorch CUDA 확인
py -3.12 -c "import torch; print('CUDA:', torch.cuda.is_available()); print('GPU:', torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'N/A')"

# 설치된 패키지 확인
py -3.12 -m pip list
```

### GPU
```bash
# NVIDIA GPU 상태
nvidia-smi
```

---

## 호환성 참고

### PyTorch 버전 호환성
- **torch 2.5.1** ↔ torchvision 0.20.1 ↔ torchaudio 2.5.1 ✓
- **torch 2.10.0**은 torchaudio 2.5.1과 호환되지 않음 ✗

### CUDA 요구사항
- PyTorch CUDA 12.1 빌드는 NVIDIA Driver >= 527.41 필요
- 현재 Driver 566.36은 CUDA 12.7 지원 → 호환성 OK
