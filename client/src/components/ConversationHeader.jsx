import { useState, useEffect } from 'react'
import { Mic, MicOff, Volume2, VolumeX, PhoneOff } from 'lucide-react'

export default function ConversationHeader({
  isAiResponding,
  isSpeaking,
  isListening,
  onToggleSpeak,
  onToggleMic,
  onEndCall,
}) {
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

  const statusText = isSpeaking ? 'Speaking' : isListening ? 'Listening' : isAiResponding ? 'Thinking' : 'Online'
  const statusColor = isSpeaking ? '#A78BFA' : isListening ? '#00D4FF' : isAiResponding ? '#F59E0B' : '#00FF88'

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
          background: statusColor,
          boxShadow: `0 0 10px ${statusColor}60`,
        }} />
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#F5F5F5' }}>
            Live Conversation
          </div>
          <div style={{ fontSize: 12, color: '#737373', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: statusColor }}>{statusText}</span>
            <span>•</span>
            <span>{formatTime(seconds)}</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          onClick={onToggleMic}
          title={isListening ? 'Stop listening' : 'Start listening'}
          style={iconBtnStyle(isListening ? '#00D4FF' : '#A3A3A3')}
        >
          {isListening ? <MicOff size={18} /> : <Mic size={18} />}
        </button>
        <button
          onClick={onToggleSpeak}
          title={isSpeaking ? 'Stop speaking' : 'Read last response aloud'}
          style={iconBtnStyle(isSpeaking ? '#A78BFA' : '#A3A3A3')}
        >
          {isSpeaking ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
        <button
          onClick={onEndCall}
          title="End call / stop all"
          style={iconBtnStyle('#FF4444')}
        >
          <PhoneOff size={18} />
        </button>
      </div>
    </div>
  )
}

const iconBtnStyle = (color) => ({
  width: 36,
  height: 36,
  borderRadius: 10,
  border: '1px solid #2A2A2A',
  background: '#1E1E1E',
  color,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
})
