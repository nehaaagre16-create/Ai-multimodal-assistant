/**
 * Avatar state machine.
 * @typedef {'idle' | 'listening' | 'thinking' | 'speaking'} AvatarState
 */

/**
 * Metadata for a selectable avatar portrait preset.
 * @typedef {Object} AvatarPreset
 * @property {string} id
 * @property {string} name
 * @property {string} portrait
 * @property {string} themeColor
 * @property {string} accentColor
 */

/**
 * Generic audio payload delivered to the avatar engine.
 * Can be a URL, ArrayBuffer, Blob, or MediaStream.
 * @typedef {string | ArrayBuffer | Blob | MediaStream} AudioSource
 */

/**
 * Renderer interface. Implementations must be framework-agnostic and
 * work outside React. This lets us swap in LivePortrait, MuseTalk, EchoMimic,
 * or any WebGL/WebGPU renderer later without touching React components.
 * @typedef {Object} AvatarRenderer
 * @property {(container: HTMLElement) => void} mount
 * @property {(state: AvatarState, portrait?: string) => void} render
 * @property {(audio: AudioSource) => void} [playAudio]
 * @property {() => void} [stopAudio]
 * @property {() => void} destroy
 */

/**
 * Observer function subscribed to engine changes.
 * @typedef {(event: AvatarEngineEvent) => void} AvatarObserver
 */

/**
 * Events emitted by the avatar engine.
 * @typedef {Object} AvatarEngineEvent
 * @property {AvatarState} state
 * @property {string | undefined} portrait
 * @property {AudioSource | undefined} audio
 * @property {boolean} isPlaying
 */

/**
 * Configuration for the avatar engine.
 * @typedef {Object} AvatarEngineConfig
 * @property {AvatarState} [initialState]
 * @property {AvatarPreset} [initialPreset]
 * @property {AvatarRenderer} [renderer]
 */

export {}
