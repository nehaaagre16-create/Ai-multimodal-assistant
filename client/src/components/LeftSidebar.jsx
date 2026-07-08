import { Home, MessageSquare, Clock, Brain, FileText, Settings, Plus } from 'lucide-react'

const navItems = [
  { id: 'home', label: 'Home', icon: Home, path: '/' },
  { id: 'chat', label: 'Chat', icon: MessageSquare, path: '/chat' },
  { id: 'history', label: 'History', icon: Clock, path: '/history' },
  { id: 'files', label: 'Files', icon: FileText, path: '/files' },
  { id: 'settings', label: 'Settings', icon: Settings, path: '/settings' },
]

export default function LeftSidebar({ currentPage, onNavigate, onNewChat }) {
  return (
    <div style={{
      width: 260,
      minWidth: 260,
      height: '100vh',
      background: 'rgba(10, 10, 10, 0.75)',
      backdropFilter: 'blur(12px)',
      borderRight: '1px solid rgba(42, 42, 42, 0.8)',
      display: 'flex',
      flexDirection: 'column',
      padding: '20px 16px',
      zIndex: 10,
    }}>
      {/* Logo */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 24,
        padding: '0 8px',
      }}>
        <div style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          background: 'linear-gradient(135deg, #7C3AED 0%, #00D4FF 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Brain size={18} color="#0A0A0A" />
        </div>
        <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.5 }}>Nexus AI</span>
      </div>

      {/* New Chat Button */}
      <button
        onClick={onNewChat}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          width: '100%',
          padding: '12px 16px',
          borderRadius: 12,
          border: '1px solid #2A2A2A',
          background: '#7C3AED20',
          color: '#A78BFA',
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
          marginBottom: 20,
          transition: 'all 0.15s',
        }}
      >
        <Plus size={18} />
        New Chat
      </button>

      {/* Navigation */}
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {navItems.map(item => {
          const Icon = item.icon
          const active = currentPage === item.id || (item.id === 'home' && currentPage === 'landing')
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.path)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                width: '100%',
                padding: '10px 12px',
                borderRadius: 10,
                border: 'none',
                background: active ? '#7C3AED30' : 'transparent',
                color: active ? '#A78BFA' : '#A3A3A3',
                fontSize: 14,
                fontWeight: active ? 600 : 500,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s',
              }}
            >
              <Icon size={18} />
              {item.label}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
