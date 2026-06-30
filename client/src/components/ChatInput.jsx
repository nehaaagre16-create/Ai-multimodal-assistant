import { Send, Mic, MicOff } from 'lucide-react'

export default function ChatInput({ input, setInput, isListening, onToggleListen, onSend, disabled }) {
  const handleSend = () => {
    if (!input.trim() || disabled) return
    onSend(input.trim())
    setInput('')
  }

  return (
    <div style={{
      padding: '16px 24px',
      borderTop: '1px solid #2A2A2A',
      display: 'flex',
      gap: 10,
      alignItems: 'center',
      background: 'rgba(20, 20, 20, 0.8)',
      backdropFilter: 'blur(10px)',
    }}>
      <button
        onClick={onToggleListen}
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          border: '1px solid #2A2A2A',
          background: isListening ? '#FF444420' : '#1E1E1E',
          color: isListening ? '#FF4444' : '#A3A3A3',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        {isListening ? <MicOff size={18} /> : <Mic size={18} />}
      </button>
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
        placeholder={isListening ? 'Listening...' : 'Type a message...'}
        disabled={disabled}
        style={{
          flex: 1,
          background: '#141414',
          border: '1px solid #2A2A2A',
          borderRadius: 12,
          padding: '12px 16px',
          color: '#F5F5F5',
          fontSize: 14,
          outline: 'none',
        }}
      />
      <button
        onClick={handleSend}
        disabled={!input.trim() || disabled}
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          border: 'none',
          background: input.trim() && !disabled ? '#7C3AED' : '#1E1E1E',
          color: input.trim() && !disabled ? '#FFFFFF' : '#525252',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: input.trim() && !disabled ? 'pointer' : 'not-allowed',
        }}
      >
        <Send size={18} />
      </button>
    </div>
  )
}
