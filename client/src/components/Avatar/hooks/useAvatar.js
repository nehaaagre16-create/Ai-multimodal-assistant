import { useSyncExternalStore } from 'react'
import { avatarEngine } from '../AvatarEngine.js'

/**
 * React hook that subscribes to the singleton avatar engine.
 * Returns the current engine snapshot (state, portrait, audio, isPlaying).
 */
export default function useAvatar() {
  return useSyncExternalStore(
    (callback) => avatarEngine.subscribe(callback),
    () => avatarEngine.getSnapshot()
  )
}
