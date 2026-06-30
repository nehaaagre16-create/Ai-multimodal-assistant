import { useState, useEffect, useRef } from 'react'

export const AVATARS = {
  nexus: { label: 'Nexus', base: '#00D4FF' },
  aurora: { label: 'Aurora', base: '#A78BFA' },
  ember: { label: 'Ember', base: '#FF6B6B' },
  pulse: { label: 'Pulse', base: '#00FF88' },
}

export default function Avatar({ state = 'idle', preset = 'nexus', size = 120 }) {
  // state: 'idle' | 'listening' | 'thinking' | 'speaking'
  const [mouthOpen, setMouthOpen] = useState(0)
  const [blink, setBlink] = useState(false)
  const [glowIntensity, setGlowIntensity] = useState(0.3)
  const [breath, setBreath] = useState(1)
  const svgRef = useRef(null)

  const theme = AVATARS[preset] || AVATARS.nexus
  const baseColor = theme.base

  // Blink animation
  useEffect(() => {
    const interval = setInterval(() => {
      setBlink(true)
      setTimeout(() => setBlink(false), 150)
    }, 3000 + Math.random() * 2000)
    return () => clearInterval(interval)
  }, [])

  // Speaking lip sync
  useEffect(() => {
    if (state !== 'speaking') {
      setMouthOpen(0)
      return
    }
    const interval = setInterval(() => {
      setMouthOpen(Math.random() * 0.8 + 0.2)
    }, 100)
    return () => clearInterval(interval)
  }, [state])

  // Listening glow pulse
  useEffect(() => {
    if (state !== 'listening') {
      setGlowIntensity(0.3)
      return
    }
    const interval = setInterval(() => {
      setGlowIntensity(prev => prev === 0.3 ? 0.8 : 0.3)
    }, 600)
    return () => clearInterval(interval)
  }, [state])

  // Thinking animation
  useEffect(() => {
    if (state !== 'thinking') return
    const interval = setInterval(() => {
      setBlink(true)
      setTimeout(() => setBlink(false), 100)
    }, 800)
    return () => clearInterval(interval)
  }, [state])

  // Idle breathing
  useEffect(() => {
    if (state !== 'idle') {
      setBreath(1)
      return
    }
    const interval = setInterval(() => {
      setBreath(prev => prev === 1 ? 1.05 : 1)
    }, 2000)
    return () => clearInterval(interval)
  }, [state])

  const getFaceColor = () => {
    const intensity = state === 'idle' ? 0.12 : state === 'listening' ? glowIntensity : 0.35
    const hex = baseColor + Math.round(intensity * 255).toString(16).padStart(2, '0')
    return hex
  }

  const getBorderColor = () => {
    if (state === 'idle') return '#2A2A2A'
    return baseColor
  }

  // Avatar expression shapes
  const eyeRadius = 7
  const mouthHeight = state === 'speaking' ? 8 + mouthOpen * 16 : 4
  const mouthRadius = state === 'speaking' ? 10 : 4

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: getFaceColor(),
        border: `2px solid ${getBorderColor()}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        transition: 'all 0.3s ease',
        boxShadow: state === 'listening' ? `0 0 40px ${baseColor}60` : 'none',
        transform: `scale(${breath})`,
      }}>
        <svg ref={svgRef} width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: 'absolute' }}>
          {/* Eye glow */}
          <defs>
            <radialGradient id="eyeGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={baseColor} stopOpacity={0.8} />
              <stop offset="100%" stopColor={baseColor} stopOpacity={0} />
            </radialGradient>
          </defs>

          {/* Left eye */}
          <g transform={`translate(${size * 0.32}, ${size * 0.38})`}>
            {state !== 'idle' && (
              <circle cx={0} cy={0} r={eyeRadius * 1.8} fill="url(#eyeGlow)" opacity={0.4} />
            )}
            <ellipse
              cx={0}
              cy={0}
              rx={eyeRadius}
              ry={blink ? 1 : eyeRadius}
              fill={state === 'idle' ? '#737373' : '#F5F5F5'}
              style={{ transition: 'all 0.1s ease' }}
            />
          </g>

          {/* Right eye */}
          <g transform={`translate(${size * 0.68}, ${size * 0.38})`}>
            {state !== 'idle' && (
              <circle cx={0} cy={0} r={eyeRadius * 1.8} fill="url(#eyeGlow)" opacity={0.4} />
            )}
            <ellipse
              cx={0}
              cy={0}
              rx={eyeRadius}
              ry={blink ? 1 : eyeRadius}
              fill={state === 'idle' ? '#737373' : '#F5F5F5'}
              style={{ transition: 'all 0.1s ease' }}
            />
          </g>

          {/* Mouth */}
          <rect
            x={size * 0.5 - 12}
            y={size * 0.65 - mouthHeight / 2}
            width={24}
            height={mouthHeight}
            rx={mouthRadius}
            fill={state === 'speaking' ? baseColor : state === 'idle' ? '#525252' : '#A3A3A3'}
            style={{ transition: 'all 0.1s ease' }}
          />

          {/* Expression accents */}
          {state === 'thinking' && (
            <>
              <circle cx={size * 0.72} cy={size * 0.22} r={3} fill={baseColor} opacity={0.6} />
              <circle cx={size * 0.78} cy={size * 0.16} r={2} fill={baseColor} opacity={0.4} />
            </>
          )}
        </svg>
      </div>

      <div style={{
        marginTop: 16,
        fontSize: 12,
        color: getBorderColor(),
        textTransform: 'uppercase',
        letterSpacing: 1,
        fontWeight: 600,
      }}>
        {state}
      </div>
    </div>
  )
}
