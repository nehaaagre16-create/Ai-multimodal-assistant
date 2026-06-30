import { useState, useEffect } from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { io } from 'socket.io-client'
import Layout from './components/Layout'
import LeftSidebar from './components/LeftSidebar'
import RightSidebar from './components/RightSidebar'
import LandingPage from './pages/LandingPage'
import ChatPage from './pages/ChatPage'
import VisionPage from './pages/VisionPage'
import SettingsPage from './pages/SettingsPage'
import ProfilePage from './pages/ProfilePage'
import HistoryPage from './pages/HistoryPage'
import MemoryPage from './pages/MemoryPage'
import FilesPage from './pages/FilesPage'

const socket = io('http://localhost:4001')

function App() {
  const [messages, setMessages] = useState([])
  const [isAiResponding, setIsAiResponding] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [currentPage, setCurrentPage] = useState('landing')
  const [cameraOn, setCameraOn] = useState(false)
  const [avatarPreset, setAvatarPreset] = useState('nexus')
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    const path = location.pathname.replace('/', '') || 'landing'
    setCurrentPage(path)
  }, [location])

  useEffect(() => {
    fetch('http://localhost:4001/api/messages')
      .then(r => r.json())
      .then(data => setMessages(data.map(m => ({ role: m.role, content: m.content, timestamp: m.timestamp }))))
      .catch(() => {})
  }, [])

  useEffect(() => {
    socket.on('ai-start', () => setIsAiResponding(true))
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
    socket.on('ai-end', () => setIsAiResponding(false))
    socket.on('ai-error', (err) => {
      setIsAiResponding(false)
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error: ' + err, timestamp: Date.now() }])
    })
    return () => {
      socket.off('ai-start')
      socket.off('ai-chunk')
      socket.off('ai-end')
      socket.off('ai-error')
    }
  }, [])

  const sendMessage = (text) => {
    const userMsg = { role: 'user', content: text, timestamp: Date.now() }
    setMessages(prev => [...prev, userMsg])
    socket.emit('chat-message', {
      message: text,
      history: messages.filter(m => m.role === 'user' || m.role === 'assistant').slice(-10)
    })
  }

  const clearChat = () => {
    fetch('http://localhost:4001/api/messages', { method: 'DELETE' })
      .then(() => setMessages([]))
      .catch(() => setMessages([]))
  }

  const handleNavigate = (path) => {
    navigate(path)
  }

  const handleNewChat = () => {
    clearChat()
    navigate('/chat')
  }

  return (
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
          isListening={isListening}
          cameraOn={cameraOn}
        />
      }
    >
      <Routes>
        <Route path="/" element={<LandingPage onStartChat={() => navigate('/chat')} />} />
        <Route path="/chat" element={
          <ChatPage
            messages={messages}
            isAiResponding={isAiResponding}
            onSend={sendMessage}
            onClear={clearChat}
            cameraOn={cameraOn}
            onCameraToggle={setCameraOn}
            isSpeaking={isSpeaking}
            setIsSpeaking={setIsSpeaking}
            isListening={isListening}
            setIsListening={setIsListening}
            avatarPreset={avatarPreset}
            onAvatarChange={setAvatarPreset}
          />
        } />
        <Route path="/vision" element={<VisionPage cameraOn={cameraOn} onCameraToggle={setCameraOn} />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/memory" element={<MemoryPage />} />
        <Route path="/files" element={<FilesPage />} />
      </Routes>
    </Layout>
  )
}

export default App
