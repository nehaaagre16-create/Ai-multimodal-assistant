# AI Multimodal Assistant — Architecture Audit & Real-Time Avatar Roadmap

> Prepared: 2 July 2026
> Scope: frontend, backend, WebSocket/LLM pipeline, TTS/STT, current avatar implementation, and proposed real-time talking avatar architecture (Wan-Streamer style).
> Status: **ANALYSIS ONLY — no code changes made.**

---

## 1. Executive Summary

The AI Multimodal Assistant is a **React + Vite + Node.js/Express + SQLite + Socket.IO** application. It already has a working real-time chat pipeline, browser-based TTS/STT, vision analysis, file uploads, memory, and a basic streamer-style AIPanel. The static avatar is currently a single PNG portrait with a fake/random mouth overlay. To reach a Wan-Streamer-level experience, the cleanest path is **not** to switch to video APIs immediately (which require paid keys and latency), but to build a **local, audio-reactive, portrait-based avatar** with real-time state rings, preset system, and fullscreen facecam — using only browser Web Audio APIs and local assets.

---

## 2. Current Architecture Overview

### 2.1 Tech Stack

| Layer | Technology | Notes |
|-------|------------|-------|
| Frontend | React 19 + Vite 8 + Socket.IO client | Black-only theme, inline styles, no Tailwind usage despite dependency. |
| Routing | React Router v7 | `/`, `/chat`, `/vision`, `/settings`, `/profile`, `/history`, `/memory`, `/files`. |
| Backend | Node.js + Express + Socket.IO | `server/index.js`, single-file monolith. |
| Database | SQLite (`better-sqlite3`) | `chat.db`, tables: `conversations`, `messages`, `memories`, `settings`. |
| LLM | OpenRouter | `openai/gpt-3.5-turbo` default, vision via `gpt-4o`. |
| TTS | Browser `speechSynthesis` | Voices selected by name heuristics (David, Zira, Jenny). |
| STT | Browser `webkitSpeechRecognition` | Continuous, interim results, echo detection. |
| Vision | Webcam + canvas capture + OpenRouter | `/api/vision`. |
| Files | Express static + base64 upload | `server/uploads`. |
| Animation | Framer Motion is installed but not used. | Opportunity. |

### 2.2 File Structure

```
/home/paperclip/AI-Multimodal-Assistant/
├── client/
│   ├── src/
│   │   ├── App.jsx                    # global state, socket, routing
│   │   ├── main.jsx                   # React root
│   │   ├── index.css / App.css        # global CSS, aurora bg, keyframes
│   │   ├── pages/
│   │   │   ├── ChatPage.jsx           # chat UI, TTS/STT lifecycle, avatar state
│   │   │   ├── VisionPage.jsx         # camera / screen capture, vision chat
│   │   │   ├── MemoryPage.jsx         # CRUD for memories
│   │   │   ├── FilesPage.jsx          # drag-drop upload, preview
│   │   │   ├── SettingsPage.jsx       # model, voice, speed, pitch, autoTTS
│   │   │   ├── ProfilePage.jsx        # stats from /api/profile/stats
│   │   │   ├── HistoryPage.jsx        # (not read yet, but present)
│   │   │   └── LandingPage.jsx        # (not read yet, but present)
│   │   └── components/
│   │       ├── AIPanel.jsx            # static portrait + fake lip sync + waveform
│   │       ├── Avatar.jsx             # SVG robot face (unused?)
│   │       ├── UserPanel.jsx          # webcam preview + mic waveform
│   │       ├── RightSidebar.jsx       # status grid, tools, latency, stats
│   │       ├── LeftSidebar.jsx        # navigation
│   │       ├── ConversationHeader.jsx # call controls
│   │       ├── ChatInput.jsx          # text input + mic toggle
│   │       ├── StatusBar.jsx          # footer status bar
│   │       ├── MessageContent.jsx     # markdown rendering
│   │       ├── MessageActions.jsx     # copy, like, read aloud
│   │       ├── ToolsPanel.jsx         # tool buttons
│   │       └── Layout.jsx             # 3-column layout
│   └── package.json
├── server/
│   ├── index.js                       # Express + Socket.IO + SQLite + routes
│   └── package.json
└── chat.db                            # SQLite database
```

---

## 3. End-to-End Voice Pipeline Trace

### 3.1 User speaks → AI responds

```
User microphone
    ↓
[ChatPage.jsx] SpeechRecognition (webkitSpeechRecognition)
    continuous=true, interimResults=true, lang='en-US'
    ↓
On silence (1.5 s) or manual stop → transcript committed
    ↓
[ChatPage.jsx] handleSend(text)
    ↓
[App.jsx] sendMessage(text) via socket.emit('chat-message', {message, history})
    ↓
[server/index.js] socket.on('chat-message')
    save user message to SQLite
    stream to OpenRouter /chat/completions with stream=true
    ↓
[server/index.js] chunks decoded from SSE
    socket.emit('ai-chunk', content)
    ↓
[App.jsx] socket.on('ai-chunk') → append to messages state
    ↓
[ChatPage.jsx] useEffect watches messages + autoTTS
    if new assistant message and autoTTS enabled → speakText(content)
    ↓
[ChatPage.jsx] speakText()
    create SpeechSynthesisUtterance
    set rate/pitch from settings
    pick voice by name heuristics (male/female/default)
    utter.onstart → setIsSpeaking(true)
    utter.onend → setIsSpeaking(false)
    ↓
Browser TTS audio output
    ↓
[AIPanel.jsx] avatarState='speaking' detected
    current implementation: random mouth height via setInterval
```

### 3.2 Voice state machine

States: `idle → listening → thinking → speaking → idle`.

- `listening`: triggered by `isListening` (mic active).
- `thinking`: triggered by `isAiResponding` (SSE streaming started, not yet finished).
- `speaking`: triggered by `isSpeaking` (TTS utterance onstart).
- `idle`: default.

Echo suppression: mic is stopped while `isSpeaking` or `isAiResponding`, and auto-restarted 1.5 s after AI finishes if `keepListeningRef.current` is true.

---

## 4. Where the Static Image Is Rendered

### 4.1 Primary avatar: AIPanel.jsx

- **Line 3:** `import assistantPortrait from '../assets/avatars/assistant_female_1.png'`
- **Line 5-10:** `AVATARS` object only defines colors/labels, **no image mapping**.
- **Line 224-245:** `<img src={assistantPortrait} ... />` always renders the same PNG regardless of preset.
- **Line 248-265:** fake mouth overlay for `speaking` state. Height is `Math.max(6, 6 + lipOpen * 16)` where `lipOpen` is derived from microphone analysis or random fallback. **This does not follow TTS audio.**
- **Line 31-81:** Audio analyser is created only when `avatarState === 'speaking'`, but it tries to get microphone input (`getUserMedia({audio:true})`), which is wrong — it should analyse the TTS output, not the mic. This causes the mouth to react to ambient noise, not the AI voice.

### 4.2 Secondary avatar: Avatar.jsx (unused?)

- SVG robot face with random lip sync.
- Not imported in the current flow we traced (only AIPanel is used in ChatPage).
- Could be deleted or repurposed as a fallback.

### 4.3 User webcam: UserPanel.jsx

- Renders `<video>` from `getUserMedia({video:true})`.
- Has a simple audio-level visualizer when listening.
- Camera button is in the footer of UserPanel.

---

## 5. Current AIPanel Problems vs. Wan-Streamer

| Wan-Streamer feature | Current state | Gap |
|----------------------|---------------|-----|
| Real-time talking face | Single PNG with fake mouth | No real lip sync; mouth is static/random. |
| Preset avatars | 4 color presets, same image | Presets only change color theme. |
| Status rings / HUD | One simple expanding ring | Missing layered HUD, model name, activity timeline. |
| Fullscreen facecam | Button exists but state is brittle | Fullscreen listener not attached to `fullscreenchange`. |
| Waveform tied to speech | CSS waveform animation | Not tied to actual audio amplitude. |
| Clean, professional portrait | Robot/SVG fallback | User wants local clean portraits. |

---

## 6. Proposed Architecture: Local Audio-Reactive Talking Avatar

### 6.1 Design principle

**Use local portraits + Web Audio API + CSS/SVG overlays.** This avoids paid APIs, keeps latency near zero, and works offline. It is a “2.5D avatar” — not a real video, but visually responsive and polished.

### 6.2 Core pieces

```
┌─────────────────────────────────────────────────────────┐
│                    AIPanel (React)                        │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  Portrait Layer (selected preset PNG)                │  │
│  │  ┌───────────────────────────────────────────────┐  │  │
│  │  │  SVG Status Rings (idle/listening/thinking/speaking) │  │  │
│  │  │  Animated gradient border / ambient glow        │  │  │
│  │  └───────────────────────────────────────────────┘  │  │
│  │  Lip-sync overlay (mouth slot) driven by audio     │  │
│  └─────────────────────────────────────────────────────┘  │
│  Preset selector row  │  Fullscreen toggle  │  Status label  │
└─────────────────────────────────────────────────────────┘
```

### 6.3 Lip-sync: the hard part

The browser TTS (`speechSynthesis`) does **not** expose audio output to Web Audio. Two clean options:

**Option A: Synthetic amplitude envelope (recommended first)**
- When TTS starts, generate a fake but plausible amplitude curve.
- Use `utterance.onboundary` events to get word/sentence timings.
- Map those timings to a `mouthOpen` value that peaks at vowels and closes at consonants/pauses.
- Pro: no extra dependencies, works with any browser voice.
- Con: not truly audio-reactive, but visually convincing.

**Option B: Capture TTS audio via `AudioContext` destination**
- Some browsers allow routing `speechSynthesis` output to an audio element or `MediaElementAudioSourceNode` if the OS exposes it as a system audio source.
- Not reliable cross-browser.

**Option C: Use a cloud TTS that returns audio bytes (e.g., ElevenLabs, OpenAI TTS, Azure)**
- Fetch MP3/PCM from backend, play via `<audio>` and analyse with Web Audio.
- Pro: real lip sync, human-like voice.
- Con: requires API key, network latency, cost.

**Recommendation:** Implement **Option A** now. It gives the best UX/effort ratio and matches the user's constraint of using free/local alternatives. Leave a hook for Option C later.

### 6.4 Preset system

Create a config file:

```js
// assets/avatarPresets.js
export const AVATAR_PRESETS = [
  { id: 'nexus',   name: 'Nexus',   portrait: '/avatars/nexus.png',   theme: '#00D4FF', ring: '#00D4FF' },
  { id: 'aurora',  name: 'Aurora',  portrait: '/avatars/aurora.png',  theme: '#A78BFA', ring: '#A78BFA' },
  { id: 'ember',   name: 'Ember',   portrait: '/avatars/ember.png',   theme: '#FF6B6B', ring: '#FF6B6B' },
  { id: 'pulse',   name: 'Pulse',   portrait: '/avatars/pulse.png',   theme: '#00FF88', ring: '#00FF88' },
]
```

Place portraits in `client/public/avatars/` so they are served as static assets and easy to swap without rebuilding.

### 6.5 Audio-reactive mouth

Two mouth shapes:
- **Closed mouth:** thin horizontal ellipse when idle/closed.
- **Open mouth:** height proportional to `amplitude` (0..1), with smooth interpolation.

Use `requestAnimationFrame` to update mouth height at 60 FPS. Smooth the value with a simple low-pass filter to avoid jitter.

For **listening state**: reuse the microphone analyser already built in UserPanel, but move it to a shared hook so AIPanel can display the user’s voice amplitude on the AI side too (or keep it in UserPanel only).

For **speaking state**: use the synthetic amplitude envelope derived from TTS boundary events.

### 6.6 Status rings

- **Idle:** slow breathing ring, dim theme color.
- **Listening:** green pulsing ring + microphone waveform at bottom.
- **Thinking:** spinning amber arc + subtle “processing dots”.
- **Speaking:** theme-color ring that expands/contracts with speech amplitude.

Use SVG `<circle>` with animated `stroke-dasharray` and `stroke-dashoffset` for the thinking arc. Use CSS `box-shadow` + keyframes for the ring pulse.

### 6.7 Fullscreen

- Store `isFullscreen` state.
- Attach `document.addEventListener('fullscreenchange', ...)` to keep React state in sync with browser fullscreen exit (ESC).
- Apply larger portrait, bigger rings, and centered layout when fullscreen.

---

## 7. Dependency Analysis

### 7.1 No new runtime dependencies required

All proposed features can be built with:
- React built-in hooks
- Browser Web Audio API (`AudioContext`, `AnalyserNode`)
- Browser `SpeechSynthesis` / `SpeechSynthesisUtterance.onboundary`
- Browser Fullscreen API
- CSS animations / SVG
- Existing `framer-motion` (optional, for page transitions or entrance animations)

### 7.2 Optional dependencies for future tiers

| Tier | Library / Service | Cost | Latency |
|------|-------------------|------|---------|
| Tier 1 (current plan) | None | Free | Low |
| Tier 2 (better lip sync) | `@pixiv/three-vrm` or `live2d-cubism` | Free | Low |
| Tier 3 (real video) | D-ID / HeyGen / Synthesia / OpenAI Sora | Paid | Higher |

### 7.3 Existing assets

- `assistant_female_1.png` is the only portrait. Need 3-4 more clean portraits for presets.
- User prefers local assets over external URLs or SVG robot faces.

---

## 8. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| `speechSynthesis.onboundary` timing inaccurate | Lip sync looks off | Combine with word-length heuristics and a fallback curve. |
| Browser voices load async / names differ | Voice selection breaks | Cache voice list, allow explicit selection, fallback to default. |
| Microphone permission denied | No listening visualizer | Gracefully degrade to CSS animation. |
| Fullscreen resize breaks layout | UI looks bad | Use CSS media-query-like container queries and `object-fit: cover`. |
| Multiple AudioContexts leak | Memory/performance issue | Reuse one shared `AudioContext`, close on unmount. |
| Fake lip sync feels cheap | UX miss | Keep mouth animation subtle and natural; avoid randomness. |

---

## 9. Implementation Roadmap

### Phase 1 — Foundation (2–2.5 h)
1. Create `client/public/avatars/` and add 4 clean portraits.
2. Create `client/src/lib/avatarPresets.js` config.
3. Refactor `AIPanel.jsx` to load portrait from preset config.
4. Add preset selector UI in AIPanel footer.
5. Fix fullscreen logic with proper `fullscreenchange` listener.

### Phase 2 — Real Lip Sync (2–2.5 h)
1. Build `useSpeechAmplitude()` hook using `SpeechSynthesisUtterance.onboundary`.
2. Generate amplitude curve from word boundaries and sentence pauses.
3. Drive AIPanel mouth overlay from amplitude signal.
4. Add smoothing/low-pass filter to mouth movement.
5. Test with different voices and speeds.

### Phase 3 — Status Rings & HUD (1.5–2 h)
1. Replace gradient border with animated SVG status rings.
2. Add ambient glow behind portrait using preset theme color.
3. Add state-specific animations (breathing idle, pulse listening, spin thinking, amplitude speaking).
4. Add waveform bars tied to amplitude for speaking/listening.
5. Remove “VIEWERS” label; show AI name, model, and preset.

### Phase 4 — Voice/Video UX Polish (1–1.5 h)
1. Improve UserPanel mic visualizer with real-frequency bars.
2. Add camera-off placeholder that matches avatar style.
3. Polish ConversationHeader mic/speaker button states.
4. Add voice preview in SettingsPage.

### Phase 5 — Memory & Files Enhancements (1.5–2 h)
1. Inject pinned memories into OpenRouter prompt context.
2. Add AI memory extraction from conversation.
3. Improve MemoryPage UI with categories/bulk actions.
4. Add file content search/preview in FilesPage.

### Phase 6 — Testing (1.5 h)
1. Run end-to-end Playwright tests for chat, settings, and vision flows.
2. Test preset switching, fullscreen, lip sync, voice states.
3. Docker build and container startup.

**Total estimated effort: 10–12 hours.** The user’s current 2 July plan covers roughly Phase 1–3 (avatar) + partial testing.

---

## 10. File-by-File Change Plan

| File | Changes | Reason |
|------|---------|--------|
| `client/public/avatars/` | Add `nexus.png`, `aurora.png`, `ember.png`, `pulse.png` (or equivalent clean portraits). | Asset source for presets. |
| `client/src/lib/avatarPresets.js` | New config file exporting preset map. | Centralize avatar metadata. |
| `client/src/hooks/useSpeechAmplitude.js` | New hook: subscribe to TTS, produce amplitude signal. | Real lip sync without cloud API. |
| `client/src/hooks/useAudioAnalyser.js` | New hook: shared microphone analyser. | Reuse between UserPanel and AIPanel. |
| `client/src/components/AIPanel.jsx` | Full rewrite: load preset portrait, add SVG rings, amplitude-driven mouth, preset selector, fullscreen listener. | Core avatar upgrade. |
| `client/src/components/ChatPage.jsx` | Pass `amplitude` or `speechSignal` to AIPanel; pass `mouthOpen` state. | Bridge TTS to avatar. |
| `client/src/components/UserPanel.jsx` | Use shared audio analyser hook; polish camera-off placeholder. | Consistent audio UX. |
| `client/src/components/ConversationHeader.jsx` | Better active-state indicators. | Voice call UX. |
| `client/src/components/SettingsPage.jsx` | Add voice preview button; improve voice list handling. | TTS testing. |
| `client/src/components/RightSidebar.jsx` | Live stats update, real latency from ping. | Status accuracy. |
| `server/index.js` | (Optional) Add `/api/avatar/presets` if presets move server-side; inject pinned memories into chat prompt. | Memory integration. |
| `client/src/index.css` | Add keyframes for rings, glow, mouth transitions. | Styling. |
| `client/src/components/Avatar.jsx` | Delete or repurpose as fallback. | Dead code removal. |

---

## 11. Key Decisions Pending Approval

1. **Do we build the local audio-reactive portrait now, or do we want to integrate a paid video API (D-ID/HeyGen) later?**
2. **Where do we source the 3–4 clean portrait images?** Options: existing `assistant_female_1.png` plus generated/drawn portraits, or reuse one portrait with different color tints for now.
3. **Should we delete `Avatar.jsx` (SVG robot) or keep it as a low-bandwidth fallback?**
4. **Should memory injection into the LLM prompt be part of this avatar sprint, or a separate follow-up?**

---

## 12. Conclusion

The project is well-architected for this upgrade. The cleanest next step is to replace the static PNG in `AIPanel.jsx` with a **preset-driven, amplitude-driven portrait system** using only browser APIs and local assets. This delivers 80% of the Wan-Streamer visual experience without API keys, cost, or latency penalties. The remaining 20% (true human voice + real video) can be added later by swapping the TTS/audio source layer.

**Recommended approval order:**
1. Approve architecture and local-portrait approach.
2. Provide/confirm portrait assets.
3. Begin Phase 1 implementation.
