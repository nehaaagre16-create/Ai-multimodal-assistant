import { Wifi, Activity, Zap } from 'lucide-react'

export default function StatusBar({ connected, latency, mode }) {
  return (
    <div style={{
      height: 36,
      minHeight: 36,
      padding: '0 24px',
      background: '#0A0A0A',
      borderTop: '1px solid #2A2A2A',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      fontSize: 12,
      color: '#737373',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: connected ? '#00FF88' : '#FF4444',
            boxShadow: connected ? '0 0 8px #00FF8860' : '0 0 8px #FF444460',
          }} />
          <span style={{ color: connected ? '#00FF88' : '#FF4444' }}>
            {connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Wifi size={14} />
          <span>Network Stable</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Zap size={14} color={latency < 200 ? '#00FF88' : '#FFC800'} />
          <span style={{ color: latency < 200 ? '#00FF88' : '#FFC800' }}>
            Latency {latency}ms
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Activity size={14} />
          <span>Mode: {mode}</span>
        </div>
      </div>
    </div>
  )
}
