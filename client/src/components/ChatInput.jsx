import { Send, Mic, Activity, Paperclip, X } from 'lucide-react'
import { useRef } from 'react'

export default function ChatInput({ input, setInput, isListening, onToggleListen, onSend, disabled, interimText = '', onAttach, pendingFiles = [], setPendingFiles }) {
  const fileInputRef = useRef(null)

  const safeSetPendingFiles = (updater) => {
    if (typeof setPendingFiles === 'function') setPendingFiles(updater)
  }

  const handleSend = () => {
    const text = (input || '').trim()
    if ((!text && pendingFiles.length === 0) || disabled) return
    onSend({ text, attachments: pendingFiles })
    setInput('')
    safeSetPendingFiles([])
  }

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length || typeof onAttach !== 'function') return
    for (const file of files) {
      try {
        const info = await onAttach(file)
        if (info) safeSetPendingFiles(prev => [...(Array.isArray(prev) ? prev : []), info])
      } catch (err) {
        console.error('Upload failed', err)
      }
    }
    e.target.value = ''
  }

  const removeFile = (idx) => {
    safeSetPendingFiles(prev => (Array.isArray(prev) ? prev : []).filter((_, i) => i !== idx))
  }

  return (
    <div style={{
      padding: '16px 24px',
      borderTop: '1px solid #2A2A2A',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      background: 'rgba(20, 20, 20, 0.8)',
      backdropFilter: 'blur(10px)',
    }}>
      {pendingFiles.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
          {pendingFiles.map((f, idx) => (
            <div key={idx} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 10px', borderRadius: 8,
              background: '#1E1E1E', border: '1px solid #2A2A2A',
              fontSize: 12, color: '#A3A3A3'
            }}>
              <span>{f.original_name}</span>
              <button onClick={() => removeFile(idx)} style={{ background: 'none', border: 'none', color: '#737373', cursor: 'pointer', padding: 0, display: 'flex' }}>
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button
          onClick={onToggleListen}
          title={isListening ? 'Voice chat on' : 'Voice chat off'}
          aria-label={isListening ? 'Stop chat microphone' : 'Start chat microphone'}
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            border: '1px solid #2A2A2A',
            background: isListening ? '#00FF8820' : '#1E1E1E',
            color: isListening ? '#00FF88' : '#A3A3A3',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <Mic size={18} />
        </button>
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            type="text"
            value={isListening && interimText ? interimText : input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={isListening ? 'Listening...' : 'Type a message...'}
            disabled={disabled}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              background: '#141414',
              border: '1px solid #2A2A2A',
              borderRadius: 12,
              padding: '12px 16px',
              color: isListening && interimText ? '#00FF88' : '#F5F5F5',
              fontSize: 14,
              outline: 'none',
            }}
          />
          {isListening && (
            <Activity size={14} color="#00FF88" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', animation: 'pulse 1s infinite' }} />
          )}
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          title="Attach file"
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            border: '1px solid #2A2A2A',
            background: '#1E1E1E',
            color: '#A3A3A3',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <Paperclip size={18} />
        </button>
        <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={handleFileChange} />
        <button
          onClick={handleSend}
          disabled={(!input.trim() && pendingFiles.length === 0) || disabled}
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            border: 'none',
            background: (input.trim() || pendingFiles.length > 0) && !disabled ? '#7C3AED' : '#1E1E1E',
            color: (input.trim() || pendingFiles.length > 0) && !disabled ? '#FFFFFF' : '#525252',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: (input.trim() || pendingFiles.length > 0) && !disabled ? 'pointer' : 'not-allowed',
          }}
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  )
}
