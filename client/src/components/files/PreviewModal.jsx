import { useState, useEffect } from 'react'
import { X, Download, Loader2 } from 'lucide-react'
import API_BASE from '../../config/api'

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`
}

function formatDateTime(ts) {
  if (!ts) return '—'
  const d = new Date(ts * 1000)
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function isImage(type) { return type?.startsWith('image/') }
function isPdf(type) { return type === 'application/pdf' }
function isText(type) { return type?.startsWith('text/') }

function getFileIcon(type, size = 20) {
  return null
}

export default function PreviewModal({ file, onClose, onDownload }) {
  const [content, setContent] = useState(null)
  const [fetching, setFetching] = useState(false)

  useEffect(() => {
    if (!file || !file.type) return
    if (isText(file.type)) {
      setFetching(true)
      fetch(`${API_BASE}/api/files/${file.id}/preview`)
        .then(r => r.text())
        .then(text => setContent(text))
        .catch(() => setContent('Unable to load preview.'))
        .finally(() => setFetching(false))
    }
  }, [file])

  return (
    <div style={overlayStyle} onClick={onClose} role="dialog" aria-modal="true" aria-label="File preview">
      <div style={previewDialogStyle} onClick={e => e.stopPropagation()}>
        <div style={previewHeaderStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: '#1A1A2E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileIcon type={file.type} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{file.original_name || file.name}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onDownload} aria-label="Download" style={actionBtnStyle}><Download size={18} color="#A3A3A3" /></button>
            <button onClick={onClose} aria-label="Close preview" style={actionBtnStyle}><X size={18} color="#A3A3A3" /></button>
          </div>
        </div>
        <div style={previewBodyStyle}>
          {isImage(file.type) && <img src={`${API_BASE}/api/files/${file.id}/preview`} alt={file.original_name} style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: 10 }} />}
          {isPdf(file.type) && <iframe src={`${API_BASE}/api/files/${file.id}/preview`} title={file.original_name} style={{ width: '100%', height: '70vh', border: 'none', borderRadius: 10 }} />}
          {isText(file.type) && (fetching ? <Loader2 size={24} className="spin" color="#A3A3A3" /> : <pre style={textPreviewStyle}>{content || 'No content'}</pre>)}
        </div>
        <div style={previewMetaStyle}>
          <span>{formatBytes(file.size)}</span>
          <span>•</span>
          <span>{formatDateTime(file.uploaded_at)}</span>
          <span>•</span>
          <span>{file.type || 'Unknown'}</span>
          {file.conversation_title && <><span>•</span><span>{file.conversation_title}</span></>}
        </div>
      </div>
    </div>
  )
}

function FileIcon({ type }) {
  const iconStyle = { color: '#A78BFA' }
  if (!type) return <span style={iconStyle}>?</span>
  if (type.startsWith('image/')) return <span style={iconStyle}>IMG</span>
  if (type === 'application/pdf') return <span style={{ color: '#FF6B6B' }}>PDF</span>
  if (type.startsWith('text/')) return <span style={{ color: '#00D4FF' }}>TXT</span>
  return <span style={iconStyle}>FILE</span>
}

const overlayStyle = { position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }
const previewDialogStyle = { background: '#141414', border: '1px solid #2A2A2A', borderRadius: 16, width: '90vw', maxWidth: 900, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }
const previewHeaderStyle = { padding: 16, borderBottom: '1px solid #2A2A2A', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }
const previewBodyStyle = { padding: 20, flex: 1, overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }
const textPreviewStyle = { width: '100%', maxHeight: '70vh', overflow: 'auto', background: '#0A0A0A', color: '#F5F5F5', padding: 16, borderRadius: 10, fontSize: 13, fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }
const previewMetaStyle = { padding: '12px 16px', borderTop: '1px solid #2A2A2A', fontSize: 12, color: '#737373', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }
const actionBtnStyle = { width: 36, height: 36, borderRadius: 8, border: '1px solid #2A2A2A', background: '#1E1E1E', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }
