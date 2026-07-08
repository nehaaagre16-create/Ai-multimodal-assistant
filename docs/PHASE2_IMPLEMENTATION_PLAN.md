# Phase 2 Implementation Plan

## Open-Source Self-Hosted Talking Avatar for AI Multimodal Assistant

**Date:** 2 July 2026
**Status:** Awaiting approval before any code is written

---

## 1. Executive Summary

Phase 1 created a clean, pluggable Avatar Engine in the React frontend. Phase 2 needs to add a **real talking avatar** driven by the generated speech.

After researching the three requested engines and inspecting the current machine, the conclusion is:

- **Best long-term engine:** **LivePortrait** (fastest, image-driven, real-time-capable, easiest to integrate as a service).
- **Current machine reality:** **Cannot run LivePortrait, MuseTalk, or EchoMimic** because there is no NVIDIA GPU and no CUDA support in WSL.
- **Recommended Phase 2 implementation path:** Start with **Wav2Lip (ONNX / maintained fork)** as a CPU-compatible Python Avatar Service, while keeping the Avatar Engine interface unchanged so LivePortrait can be dropped in later without touching React or Node.js.

If you strongly prefer to stick to the three engines exactly, the only honest path is to first add an NVIDIA GPU to the machine. The plan below explains why.

---

## 2. Research: Comparison of LivePortrait, MuseTalk, EchoMimic

### 2.1 LivePortrait (KlingAIResearch)

| Criteria | Evaluation |
|----------|------------|
| **Run locally?** | Yes, fully open-source. |
| **License** | MIT License (code + weights free for commercial use). |
| **Real-time capability** | Yes. Designed for real-time portrait animation. Community projects (FasterLivePortrait, ditto-talkinghead, FacePoke) confirm real-time use. |
| **GPU requirements** | NVIDIA GPU required. Tested on RTX 4090, V100, etc. Requires CUDA. macOS Apple Silicon supported but ~20× slower. |
| **CPU fallback** | Not practical. Intel/AMD CPU inference is extremely slow. |
| **Installation difficulty** | Medium. Conda + PyTorch + `requirements.txt` + `huggingface-cli download`. Animals mode requires compiling X-Pose ops. |
| **Active maintenance** | Very active. 18.6k stars, frequent updates, large community. |
| **Integration with React + Node.js** | Excellent. Wrap inference in a Python service with HTTP/WebSocket API; stream generated frames to the frontend. |
| **Lip-sync quality** | High for face animation and expression retargeting. Not a native audio-lip-sync model, but audio-to-motion can be added with a small bridge. |
| **Facial realism** | Very high. Best-in-class for single-image portrait animation. |
| **Input format** | Single image OR video + driving video/motion template. Audio needs to be converted to a motion template first. |

**Best fit:** Long-term, high-quality, self-hosted talking avatar once an NVIDIA GPU is available.

---

### 2.2 MuseTalk (TMElyralab)

| Criteria | Evaluation |
|----------|------------|
| **Run locally?** | Yes, open-source. |
| **License** | MIT License for code and weights. |
| **Real-time capability** | Claims 30 fps+ on NVIDIA Tesla V100. Real-time pipeline exists. |
| **GPU requirements** | NVIDIA GPU strongly recommended. CUDA 11.7 / 11.8. Tested on V100, A100, RTX 4090. |
| **CPU fallback** | Not practical. Diffusion-based UNet inference is too slow on CPU. |
| **Installation difficulty** | High. Requires PyTorch 2.0.1, MMLab ecosystem (`mmcv`, `mmdet`, `mmpose`), FFmpeg setup, multiple model downloads. |
| **Active maintenance** | Active. 6.1k stars, 1.5 release with training code. |
| **Integration with React + Node.js** | Good, but heavier. Can be wrapped in a service. |
| **Lip-sync quality** | High. Specifically designed for audio-driven lip-sync. |
| **Facial realism** | Good, but 256×256 face region, single-frame generation can cause jitter. |
| **Input format** | Video input + audio. Requires a source video of the talking person. |

**Best fit:** If you have a GPU and want a dedicated lip-sync model for pre-recorded or streaming video.

---

### 2.3 EchoMimic (Ant Group)

| Criteria | Evaluation |
|----------|------------|
| **Run locally?** | Yes, open-source. |
| **License** | Apache 2.0 (most permissive of the three). |
| **Real-time capability** | Inference is not marketed as real-time. Accelerated models improved 10× (from ~7 min to ~50 s for 240 frames on V100), which is still far from real-time streaming. |
| **GPU requirements** | NVIDIA GPU. Tested on A100 80GB, RTX 4090D 24GB, V100 16GB. CUDA ≥ 11.7. |
| **CPU fallback** | Not practical. Diffusion-based model is too slow on CPU. |
| **Installation difficulty** | Medium. Requires PyTorch, diffusers, transformers, mediapipe, model downloads. |
| **Active maintenance** | Moderate. 4.2k stars, newer V2/V3 versions exist. |
| **Integration with React + Node.js** | Good, but slower than LivePortrait. |
| **Lip-sync quality** | High quality, especially with landmark conditioning. |
| **Facial realism** | Very high. Good for lifelike portrait animation. |
| **Input format** | Single image + audio (+ optional pose). |

**Best fit:** Research / quality-first projects with powerful GPU, not low-latency real-time assistant.

---

## 3. Environment Inspection

| Resource | Finding |
|----------|---------|
| **Operating System** | Windows 11 (WSL 2.7.3.0) running Ubuntu 24.04.1 LTS |
| **WSL availability** | Yes, WSL2 is running |
| **Python version** | 3.11.15 (in active venv) |
| **Node version** | 22.22.2 |
| **CUDA availability** | **Not available** in WSL. `nvidia-smi` and `nvcc` not found. No `/usr/local/cuda`. |
| **GPU model** | **Intel UHD Graphics (iGPU)** only. **No NVIDIA GPU.** |
| **GPU VRAM** | ~2 GB shared system memory |
| **Available RAM** | 16 GB total, ~7.6 GB visible in WSL, ~3.7 GB available currently |
| **Storage** | 920 GB free on WSL root, 279 GB free on C: drive |
| **FFmpeg** | 6.1.1 installed |
| **Git** | 2.43.0 installed |
| **CMake** | **Not installed** |
| **PyTorch / ONNX** | Not installed in current venv |

### Verdict

**LivePortrait, MuseTalk, and EchoMimic cannot run on this machine.** All three are PyTorch/CUDA-based and require an NVIDIA GPU. Intel UHD iGPU does not support CUDA. CPU inference would be far too slow for real-time interaction (likely seconds per frame, not frames per second).

To run any of the three engines, you would need to add an NVIDIA GPU with at least 8 GB VRAM (RTX 3060/4060 or better) and install NVIDIA drivers + CUDA in WSL.

---

## 4. Recommendation

### 4.1 Best long-term engine (when GPU is available): LivePortrait

**Why:**
- MIT License (free for commercial use).
- Single-image input → perfect for the existing `assistant_female_1.png` portrait.
- Real-time capable and fast on modern NVIDIA GPUs.
- Huge community and many integration examples (ComfyUI, WebUI, etc.).
- Easiest to wrap as a Python service behind the existing Avatar Engine.
- Supports both image and video input; can be driven by audio-generated motion templates.

### 4.2 Closest alternative for the current machine (no GPU): Wav2Lip

**Why Wav2Lip for now:**
- Proven, trained neural lip-sync model.
- Can run on CPU with ONNX Runtime (much lighter than LivePortrait/MuseTalk/EchoMimic).
- Does not require CUDA or NVIDIA GPU.
- Real enough for a self-hosted assistant: it actually maps audio waveforms to mouth shapes.

**Important caveats:**
- The original Wav2Lip repository is now commercialized and uses old PyTorch. We will use a modern ONNX fork (`wav2lip-onnx-HQ` or similar) or convert the original weights to ONNX.
- Wav2Lip needs a **source video** of the talking face, not just a single image. The current `assistant_female_1.png` is not enough.
- Options to get a source video:
  1. Record a short 5–10 second looped video of the person / avatar looking at the camera.
  2. Use a simple head-turning/idle-motion loop generated from the single image (e.g., with a lightweight CPU motion generator, or a pre-recorded loop).
  3. Generate a synthetic video with subtle motion from the static image using a free tool and use that as the source.
- Quality is lower than LivePortrait but it is a genuine neural lip-sync.

### 4.3 If you reject Wav2Lip because it needs a video

There is **no CPU-only, single-image, neural talking-head engine** that runs in real-time on an Intel iGPU. The only honest single-image, CPU-capable alternatives are:
- **Rhubarb Lip Sync** (rule-based mouth shapes from audio) + a set of mouth sprites.
- **MediaPipe Face Mesh + audio analysis** (RMS/pitch) to drive pre-defined mouth shapes.

Both are **not neural** and would be considered “rule-based” rather than “deep learning.” They would still be genuinely audio-driven and avoid the hardcoded fake lip-sync you dislike, but they are not the same as LivePortrait.

**Recommendation:** Proceed with **Wav2Lip-onnx** as the Phase 2 implementation, and design the architecture so that LivePortrait can be swapped in later as a new renderer.

---

## 5. Architecture Design

### 5.1 Principle: Avatar Engine interface does not change

Phase 1 created this interface:

```javascript
// client/src/components/Avatar/AvatarEngine.js
class AvatarEngine {
  initialize(container) {}
  setState('idle' | 'listening' | 'thinking' | 'speaking') {}
  setPreset(preset) {}
  setPortrait(url) {}
  playAudio(audioUrl) {}
  stopAudio() {}
  subscribe(callback) {}
}
```

Phase 2 will only change the **renderer implementation** behind this interface. No React component, no Node.js route, and no ChatPage logic need to change.

### 5.2 New renderer: `Wav2LipRenderer`

```
client/src/components/Avatar/renderers/
  PortraitRenderer.js      (existing static fallback)
  Wav2LipRenderer.js       (new: streams generated video frames from backend)
```

`Wav2LipRenderer` will:
- Connect to a WebSocket endpoint on the Python Avatar Service.
- Send the current portrait / source video ID and the TTS audio URL.
- Receive streaming frames or a generated video URL and play them in the avatar panel.
- Fall back to `PortraitRenderer` if the service is unavailable.

### 5.3 System architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        React Frontend                               │
│  ┌──────────────┐    ┌──────────────────┐    ┌──────────────────┐   │
│  │   ChatPage   │───▶│  AvatarEngine    │───▶│ Wav2LipRenderer│   │
│  └──────────────┘    └──────────────────┘    └────────┬─────────┘   │
│                        ▲                               │             │
│                        │ subscribe                    │ WebSocket   │
└────────────────────────┼───────────────────────────────┼─────────────┘
                         │                               │
                         │ HTTP / WebSocket              │
┌────────────────────────┼───────────────────────────────┼─────────────┐
│                   Node.js Backend                      │             │
│  ┌─────────────────────┴──┐                         │             │
│  │  /api/avatar/stream    │◀─────────────────────────┘             │
│  │  /api/avatar/speak     │                                        │
│  └─────────────────────┬──┘                                        │
│                        │ HTTP / WebSocket                         │
│                        ▼                                            │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              Python Avatar Service (separate process)         │   │
│  │  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐  │   │
│  │  │   FastAPI     │   │  Wav2Lip     │   │  FFmpeg      │  │   │
│  │  │   WebSocket   │──▶│  ONNX Model  │──▶│  Encode      │  │   │
│  │  │   Server      │   │  Inference   │   │  Frames      │  │   │
│  │  └──────────────┘   └──────────────┘   └──────────────┘  │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.4 Communication flow

1. User sends message → ChatPage calls TTS (browser SpeechSynthesis).
2. `SpeechSynthesisAdapter` calls `avatarEngine.playAudio(audioBlobUrl)` and `avatarEngine.setState('speaking')`.
3. `Wav2LipRenderer` receives the audio URL and sends it via WebSocket to Node.js `/api/avatar/speak`.
4. Node.js forwards to the Python Avatar Service.
5. Python service runs Wav2Lip ONNX inference on CPU, producing a short video stream.
6. Python service streams frames (or a video chunk) back to the frontend via WebSocket.
7. `Wav2LipRenderer` renders the video frames in the avatar panel.
8. When TTS ends, `SpeechSynthesisAdapter` calls `avatarEngine.setState('idle')` and `stopAudio()`.

### 5.5 Future swap to LivePortrait

When a GPU is available:
- Add a new `LivePortraitRenderer.js` in the frontend.
- Add a new `LivePortraitService.py` in the Python Avatar Service.
- Switch the renderer in `AvatarEngine.js` without changing the public API.
- React and Node.js remain untouched.

---

## 6. Detailed Implementation Plan

### 6.1 Required repositories

- **Wav2Lip ONNX fork:** `https://github.com/instant-high/wav2lip-onnx-HQ` (or another maintained ONNX fork).
- **Original Wav2Lip weights:** `https://huggingface.co/spaces/watksho/wav2lip-onnx` or similar HuggingFace mirror.
- **Python Avatar Service:** New folder under `AI-Multimodal-Assistant/avatar-service/`.

### 6.2 Python dependencies

Create `avatar-service/requirements.txt`:

```txt
fastapi>=0.110.0
uvicorn[standard]>=0.27.0
websockets>=12.0
python-multipart>=0.0.9
onnxruntime>=1.17.0          # CPU-only; GPU version available later
opencv-python>=4.9.0
numpy>=1.24.0
librosa>=0.10.1
soundfile>=0.12.1
ffmpeg-python>=0.2.0
pillow>=10.2.0
pydantic>=2.5.0
httpx>=0.26.0
```

Approximate install size: ~500 MB–1 GB.

### 6.3 Node.js dependencies

No new backend dependencies expected. Frontend will use the existing `AvatarEngine` and a new WebSocket client (native browser API). If needed, `ws` could be added for testing.

### 6.4 Model downloads

| Model | Size | Source | Purpose |
|-------|------|--------|---------|
| Wav2Lip ONNX | ~50–150 MB | HuggingFace / GitHub release | Lip-sync inference |
| Face detection model | ~10–30 MB | OpenCV DNN / ONNX | Crop face region |
| Source video | User-provided | Local file | Base talking face video |

Total download: ~100–200 MB.

### 6.5 Folder structure

```
AI-Multimodal-Assistant/
├── client/
│   └── src/
│       └── components/
│           └── Avatar/
│               └── renderers/
│                   ├── PortraitRenderer.js
│                   └── Wav2LipRenderer.js
├── server/
│   └── avatar/
│       └── routes/
│           └── avatarService.js       # proxy to Python service
└── avatar-service/                    # NEW Python service
    ├── app.py                         # FastAPI + WebSocket entry
    ├── requirements.txt
    ├── Dockerfile
    ├── models/
    │   └── wav2lip/
    │       ├── wav2lip.onnx
    │       └── face_detector.onnx
    ├── src/
    │   ├── inference.py               # Wav2Lip ONNX inference
    │   ├── pipeline.py                # audio → video pipeline
    │   ├── streaming.py               # WebSocket streaming logic
    │   └── utils.py                   # audio/video helpers
    └── samples/
        └── source_video.mp4           # user-provided base video
```

### 6.6 GPU requirements

- **Wav2Lip ONNX CPU:** No GPU required. Runs on Intel iGPU/CPU with ONNX Runtime.
- **LivePortrait (future):** Requires NVIDIA GPU with ≥8 GB VRAM and CUDA in WSL.

### 6.7 Expected FPS / latency

| Scenario | Expected Performance |
|----------|----------------------|
| Wav2Lip ONNX on CPU | Pre-generate a 3–10 second video in ~1–5 seconds. Real-time streaming likely not possible, but acceptable for turn-based assistant responses. |
| LivePortrait on GPU (future) | 25–30+ fps real-time streaming. |

### 6.8 Risks

| Risk | Mitigation |
|------|------------|
| Wav2Lip ONNX model is hard to find or unstable | Keep `PortraitRenderer` as fallback; test model download and inference first. |
| Source video quality affects output | Use a high-quality, front-facing, well-lit looped video. |
| CPU inference too slow for real-time | Pre-generate the full video before playback; accept a short delay. |
| Audio/video sync issues | Use FFmpeg to align timestamps; send audio and video together from the service. |
| WebSocket connection drops | Implement reconnection and fallback to static portrait. |
| Dependency conflicts (Python 3.11, old PyTorch) | Use ONNX Runtime instead of PyTorch; avoid the original Wav2Lip repo. |

### 6.9 CPU fallback

- `Wav2LipRenderer` will automatically fall back to `PortraitRenderer` if:
  - The Python service is not running.
  - The model fails to load.
  - The source video is missing.

---

## 7. What You Must Provide Before Implementation

1. **Decision:** Approve Wav2Lip-onnx as the Phase 2 engine, or choose another engine.
2. **Source video:** A 5–10 second looping video of the avatar face (front-facing, neutral expression, minimal head movement), OR permission to use the static image with a simple head-loop pre-generation step.
3. **Acceptance of trade-offs:** Real-time streaming is not possible on this machine. The assistant will pre-generate the talking video for each response and play it back.

---

## 8. Next Steps After Approval

1. Set up `avatar-service/` Python environment and install dependencies.
2. Download Wav2Lip ONNX models and sample source video.
3. Build the FastAPI + WebSocket Python service.
4. Implement `Wav2LipRenderer.js` in the frontend.
5. Wire the Node.js backend to proxy to the Python service.
6. Test audio → video → avatar flow end-to-end.
7. Document the future swap path to LivePortrait.

---

## 9. Alternative: Upgrade Hardware First

If you want to skip Wav2Lip and go directly to LivePortrait, the minimum hardware upgrade is:

- **GPU:** NVIDIA RTX 3060 12GB or RTX 4060 Ti 16GB (better: RTX 4070+).
- **WSL setup:** Install NVIDIA Windows driver + WSL CUDA toolkit + `nvidia-smi` visible in WSL.
- **RAM:** 16 GB is acceptable; 32 GB recommended.

Once that is in place, the same architecture can be used with a `LivePortraitRenderer` and `LivePortraitService.py` instead.

---

**End of plan. Awaiting approval.**
