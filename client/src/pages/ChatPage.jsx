import { useState, useRef, useEffect } from 'react'
import { Send, Trash2, Mic, MicOff, Volume2, VolumeX, User, Bot } from 'lucide-react'
import Avatar from '../components/Avatar'

export default function ChatPage({ messages, isAiResponding, onSend, onClear }) {
  const [input, setInput] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [autoTTS, setAutoTTS] = useState(false)
  const [avatarState, setAvatarState] = useState('idle')
  const messagesEndRef = useRef(null)
  const recognitionRef = useRef(null)
  const synthRef = useRef(window.speechSynthesis)
  const lastAiMessageRef = useRef('')

  // Fetch settings on mount
  useEffect(() => {
    fetch('http://localhost:4001/api/settings')
      .then(r => r.json())
      .then(data => {
        if (data.autoTTS === 'true') setAutoTTS(true)
      })
      .catch(() => {})
  }, [])

  // Auto-TTS: speak when AI finishes a new message
  useEffect(() => {
    if (!autoTTS || isAiResponding) return
    const lastMsg = messages.filter(m => m.role === 'assistant').pop()
    if (lastMsg && lastMsg.content && lastMsg.content !== lastAiMessageRef.current) {
      lastAiMessageRef.current = lastMsg.content
      speakText(lastMsg.content)
    }
  }, [messages, isAiResponding, autoTTS])

  // Avatar state management
  useEffect(() => {
    if (isSpeaking) {
      setAvatarState('speaking')
    } else if (isListening) {
      setAvatarState('listening')
    } else if (isAiResponding) {
      setAvatarState('thinking')
    } else {
      setAvatarState('idle')
    }
  }, [isSpeaking, isListening, isAiResponding])

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  useEffect(() => scrollToBottom(), [messages])

  // Speech Recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      recognitionRef.current = new SpeechRecognition()
      recognitionRef.current.continuous = false
      recognitionRef.current.interimResults = false
      recognitionRef.current.lang = 'en-US'
      recognitionRef.current.onresult = (e) => {
        const transcript = e.results[0][0].transcript
        setInput(transcript)
        setIsListening(false)
      }
      recognitionRef.current.onerror = () => setIsListening(false)
      recognitionRef.current.onend = () => setIsListening(false)
    }
  }, [])

  const toggleListen = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition not supported. Use Chrome/Edge on desktop with microphone permission.')
      return
    }
    if (isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
    } else {
      try {
        recognitionRef.current.start()
        setIsListening(true)
      } catch (err) {
        alert('Mic error: ' + err.message)
        setIsListening(false)
      }
    }
  }

  const speakText = (text) => {
    if (!text || !synthRef.current) return
    synthRef.current.cancel()
    const utter = new SpeechSynthesisUtterance(text)
    utter.rate = 1
    utter.pitch = 1
    utter.onstart = () => setIsSpeaking(true)
    utter.onend = () => setIsSpeaking(false)
    synthRef.current.speak(utter)
  }

  const speakLastMessage = () => {
    const lastAi = messages.filter(m => m.role === 'assistant').pop()
    if (!lastAi) return
    speakText(lastAi.content)
  }

  const stopSpeaking = () => {
    synthRef.current?.cancel()
    setIsSpeaking(false)
  }

  const handleSend = () => {
    if (!input.trim() || isAiResponding) return
    onSend(input.trim())
    setInput('')
  }

  const formatTime = (ts) => {
    if (!ts) return ''
    const d = new Date(ts * 1000 || ts)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* Left: Chat area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid #2A2A2A',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Bot size={22} color="#00D4FF" />
            <span style={{ fontSize: 16, fontWeight: 600 }}>AI Chat</span>
            {isAiResponding && (
              <span style={{
                fontSize: 12,
                color: '#00D4FF',
                background: '#00D4FF15',
                padding: '2px 8px',
                borderRadius: 12,
              }}>
                typing...
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {isSpeaking ? (
              <button onClick={stopSpeaking} style={iconBtnStyle}>
                <VolumeX size={18} />
              </button>
            ) : (
              <button onClick={speakLastMessage} style={iconBtnStyle}>
                <Volume2 size={18} />
              </button>
            )}
            <button onClick={onClear} style={iconBtnStyle}>
              <Trash2 size={18} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}>
          {messages.length === 0 && (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#737373',
              gap: 12,
            }}>
              <Bot size={48} color="#2A2A2A" />
              <p style={{ fontSize: 14 }}>Start a conversation with the AI</p>
              <p style={{ fontSize: 12, color: '#525252' }}>Type a message or use the microphone</p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                gap: 12,
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '80%',
              }}
            >
              {msg.role === 'assistant' && (
                <div style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: '#00D4FF20',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Bot size={14} color="#00D4FF" />
                </div>
              )}
              <div style={{
                background: msg.role === 'user' ? '#1E1E1E' : '#141414',
                border: msg.role === 'user' ? '1px solid #2A2A2A' : '1px solid #2A2A2A',
                borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                padding: '12px 16px',
                fontSize: 14,
                lineHeight: 1.6,
                color: '#F5F5F5',
                wordBreak: 'break-word',
              }}>
                <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                <div style={{
                  fontSize: 11,
                  color: '#525252',
                  marginTop: 6,
                  textAlign: 'right',
                }}>
                  {formatTime(msg.timestamp)}
                </div>
              </div>
              {msg.role === 'user' && (
                <div style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: '#2A2A2A',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <User size={14} color="#A3A3A3" />
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #2A2A2A',
          display: 'flex',
          gap: 10,
          alignItems: 'center',
        }}>
          <button
            onClick={toggleListen}
            style={{
              ...iconBtnStyle,
              background: isListening ? '#FF444420' : '#1E1E1E',
              color: isListening ? '#FF4444' : '#A3A3A3',
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
            disabled={isAiResponding}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isAiResponding}
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              border: 'none',
              background: input.trim() && !isAiResponding ? '#00D4FF' : '#1E1E1E',
              color: input.trim() && !isAiResponding ? '#0A0A0A' : '#525252',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: input.trim() && !isAiResponding ? 'pointer' : 'not-allowed',
              transition: 'all 0.15s',
            }}
          >
            <Send size={18} />
          </button>
        </div>
      </div>

      {/* Right: Avatar panel */}
      <div style={{
        width: 200,
        borderLeft: '1px solid #2A2A2A',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0D0D0D',
      }}>
        <Avatar state={avatarState} />
        <div style={{
          marginTop: 8,
          fontSize: 11,
          color: '#525252',
          textAlign: 'center',
          padding: '0 16px',
        }}>
          {avatarState === 'speaking' && 'Speaking...'}
          {avatarState === 'listening' && 'Listening...'}
          {avatarState === 'thinking' && 'Thinking...'}
          {avatarState === 'idle' && 'Ready'}
        </div>
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
  transition: 'all 0.15s',
}
