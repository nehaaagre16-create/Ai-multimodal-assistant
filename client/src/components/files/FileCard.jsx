import { useState } from 'react'
import { FileText, Image, FileSpreadsheet, FileCode, FileArchive, FileMusic, FileVideo, File, Download, Trash2, Eye } from 'lucide-react'
import { motion } from 'framer-motion'

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
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function getFileIcon(type, size = 20) {
  if (!type) return <File size={size} />
  if (type.startsWith('image/')) return <Image size={size} color="#A78BFA" />
  if (type === 'application/pdf') return <FileText size={size} color="#FF6B6B" />
  if (type.startsWith('text/')) return <FileCode size={size} color="#00D4FF" />
  if (type.includes('spreadsheet') || type.includes('excel') || type.includes('csv')) return <FileSpreadsheet size={size} color="#4ADE80" />
  if (type.startsWith('audio/')) return <FileMusic size={size} color="#F472B6" />
  if (type.startsWith('video/')) return <FileVideo size={size} color="#F59E0B" />
  if (type.includes('zip') || type.includes('compressed')) return <FileArchive size={size} color="#A8A29E" />
  return <File size={size} color="#A3A3A3" />
}

function canPreview(type) {
  if (!type) return false
  return type.startsWith('image/') || type === 'application/pdf' || type.startsWith('text/')
}

export default function FileCard({ file, view, index = 0, onDownload, onPreview, onDelete }) {
  const [hover, setHover] = useState(false)

  const isGrid = view === 'grid'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.22, delay: Math.min(index * 0.03, 0.2), ease: 'easeOut' }}
      style={{
        ...(isGrid ? gridCardStyle : listRowStyle),
        borderColor: hover ? '#333333' : '#262626',
        background: hover ? '#181818' : '#141414'
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div style={isGrid ? gridIconWrapStyle : listIconWrapStyle}>
        {getFileIcon(file.type, isGrid ? 36 : 26)}
      </div>

      <div style={isGrid ? gridInfoStyle : listInfoStyle}>
        <div style={fileNameStyle} title={file.original_name || file.name}>
          {file.original_name || file.name}
        </div>
        <div style={metaStyle}>
          <span>{formatBytes(file.size)}</span>
          <span style={{ color: '#404040' }}>•</span>
          <span>{formatDateTime(file.uploaded_at)}</span>
        </div>
      </div>

      <div style={{ ...actionsStyle, opacity: isGrid ? (hover ? 1 : 0) : 1 }}>
        {canPreview(file.type) && (
          <button
            onClick={(e) => { e.stopPropagation(); onPreview() }}
            aria-label="Preview"
            style={{ ...actionBtnStyle, borderColor: hover ? '#7C3AED' : '#262626' }}
          >
            <Eye size={16} color="#A78BFA" />
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onDownload() }}
          aria-label="Download"
          style={actionBtnStyle}
        >
          <Download size={16} color="#A3A3A3" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          aria-label="Delete"
          style={{ ...actionBtnStyle, borderColor: '#FF444440' }}
        >
          <Trash2 size={16} color="#FF4444" />
        </button>
      </div>
    </motion.div>
  )
}

const gridCardStyle = {
  position: 'relative',
  background: '#141414',
  border: '1px solid #262626',
  borderRadius: 16,
  padding: 20,
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  transition: 'border-color 0.2s, background 0.2s',
  cursor: 'default'
}

const listRowStyle = {
  position: 'relative',
  background: '#141414',
  border: '1px solid #262626',
  borderRadius: 14,
  padding: '16px 20px',
  display: 'flex',
  alignItems: 'center',
  gap: 16,
  transition: 'border-color 0.2s, background 0.2s'
}

const gridIconWrapStyle = {
  width: 64,
  height: 64,
  borderRadius: 14,
  background: 'linear-gradient(135deg, #1A1A2E 0%, #14141B 100%)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '1px solid #252532'
}

const listIconWrapStyle = {
  width: 48,
  height: 48,
  borderRadius: 12,
  background: 'linear-gradient(135deg, #1A1A2E 0%, #14141B 100%)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '1px solid #252532',
  flexShrink: 0
}

const gridInfoStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  minWidth: 0
}

const listInfoStyle = {
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 4
}

const fileNameStyle = {
  fontSize: 14,
  fontWeight: 600,
  color: '#F5F5F5',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap'
}

const metaStyle = {
  fontSize: 12,
  color: '#737373',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexWrap: 'wrap'
}

const actionsStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginTop: 'auto',
  transition: 'opacity 0.2s'
}

const actionBtnStyle = {
  width: 34,
  height: 34,
  borderRadius: 9,
  border: '1px solid #262626',
  background: '#1E1E1E',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  transition: 'border-color 0.2s, background 0.2s'
}
