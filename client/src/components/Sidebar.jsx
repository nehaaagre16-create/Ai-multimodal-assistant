import { useState } from 'react'
import { Mic, MessageSquare, Eye, Settings, User, Home } from 'lucide-react'

const navItems = [
  { id: 'landing', label: 'Home', icon: Home },
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'vision', label: 'Vision', icon: Eye },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'profile', label: 'Profile', icon: User },
]

export default function Sidebar({ currentPage, onNavigate }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div
      style={{
        width: collapsed ? 60 : 220,
        height: '100vh',
        background: '#141414',
        borderRight: '1px solid #2A2A2A',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.2s ease',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          padding: '20px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          borderBottom: '1px solid #2A2A2A',
          cursor: 'pointer',
        }}
        onClick={() => setCollapsed(!collapsed)}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: '#00D4FF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Mic size={18} color="#0A0A0A" />
        </div>
        {!collapsed && (
          <span style={{ fontSize: 16, fontWeight: 600, color: '#F5F5F5' }}>
            AI Assistant
          </span>
        )}
      </div>

      <nav style={{ padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
        {navItems.map((item) => {
          const Icon = item.icon
          const active = currentPage === item.id || (item.id === 'landing' && currentPage === '')
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 12px',
                borderRadius: 8,
                border: 'none',
                background: active ? '#1E1E1E' : 'transparent',
                color: active ? '#00D4FF' : '#A3A3A3',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 500,
                textAlign: 'left',
                transition: 'all 0.15s',
                width: '100%',
              }}
              onMouseEnter={(e) => {
                if (!active) e.currentTarget.style.background = '#1A1A1A'
              }}
              onMouseLeave={(e) => {
                if (!active) e.currentTarget.style.background = 'transparent'
              }}
            >
              <Icon size={20} />
              {!collapsed && <span>{item.label}</span>}
            </button>
          )
        })}
      </nav>

      <div
        style={{
          padding: '12px 16px',
          borderTop: '1px solid #2A2A2A',
          fontSize: 12,
          color: '#737373',
          textAlign: collapsed ? 'center' : 'left',
        }}
      >
        {collapsed ? 'v1' : 'v1.0.0'}
      </div>
    </div>
  )
}
