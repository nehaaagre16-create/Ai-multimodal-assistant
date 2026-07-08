import { useState, useEffect } from 'react'
import { Mic, Eye, Brain, Zap, Activity, Wifi } from 'lucide-react'
import ToolsPanel from './ToolsPanel'
import API_BASE from '../config/api';

export default function RightSidebar({ isAiResponding, isListening, isSpeaking, latency = 0, cameraOn = false, onWhiteboard, onScreenshot }) {
  const [stats, setStats] = useState({ messages: 0, conversations: 0 })

  useEffect(() => {
    fetch(`${API_BASE}/api/messages`)
      .then(r => r.json())
      .then(data => setStats(prev => ({ ...prev, messages: data.length })))
      .catch(() => {})
  }, [])

  const statusItems = [
    { label: 'Voice', icon: Mic, active: isListening || isSpeaking, color: '#00D4FF' },
    { label: 'Vision', icon: Eye, active: cameraOn, color: '#A78BFA' },
    { label: 'Memory', icon: Brain, active: true, color: '#00FF88' },
    { label: 'Response', icon: Zap, active: isAiResponding, color: '#FFC800' },
  ]

  return (
    <div style={{
      width: 280,
      minWidth: 280,
      height: '100vh',
      background: 'rgba(10, 10, 10, 0.75)',
      backdropFilter: 'blur(12px)',
      borderLeft: '1px solid rgba(42, 42, 42, 0.8)',
      display: 'flex',
      flexDirection: 'column',
      padding: '20px 16px',
      zIndex: 10,
    }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#F5F5F5', marginBottom: 20 }}>
        Assistant Status
      </div>

      {/* Status Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
        {statusItems.map(item => {
          const Icon = item.icon
          return (
            <div key={item.label} style={{
              padding: 14,
              borderRadius: 12,
              background: '#141414',
              border: '1px solid #2A2A2A',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}>
              <div style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: item.active ? `${item.color}20` : '#1E1E1E',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Icon size={16} color={item.active ? item.color : '#737373'} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#737373' }}>{item.label}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: item.active ? item.color : '#525252' }}>
                  {item.active ? 'Active' : 'Idle'}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <ToolsPanel
        onScreenshot={onScreenshot}
        onWhiteboard={onWhiteboard}
      />

      {/* Current Mode */}
      <div style={{
        padding: 16,
        borderRadius: 12,
        background: '#141414',
        border: '1px solid #2A2A2A',
        marginBottom: 24,
      }}>
        <div style={{ fontSize: 12, color: '#737373', marginBottom: 8 }}>Current Mode</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Wifi size={16} color="#00FF88" />
          <span style={{ fontSize: 14, fontWeight: 600, color: '#00FF88' }}>Voice + Text</span>
        </div>
      </div>

      {/* Quick Stats */}
      <div style={{
        padding: 16,
        borderRadius: 12,
        background: '#141414',
        border: '1px solid #2A2A2A',
        marginBottom: 24,
      }}>
        <div style={{ fontSize: 12, color: '#737373', marginBottom: 12 }}>Session Stats</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 13, color: '#A3A3A3' }}>Messages</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#F5F5F5' }}>{stats.messages}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 13, color: '#A3A3A3' }}>Latency</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: latency < 200 ? '#00FF88' : '#FFC800' }}>
            {latency}ms
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, color: '#A3A3A3' }}>Network</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#00FF88', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Activity size={12} /> Stable
          </span>
        </div>
      </div>

      {/* Activity Log */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <div style={{ fontSize: 12, color: '#737373', marginBottom: 12 }}>Live Activity</div>
        <div style={{
          padding: 12,
          borderRadius: 10,
          background: '#141414',
          border: '1px solid #2A2A2A',
          fontSize: 12,
          color: '#A3A3A3',
          lineHeight: 1.5,
        }}>
          {isAiResponding ? 'AI is generating a response...' :
           isListening ? 'Listening for voice input...' :
           isSpeaking ? 'Speaking response...' :
           'Waiting for input'}
        </div>
      </div>
    </div>
  )
}
