import { useState, useEffect } from 'react'

export default function Avatar({ state = 'idle' }) {
  // state: 'idle' | 'listening' | 'thinking' | 'speaking'
  const [mouthOpen, setMouthOpen] = useState(0)
  const [blink, setBlink] = useState(false)
  const [glowIntensity, setGlowIntensity] = useState(0.3)

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

  const getFaceColor = () => {
    switch (state) {
      case 'listening': return `rgba(0, 212, 255, ${glowIntensity})`
      case 'thinking': return 'rgba(255, 200, 0, 0.4)'
      case 'speaking': return 'rgba(0, 255, 136, 0.3)'
      default: return 'rgba(0, 212, 255, 0.15)'
    }
  }

  const getBorderColor = () => {
    switch (state) {
      case 'listening': return '#00D4FF'
      case 'thinking': return '#FFC800'
      case 'speaking': return '#00FF88'
      default: return '#2A2A2A'
    }
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }}>
      {/* Avatar face container */}
      <div style={{
        width: 120,
        height: 120,
        borderRadius: '50%',
        background: getFaceColor(),
        border: `2px solid ${getBorderColor()}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        transition: 'all 0.3s ease',
        boxShadow: state === 'listening' ? `0 0 30px ${getBorderColor()}40` : 'none',
      }}>
        {/* Eyes */}
        <div style={{
          position: 'absolute',
          top: '35%',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: 20,
        }}>
          {/* Left eye */}
          <div style={{
            width: 14,
            height: blink ? 2 : 14,
            borderRadius: '50%',
            background: state === 'listening' ? '#00D4FF' : '#F5F5F5',
            transition: 'all 0.1s ease',
          }} />
          {/* Right eye */}
          <div style={{
            width: 14,
            height: blink ? 2 : 14,
            borderRadius: '50%',
            background: state === 'listening' ? '#00D4FF' : '#F5F5F5',
            transition: 'all 0.1s ease',
          }} />
        </div>

        {/* Mouth */}
        <div style={{
          position: 'absolute',
          bottom: '25%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 24,
          height: state === 'speaking' ? 8 + mouthOpen * 12 : 4,
          borderRadius: state === 'speaking' ? '50%' : 8,
          background: state === 'speaking' ? '#00FF88' : '#737373',
          transition: 'all 0.1s ease',
        }} />
      </div>

      {/* Status label */}
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
