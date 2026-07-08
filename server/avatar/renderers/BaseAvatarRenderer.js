/**
 * Backend avatar renderer adapter interface.
 *
 * Implementations for LivePortrait / MuseTalk / EchoMimic should expose:
 *   - initialize()
 *   - render(audioBuffer, portraitPath) -> { videoStream | frames[] }
 *   - dispose()
 */

class BaseAvatarRenderer {
  async initialize() {
    throw new Error('Not implemented')
  }

  async render(audio, portrait) {
    throw new Error('Not implemented')
  }

  async dispose() {
    throw new Error('Not implemented')
  }
}

module.exports = BaseAvatarRenderer
