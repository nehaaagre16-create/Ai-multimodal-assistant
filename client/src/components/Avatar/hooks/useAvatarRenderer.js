import { useLayoutEffect, useRef } from 'react'
import { avatarEngine } from '../AvatarEngine.js'
import VideoAvatarRenderer from '../../VideoAvatar/VideoAvatar.jsx'

/**
 * React hook that mounts the avatar renderer into a DOM container.
 *
 * Usage:
 *   const containerRef = useRef(null)
 *   useAvatarRenderer(containerRef)
 */
export default function useAvatarRenderer(containerRef, _onMount = null) {
  const mountedRef = useRef(false)

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container || mountedRef.current) return

    mountedRef.current = true

    const unsubscribe = avatarEngine.subscribe(() => {
      _onMount?.(true)
    })

    avatarEngine.setRenderer(VideoAvatarRenderer, {})
    avatarEngine.initialize()
    avatarEngine.mountRenderer(container)

    return () => {
      unsubscribe()
      avatarEngine.destroy()
      mountedRef.current = false
    }
  }, [containerRef])
}
