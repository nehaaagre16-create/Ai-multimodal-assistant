import { avatarEngine } from '../AvatarEngine.js'

/**
 * SpeechSynthesisAdapter bridges the assistant's spoken text to the AvatarEngine.
 *
 * The adapter drives the avatar engine directly with text. The engine's active
 * renderer is responsible for rendering and audio playback.
 */
export class SpeechSynthesisAdapter {
  /**
   * Speak text through the avatar engine.
   * @param {string} text
   * @param {object} options
   * @param {string} options.voice - 'male' | 'female' | 'default'
   * @param {() => void} [options.onFinished]
   */
  static speak(text, options = {}) {
    if (!text) return
    const userOnFinished = options.onFinished
    const userOnStarted = options.onStarted
    avatarEngine.playAudio({
      text,
      type: 'text',
      voice: options.voice || 'default',
      speed: options.speed,
      pitch: options.pitch,
      onStarted: () => {
        avatarEngine.setState('speaking')
        userOnStarted?.()
      },
      onFinished: () => {
        avatarEngine.setState('idle')
        userOnFinished?.()
      },
    })
  }

  static stop() {
    avatarEngine.stopAudio()
    avatarEngine.setState('idle')
  }

  /**
   * Legacy attach helper for browser SpeechSynthesisUtterance objects.
   * @param {SpeechSynthesisUtterance} utter
   */
  static attach(utter) {
    const originalOnStart = utter.onstart
    const originalOnEnd = utter.onend
    const originalOnError = utter.onerror

    utter.onstart = (event) => {
      avatarEngine.setState('speaking')
      originalOnStart?.call(utter, event)
    }

    utter.onend = (event) => {
      avatarEngine.stopAudio()
      avatarEngine.setState('idle')
      originalOnEnd?.call(utter, event)
    }

    utter.onerror = (event) => {
      avatarEngine.stopAudio()
      avatarEngine.setState('idle')
      originalOnError?.call(utter, event)
    }
  }
}

export default SpeechSynthesisAdapter
