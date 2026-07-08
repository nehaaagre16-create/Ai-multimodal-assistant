# Avatar Engine: Wav2Lip → LivePortrait Swap Guide

This document explains how the Avatar Engine stays renderer-swappable, and the exact steps to replace the current CPU-compatible Wav2Lip renderer with a LivePortrait renderer later without touching any React component or the Node.js API contract.

## 1. Core Principle

The only integration point between the UI and the avatar system is the **AvatarEngine** singleton.

```
React components  ──►  AvatarEngine  ──►  AvatarRenderer  ──►  Python Avatar Service
                         │                    │                     │
                         │                    ▼                     │
                         │            Wav2LipRenderer  ──►  Wav2Lip ONNX + Piper
                         │                    │
                         │            LivePortraitRenderer  ──►  LivePortrait
```

- React calls `avatarEngine.playAudio({ text })`.
- `AvatarEngine` passes the request to whichever renderer is currently mounted.
- The renderer is responsible for turning text into synchronized audio + video.
- The renderer reports failure via `avatarEngine.reportRendererFailure()`. The engine then automatically swaps to the registered fallback (`PortraitRenderer`).

## 2. Files to Change for a LivePortrait Swap

### Step 1 — Create the new renderer class

Create `client/src/components/Avatar/renderers/LivePortraitRenderer.js` that implements the same `AvatarRenderer` interface as `Wav2LipRenderer`:

- `mount(container)` — create a `<video>` element and audio element inside the container.
- `render(state, portrait)` — update visual state classes.
- `playAudio(audio)` — call your new Python endpoint with `audio.text`, then play the returned audio + video.
- `stopAudio()` — stop and clear media.
- `destroy()` — clean up DOM and timers.

Keep the same `serviceBaseUrl` convention (`/api/avatar`) so no frontend URL changes.

### Step 2 — Point the hook to the new renderer

In `client/src/components/Avatar/hooks/useAvatarRenderer.js`:

```js
import LivePortraitRenderer from '../renderers/LivePortraitRenderer.js'
// ...
avatarEngine.setRenderer(LivePortraitRenderer)
```

No other frontend file needs to change. `ChatPage.jsx`, `AIPanel.jsx`, `Avatar.jsx`, and `SpeechSynthesisAdapter.js` remain untouched because they only talk to `AvatarEngine`.

### Step 3 — Create the LivePortrait Python service

Create a new service alongside `avatar-service/` (or a new sub-folder inside it). It must expose the same API surface:

```
POST /api/avatar/speak_text
  Request:  { "text": "...", "source_video": "..." }
  Response: { "audio_url": "/outputs/audio_xxx.wav",
              "video_url": "/outputs/output_xxx.mp4",
              "duration_sec": 1.2,
              "inference_time_sec": 0.5,
              "fps_generated": 30,
              "latency_ms": 800 }

GET /api/avatar/health
  Response: { "status": "ok", "model_loaded": true }

GET /api/avatar/outputs/:filename
  Response: binary WAV or MP4
```

### Step 4 — Configure the Node.js proxy

`server/index.js` already proxies all `/api/avatar/*` traffic to `AVATAR_SERVICE_URL` (default `http://localhost:9000`).

When the LivePortrait service is ready, change the environment variable or default in `server/index.js`:

```bash
# In the project root .env
AVATAR_SERVICE_URL=http://localhost:9001
```

No frontend code or API route changes are needed.

### Step 5 — Switch the frontend back to the new renderer

Run `npm run dev` in `client/`. The React app will now mount `LivePortraitRenderer`, which will call the same Node proxy routes.

## 3. What Does NOT Need to Change

| File | Why it stays the same |
|------|-----------------------|
| `client/src/components/Avatar/AvatarEngine.js` | Already renderer-agnostic. |
| `client/src/components/Avatar/Avatar.jsx` | Only mounts the engine into a container. |
| `client/src/components/AIPanel.jsx` | Only passes `avatarState` to the engine. |
| `client/src/components/Avatar/adapters/SpeechSynthesisAdapter.js` | Only calls `avatarEngine.playAudio({ text })`. |
| `client/src/pages/ChatPage.jsx` | Only calls `SpeechSynthesisAdapter.speak(text)`. |
| `server/index.js` routes | Already generic `/api/avatar/*` proxy. |

## 4. Required GPU Upgrade

LivePortrait requires an NVIDIA GPU with CUDA. The current machine uses Intel UHD iGPU, so LivePortrait cannot run here. The Wav2Lip CPU path is the highest-quality option that is free, open-source, and self-hosted on this hardware.

Minimum target hardware for LivePortrait:
- NVIDIA GPU with 8 GB+ VRAM (RTX 4060 Ti / 4070 class).
- CUDA 11.8+ and cuDNN installed.
- WSL2 or native Linux recommended for service deployment.

## 5. Quick Checklist

- [ ] Create `LivePortraitRenderer.js` with the same interface as `Wav2LipRenderer.js`.
- [ ] Update `useAvatarRenderer.js` to use `LivePortraitRenderer`.
- [ ] Implement LivePortrait Python service matching `/speak_text` and `/health`.
- [ ] Set `AVATAR_SERVICE_URL` to the new service port.
- [ ] Verify the Node proxy still returns the expected JSON shape.
- [ ] Confirm React UI shows the new video without any component edits.

## 6. Rollback

If the new renderer fails, the `AvatarEngine` automatically falls back to `PortraitRenderer`. To force a manual rollback, change one line in `useAvatarRenderer.js` back to:

```js
avatarEngine.setRenderer(Wav2LipRenderer)
```

or keep `PortraitRenderer` as the fallback.

## 7. Current Renderer

As of this commit, the active renderer is **Wav2LipRenderer** using:
- **Wav2Lip ONNX** (`wav2lip_gan.onnx`) for lip-sync.
- **Piper TTS** (`en_US-amy-medium`) for local, free speech synthesis.
- **Python Avatar Service** running on port `9000`.
- **Node.js proxy** on `/api/avatar/*`.
