import { useState, useRef, useEffect } from 'react'
import { Volume2, Mic, Activity, Maximize2, Minimize2 } from 'lucide-react'
import { Avatar, avatarEngine, avatarPresets, avatarPresetMap } from '@avatar'

const statusConfig = {
  idle: { label: 'Idle', icon: Activity, color: '#A3A3A3' },
  listening: { label: 'Listening', icon: Mic, color: '#00FF88' },
  thinking: { label: 'Thinking', icon: Activity, color: '#FFC800' },
  speaking: { label: 'Speaking', icon: Volume2, color: '#A78BFA' },
}

export { avatarPresets }

export default function AIPanel({
  avatarState,
  avatarPreset,
  onAvatarChange,
  name = 'Nexus AI',
  className = '',
}) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const panelRef = useRef(null)

  const theme = avatarPresetMap[avatarPreset] || avatarPresetMap.nexus

  // Keep engine preset in sync with React prop.
  useEffect(() => {
    if (theme) {
      avatarEngine.setPreset(theme)
    }
  }, [theme])

  // Keep engine state in sync with React prop.
  useEffect(() => {
    if (avatarState) {
      avatarEngine.setState(avatarState)
    }
  }, [avatarState])

  // Listen for browser fullscreen changes (e.g. ESC).
  useEffect(() => {
    const handler = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      panelRef.current?.requestFullscreen?.().catch(() => {})
    } else {
      document.exitFullscreen?.().catch(() => {})
    }
  }

  const status = statusConfig[avatarState] || statusConfig.idle
  const StatusIcon = status.icon

  return (
    <div
      ref={panelRef}
      className={`ai-panel ${className}`}
      data-avatar-state={avatarState}
      style={{
        flex: 1,
        minHeight: 0,
        borderRadius: 20,
        background: '#141414',
        border: '1px solid #2A2A2A',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      {/* Avatar facecam area */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        padding: 20,
        background: '#0F0F0F',
      }}>
        <div style={{
          position: 'relative',
          zIndex: 2,
          width: '100%',
          height: '100%',
          borderRadius: 14,
          overflow: 'hidden',
          background: '#141414',
          border: '1px solid #2A2A2A',
        }}
        >
          <Avatar />

          {/* Floating status pill */}
          <div style={{
            position: 'absolute',
            bottom: 12,
            left: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 10px',
            borderRadius: 999,
            background: 'rgba(20, 20, 20, 0.72)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            transition: 'opacity 180ms ease, transform 180ms ease',
            opacity: 1,
          }}>
            <span style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: status.color,
              boxShadow: `0 0 6px ${status.color}60`,
              transition: 'background 180ms ease, box-shadow 180ms ease',
            }} />
            <StatusIcon size={12} color={status.color} />
            <span style={{ fontSize: 11, fontWeight: 500, color: '#E5E5E5' }}>
              {status.label}
            </span>
          </div>
        </div>
      </div>

      {/* Footer info */}
      <div style={{
        padding: 14,
        borderTop: '1px solid #2A2A2A',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: '#0F0F0F',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: '#A3A3A3' }}>
            {name}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Preset selector */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowMenu(s => !s)}
              style={{
                padding: '6px 10px',
                borderRadius: 8,
                border: '1px solid #2A2A2A',
                background: '#1E1E1E',
                color: '#A3A3A3',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              {theme.name}
            </button>
            {showMenu && (
              <div style={{
                position: 'absolute',
                bottom: '100%',
                right: 0,
                marginBottom: 6,
                background: '#1E1E1E',
                border: '1px solid #2A2A2A',
                borderRadius: 10,
                overflow: 'hidden',
                minWidth: 120,
                zIndex: 20,
              }}>
                {avatarPresets.map(p => (
                  <button
                    key={p.id}
                    onClick={() => {
                      onAvatarChange?.(p.id)
                      setShowMenu(false)
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      textAlign: 'left',
                      border: 'none',
                      background: 'transparent',
                      color: p.id === avatarPreset ? theme.themeColor : '#A3A3A3',
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button onClick={toggleFullscreen} style={iconBtnStyle}>
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>

    </div>
  )
}

const iconBtnStyle = {
  width: 32,
  height: 32,
  borderRadius: 10,
  border: '1px solid #2A2A2A',
  background: 'rgba(10,10,10,0.85)',
  color: '#A3A3A3',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  transition: 'all 0.2s',
}
