import { useState, useRef, useEffect } from 'react'
import { X, Download, Eraser, Pen, Square } from 'lucide-react'

export default function WhiteboardModal({ isOpen, onClose, onSend }) {
  const canvasRef = useRef(null)
  const isDrawing = useRef(false)
  const [color, setColor] = useState('#FFFFFF')
  const [brushSize, setBrushSize] = useState(3)
  const [tool, setTool] = useState('pen') // pen | eraser

  const colors = ['#FFFFFF', '#00D4FF', '#00FF88', '#FFC800', '#A78BFA', '#FF4D4D']

  useEffect(() => {
    if (!isOpen || !canvasRef.current) return
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * 2
    canvas.height = rect.height * 2
    const ctx = canvas.getContext('2d')
    ctx.scale(2, 2)
    ctx.fillStyle = '#0A0A0A'
    ctx.fillRect(0, 0, rect.width, rect.height)
  }, [isOpen])

  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    return { x: clientX - rect.left, y: clientY - rect.top }
  }

  const startDraw = (e) => {
    isDrawing.current = true
    const ctx = canvasRef.current.getContext('2d')
    const { x, y } = getPos(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const draw = (e) => {
    if (!isDrawing.current) return
    e.preventDefault()
    const ctx = canvasRef.current.getContext('2d')
    const { x, y } = getPos(e)
    ctx.lineTo(x, y)
    ctx.strokeStyle = tool === 'eraser' ? '#0A0A0A' : color
    ctx.lineWidth = tool === 'eraser' ? brushSize * 3 : brushSize
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()
  }

  const stopDraw = () => {
    isDrawing.current = false
    const ctx = canvasRef.current.getContext('2d')
    ctx.beginPath()
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()
    ctx.fillStyle = '#0A0A0A'
    ctx.fillRect(0, 0, rect.width, rect.height)
  }

  const downloadCanvas = () => {
    const canvas = canvasRef.current
    const link = document.createElement('a')
    link.download = `whiteboard-${Date.now()}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  const sendCanvas = () => {
    const canvas = canvasRef.current
    const dataUrl = canvas.toDataURL('image/png')
    fetch(dataUrl)
      .then(r => r.blob())
      .then(blob => {
        const file = new File([blob], `whiteboard-${Date.now()}.png`, { type: 'image/png' })
        if (onSend) onSend(file)
        onClose()
      })
  }

  if (!isOpen) return null

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 24
    }}>
      <div style={{
        width: '100%', maxWidth: 900, height: '80vh',
        background: '#141414', border: '1px solid #2A2A2A',
        borderRadius: 16, display: 'flex', flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '12px 16px', borderBottom: '1px solid #2A2A2A',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#F5F5F5' }}>Whiteboard</div>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', color: '#A3A3A3', cursor: 'pointer'
          }}><X size={20} /></button>
        </div>

        {/* Toolbar */}
        <div style={{
          padding: '10px 16px', borderBottom: '1px solid #2A2A2A',
          display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap'
        }}>
          <button onClick={() => setTool('pen')} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', borderRadius: 8,
            background: tool === 'pen' ? '#1E1E1E' : 'transparent',
            border: '1px solid #2A2A2A', color: '#F5F5F5', cursor: 'pointer'
          }}><Pen size={14} /> Pen</button>

          <button onClick={() => setTool('eraser')} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', borderRadius: 8,
            background: tool === 'eraser' ? '#1E1E1E' : 'transparent',
            border: '1px solid #2A2A2A', color: '#F5F5F5', cursor: 'pointer'
          }}><Eraser size={14} /> Eraser</button>

          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {colors.map(c => (
              <button key={c} onClick={() => { setColor(c); setTool('pen') }} style={{
                width: 22, height: 22, borderRadius: 6,
                background: c, border: color === c && tool === 'pen' ? '2px solid #F5F5F5' : '2px solid transparent',
                cursor: 'pointer'
              }} />
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
            <span style={{ fontSize: 12, color: '#737373' }}>Size</span>
            <input
              type="range" min={1} max={20} value={brushSize}
              onChange={e => setBrushSize(Number(e.target.value))}
              style={{ width: 80 }}
            />
          </div>
        </div>

        {/* Canvas */}
        <div style={{ flex: 1, padding: 12, background: '#0A0A0A', position: 'relative' }}>
          <canvas
            ref={canvasRef}
            onMouseDown={startDraw}
            onMouseMove={draw}
            onMouseUp={stopDraw}
            onMouseLeave={stopDraw}
            onTouchStart={startDraw}
            onTouchMove={draw}
            onTouchEnd={stopDraw}
            style={{
              width: '100%', height: '100%', borderRadius: 12,
              background: '#0A0A0A', cursor: 'crosshair', touchAction: 'none'
            }}
          />
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 16px', borderTop: '1px solid #2A2A2A',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <button onClick={clearCanvas} style={{
            padding: '8px 14px', borderRadius: 8, border: '1px solid #2A2A2A',
            background: '#1E1E1E', color: '#A3A3A3', cursor: 'pointer'
          }}>Clear</button>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={downloadCanvas} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 8, border: '1px solid #2A2A2A',
              background: '#1E1E1E', color: '#F5F5F5', cursor: 'pointer'
            }}><Download size={14} /> Save</button>
            <button onClick={sendCanvas} style={{
              padding: '8px 16px', borderRadius: 8, border: 'none',
              background: '#00D4FF', color: '#000', fontWeight: 600, cursor: 'pointer'
            }}>Send to Chat</button>
          </div>
        </div>
      </div>
    </div>
  )
}
