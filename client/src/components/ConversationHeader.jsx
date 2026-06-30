import { useState, useEffect } from 'react'
import { PhoneOff, LayoutGrid, Volume2, VolumeX, Mic, MicOff } from 'lucide-react'

export default function ConversationHeader({ isSpeaking, isListening, onToggleSpeak, onToggleMic, onEndCall, onToggleLayout }) {
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => setSeconds(s => s + 1), 1000)
    return () => clearInterval(interval)
  }, [])

  const formatTime = (s) => {
    const mins = Math.floor(s / 60).toString().padStart(2, '0')
    const secs = (s % 60).toString().padStart(2, '0')
    return `${mins}:${secs}`
  }

  return (
    <div style={{
      height: 64,
      minHeight: 64,
      padding: '0 24px',
      borderBottom: '1px solid #2A2A2A',
      background: 'rgba(20, 20, 20, 0.8)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: '#00FF88',
          boxShadow: '0 0 10px #00FF8860',
        }} />
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#F5F5F5' }}>
            Live Conversation
          </div>
          <div style={{ fontSize: 12, color: '#737373', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: '#00FF88' }}>Online</span>
            <span>•</span>
            <span>{formatTime(seconds)}</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={onToggleSpeak} style={iconBtnStyle}>
          {isSpeaking ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
        <button onClick={onToggleMic} style={{ ...iconBtnStyle, color: isListening ? '#00D4FF' : '#A3A3A3' }}>
          {isListening ? <MicOff size={18} /> : <Mic size={18} />}
        </button>
        <button onClick={onToggleLayout} style={iconBtnStyle}>
          <LayoutGrid size={18} />
        </button>
        <button
          onClick={onEndCall}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 14px',
            borderRadius: 10,
            border: 'none',
            background: '#FF444430',
            color: '#FF4444',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <PhoneOff size={16} />
          End Call
        </button>
      </div>
    </div>
  )
}

const iconBtnStyle = {
  width: 36,
  height: 36,
  borderRadius: 10,
  border: '1px solid #2A2A2A',
  background: '#1E1E1E',
  color: '#A3A3A3',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
}
