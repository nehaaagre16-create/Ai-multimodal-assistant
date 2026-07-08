/**
 * Avatar presets used by the AvatarEngine and the rest of the application.
 * Portraits are served from /avatars as static assets.
 */
export const avatarPresets = [
  {
    id: 'nexus',
    name: 'Nexus',
    gender: 'female',
    portrait: '/avatars/assistant_female_1.png',
    themeColor: '#00D4FF',
    accentColor: '#A78BFA',
    skin: '#f5d0b0',
    hair: '#1a1a1a',
    eyeColor: '#3b3b3b',
  },
  {
    id: 'aurora',
    name: 'Aurora',
    gender: 'female',
    portrait: '/avatars/assistant_female_1.png',
    themeColor: '#A78BFA',
    accentColor: '#00D4FF',
    skin: '#f0d5c5',
    hair: '#2d1f3d',
    eyeColor: '#5a4a6a',
  },
  {
    id: 'ember',
    name: 'Ember',
    gender: 'female',
    portrait: '/avatars/assistant_female_1.png',
    themeColor: '#FF6B6B',
    accentColor: '#FFC800',
    skin: '#e8c4a8',
    hair: '#2a1812',
    eyeColor: '#4a3025',
  },
  {
    id: 'pulse',
    name: 'Pulse',
    gender: 'female',
    portrait: '/avatars/assistant_female_1.png',
    themeColor: '#00FF88',
    accentColor: '#00D4FF',
    skin: '#f5d0b0',
    hair: '#0f1f1a',
    eyeColor: '#1f3d3d',
  },
]

export const avatarPresetMap = avatarPresets.reduce((acc, preset) => {
  acc[preset.id] = preset
  return acc
}, {})

export default avatarPresets
