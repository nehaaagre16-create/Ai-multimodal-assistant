# Avatar Engine Limitations: Wav2Lip vs LivePortrait / Wan-Streamer

This document records the limitations of the current free, open-source, CPU-based talking avatar compared to GPU-first engines such as **LivePortrait** and **Wan-Streamer**.

## 1. Engine Overview

| Component | Current (Wav2Lip) | LivePortrait | Wan-Streamer |
|-----------|-------------------|--------------|--------------|
| **License** | MIT | MIT | Various (mostly proprietary) |
| **GPU required** | No | Yes (NVIDIA CUDA) | Yes |
| **CPU viable** | Yes | No | No |
| **Input** | Source video + audio | Image/video + driving motion | Text/image + video |
| **Output** | Lip-synced MP4 | Animated portrait MP4/WebM | Video stream |
| **Real-time streaming** | Batch / file-based | Yes | Yes |
| **Latency on this hardware** | ~4–8 s for 2–3 s speech | Cannot run | Cannot run |
| **Audio-driven lip-sync** | Yes | Partial (needs audio-to-motion bridge) | Yes |
| **Facial expressiveness** | Minimal (mouth only) | High (full face, eyes, head) | High |
| **Body / upper body** | None | None | Partial |

## 2. What Wav2Lip Does Well

- **Free and self-hosted** — no API keys, no subscription, no telemetry.
- **CPU compatible** — runs on the existing Intel i7-13620H + Intel UHD iGPU.
- **Real lip-sync** — the mouth shape is generated from the actual audio waveform, not a random animation.
- **Modular renderer** — the React frontend and Node.js backend do not know which model is running.
- **Renderer fallback** — if the Python service fails, the UI automatically falls back to `PortraitRenderer` with browser speech synthesis.

## 3. Current Limitations

### 3.1 Latency

Every assistant utterance must be synthesized and generated before playback:

```
Text ──► Piper TTS (~1.5–2 s) ──► Wav2Lip ONNX (~1.5–3 s) ──► MP4 + WAV
```

Total first-frame latency is typically **4–8 seconds** for a short sentence on this CPU. LivePortrait or Wan-Streamer, on a GPU, can stream frames with sub-second latency.

### 3.2 Source Video Quality

- The current avatar uses a short source video created from a single static portrait image with a slow breathing animation.
- Wav2Lip only modifies the mouth region. It does not animate the rest of the face or head.
- LivePortrait would produce a far more expressive, gaze-aware, head-moving avatar from a single image or short video.

### 3.3 Audio Quality

- Piper TTS is fast and local, but it is a compact neural model. It is not as natural as larger cloud TTS or fine-tuned Piper voices.
- Voices are limited to the downloaded Piper model. The current default is `en_US-amy-medium`.
- Speed and pitch are controlled by the source audio, not the frontend.

### 3.4 Not Streaming

- The current pipeline generates a full MP4 file and then plays it.
- It cannot stream the avatar in chunks as the assistant speaks, which means longer responses have higher wait times.
- With a GPU, LivePortrait can generate frames on-the-fly for a continuous streaming experience.

### 3.5 Hardware Ceiling

- Wav2Lip inference on CPU gives roughly **25–30 fps** for a 96×96 face region, but the surrounding pipeline (face detection, frame I/O, FFmpeg merge) adds overhead.
- Higher-resolution source videos or longer speech will increase latency linearly.

### 3.6 Face Detection Robustness

- The current service uses MediaPipe for face detection. It works well for frontal faces but may fail on extreme angles, low light, or heavily stylized portraits.
- A real source video with consistent lighting and a frontal face gives the best results.

## 4. Why This Is the Right Choice for This Machine

The three originally requested engines (LivePortrait, MuseTalk, EchoMimic) all require NVIDIA CUDA and do not run on Intel UHD iGPU. Wav2Lip ONNX is the highest-quality, free, open-source alternative that:

- Runs entirely on CPU.
- Produces real audio-driven lip-sync.
- Fits the existing renderer-swappable architecture.
- Can be replaced by LivePortrait later with zero frontend changes.

## 5. Path to LivePortrait / GPU Quality

Once an NVIDIA GPU is added:

1. Implement `LivePortraitRenderer.js` matching the `AvatarRenderer` interface.
2. Build a LivePortrait Python service behind the same `/api/avatar/*` routes.
3. Update `AVATAR_SERVICE_URL` to the new service.
4. The React frontend will automatically use the higher-quality GPU avatar.

See `AVATAR_LIVEPORTRAIT_SWAP.md` for the exact checklist.

## 6. Performance Baseline on Current Hardware

Measured on Intel Core i7-13620H + Intel UHD iGPU, 16 GB RAM:

| Text length | TTS time | Wav2Lip time | Frames | FPS | Total latency |
|-------------|----------|--------------|--------|-----|---------------|
| ~1.8 s | ~1.9 s | ~1.6 s | 44 | 28.3 | ~4.4 s |
| ~3.2 s | ~2.1 s | ~2.9 s | 80 | 27.3 | ~8.5 s |

These numbers are logged by the Python service for every `/speak_text` request.

## 7. Summary

The current implementation is a **real, audio-driven, free, open-source talking avatar** that works on your current Intel i7 hardware. It is not as fast or as visually expressive as GPU-based LivePortrait or Wan-Streamer, but it is the highest-quality option available without buying an NVIDIA GPU or paying for a cloud API. The renderer-swappable design guarantees a smooth upgrade path later.
