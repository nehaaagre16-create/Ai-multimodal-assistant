/**
 * Service for managing avatar presets and portraits on the backend.
 *
 * Future responsibilities:
 * - Store preset metadata.
 * - Validate uploaded portrait images.
 * - Serve portrait URLs to the frontend.
 */

class AvatarPresetService {
  constructor() {
    this.presets = []
  }

  getPresets() {
    return this.presets
  }

  addPreset(preset) {
    this.presets.push(preset)
  }
}

module.exports = AvatarPresetService
