import { useRef } from 'react'
import useAvatarRenderer from './hooks/useAvatarRenderer.js'

/**
 * Avatar React component.
 *
 * Renders the avatar engine's renderer output into a DOM container.
 *
 * @param {Object} props
 * @param {string} [props.className]
 * @param {React.CSSProperties} [props.style]
 */
export default function Avatar({ className = '', style = {} }) {
  const containerRef = useRef(null)
  useAvatarRenderer(containerRef)

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        ...style,
      }}
    >
    </div>
  )
}
