/**
 * Avatar state machine.
 */
export type AvatarState = 'idle' | 'listening' | 'thinking' | 'speaking'

/**
 * Metadata for a selectable avatar portrait preset.
 */
export interface AvatarPreset {
  id: string
  name: string
  portrait: string
  themeColor: string
  accentColor: string
}

/**
 * Generic audio payload delivered to the avatar engine.
 * Can be a URL, ArrayBuffer, MediaStream, or Blob.
 */
export type AudioSource = string | ArrayBuffer | Blob | MediaStream

/**
 * Renderer interface. Implementations must be framework-agnostic and
 * work outside React. This lets us swap in LivePortrait, MuseTalk, EchoMimic,
 * or any WebGL/WebGPU renderer later without touching React components.
 */
export interface AvatarRenderer {
  /**
   * Called once when the renderer is mounted to a DOM container.
   */
  mount(container: HTMLElement): void

  /**
   * Called when the renderer should update its visual state.
   */
  render(state: AvatarState, portrait?: string): void

  /**
   * Called when a new audio source should drive the avatar.
   */
  playAudio?(audio: AudioSource): void

  /**
   * Called when any active audio should stop.
   */
  stopAudio?(): void

  /**
   * Called before the renderer is unmounted and destroyed.
   */
  destroy(): void
}

/**
 * Observer function subscribed to engine changes.
 */
export type AvatarObserver = (event: AvatarEngineEvent) => void

/**
 * Events emitted by the avatar engine.
 */
export interface AvatarEngineEvent {
  state: AvatarState
  portrait: string | undefined
  audio: AudioSource | undefined
  isPlaying: boolean
}

/**
 * Configuration for the avatar engine.
 */
export interface AvatarEngineConfig {
  initialState?: AvatarState
  initialPreset?: AvatarPreset
  renderer?: AvatarRenderer
}
