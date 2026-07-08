# Phase 1 — Avatar Engine Refactor Summary

> Date: 2 July 2026
> Status: **Completed. Awaiting review before Phase 2.**

---

## 1. What Was Accomplished

### 1.1 Architecture Goal

The avatar is now **completely independent** from the chat UI. React components no longer manage avatar state, portrait selection, or mouth animation logic. Instead, a single `AvatarEngine` singleton owns all avatar state and delegates rendering to a pluggable `AvatarRenderer` interface.

This means the current portrait renderer can be replaced with **LivePortrait, MuseTalk, EchoMimic, or any future video-generation pipeline** without changing React components.

---

## 2. Files Created

### Frontend — `client/src/components/Avatar/`

| File | Purpose |
|------|---------|
| `AvatarEngine.js` | Singleton engine exposing `initialize()`, `setState()`, `setPortrait()`, `setPreset()`, `playAudio()`, `stopAudio()`, and subscription API. |
| `Avatar.jsx` | React component that only renders the engine's renderer output into a DOM container. |
| `types.js` | JSDoc type definitions mirroring the requested TypeScript types. |
| `index.js` | Public module entry point exporting `Avatar`, `AvatarEngine`, `avatarEngine`, `useAvatar`, `avatarPresets`, `avatarPresetMap`, `SpeechSynthesisAdapter`. |
| `presets.js` | Avatar preset configuration (Nexus, Aurora, Ember, Pulse). |
| `package.json` | Folder-level package manifest so Vite resolves the module directory. |
| `renderers/PortraitRenderer.js` | Default renderer. Renders a static portrait image with theme-aware CSS. |
| `hooks/useAvatar.js` | React hook that subscribes to the singleton engine via `useSyncExternalStore`. |
| `hooks/useAvatarRenderer.js` | React hook that mounts the renderer into a DOM container. |
| `adapters/SpeechSynthesisAdapter.js` | Bridges browser TTS lifecycle to `AvatarEngine`. |
| `animations/` | Reserved for Phase 2 animation curves (currently empty). |

### Backend — `server/avatar/`

| File | Purpose |
|------|---------|
| `engines/AvatarBackendEngine.js` | Placeholder server-side engine for future video-generation pipelines. |
| `renderers/BaseAvatarRenderer.js` | Base interface for server-side renderers (LivePortrait, MuseTalk, EchoMimic). |
| `services/AvatarPresetService.js` | Placeholder preset management service. |
| `adapters/` | Reserved for future adapters (text-to-speech services, WebRTC). |
| `models/` | Reserved for future ML model wrappers. |

### Static assets

| File | Purpose |
|------|---------|
| `client/public/avatars/assistant_female_1.png` | Portrait asset served statically for presets. |

---

## 3. Files Modified

| File | Change |
|------|--------|
| `client/src/components/AIPanel.jsx` | Rewritten to use the new `Avatar` component and subscribe to `AvatarEngine` for state/portrait. Added working preset selector and fullscreen listener. Removed fake lip-sync and random mouth animation. |
| `client/src/pages/ChatPage.jsx` | Removed local `avatarState` state. Now routes all voice state transitions (`idle`, `listening`, `thinking`, `speaking`) through `avatarEngine.setState()`. Uses `SpeechSynthesisAdapter.attach()` to bridge TTS to the engine. |
| `client/vite.config.js` | Added `@avatar` alias resolving to `src/components/Avatar/index.js`. |

### Files NOT modified

- `App.jsx`, `UserPanel.jsx`, `RightSidebar.jsx`, `ConversationHeader.jsx`, `ChatInput.jsx`, `MessageActions.jsx`, `MessageContent.jsx`, `StatusBar.jsx`, `LeftSidebar.jsx`, `Layout.jsx` — unchanged.
- All `pages/` except `ChatPage.jsx` — unchanged.
- `server/index.js` — unchanged.
- `package.json` files — unchanged.

---

## 4. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         React Layer                                  │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐    │
│  │  ChatPage   │    │   AIPanel   │    │   Other Components  │    │
│  └──────┬──────┘    └──────┬──────┘    └─────────────────────┘    │
│         │                  │                                         │
│  calls avatarEngine.setState()                                       │
│  calls SpeechSynthesisAdapter.attach()                               │
│         │                  │                                         │
└─────────┼──────────────────┼─────────────────────────────────────────┘
          │                  │
          ▼                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     Avatar Engine (singleton)                        │
│   initialize()  ·  setState()  ·  setPortrait()  ·  playAudio()      │
│   stopAudio()   ·  subscribe()                                       │
│                         │                                            │
│                         ▼                                            │
│              ┌─────────────────────┐                                 │
│              │   AvatarRenderer    │  ← Pluggable interface          │
│              │   mount / render    │                                 │
│              │   playAudio / stop  │                                 │
│              │   destroy           │                                 │
│              └─────────────────────┘                                 │
└─────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     Concrete Renderers                               │
│   ┌─────────────────┐   ┌─────────────────┐  ┌─────────────────┐   │
│   │ PortraitRenderer│   │ LivePortrait    │  │ EchoMimic     │   │
│   │ (current)         │   │ (future)        │  │ (future)      │   │
│   └─────────────────┘   └─────────────────┘  └─────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘

SpeechSynthesisAdapter
         │
         ├─ onstart  → avatarEngine.setState('speaking')
         ├─ onend    → avatarEngine.stopAudio() + setState('idle')
         └─ onerror  → avatarEngine.stopAudio() + setState('idle')
```

---

## 5. Public API of the Avatar Engine

```js
// Initialize the engine with a renderer (or uses default PortraitRenderer).
avatarEngine.initialize()

// Transition between states.
avatarEngine.setState('idle')
avatarEngine.setState('listening')
avatarEngine.setState('thinking')
avatarEngine.setState('speaking')

// Deliver real audio to the renderer (used by TTS adapters).
avatarEngine.playAudio(audioSource)

// Stop any active audio.
avatarEngine.stopAudio()

// Change portrait image or preset.
avatarEngine.setPortrait('/avatars/assistant_female_1.png')
avatarEngine.setPreset(avatarPresetMap.aurora)

// React integration.
const { state, portrait, audio, isPlaying } = useAvatar()
```

---

## 6. How the TTS Pipeline Is Now Connected

1. User sends message or uses voice.
2. ChatPage sets `isAiResponding = true` → engine state becomes `thinking`.
3. AI response streams in.
4. If auto-TTS or manual speak is triggered, `speakText()` creates a `SpeechSynthesisUtterance`.
5. `SpeechSynthesisAdapter.attach(utter)` hooks the utterance lifecycle.
6. `utter.onstart` → `avatarEngine.setState('speaking')`.
7. `utter.onend` → `avatarEngine.stopAudio()` + `avatarEngine.setState('idle')`.
8. The engine forwards these to the current renderer, which can later drive real lip-sync.

**No fake mouth movements are generated in Phase 1.** The renderer only renders a static portrait and records the state on the container's `data-avatar-state` attribute.

---

## 7. Verification Results

- `npm run build` passes successfully.
- Dev server starts at `http://localhost:5173`.
- `/chat` route loads without JavaScript errors.
- Avatar panel displays the portrait and the `Nexus` preset selector.
- Fullscreen button and listener are wired correctly.
- Screenshot sent to Telegram for visual review.

---

## 8. Remaining Work for Phase 2

1. **Add real lip-sync to `PortraitRenderer`** using the TTS boundary events or captured audio amplitude.
2. **Implement SVG status rings** (idle breathing, listening pulse, thinking spinner, speaking amplitude ring).
3. **Add ambient glow and border animations** tied to state and preset theme color.
4. **Replace the single portrait with 4 distinct images** for Nexus / Aurora / Ember / Pulse.
5. **Connect microphone amplitude to the renderer** when the engine is in `listening` state.
6. **Add audio waveform visualization** in both AIPanel and UserPanel.
7. **Test state transitions** through a full chat + voice + auto-TTS flow.
8. **Playwright regression test** for the chat and avatar flows.

---

## 9. Key Design Decisions

- The project is currently JavaScript, so the requested `.ts` / `.tsx` files were implemented as `.js` / `.jsx` with TypeScript-style JSDoc types. A full TypeScript migration can be done as a separate future step without affecting the architecture.
- The `@avatar` Vite alias keeps imports clean and allows easy relocation of the module later.
- The engine is a singleton so that any adapter (TTS, STT, WebSocket, future backend sync) can drive the avatar from anywhere in the application.
- `AvatarRenderer` is framework-agnostic and DOM-only, so server-side or WebGL renderers can be dropped in without touching React.

---

## 10. Notes for Review

Please review the following before approving Phase 2:

1. Do you want me to add a **TypeScript compiler setup** now, or keep the JS implementation with JSDoc types?
2. Do you have **4 distinct portrait images**, or should I generate tint variations of the existing portrait for the presets?
3. Should the **UserPanel microphone visualizer** also be moved under the Avatar engine, or kept separate?
4. Any changes to the **state transition logic** (for example, should "thinking" start immediately when the user stops speaking, or only after the message is sent)?

