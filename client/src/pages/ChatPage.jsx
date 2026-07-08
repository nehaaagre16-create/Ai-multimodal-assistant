import { useState, useEffect, useCallback, useRef } from 'react'
import { Bot, User, Trash2, FileText } from 'lucide-react'
import API_BASE from '../config/api'
import useSpeechRecognition from '../hooks/useSpeechRecognition'
import { SpeechSynthesisAdapter } from '../components/Avatar/adapters/SpeechSynthesisAdapter.js'
import ConversationHeader from '../components/ConversationHeader'
import UserPanel from '../components/UserPanel'
import AIPanel from '../components/AIPanel'
import ChatInput from '../components/ChatInput'
import MessageActions from '../components/MessageActions'
import MessageContent from '../components/MessageContent'
import StatusBar from '../components/StatusBar'

export default function ChatPage({ messages, isAiResponding, onSend, onClear, cameraOn, onCameraToggle, isSpeaking, setIsSpeaking, isListening, setIsListening, isVideoListening, setIsVideoListening, avatarPreset, onAvatarChange, pendingAttachments, onAttachmentsConsumed }) {
  const [input, setInput] = useState('')
  const [interimText, setInterimText] = useState('')
  const [autoTTS, setAutoTTS] = useState(false)
  const [voice, setVoice] = useState('default')
  const [voiceSpeed, setVoiceSpeed] = useState(1)
  const [voicePitch, setVoicePitch] = useState(1)
  const [latency, setLatency] = useState(0)
  const [pendingFiles, setPendingFiles] = useState([])
  const messagesEndRef = useRef(null)
  const messagesContainerRef = useRef(null)
  const prevMessagesLen = useRef(0)
  const synthRef = useRef(window.speechSynthesis)
  const lastAiMessageRef = useRef('')
  const lastInteractedRef = useRef(null)
  const attachmentConsumedRef = useRef(false)
  const keepVideoListeningRef = useRef(false)

  // Inject screenshot/whiteboard attachments into pending files when provided
  useEffect(() => {
    if (pendingAttachments?.length > 0 && !attachmentConsumedRef.current) {
      attachmentConsumedRef.current = true
      setPendingFiles(prev => [...(Array.isArray(prev) ? prev : []), ...pendingAttachments])
      if (typeof onAttachmentsConsumed === 'function') onAttachmentsConsumed()
    }
    if (!pendingAttachments?.length) {
      attachmentConsumedRef.current = false
    }
  }, [pendingAttachments, onAttachmentsConsumed])

  // TTS enabled for voice conversations; autoTTS setting also enables for text.
  const shouldSpeak = useCallback(() => autoTTS || isVideoListening || lastInteractedRef.current === 'voice', [autoTTS, isVideoListening])

  const speakText = useCallback((text, options = {}) => {
    if (!text) return
    synthRef.current?.cancel()
    SpeechSynthesisAdapter.speak(text, {
      voice: options.voice ?? voice,
      speed: options.speed ?? voiceSpeed,
      pitch: options.pitch ?? voicePitch,
      onStarted: () => setIsSpeaking(true),
      onFinished: () => setIsSpeaking(false),
    })
  }, [voice, setIsSpeaking, voiceSpeed, voicePitch])

  useEffect(() => {
    fetch(`${API_BASE}/api/settings`)
      .then(r => r.json())
      .then(data => {
        if (data.autoTTS === 'true') setAutoTTS(true)
        if (data.voice) setVoice(data.voice)
        if (data.voiceSpeed) setVoiceSpeed(parseFloat(data.voiceSpeed))
        if (data.voicePitch) setVoicePitch(parseFloat(data.voicePitch))
      })
      .catch(() => {})
  }, [])

  // Trigger TTS for every new assistant response when voice mode is active.
  useEffect(() => {
    if (isAiResponding) return
    const lastMsg = messages.filter(m => m.role === 'assistant').pop()
    if (lastMsg && lastMsg.content && lastMsg.content !== lastAiMessageRef.current) {
      lastAiMessageRef.current = lastMsg.content
      if (shouldSpeak()) {
        speakText(lastMsg.content)
      }
    }
  }, [messages, isAiResponding, shouldSpeak, speakText])

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

  // Exclusive mic lock — only one of chat-mic or video-mic can hold it.
  const micOwnerRef = useRef(null)
  const acquireMicLock = useCallback((owner) => {
    if (micOwnerRef.current && micOwnerRef.current !== owner) return false
    micOwnerRef.current = owner
    return true
  }, [])
  const releaseMicLock = useCallback((owner) => {
    if (micOwnerRef.current === owner) micOwnerRef.current = null
  }, [])

  const handleChatFinal = useCallback((text) => {
    setInput(prev => {
      const combined = (prev + ' ' + text).trim()
      return combined
    })
    setInterimText('')
    lastInteractedRef.current = 'voice'
  }, [])

  const handleChatInterim = useCallback((text) => {
    setInterimText(text)
  }, [])

  const handleVideoFinal = useCallback((text) => {
    if (!text.trim() || isAiResponding) return
    lastInteractedRef.current = 'voice'
    onSend({ text: text.trim(), attachments: [] })
  }, [isAiResponding, onSend])

  const chatMic = useSpeechRecognition({
    mode: 'dictation',
    onFinal: handleChatFinal,
    onInterim: handleChatInterim,
    onError: (e) => console.error('[chat-mic]', e),
    onStateChange: (active) => {
      if (!active && micOwnerRef.current === 'chat') releaseMicLock('chat')
      setIsListening(active)
    },
    acquireLock: () => acquireMicLock('chat'),
    releaseLock: () => releaseMicLock('chat'),
  })

  const videoMic = useSpeechRecognition({
    mode: 'continuous',
    silenceTimeoutMs: 1200,
    onFinal: handleVideoFinal,
    onInterim: () => {},
    onError: (e) => console.error('[video-mic]', e),
    onStateChange: (active) => {
      if (!active && micOwnerRef.current === 'video') releaseMicLock('video')
      keepVideoListeningRef.current = active
      setIsVideoListening(active)
    },
    acquireLock: () => acquireMicLock('video'),
    releaseLock: () => releaseMicLock('video'),
  })

  const toggleChatMic = useCallback(() => {
    if (isVideoListening) {
      videoMic.stop()
      releaseMicLock('video')
      setIsVideoListening(false)
      keepVideoListeningRef.current = false
    }
    chatMic.toggle()
  }, [chatMic, videoMic, isVideoListening, setIsVideoListening, releaseMicLock])

  const toggleVideoMic = useCallback(() => {
    if (isListening) {
      chatMic.stop()
      releaseMicLock('chat')
      setIsListening(false)
      setInterimText('')
    }
    videoMic.toggle()
  }, [chatMic, videoMic, isListening, setIsListening, releaseMicLock])

  // Continuous voice: restart video mic after AI finishes speaking.
  useEffect(() => {
    if (!keepVideoListeningRef.current) return
    if (isSpeaking || isAiResponding) return
    videoMic.start()
  }, [isSpeaking, isAiResponding, videoMic])

  const stopSpeaking = useCallback(() => {
    synthRef.current?.cancel()
    setIsSpeaking(false)
  }, [setIsSpeaking])

  const handleSend = useCallback((payload) => {
    const text = ((typeof payload === 'string' ? payload : payload.text) || '').trim()
    const attachments = typeof payload === 'string' ? [] : (payload.attachments || [])
    if ((!text && attachments.length === 0) || isAiResponding) return
    lastInteractedRef.current = 'text'
    const start = performance.now()
    onSend({ text, attachments })
    setInput('')
    setInterimText('')
    setPendingFiles([])
    setTimeout(() => setLatency(Math.round(performance.now() - start)), 100)
  }, [isAiResponding, onSend])

  const uploadAttachment = useCallback(async (file) => {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`${API_BASE}/api/upload`, {
      method: 'POST',
      body: form
    })
    if (!res.ok) throw new Error('Upload failed')
    const data = await res.json()
    return {
      filename: data.filename || `${Date.now()}_${file.name}`,
      original_name: data.original_name || file.name,
      type: file.type,
      size: file.size,
      url: `${API_BASE}/uploads/${data.filename || `${Date.now()}_${file.name}`}`
    }
  }, [])

  const formatTime = useCallback((ts) => {
    if (!ts) return ''
    const d = new Date(ts * 1000 || ts)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }, [])

  const hasImageAttachments = useCallback((attachments) => {
    return Array.isArray(attachments) && attachments.some(a =>
      (a.type || '').startsWith('image/') || /\.(png|jpg|jpeg|gif|webp|bmp|svg)$/i.test(a.original_name || a.filename)
    )
  }, [])

  const lastUserWithImages = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i]
      if (m.role === 'user' && hasImageAttachments(m.attachments)) return m
    }
    return null
  })()

  const lastUserWithImagesIndex = lastUserWithImages ? messages.indexOf(lastUserWithImages) : -1

  const avatarState = (() => {
    if (isSpeaking) return 'speaking'
    if (isListening || isVideoListening) return 'listening'
    if (isAiResponding) return 'thinking'
    return 'idle'
  })()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <ConversationHeader
        isAiResponding={isAiResponding}
        isSpeaking={isSpeaking}
        isListening={isListening || isVideoListening}
        onToggleSpeak={isSpeaking ? stopSpeaking : () => {
          const lastAi = messages.filter(m => m.role === 'assistant').pop()
          if (lastAi) speakText(lastAi.content)
        }}
        onToggleMic={toggleChatMic}
        onEndCall={() => {
          stopSpeaking()
          chatMic.stop()
          videoMic.stop()
        }}
        onToggleLayout={() => {}}
      />

      <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 16, padding: 16 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <div style={{ flex: 1, display: 'flex', gap: 16 }}>
            <UserPanel
              isListening={isListening}
              onToggleMic={toggleChatMic}
              isVideoListening={isVideoListening}
              onToggleVideoMic={toggleVideoMic}
              cameraOn={cameraOn}
              onCameraToggle={onCameraToggle}
            />
            <AIPanel
              avatarState={avatarState}
              avatarPreset={avatarPreset}
              onAvatarChange={onAvatarChange}
              isSpeaking={isSpeaking}
              isListening={isListening || isVideoListening}
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
              {messages.map((msg, i) => {
                const isAwaitingVisionResponse = msg.role === 'assistant' && isAiResponding && msg.content === '' && lastUserWithImages && i > lastUserWithImagesIndex
                return (
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
                      <div>
                        {msg.role === 'assistant' ? (
                          isAwaitingVisionResponse ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#A78BFA' }}>
                              <span className="vision-pulse" style={{ width: 8, height: 8, borderRadius: '50%', background: '#A78BFA', display: 'inline-block' }} />
                              Analyzing image...
                            </div>
                          ) : (
                            <MessageContent content={msg.content} />
                          )
                        ) : (
                          <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                        )}
                        {Array.isArray(msg.attachments) && msg.attachments.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                            {msg.attachments.map((a, idx) => (
                              a.type?.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp|bmp|svg)$/i.test(a.original_name || a.filename) ? (
                                <img
                                  key={idx}
                                  src={`${API_BASE}/uploads/${a.filename}`}
                                  alt={a.original_name}
                                  style={{
                                    maxWidth: 220,
                                    maxHeight: 160,
                                    borderRadius: 8,
                                    border: '1px solid #2A2A2A',
                                    display: 'block'
                                  }}
                                />
                              ) : (
                                <a
                                  key={idx}
                                  href={`${API_BASE}/uploads/${a.filename}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 6,
                                    padding: '6px 10px', borderRadius: 8,
                                    background: '#0A0A0A', border: '1px solid #2A2A2A',
                                    fontSize: 12, color: '#A3A3A3', textDecoration: 'none'
                                  }}
                                >
                                  <FileText size={12} />
                                  <span style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.original_name}</span>
                                </a>
                              )
                            ))}
                          </div>
                        )}
                      </div>
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
                )
              })}
              <div ref={messagesEndRef} />
            </div>

            <ChatInput
              input={input}
              setInput={setInput}
              isListening={isListening}
              onToggleListen={toggleChatMic}
              onSend={handleSend}
              disabled={isAiResponding}
              interimText={interimText}
              onAttach={uploadAttachment}
              pendingFiles={pendingFiles}
              setPendingFiles={setPendingFiles}
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
