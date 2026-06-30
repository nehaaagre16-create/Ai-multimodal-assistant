import { useState, useEffect, useCallback, useRef } from 'react'
import { Bot, User, Trash2 } from 'lucide-react'
import ConversationHeader from '../components/ConversationHeader'
import UserPanel from '../components/UserPanel'
import AIPanel from '../components/AIPanel'
import ChatInput from '../components/ChatInput'
import MessageActions from '../components/MessageActions'
import MessageContent from '../components/MessageContent'
import StatusBar from '../components/StatusBar'

export default function ChatPage({ messages, isAiResponding, onSend, onClear, cameraOn, onCameraToggle, isSpeaking, setIsSpeaking, isListening, setIsListening, avatarPreset, onAvatarChange }) {
  const [input, setInput] = useState('')
  const [autoTTS, setAutoTTS] = useState(false)
  const [voice, setVoice] = useState('default')
  const [voiceSpeed, setVoiceSpeed] = useState(1)
  const [voicePitch, setVoicePitch] = useState(1)
  const [avatarState, setAvatarState] = useState('idle')
  const [latency, setLatency] = useState(0)
  const messagesEndRef = useRef(null)
  const messagesContainerRef = useRef(null)
  const prevMessagesLen = useRef(0)
  const recognitionRef = useRef(null)
  const synthRef = useRef(window.speechSynthesis)
  const lastAiMessageRef = useRef('')

  const speakText = useCallback((text) => {
    if (!text || !synthRef.current) return
    synthRef.current.cancel()
    const utter = new SpeechSynthesisUtterance(text)
    utter.rate = voiceSpeed
    utter.pitch = voicePitch

    const currentVoice = voice
    const voices = synthRef.current.getVoices()
    if (currentVoice === 'male') {
      const maleVoice = voices.find(v => v.name.toLowerCase().includes('male') || v.gender === 'male')
        || voices.find(v => v.name.toLowerCase().includes('david') || v.name.toLowerCase().includes('mark') || v.name.toLowerCase().includes('james'))
      if (maleVoice) utter.voice = maleVoice
    } else if (currentVoice === 'female') {
      const femaleVoice = voices.find(v => v.name.toLowerCase().includes('female') || v.gender === 'female')
        || voices.find(v => v.name.toLowerCase().includes('zira') || v.name.toLowerCase().includes('jenny') || v.name.toLowerCase().includes('linda'))
      if (femaleVoice) utter.voice = femaleVoice
    }

    utter.onstart = () => setIsSpeaking(true)
    utter.onend = () => setIsSpeaking(false)
    synthRef.current.speak(utter)
  }, [voice, setIsSpeaking, voiceSpeed, voicePitch])

  useEffect(() => {
    fetch('http://localhost:4001/api/settings')
      .then(r => r.json())
      .then(data => {
        if (data.autoTTS === 'true') setAutoTTS(true)
        if (data.voice) setVoice(data.voice)
        if (data.voiceSpeed) setVoiceSpeed(parseFloat(data.voiceSpeed))
        if (data.voicePitch) setVoicePitch(parseFloat(data.voicePitch))
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!autoTTS || isAiResponding) return
    const lastMsg = messages.filter(m => m.role === 'assistant').pop()
    if (lastMsg && lastMsg.content && lastMsg.content !== lastAiMessageRef.current) {
      lastAiMessageRef.current = lastMsg.content
      speakText(lastMsg.content)
    }
  }, [messages, isAiResponding, autoTTS, voice, speakText])

  useEffect(() => {
    if (isSpeaking) setAvatarState('speaking')
    else if (isListening) setAvatarState('listening')
    else if (isAiResponding) setAvatarState('thinking')
    else setAvatarState('idle')
  }, [isSpeaking, isListening, isAiResponding])

  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container) return
    const justLoaded = prevMessagesLen.current === 0 && messages.length > 0
    const gotNewMessage = messages.length > prevMessagesLen.current
    if (gotNewMessage && !justLoaded) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' })
    }
    prevMessagesLen.current = messages.length
  }, [messages])

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

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })

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

  const stopSpeaking = () => {
    synthRef.current?.cancel()
    setIsSpeaking(false)
  }

  const handleSend = (text) => {
    if (!text || isAiResponding) return
    const start = performance.now()
    onSend(text)
    setTimeout(() => setLatency(Math.round(performance.now() - start)), 100)
  }

  const formatTime = (ts) => {
    if (!ts) return ''
    const d = new Date(ts * 1000 || ts)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <ConversationHeader
        isAiResponding={isAiResponding}
        isSpeaking={isSpeaking}
        isListening={isListening}
        onToggleSpeak={isSpeaking ? stopSpeaking : () => {
          const lastAi = messages.filter(m => m.role === 'assistant').pop()
          if (lastAi) speakText(lastAi.content)
        }}
        onToggleMic={toggleListen}
        onEndCall={() => {
          stopSpeaking()
          if (isListening) toggleListen()
        }}
        onToggleLayout={() => {}}
      />

      <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 16, padding: 16 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <div style={{ flex: 1, display: 'flex', gap: 16 }}>
            <UserPanel isListening={isListening} onToggleMic={toggleListen} cameraOn={cameraOn} onCameraToggle={onCameraToggle} />
            <AIPanel
              avatarState={avatarState}
              avatarPreset={avatarPreset}
              onAvatarChange={onAvatarChange}
              isSpeaking={isSpeaking}
              isListening={isListening}
              isAiResponding={isAiResponding}
            />
          </div>

          <div style={{
            height: 280,
            minHeight: 280,
            borderRadius: 16,
            background: '#141414',
            border: '1px solid #2A2A2A',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '12px 16px',
              borderBottom: '1px solid #2A2A2A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Bot size={16} color="#A78BFA" />
                <span style={{ fontSize: 13, fontWeight: 600 }}>Chat</span>
              </div>
              <button onClick={onClear} style={clearBtnStyle}>
                <Trash2 size={14} />
                <span>Clear</span>
              </button>
            </div>

            <div
              ref={messagesContainerRef}
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
              }}
            >
              {messages.length === 0 && (
                <div style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#737373',
                  gap: 8,
                }}>
                  <Bot size={40} color="#2A2A2A" />
                  <p style={{ fontSize: 13 }}>Start a conversation</p>
                </div>
              )}
              {messages.map((msg, i) => (
                <div key={i} style={{
                  display: 'flex',
                  gap: 10,
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                }}>
                  {msg.role === 'assistant' && (
                    <div style={avatarStyle('#7C3AED20')}>
                      <Bot size={14} color="#A78BFA" />
                    </div>
                  )}
                  <div>
                    <div style={{
                      background: msg.role === 'user' ? '#1E1E1E' : '#1A1A2E',
                      border: '1px solid #2A2A2A',
                      borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                      padding: '10px 14px',
                      fontSize: 13,
                      lineHeight: 1.5,
                      color: '#F5F5F5',
                      wordBreak: 'break-word',
                    }}>
                      <div>{msg.role === 'assistant' ? <MessageContent content={msg.content} /> : <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>}</div>
                      <div style={{ fontSize: 10, color: '#525252', marginTop: 6, textAlign: 'right' }}>
                        {formatTime(msg.timestamp)}
                      </div>
                    </div>
                    {msg.role === 'assistant' && (
                      <MessageActions content={msg.content} onReadAloud={() => speakText(msg.content)} />
                    )}
                  </div>
                  {msg.role === 'user' && (
                    <div style={avatarStyle('#2A2A2A')}>
                      <User size={14} color="#A3A3A3" />
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <ChatInput
              input={input}
              setInput={setInput}
              isListening={isListening}
              onToggleListen={toggleListen}
              onSend={handleSend}
              disabled={isAiResponding}
            />
          </div>
        </div>
      </div>

      <StatusBar connected={true} latency={latency} mode="Voice + Text" />
    </div>
  )
}

const avatarStyle = (bg) => ({
  width: 26,
  height: 26,
  borderRadius: '50%',
  background: bg,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
})

const clearBtnStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  padding: '6px 10px',
  borderRadius: 8,
  border: '1px solid #2A2A2A',
  background: '#1E1E1E',
  color: '#A3A3A3',
  fontSize: 12,
  cursor: 'pointer',
}
