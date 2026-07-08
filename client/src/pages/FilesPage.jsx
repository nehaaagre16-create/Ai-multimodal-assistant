import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { FileText, Search, X, FolderOpen, LayoutGrid, List, UploadCloud, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useFiles } from '../hooks/useFiles'
import FileCard from '../components/files/FileCard'
import PreviewModal from '../components/files/PreviewModal'
import DeleteDialog from '../components/files/DeleteDialog'
import Toast from '../components/files/Toast'
import API_BASE from '../config/api'

const SORT_OPTIONS = [
  { key: 'newest', label: 'Newest' },
  { key: 'oldest', label: 'Oldest' },
  { key: 'name-asc', label: 'Name A–Z' },
  { key: 'name-desc', label: 'Name Z–A' },
  { key: 'largest', label: 'Largest' },
  { key: 'smallest', label: 'Smallest' }
]

const VIEW_MODES = [
  { key: 'grid', icon: LayoutGrid },
  { key: 'list', icon: List }
]

export default function FilesPage() {
  const { files, loading, hasMore, listFiles, loadMore, refresh, deleteFile, uploadFiles } = useFiles()

  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('newest')
  const [view, setView] = useState('grid')
  const [previewId, setPreviewId] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [dropActive, setDropActive] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(null)
  const [toast, setToast] = useState(null)
  const [isCompact, setIsCompact] = useState(false)
  const [searchResults, setSearchResults] = useState(null)
  const containerRef = useRef(null)
  const searchRef = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    const update = () => setIsCompact(window.innerWidth < 768)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  useEffect(() => {
    if (!search.trim()) {
      setSearchResults(null)
      listFiles({ q: '', reset: true })
    } else {
      const timer = setTimeout(() => {
        refresh()
        const q = search.trim().toLowerCase()
        setSearchResults(files.filter(f => (f.original_name || f.name || '').toLowerCase().includes(q)))
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [search])

  const filtered = useMemo(() => {
    const data = searchResults || files
    const sorted = [...data]
    switch (sort) {
      case 'newest': sorted.sort((a, b) => (b.uploaded_at || 0) - (a.uploaded_at || 0)); break
      case 'oldest': sorted.sort((a, b) => (a.uploaded_at || 0) - (b.uploaded_at || 0)); break
      case 'name-asc': sorted.sort((a, b) => (a.original_name || '').localeCompare(b.original_name || '')); break
      case 'name-desc': sorted.sort((a, b) => (b.original_name || '').localeCompare(a.original_name || '')); break
      case 'largest': sorted.sort((a, b) => (b.size || 0) - (a.size || 0)); break
      case 'smallest': sorted.sort((a, b) => (a.size || 0) - (b.size || 0)); break
      default: break
    }
    return sorted
  }, [files, searchResults, sort])

  const handleDownload = useCallback((id) => {
    if (!id) return
    window.open(`${API_BASE}/api/files/${id}/download`, '_blank')
  }, [])

  const handleDelete = useCallback(async () => {
    if (!deleteId) return
    try {
      await deleteFile(deleteId)
      setDeleteId(null)
      showToast('File deleted')
    } catch (err) {
      showToast('Failed to delete file', 'error')
    }
  }, [deleteId, deleteFile])

  const onDropFiles = useCallback(async (e) => {
    e.preventDefault()
    setDropActive(false)
    const items = e.dataTransfer.files
    if (!items.length) return
    setUploadProgress({ current: 0, total: items.length })
    try {
      await uploadFiles(items, setUploadProgress)
      showToast(`${items.length} file(s) uploaded`)
    } catch (err) {
      showToast('Some uploads failed', 'error')
    } finally {
      setUploadProgress(null)
    }
  }, [uploadFiles])

  const onFileInputChange = useCallback(async (e) => {
    const items = e.target.files
    if (!items.length) return
    setUploadProgress({ current: 0, total: items.length })
    try {
      await uploadFiles(items, setUploadProgress)
      showToast(`${items.length} file(s) uploaded`)
    } catch (err) {
      showToast('Some uploads failed', 'error')
    } finally {
      setUploadProgress(null)
      e.target.value = ''
    }
  }, [uploadFiles])

  function showToast(message, type = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const previewFile = files.find(f => f.id === previewId)

  return (
    <div style={{ flex: 1, display: 'flex', height: '100%', overflow: 'hidden', background: '#0A0A0A' }}>
      <main
        ref={containerRef}
        style={pageStyle}
        onDragOver={e => { e.preventDefault(); setDropActive(true) }}
        onDragLeave={e => { e.preventDefault(); setDropActive(false) }}
        onDrop={onDropFiles}
      >
        <div style={headerStyle}>
          <div style={titleRowStyle}>
            <div style={iconWrapperStyle}>
              <FileText size={20} color="#00D4FF" />
            </div>
            <div>
              <h1 style={titleStyle}>Files</h1>
              <p style={subtitleStyle}>
                {searchResults ? `${searchResults.length} search result${searchResults.length !== 1 ? 's' : ''}` : `${files.length} file${files.length !== 1 ? 's' : ''}`}
              </p>
            </div>
          </div>

          <div style={controlsStyle(isCompact)}>
            <div style={searchWrapStyle}>
              <Search size={16} color="#737373" style={searchIconStyle} />
              <input
                ref={searchRef}
                placeholder="Search files..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={inputStyle}
                aria-label="Search files"
              />
              {search && (
                <button onClick={() => setSearch('')} style={clearSearchStyle} aria-label="Clear search">
                  <X size={16} />
                </button>
              )}
            </div>

            <div style={rightControlsStyle}>
              {!isCompact && (
                <div style={sortWrapStyle}>
                  <select value={sort} onChange={(e) => setSort(e.target.value)} style={selectStyle} aria-label="Sort files">
                    {SORT_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
                  </select>
                </div>
              )}

              {!isCompact && (
                <div style={viewToggleStyle}>
                  {VIEW_MODES.map(m => {
                    const Icon = m.icon
                    return (
                      <button
                        key={m.key}
                        onClick={() => setView(m.key)}
                        style={{ ...viewBtnStyle, background: view === m.key ? '#7C3AED20' : 'transparent', color: view === m.key ? '#A78BFA' : '#A3A3A3' }}
                        aria-label={`${m.key} view`}
                      >
                        <Icon size={16} />
                      </button>
                    )
                  })}
                </div>
              )}

              <input type="file" multiple ref={fileInputRef} onChange={onFileInputChange} style={{ display: 'none' }} />
              <button onClick={() => fileInputRef.current?.click()} style={uploadBtnStyle}>
                <UploadCloud size={16} /> {!isCompact && 'Upload'}
              </button>
            </div>
          </div>
        </div>

        <div style={contentStyle} onScroll={e => {
          const el = e.currentTarget
          if (el.scrollTop + el.clientHeight >= el.scrollHeight - 100) loadMore()
        }}>
          {loading && files.length === 0 ? (
            <div style={view === 'grid' ? gridStyle(isCompact) : listStyle}>
              {Array.from({ length: isCompact ? 6 : 8 }).map((_, i) => (
                <div key={i} style={view === 'grid' ? skeletonGridStyle : skeletonListStyle}>
                  <div style={skeletonIconStyle} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ ...skeletonLineStyle, width: '65%' }} />
                    <div style={{ ...skeletonLineStyle, width: '40%' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              style={emptyStyle}
            >
              <div style={emptyIconStyle}>
                <FolderOpen size={40} color="#525252" />
              </div>
              <h3 style={{ margin: '0 0 8px', fontSize: 17, color: '#D4D4D4', fontWeight: 600 }}>
                {search ? 'No matching files' : 'No files yet'}
              </h3>
              <p style={{ margin: '0 0 20px', fontSize: 13, color: '#737373', maxWidth: 320, lineHeight: 1.5 }}>
                {search ? 'Try a different search term.' : 'Drag and drop files here, or click Upload to add them to your library.'}
              </p>
              {!search && (
                <button onClick={() => fileInputRef.current?.click()} style={emptyUploadBtnStyle}>
                  <UploadCloud size={16} /> Upload your first file
                </button>
              )}
            </motion.div>
          ) : (
            <div style={view === 'grid' ? gridStyle(isCompact) : listStyle}>
              <AnimatePresence mode="popLayout">
                {filtered.map((file, index) => (
                  <FileCard
                    key={file.id}
                    file={file}
                    view={view}
                    index={index}
                    onDownload={() => handleDownload(file.id)}
                    onPreview={() => setPreviewId(file.id)}
                    onDelete={() => setDeleteId(file.id)}
                  />
                ))}
              </AnimatePresence>
              {loading && files.length > 0 && (
                <div style={{ textAlign: 'center', padding: 28 }}>
                  <Loader2 size={24} className="spin" color="#A78BFA" />
                </div>
              )}
            </div>
          )}
        </div>

        {dropActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={dropOverlayStyle}
          >
            <UploadCloud size={64} color="#A78BFA" />
            <h2 style={{ margin: '16px 0 8px', fontSize: 20 }}>Drop files to upload</h2>
            <p style={{ color: '#A3A3A3', margin: 0 }}>Files will be added to your library</p>
          </motion.div>
        )}

        {uploadProgress && (
          <div style={uploadOverlayStyle}>
            <Loader2 size={32} className="spin" color="#A78BFA" />
            <p style={{ margin: '12px 0 0', color: '#F5F5F5' }}>Uploading {uploadProgress.current} of {uploadProgress.total}...</p>
          </div>
        )}

        {deleteId && <DeleteDialog onCancel={() => setDeleteId(null)} onConfirm={handleDelete} count={1} />}
        {previewId && previewFile && <PreviewModal file={previewFile} onClose={() => setPreviewId(null)} onDownload={() => handleDownload(previewFile.id)} />}
        {toast && <Toast toast={toast} />}
        <StyleInjector />
      </main>
    </div>
  )
}

const StyleInjector = () => {
  useEffect(() => {
    const styleSheet = document.createElement('style')
    styleSheet.innerText = `
      @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.4; } 100% { opacity: 1; } }
      .spin { animation: spin 1s linear infinite; }
      @keyframes spin { 100% { transform: rotate(360deg); } }
      button:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid #7C3AED; outline-offset: 2px; }
    `
    document.head.appendChild(styleSheet)
    return () => styleSheet.remove()
  }, [])
  return null
}

const pageStyle = { flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: '#0A0A0A', position: 'relative' }
const headerStyle = { padding: '28px 32px', borderBottom: '1px solid #171717', display: 'flex', flexDirection: 'column', gap: 20 }
const titleRowStyle = { display: 'flex', alignItems: 'center', gap: 14 }
const iconWrapperStyle = { width: 44, height: 44, borderRadius: 12, background: '#00D4FF15', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #00D4FF25' }
const titleStyle = { fontSize: 22, fontWeight: 700, margin: 0, color: '#F5F5F5', letterSpacing: '-0.02em' }
const subtitleStyle = { fontSize: 13, color: '#737373', margin: '4px 0 0' }
const controlsStyle = (compact) => ({ display: 'flex', alignItems: 'center', gap: 14, flexWrap: compact ? 'nowrap' : 'wrap', flexDirection: compact ? 'column' : 'row' })
const rightControlsStyle = { display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }
const searchWrapStyle = { position: 'relative', flex: 1, minWidth: 200, width: '100%' }
const searchIconStyle = { position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }
const inputStyle = { background: '#0F0F0F', border: '1px solid #262626', borderRadius: 12, padding: '12px 38px 12px 42px', color: '#F5F5F5', fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box', transition: 'border-color 0.2s, background 0.2s' }
const clearSearchStyle = { position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: '#737373', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4, borderRadius: 6 }
const sortWrapStyle = { display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #262626', borderRadius: 12, padding: '10px 12px', background: '#0F0F0F' }
const selectStyle = { background: 'transparent', border: 'none', color: '#F5F5F5', fontSize: 13, outline: 'none', cursor: 'pointer' }
const viewToggleStyle = { display: 'flex', border: '1px solid #262626', borderRadius: 12, overflow: 'hidden' }
const viewBtnStyle = { width: 38, height: 38, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background 0.2s' }
const uploadBtnStyle = { display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 12, border: '1px solid #2A2A2A', background: '#7C3AED', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s, transform 0.1s', whiteSpace: 'nowrap' }
const emptyUploadBtnStyle = { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 12, border: '1px solid #2A2A2A', background: '#7C3AED', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s' }
const contentStyle = { flex: 1, overflowY: 'auto', padding: '28px 32px' }
const gridStyle = (compact) => ({ display: 'grid', gridTemplateColumns: compact ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))', gap: 18 })
const listStyle = { display: 'flex', flexDirection: 'column', gap: 12 }
const skeletonGridStyle = { background: '#141414', border: '1px solid #262626', borderRadius: 16, padding: 18, display: 'flex', flexDirection: 'column', gap: 14, height: 176 }
const skeletonListStyle = { background: '#141414', border: '1px solid #262626', borderRadius: 14, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14, height: 88 }
const skeletonIconStyle = { width: 48, height: 48, borderRadius: 12, background: '#1F1F1F', animation: 'pulse 1.5s infinite' }
const skeletonLineStyle = { height: 12, borderRadius: 6, background: '#1F1F1F', animation: 'pulse 1.5s infinite' }
const emptyStyle = { color: '#525252', textAlign: 'center', padding: '100px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }
const emptyIconStyle = { width: 80, height: 80, borderRadius: 24, background: '#141414', border: '1px solid #262626', display: 'flex', alignItems: 'center', justifyContent: 'center' }
const dropOverlayStyle = { position: 'fixed', inset: 0, zIndex: 140, background: 'rgba(10,10,10,0.95)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' }
const uploadOverlayStyle = { position: 'fixed', inset: 0, zIndex: 150, background: 'rgba(0,0,0,0.8)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }
