/**
 * Backend Avatar Engine placeholder.
 *
 * The current avatar is entirely client-side (browser TTS/STT + Web Audio).
 * This module is reserved for future server-side avatar generation pipelines
 * such as LivePortrait, MuseTalk, EchoMimic, or other video-generation models.
 *
 * Future responsibilities:
 * - Accept text/audio from the chat pipeline.
 * - Generate or stream avatar video frames.
 * - Serve frames to the frontend via WebSocket, SSE, or WebRTC.
 */

class AvatarBackendEngine {
  constructor() {
    this.state = 'idle'
  }

  setState(state) {
    this.state = state
  }

  async generateFrames(audio, portrait) {
    // Placeholder for future integration.
    throw new Error('Server-side avatar generation is not implemented yet.')
  }
}

module.exports = AvatarBackendEngine
