import { useEffect, useState } from 'react'
import { ArrowRight, Zap, MessageSquare, Mic, Eye, Brain } from 'lucide-react'

export default function LandingPage({ onStartChat }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const features = [
    { icon: MessageSquare, title: 'Text Chat', desc: 'Natural conversations with GPT-3.5' },
    { icon: Mic, title: 'Voice Input', desc: 'Speak instead of typing' },
    { icon: Eye, title: 'Vision', desc: 'Object detection via webcam' },
    { icon: Brain, title: 'AI Powered', desc: 'Streaming responses in real-time' },
  ]

  return (
    <div style={{
      height: '100vh',
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 24px',
      position: 'relative',
    }}>
      {/* Glow effect */}
      <div style={{
        position: 'absolute',
        top: '20%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 400,
        height: 400,
        background: 'radial-gradient(circle, #00D4FF10 0%, transparent 70%)',
        borderRadius: '50%',
        pointerEvents: 'none',
      }} />

      <div style={{
        textAlign: 'center',
        maxWidth: 600,
        zIndex: 1,
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(20px)',
        transition: 'all 0.6s ease',
      }}>
        <div style={{
          width: 64,
          height: 64,
          borderRadius: 16,
          background: '#00D4FF20',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px',
        }}>
          <Zap size={32} color="#00D4FF" />
        </div>

        <h1 style={{
          fontSize: 40,
          fontWeight: 700,
          margin: '0 0 12px',
          letterSpacing: '-0.5px',
          background: 'linear-gradient(135deg, #F5F5F5 0%, #A3A3A3 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          AI Multimodal Assistant
        </h1>

        <p style={{
          fontSize: 16,
          color: '#A3A3A3',
          margin: '0 0 32px',
          lineHeight: 1.6,
        }}>
          Voice, vision, and intelligence — all in one interface.
          Chat with AI, speak naturally, and explore object detection.
        </p>

        <button
          onClick={onStartChat}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '14px 28px',
            borderRadius: 12,
            border: 'none',
            background: '#00D4FF',
            color: '#0A0A0A',
            fontSize: 16,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#00E5FF'
            e.currentTarget.style.transform = 'translateY(-1px)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#00D4FF'
            e.currentTarget.style.transform = 'translateY(0)'
          }}
        >
          Start Chatting
          <ArrowRight size={18} />
        </button>
      </div>

      {/* Features grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 16,
        maxWidth: 560,
        width: '100%',
        marginTop: 48,
        zIndex: 1,
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(20px)',
        transition: 'all 0.6s ease 0.2s',
      }}>
        {features.map((f, i) => {
          const Icon = f.icon
          return (
            <div key={i} style={{
              padding: 20,
              borderRadius: 12,
              background: '#141414',
              border: '1px solid #2A2A2A',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}>
              <Icon size={20} color="#00D4FF" />
              <span style={{ fontSize: 14, fontWeight: 600, color: '#F5F5F5' }}>{f.title}</span>
              <span style={{ fontSize: 13, color: '#737373' }}>{f.desc}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
