import { useState } from 'react'
import { User, Mail, Calendar, Activity } from 'lucide-react'

export default function ProfilePage() {
  const [stats] = useState({
    messagesSent: 0,
    voiceUsed: 0,
    joinedDate: new Date().toLocaleDateString(),
  })

  return (
    <div style={{ padding: '32px 40px', maxWidth: 600, overflowY: 'auto', height: '100vh' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 24px' }}>Profile</h1>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: 24,
        background: '#141414',
        borderRadius: 16,
        border: '1px solid #2A2A2A',
        marginBottom: 24,
      }}>
        <div style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          background: '#00D4FF20',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <User size={28} color="#00D4FF" />
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>User</div>
          <div style={{ fontSize: 14, color: '#737373', display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <Mail size={14} />
            user@localhost
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <StatCard icon={Activity} label="Messages" value={stats.messagesSent} />
        <StatCard icon={Activity} label="Voice Used" value={stats.voiceUsed} />
        <StatCard icon={Calendar} label="Joined" value={stats.joinedDate} />
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value }) {
  return (
    <div style={{
      padding: 20,
      background: '#141414',
      borderRadius: 12,
      border: '1px solid #2A2A2A',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      <Icon size={18} color="#00D4FF" />
      <div style={{ fontSize: 20, fontWeight: 700 }}>{value}</div>
      <div style={{ fontSize: 12, color: '#737373' }}>{label}</div>
    </div>
  )
}
