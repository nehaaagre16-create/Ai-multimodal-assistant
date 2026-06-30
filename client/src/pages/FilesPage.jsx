import { useState, useEffect, useRef } from 'react'
import { FileText, Upload, X, Eye, Trash2 } from 'lucide-react'

export default function FilesPage() {
  const [files, setFiles] = useState([])
  const [drag, setDrag] = useState(false)
  const [preview, setPreview] = useState(null)
  const inputRef = useRef(null)

  const fetchFiles = () => {
    fetch('http://localhost:4001/api/files')
      .then(r => r.json())
      .then(data => setFiles(data))
      .catch(() => {})
  }

  useEffect(() => {
    fetchFiles()
  }, [])

  const uploadFile = async (file) => {
    const reader = new FileReader()
    reader.onload = async () => {
      const base64 = reader.result
      await fetch('http://localhost:4001/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, content: base64, type: file.type })
      })
      fetchFiles()
    }
    reader.readAsDataURL(file)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDrag(false)
    const dropped = Array.from(e.dataTransfer.files)
    dropped.forEach(uploadFile)
  }

  const handleSelect = (e) => {
    const selected = Array.from(e.target.files || [])
    selected.forEach(uploadFile)
  }

  const handleDelete = async (name) => {
    await fetch(`http://localhost:4001/api/files/${encodeURIComponent(name)}`, { method: 'DELETE' })
    fetchFiles()
  }

  return (
    <div style={{ flex: 1, padding: 32, overflowY: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: '#00D4FF20', display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <FileText size={20} color="#00D4FF" />
        </div>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Files</h1>
          <p style={{ fontSize: 13, color: '#737373', margin: 0 }}>Upload and manage documents</p>
        </div>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          background: drag ? '#00D4FF10' : '#141414',
          border: `2px dashed ${drag ? '#00D4FF' : '#2A2A2A'}`,
          borderRadius: 16, padding: 40, marginBottom: 24,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
          cursor: 'pointer', transition: 'all 0.2s'
        }}
      >
        <Upload size={32} color="#737373" />
        <div style={{ fontSize: 14, color: '#A3A3A3' }}>Drop files here or click to upload</div>
        <input ref={inputRef} type="file" multiple style={{ display: 'none' }} onChange={handleSelect} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {files.length === 0 && (
          <div style={{ color: '#525252', textAlign: 'center', padding: 40 }}>No files uploaded yet.</div>
        )}
        {files.map(f => (
          <div key={f.name} style={{
            background: '#141414', border: '1px solid #2A2A2A', borderRadius: 12, padding: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#F5F5F5', wordBreak: 'break-word' }}>{f.name}</div>
              <div style={{ fontSize: 12, color: '#737373', marginTop: 4 }}>{(f.size / 1024).toFixed(1)} KB</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setPreview(f)} style={iconBtnStyle}>
                <Eye size={16} />
              </button>
              <button onClick={() => handleDelete(f.name)} style={iconBtnStyle}>
                <Trash2 size={16} color="#FF4444" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {preview && (
        <div style={{
          position: 'fixed', inset: 0, background: '#000000CC', zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40
        }} onClick={() => setPreview(null)}>
          <div style={{ background: '#141414', border: '1px solid #2A2A2A', borderRadius: 16, padding: 24, maxWidth: 600, width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{preview.name}</div>
              <button onClick={() => setPreview(null)} style={iconBtnStyle}><X size={18} /></button>
            </div>
            {preview.type?.startsWith('image/') ? (
              <img src={`http://localhost:4001/uploads/${preview.name}`} alt={preview.name} style={{ width: '100%', borderRadius: 10 }} />
            ) : (
              <div style={{ color: '#737373', padding: 20 }}>Preview not available for this file type.</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const iconBtnStyle = {
  width: 36, height: 36, borderRadius: 8, border: '1px solid #2A2A2A',
  background: '#1E1E1E', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
}
