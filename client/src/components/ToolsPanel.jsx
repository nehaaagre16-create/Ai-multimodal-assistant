import { Monitor, PenTool } from 'lucide-react'

export default function ToolsPanel({ onScreenshot, onWhiteboard }) {
  const tools = [
    { id: 'screenshot', label: 'Screenshot', icon: Monitor, onClick: onScreenshot },
    { id: 'whiteboard', label: 'Whiteboard', icon: PenTool, onClick: onWhiteboard },
  ]

  return (
    <div style={{
      padding: 16,
      borderRadius: 12,
      background: '#141414',
      border: '1px solid #2A2A2A',
      marginBottom: 24
    }}>
      <div style={{ fontSize: 12, color: '#737373', marginBottom: 12 }}>
        Tools
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {tools.map(tool => {
          const Icon = tool.icon
          return (
            <button
              key={tool.id}
              onClick={tool.onClick}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 8,
                border: '1px solid #2A2A2A', background: '#1E1E1E',
                color: '#A3A3A3', fontSize: 13, cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              <Icon size={16} />
              {tool.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
