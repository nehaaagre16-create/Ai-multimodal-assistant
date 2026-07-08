# Phase 2 Implementation — Open-Source Self-Hosted Talking Avatar

**Status:** Complete  
**Date:** 2 July 2026

## What was delivered

A fully free, open-source, self-hosted talking avatar for the AI Multimodal Assistant.

- **Engine:** Wav2Lip ONNX (real neural lip-sync, CPU-compatible).
- **TTS:** Piper (local, free, open-source).
- **Backend:** Python FastAPI Avatar Service + Node.js `/api/avatar/*` proxy.
- **Frontend:** `Wav2LipRenderer.js` plugged into the existing `AvatarEngine`.
- **Fallback:** `PortraitRenderer` automatically used if the Python service fails.
- **Renderer-swappable:** LivePortrait can replace Wav2Lip later without touching React.

## How it works

1. The assistant response text is passed to `SpeechSynthesisAdapter.speak(text)`.
2. `AvatarEngine` forwards it to `Wav2LipRenderer`.
3. `Wav2LipRenderer` calls `POST /api/avatar/speak_text`.
4. Node.js proxies to the Python service.
5. Python service:
   - Synthesizes speech with Piper (`audio_*.wav`).
   - Generates a lip-sync video with Wav2Lip ONNX (`output_*.mp4`).
   - Logs inference time, FPS, frames, and total latency.
6. Frontend receives audio + video URLs and plays them in sync.
7. If the service fails, `AvatarEngine.reportRendererFailure()` switches to `PortraitRenderer`.

## Performance baseline (Intel i7-13620H + Intel UHD iGPU)

| Text length | TTS time | Wav2Lip time | Frames | FPS | Total latency |
|-------------|----------|--------------|--------|-----|---------------|
| ~1.8 s | ~1.9 s | ~1.6 s | 44 | 28.3 | ~4.4 s |
| ~3.2 s | ~2.1 s | ~2.9 s | 80 | 27.3 | ~8.5 s |

## Architecture

```
ChatPage / AIPanel
       │
       ▼
SpeechSynthesisAdapter ──► AvatarEngine
                              │
          ┌───────────────────┴───────────────────┐
          │                                       │
          ▼                                       ▼
Wav2LipRenderer.js                 PortraitRenderer.js (fallback)
          │                                       │
          ▼                                       ▼
POST /api/avatar/speak_text        browser SpeechSynthesis
          │
          ▼
Node.js proxy
          │
          ▼
Python Avatar Service (FastAPI, port 9000)
          │
          ├── Piper TTS → audio_*.wav
          └── Wav2Lip ONNX → output_*.mp4
```

## Key files

- `avatar-service/app.py` — FastAPI service.
- `avatar-service/src/inference.py` — Wav2Lip ONNX pipeline.
- `avatar-service/src/tts_service.py` — Piper TTS wrapper.
- `server/index.js` — `/api/avatar/*` proxy.
- `client/src/components/Avatar/renderers/Wav2LipRenderer.js` — new renderer.
- `client/src/components/Avatar/AvatarEngine.js` — fallback logic.
- `client/src/components/Avatar/hooks/useAvatarRenderer.js` — mounts Wav2Lip renderer.
- `client/src/components/Avatar/adapters/SpeechSynthesisAdapter.js` — text-to-avatar bridge.
- `client/src/pages/ChatPage.jsx` — uses `SpeechSynthesisAdapter.speak()` for read-aloud and auto-TTS.
- `docs/AVATAR_LIMITATIONS.md` — comparison with LivePortrait / Wan-Streamer.
- `docs/AVATAR_LIVEPORTRAIT_SWAP.md` — exact swap checklist.

## How to start

```bash
# 1. Start the Python Avatar Service
cd /home/paperclip/AI-Multimodal-Assistant/avatar-service
source .venv/bin/activate
python -m uvicorn app:app --host 0.0.0.0 --port 9000

# 2. Start the Node.js server
cd /home/paperclip/AI-Multimodal-Assistant/server
node index.js

# 3. Start the Vite dev server
cd /home/paperclip/AI-Multimodal-Assistant/client
npm run dev -- --host
```

Open the chat page, enable **Voice chat** (auto-TTS), and send a message. The assistant's text response will be spoken by the Wav2Lip avatar.

## Limitations

- Requires ~4–8 s of generation time before the first frame plays (CPU inference).
- Uses a source video derived from a static portrait; no full-head motion or expressive eye movement.
- Wav2Lip modifies only the mouth region.
- LivePortrait and Wan-Streamer require an NVIDIA GPU and cannot run on this machine.

## Next steps to upgrade to LivePortrait

1. Add an NVIDIA GPU to the machine.
2. Create `LivePortraitRenderer.js` matching the `AvatarRenderer` interface.
3. Build a LivePortrait Python service exposing the same `/api/avatar/*` endpoints.
4. Set `AVATAR_SERVICE_URL` to the new service port.
5. No React or Node.js route changes are needed.

See `docs/AVATAR_LIVEPORTRAIT_SWAP.md` for the full checklist.
