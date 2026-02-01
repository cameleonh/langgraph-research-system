# LangGraph GPU 환경 설정 가이드

## 현재 설치된 패키지 버전 (Python 3.12)

```
marker-pdf             1.10.2
torch                  2.10.0  ⚠️ 호환성 문제
torchaudio             2.5.1+cu121
torchvision            0.20.1+cu121
transformers           4.57.6
```

## 문제점

**torch 2.10.0**이 torchaudio/torchvision 2.5.1과 호환되지 않아 Marker 실행 실패

## 해결 방안

### 옵션 1: PyTorch 다운그레이드 (권장)

```bash
# 현재 버전 제거
py -3.12 -m pip uninstall torch torchvision torchaudio -y

# 호환되는 버전 설치
py -3.12 -m pip install torch==2.5.1 torchvision==0.20.1 torchaudio==2.5.1 --index-url https://download.pytorch.org/whl/cu121

# marker-pdf 재설치
py -3.12 -m pip install marker-pdf --force-reinstall --no-deps
```

### 옵션 2: 전체 재설치

```bash
# 모두 제거
py -3.12 -m pip uninstall torch torchvision torchaudio marker-pdf -y

# 한 번에 설치 (호환되는 버전으로)
py -3.12 -m pip install torch==2.5.1 torchvision==0.20.1 torchaudio==2.5.1 marker-pdf --index-url https://download.pytorch.org/whl/cu121
```

## GPU 확인 명령어

```bash
# PyTorch CUDA 확인
py -3.12 -c "import torch; print('CUDA available:', torch.cuda.is_available()); print('GPU:', torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'N/A')"

# GPU 상태 확인
nvidia-smi
```

## Marker 경로

```
실행 파일: C:\Users\honey\AppData\Local\Programs\Python\Python312\Scripts\marker_single.exe
```

## 환경 설정 요약

| 항목 | 값 |
|------|------|
| Python | 3.12 |
| GPU | NVIDIA GeForce RTX 3090 |
| CUDA Version | 12.7 |
| Driver Version | 566.36 |
| PyTorch (권장) | 2.5.1+cu121 |
| marker-pdf | 1.10.2 |
