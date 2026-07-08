import VideoAvatarRenderer from '../VideoAvatar/VideoAvatar.jsx'

/**
 * @import { AvatarState, AvatarPreset, AudioSource, AvatarRenderer, AvatarObserver, AvatarEngineEvent } from './types.js'
 */

const VALID_STATES = /** @type {AvatarState[]} */ (['idle', 'listening', 'thinking', 'speaking'])

/**
 * AvatarEngine is the single source of truth for avatar state, portrait, and audio.
 *
 * It is intentionally decoupled from React, GPT, TTS, STT, and WebSockets.
 * UI components and external adapters subscribe to it via subscribe().
 *
 * The engine delegates rendering to a pluggable AvatarRenderer implementation.
 */
class AvatarEngine {
  #state = /** @type {AvatarState} */ ('idle')
  #preset = /** @type {AvatarPreset | undefined} */ (undefined)
  #renderer = /** @type {AvatarRenderer | null} */ (null)
  #fallbackRenderer = /** @type {AvatarRenderer | null} */ (null)
  #observers = /** @type {Set<AvatarObserver>} */ (new Set())
  #currentAudio = /** @type {AudioSource | undefined} */ (undefined)
  #isPlaying = false

  constructor({ initialState = 'idle', initialPreset, renderer, fallbackRenderer } = {}) {
    this.#state = VALID_STATES.includes(initialState) ? initialState : 'idle'
    this.#preset = initialPreset
    this.#renderer = renderer ?? null
    this.#fallbackRenderer = fallbackRenderer ?? null
  }

  initialize(renderer, fallbackRenderer) {
    if (renderer) this.#renderer = renderer
    if (fallbackRenderer) this.#fallbackRenderer = fallbackRenderer
    if (!this.#fallbackRenderer) this.#fallbackRenderer = new VideoAvatarRenderer()
    if (!this.#renderer) this.#renderer = new VideoAvatarRenderer()
    this.#emit()
  }

  setRenderer(RendererClass, options = {}) {
    this.#renderer?.destroy?.()
    this.#renderer = new RendererClass(options)
  }

  subscribe(observer) {
    this.#observers.add(observer)
    observer(this.getSnapshot())
    return () => this.#observers.delete(observer)
  }

  setState(state) {
    if (!VALID_STATES.includes(state) || this.#state === state) return
    this.#state = state
    this.#activeRenderer()?.render(this.#state, this.#preset?.portrait)
    this.#emit()
  }

  setPreset(preset) {
    this.#preset = preset
    this.#activeRenderer()?.render(this.#state, this.#preset?.portrait)
    this.#emit()
  }

  setPortrait(image) {
    if (this.#preset) {
      this.#preset = { ...this.#preset, portrait: image }
    } else {
      this.#preset = {
        id: 'custom',
        name: 'Custom',
        portrait: image,
        themeColor: '#00D4FF',
        accentColor: '#A78BFA',
      }
    }
    this.#activeRenderer()?.render(this.#state, this.#preset.portrait)
    this.#emit()
  }

  playAudio(audio) {
    this.#currentAudio = audio
    this.#isPlaying = true
    this.#activeRenderer()?.playAudio?.(audio)
    this.#emit()
  }

  stopAudio() {
    this.#currentAudio = undefined
    this.#isPlaying = false
    this.#activeRenderer()?.stopAudio?.()
    this.#emit()
  }

  getSnapshot() {
    return {
      state: this.#state,
      portrait: this.#preset?.portrait,
      audio: this.#currentAudio,
      isPlaying: this.#isPlaying,
    }
  }

  getPreset() {
    return this.#preset
  }

  mountRenderer(container) {
    this.#activeRenderer()?.mount(container)
    this.#activeRenderer()?.render(this.#state, this.#preset?.portrait)
  }

  destroy() {
    this.#renderer?.destroy()
    this.#fallbackRenderer?.destroy()
    this.#renderer = null
    this.#fallbackRenderer = null
    this.#observers.clear()
  }

  reportRendererFailure() {
    if (this.#renderer && this.#renderer !== this.#fallbackRenderer) {
      this.#renderer.destroy()
    }
    this.#renderer = this.#fallbackRenderer
    this.#activeRenderer()?.render(this.#state, this.#preset?.portrait)
    this.#emit()
  }

  #activeRenderer() {
    return this.#renderer ?? this.#fallbackRenderer
  }

  #emit() {
    const snapshot = this.getSnapshot()
    this.#observers.forEach((fn) => {
      try {
        fn(snapshot)
      } catch {}
    })
  }
}

export const avatarEngine = new AvatarEngine()

export { AvatarEngine }
export default AvatarEngine
