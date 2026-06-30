import { useState, useRef, useEffect } from 'react'
import { Volume2, Mic, Activity, Maximize2, Minimize2, Radio } from 'lucide-react'
import assistantPortrait from '../assets/avatars/assistant_female_1.png'

export const AVATARS = {
  nexus: { label: 'Nexus', color: '#00D4FF' },
  aurora: { label: 'Aurora', color: '#A78BFA' },
  ember: { label: 'Ember', color: '#FF6B6B' },
  pulse: { label: 'Pulse', color: '#00FF88' },
}

export default function AIPanel({
  avatarState = 'idle',
  avatarPreset = 'nexus',
  onAvatarChange,
  isSpeaking = false,
  isListening = false,
  isAiResponding = false,
  name = 'Nexus AI',
  className = '',
}) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [lipOpen, setLipOpen] = useState(0)
  const panelRef = useRef(null)
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const theme = AVATARS[avatarPreset] || AVATARS.nexus

  useEffect(() => {
    if (avatarState !== 'speaking') {
      setLipOpen(0)
      audioContextRef.current?.close().catch(() => {})
      audioContextRef.current = null
      analyserRef.current = null
      return
    }

    let rafId
    const startAnalyser = async () => {
      try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)()
        audioContextRef.current = audioContext
        const analyser = audioContext.createAnalyser()
        analyser.fftSize = 64
        analyserRef.current = analyser

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        const source = audioContext.createMediaStreamSource(stream)
        source.connect(analyser)

        const data = new Uint8Array(analyser.frequencyBinCount)
        const loop = () => {
          if (!analyserRef.current) return
          analyserRef.current.getByteFrequencyData(data)
          const avg = data.reduce((a, b) => a + b, 0) / data.length
          const normalized = Math.min(avg / 128, 1)
          setLipOpen(normalized)
          rafId = requestAnimationFrame(loop)
        }
        loop()
      } catch (err) {
        const fallbackLoop = () => {
          setLipOpen(Math.random() * 0.6 + 0.2)
          rafId = setTimeout(fallbackLoop, 120)
        }
        fallbackLoop()
      }
    }

    startAnalyser()

    return () => {
      if (rafId) {
        if (typeof rafId === 'number') cancelAnimationFrame(rafId)
        else clearTimeout(rafId)
      }
      audioContextRef.current?.close().catch(() => {})
    }
  }, [avatarState])

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      panelRef.current?.requestFullscreen?.()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen?.()
      setIsFullscreen(false)
    }
  }

  const statusLabels = {
    idle: 'Idle',
    listening: 'Listening',
    thinking: 'Thinking',
    speaking: 'Speaking',
  }

  const statusColor =
    avatarState === 'speaking' ? '#A78BFA' :
    avatarState === 'listening' ? '#00FF88' :
    avatarState === 'thinking' ? '#FFC800' : '#00D4FF'

  return (
    <div
      ref={panelRef}
      className={`ai-panel ${className}`}
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
      {/* Streamer facecam area */}
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
        {/* Animated gradient border */}
        <div style={{
          position: 'absolute',
          inset: 14,
          borderRadius: 16,
          padding: 2,
          background: avatarState === 'speaking'
            ? 'linear-gradient(45deg, #A78BFA, #00D4FF, #A78BFA)'
            : avatarState === 'listening'
            ? 'linear-gradient(45deg, #00FF88, #00D4FF, #00FF88)'
            : 'linear-gradient(45deg, #2A2A2A, #1A1A2E, #2A2A2A)',
          backgroundSize: '200% 200%',
          animation: 'gradient-shift 3s ease infinite',
        }}>
          <div style={{
            width: '100%',
            height: '100%',
            borderRadius: 14,
            background: '#0F0F0F',
          }} />
        </div>

        {/* Streamer card */}
        <div style={{
          position: 'relative',
          zIndex: 2,
          width: '100%',
          maxWidth: 360,
          height: '100%',
          maxHeight: 320,
          borderRadius: 14,
          overflow: 'hidden',
          background: '#141414',
          border: '1px solid #2A2A2A',
          boxShadow: avatarState === 'speaking' ? '0 0 40px #A78BFA50' : '0 0 20px rgba(0,0,0,0.5)',
          transition: 'box-shadow 0.4s ease',
        }}>


          {/* Ambient glow behind image */}
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: `radial-gradient(circle at center, ${theme.color}20 0%, transparent 70%)`,
          }} />

          {/* Speaking/listening ring */}
          {(avatarState === 'speaking' || avatarState === 'listening') && (
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
            }}>
              <div style={{
                width: 200,
                height: 200,
                borderRadius: '50%',
                border: `2px solid ${statusColor}`,
                opacity: 0.5,
                animation: 'ring-expand 1.5s ease-out infinite',
              }} />
            </div>
          )}

          {/* Thinking spinner */}
          {avatarState === 'thinking' && (
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
            }}>
              <div style={{
                width: 220,
                height: 220,
                borderRadius: '50%',
                border: '3px solid transparent',
                borderTopColor: '#FFC800',
                animation: 'spin 1s linear infinite',
              }} />
            </div>
          )}

          {/* Portrait image */}
          <div
            style={{
              width: '100%',
              height: '100%',
              position: 'relative',
              zIndex: 2,
              opacity: imageLoaded ? 1 : 0,
              transition: 'opacity 0.5s ease',
              animation: avatarState === 'idle' ? 'breathe 3s ease-in-out infinite' : 'none',
            }}
          >
            <img
              src={assistantPortrait}
              alt="AI Assistant"
              onLoad={() => setImageLoaded(true)}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'center top',
              }}
            />

            {/* Animated mouth overlay for speaking */}
            {avatarState === 'speaking' && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '18%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 40,
                  height: Math.max(6, 6 + lipOpen * 16),
                  borderRadius: '50%',
                  background: 'linear-gradient(180deg, #6b4c9a 0%, #4a3b6b 100%)',
                  boxShadow: '0 0 10px #A78BFAA0, inset 0 0 4px #A78BFA60',
                  opacity: 0.85,
                  transition: 'height 0.08s ease-out',
                  border: '1px solid #A78BFA60',
                }}
              />
            )}
          </div>

          {/* Loading state */}
          {!imageLoaded && (
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1,
              background: '#1A1A2E',
            }}>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                border: '3px solid transparent',
                borderTopColor: theme.color,
                animation: 'spin 1s linear infinite',
              }} />
            </div>
          )}
        </div>

        {/* Waveform */}
        {(avatarState === 'speaking' || avatarState === 'listening') && (
          <div style={{
            marginTop: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            zIndex: 2,
          }}>
            <Waveform active color={statusColor} />
          </div>
        )}
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
          {avatarState === 'speaking' ? <Volume2 size={14} color={statusColor} /> :
           avatarState === 'listening' ? <Mic size={14} color={statusColor} /> :
           <Activity size={14} color={statusColor} />}
          <span style={{ fontSize: 12, color: '#A3A3A3' }}>
            {avatarState === 'idle' && 'Ready to assist'}
            {avatarState === 'listening' && 'Listening to you'}
            {avatarState === 'thinking' && 'Thinking...'}
            {avatarState === 'speaking' && 'Speaking response'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: '#737373' }}>VIEWERS</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#F5F5F5' }}>1</span>
        </div>
      </div>

      <style>{`
        @keyframes gradient-shift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes live-pulse {
          0%, 100% { opacity: 1; transform: scale(1); box-shadow: 0 0 0 0 #FF444480; }
          50% { opacity: 0.9; transform: scale(1.02); box-shadow: 0 0 0 8px #FF444410; }
        }
        @keyframes ring-expand {
          0% { transform: scale(0.9); opacity: 0.6; }
          100% { transform: scale(1.4); opacity: 0; }
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.2); }
        }
        @keyframes breathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.01); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes waveform {
          0%, 100% { height: 6px; opacity: 0.4; }
          50% { height: 28px; opacity: 1; }
        }
      `}</style>
    </div>
  )
}

function Waveform({ active, color }) {
  const bars = 14
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      height: 32,
      zIndex: 2,
    }}>
      {Array.from({ length: bars }).map((_, i) => (
        <div
          key={i}
          style={{
            width: 4,
            borderRadius: 2,
            background: color,
            opacity: 0.8,
            animation: active ? `waveform 1s ease-in-out infinite ${i * 0.05}s` : 'none',
          }}
        />
      ))}
    </div>
  )
}

const iconBtn = {
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
