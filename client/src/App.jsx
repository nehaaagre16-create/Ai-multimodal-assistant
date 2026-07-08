import { useState, useEffect, useRef } from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { io } from 'socket.io-client'
import API_BASE from './config/api'
import Layout from './components/Layout'
import LeftSidebar from './components/LeftSidebar'
import RightSidebar from './components/RightSidebar'
import WhiteboardModal from './components/WhiteboardModal'
import LandingPage from './pages/LandingPage'
import ChatPage from './pages/ChatPage'
import VisionPage from './pages/VisionPage'
import SettingsPage from './pages/SettingsPage'
import ProfilePage from './pages/ProfilePage'
import HistoryPage from './pages/HistoryPage'
import FilesPage from './pages/FilesPage'
import { getConversation, createConversation } from './services/conversationStorage'

const socket = io(API_BASE)

function App() {
  const [messages, setMessages] = useState([])
  const [currentConversationId, setCurrentConversationId] = useState(null)
  const [isAiResponding, setIsAiResponding] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isVideoListening, setIsVideoListening] = useState(false)
  const [currentPage, setCurrentPage] = useState('landing')
  const [cameraOn, setCameraOn] = useState(false)
  const [avatarPreset, setAvatarPreset] = useState('nexus')
  const [latency, setLatency] = useState(0)
  const [whiteboardOpen, setWhiteboardOpen] = useState(false)
  const [pendingAttachments, setPendingAttachments] = useState([])
  const aiResponseTimeoutRef = useRef(null)
  const pendingResponseRef = useRef(false)
  const messagesRef = useRef(messages)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => {
    const path = location.pathname.replace('/', '') || 'landing'
    setCurrentPage(path)
  }, [location])

  // Restore conversation from URL query param when on /chat
  useEffect(() => {
    if (location.pathname !== '/chat') return
    const params = new URLSearchParams(location.search)
    const conversationId = params.get('conversation')
    if (conversationId) {
      loadConversation(conversationId)
    } else {
      // Starting a fresh chat
      setCurrentConversationId(null)
      setMessages([])
    }
  }, [location.pathname, location.search])

  const loadConversation = async (id) => {
    try {
      const { conversation, messages } = await getConversation(id)
      setCurrentConversationId(conversation.id)
      setMessages(messages.map(m => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
        attachments: m.attachments || []
      })))
    } catch (err) {
      console.error('Failed to load conversation:', err)
      setCurrentConversationId(null)
      setMessages([])
    }
  }

  useEffect(() => {
    socket.on('ai-start', () => {
      pendingResponseRef.current = true
      setIsAiResponding(true)
      setMessages(prev => {
        const last = prev[prev.length - 1]
        if (last && last.role === 'assistant' && last.content === '') return prev
        return [...prev, { role: 'assistant', content: '', timestamp: Date.now() }]
      })
      clearTimeout(aiResponseTimeoutRef.current)
      aiResponseTimeoutRef.current = setTimeout(() => {
        pendingResponseRef.current = false
        setIsAiResponding(false)
      }, 15000)
    })
    socket.on('ai-chunk', (chunk) => {
      setMessages(prev => {
        const last = prev[prev.length - 1]
        if (last && last.role === 'assistant') {
          const updated = [...prev]
          updated[updated.length - 1] = { ...last, content: last.content + chunk }
          return updated
        }
        return [...prev, { role: 'assistant', content: chunk, timestamp: Date.now() }]
      })
    })
    socket.on('ai-end', () => {
      pendingResponseRef.current = false
      clearTimeout(aiResponseTimeoutRef.current)
      setIsAiResponding(false)
    })
    socket.on('ai-error', (err) => {
      pendingResponseRef.current = false
      clearTimeout(aiResponseTimeoutRef.current)
      setIsAiResponding(false)
      setMessages(prev => {
        // Remove any trailing empty assistant bubble before showing the error.
        const cleaned = prev.length > 0 && prev[prev.length - 1].role === 'assistant' && prev[prev.length - 1].content === ''
          ? prev.slice(0, -1)
          : prev
        const friendly = typeof err === 'string' && err.toLowerCase().includes('image')
          ? err
          : typeof err === 'string'
            ? `Something went wrong: ${err}`
            : 'Something went wrong. Please try again.';
        return [...cleaned, { role: 'assistant', content: friendly, timestamp: Date.now() }]
      })
    })
    socket.on('conversation-created', ({ id }) => {
      setCurrentConversationId(id)
    })
    return () => {
      socket.off('ai-start')
      socket.off('ai-chunk')
      socket.off('ai-end')
      socket.off('ai-error')
      socket.off('conversation-created')
      clearTimeout(aiResponseTimeoutRef.current)
    }
  }, [])

  const handleSend = (payload) => {
    const text = (typeof payload === 'string' ? payload : payload.text) || ''
    const attachments = typeof payload === 'string' ? [] : payload.attachments || []
    if ((!text.trim() && attachments.length === 0) || isAiResponding) return
    const userMsg = { role: 'user', content: text, timestamp: Date.now(), attachments }
    setMessages(prev => [...prev, userMsg])
    socket.emit('chat-message', {
      message: text,
      history: messagesRef.current.filter(m => m.role === 'user' || m.role === 'assistant').slice(-10),
      attachments,
      conversationId: currentConversationId
    })
  }

  const clearChat = () => {
    setCurrentConversationId(null)
    setMessages([])
  }

  const handleNavigate = (path) => {
    navigate(path)
  }

  const handleNewChat = () => {
    clearChat()
    navigate('/chat')
  }

  const handleWhiteboardSend = async (file) => {
    navigate('/chat')
    const attachment = await uploadAndBuildAttachment(file)
    if (attachment) {
      setPendingAttachments(prev => [...prev, attachment])
    }
  }

  const uploadAndBuildAttachment = async (file) => {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`${API_BASE}/api/upload`, {
      method: 'POST',
      body: form
    })
    if (!res.ok) return null
    const data = await res.json()
    return {
      filename: data.filename || `${Date.now()}_${file.name}`,
      original_name: data.original_name || file.name,
      type: file.type || 'image/png',
      size: file.size
    }
  }

  const uploadAttachment = async (file) => {
    const info = await uploadAndBuildAttachment(file)
    if (!info) throw new Error('Upload failed')
    return {
      ...info,
      url: `${API_BASE}/uploads/${info.filename}`
    }
  }

  const captureScreenshot = async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      console.warn('Screen capture not supported in this browser.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'never' },
        audio: false,
      })
      const video = document.createElement('video')
      video.srcObject = stream
      video.playsInline = true
      await new Promise((resolve, reject) => {
        video.onloadedmetadata = () => resolve()
        video.onerror = reject
        video.play().catch(reject)
      })

      const track = stream.getVideoTracks()[0]
      const settings = track.getSettings()
      const width = settings.width || video.videoWidth
      const height = settings.height || video.videoHeight

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(video, 0, 0, width, height)

      stream.getTracks().forEach(t => t.stop())

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
      if (!blob) throw new Error('Canvas toBlob failed')
      const file = new File([blob], `screenshot_${Date.now()}.png`, { type: 'image/png' })
      const attachment = await uploadAndBuildAttachment(file)
      if (attachment) {
        setPendingAttachments(prev => [...prev, attachment])
      }
    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'AbortError') return
      console.error('Screenshot capture failed:', err)
    }
  }

  return (
    <>
      <Layout
        leftSidebar={
          <LeftSidebar
            currentPage={currentPage}
            onNavigate={handleNavigate}
            onNewChat={handleNewChat}
          />
        }
        rightSidebar={
          <RightSidebar
            isAiResponding={isAiResponding}
            isSpeaking={isSpeaking}
            isListening={isListening || isVideoListening}
            cameraOn={cameraOn}
            latency={latency}
            onWhiteboard={() => setWhiteboardOpen(true)}
            onScreenshot={captureScreenshot}
          />
        }
      >
        <Routes>
          <Route path="/" element={<LandingPage onStartChat={() => navigate('/chat')} />} />
          <Route path="/chat" element={
            <ChatPage
              messages={messages}
              isAiResponding={isAiResponding}
              onSend={handleSend}
              onClear={clearChat}
              cameraOn={cameraOn}
              onCameraToggle={setCameraOn}
              isSpeaking={isSpeaking}
              setIsSpeaking={setIsSpeaking}
              isListening={isListening}
              setIsListening={setIsListening}
              isVideoListening={isVideoListening}
              setIsVideoListening={setIsVideoListening}
              avatarPreset={avatarPreset}
              onAvatarChange={setAvatarPreset}
              latency={latency}
              setLatency={setLatency}
              pendingAttachments={pendingAttachments}
              onAttachmentsConsumed={() => setPendingAttachments([])}
            />
          } />
          <Route path="/vision" element={<VisionPage cameraOn={cameraOn} onCameraToggle={setCameraOn} />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/files" element={<FilesPage />} />
        </Routes>
      </Layout>
      <WhiteboardModal isOpen={whiteboardOpen} onClose={() => setWhiteboardOpen(false)} onSend={handleWhiteboardSend} />
    </>
  )
}

export default App
