import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  History, Search, Star, Trash2, Edit2, Check, X, MessageSquare, Plus,
  MoreVertical, FileText, Download, Copy, Pin, Archive, RotateCcw,
  FileJson, FileImage
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { List as VirtualList } from 'react-window'
import {
  listConversations, deleteConversation, updateConversation, duplicateConversation, exportConversation
} from '../services/conversationStorage'

const BATCH_SIZE = 50
const VIRTUAL_THRESHOLD = 200

const HISTORY_STATE_KEY = 'history_page_state'

const GROUP_LABELS = [
  { key: 'today', label: 'Today', test: (d) => isSameDay(d, new Date()) },
  { key: 'yesterday', label: 'Yesterday', test: (d) => isSameDay(d, subDays(new Date(), 1)) },
  { key: 'week', label: 'Last 7 Days', test: (d) => d > subDays(new Date(), 7) && d <= subDays(new Date(), 1) },
  { key: 'month', label: 'Last 30 Days', test: (d) => d > subDays(new Date(), 30) && d <= subDays(new Date(), 7) },
  { key: 'older', label: 'Older', test: () => true }
]

function subDays(date, days) {
  const d = new Date(date)
  d.setDate(d.getDate() - days)
  return d
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function groupConversations(conversations) {
  const groups = []
  for (const c of conversations) {
    const ts = (c.lastUpdated || c.updated_at || 0) * 1000
    const d = new Date(ts)
    let group = GROUP_LABELS.find(g => g.test(d))?.key || 'older'
    let existing = groups.find(g => g.key === group)
    if (!existing) {
      existing = { key: group, label: GROUP_LABELS.find(g => g.key === group)?.label || 'Older', items: [] }
      groups.push(existing)
    }
    existing.items.push(c)
  }
  const order = GROUP_LABELS.map(g => g.key)
  return groups.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key)).filter(g => g.items.length > 0)
}

export default function HistoryPage() {
  const navigate = useNavigate()
  const listContainerRef = useRef(null)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  const [isTablet, setIsTablet] = useState(false)

  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [showArchived, setShowArchived] = useState(false)
  const [conversations, setConversations] = useState([])
  const [scrollTop, setScrollTop] = useState(0)

  const [editing, setEditing] = useState(null)
  const [editTitle, setEditTitle] = useState('')
  const [deleteId, setDeleteId] = useState(null)
  const [exportId, setExportId] = useState(null)
  const [activeMenuId, setActiveMenuId] = useState(null)
  const menuRef = useRef(null)

  // Load persisted state
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(HISTORY_STATE_KEY) || '{}')
      if (saved.search) setSearch(saved.search)
      if (saved.selectedId) setSelectedId(saved.selectedId)
      if (saved.showArchived) setShowArchived(saved.showArchived)
      if (typeof saved.scrollTop === 'number') setScrollTop(saved.scrollTop)
    } catch {}
  }, [])

  // Persist state
  useEffect(() => {
    const state = { search, selectedId, showArchived, scrollTop }
    localStorage.setItem(HISTORY_STATE_KEY, JSON.stringify(state))
  }, [search, selectedId, showArchived, scrollTop])

  // Responsive layout
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth
      setIsMobile(w < 640)
      setIsTablet(w >= 640 && w < 1024)
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const fetchConversations = useCallback(async (query = '', offset = 0, append = false, includeArchived = showArchived) => {
    if (loading) return
    try {
      setLoading(true)
      const data = await listConversations(query, { offset, limit: BATCH_SIZE, includeArchived })
      if (data.length < BATCH_SIZE) setHasMore(false)
      else setHasMore(true)
      setConversations(prev => append ? [...prev, ...data] : data)
    } catch (err) {
      console.error('Failed to load conversations:', err)
      if (!append) setConversations([])
    } finally {
      setLoading(false)
    }
  }, [loading, showArchived])

  // Initial + search load
  useEffect(() => {
    const timeout = setTimeout(() => {
      setConversations([])
      setHasMore(true)
      fetchConversations(search, 0, false, showArchived)
    }, 250)
    return () => clearTimeout(timeout)
  }, [search, showArchived])

  // Infinite scroll / lazy load
  useEffect(() => {
    const container = listContainerRef.current
    if (!container) return
    const onScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container
      setScrollTop(scrollTop)
      if (!loading && hasMore && scrollTop + clientHeight >= scrollHeight - 200) {
        fetchConversations(search, conversations.length, true, showArchived)
      }
    }
    container.addEventListener('scroll', onScroll)
    return () => container.removeEventListener('scroll', onScroll)
  }, [conversations.length, loading, hasMore, search, showArchived, fetchConversations])

  // Restore scroll position once
  const restoredScrollRef = useRef(false)
  useEffect(() => {
    if (restoredScrollRef.current) return
    if (listContainerRef.current && scrollTop) {
      listContainerRef.current.scrollTop = scrollTop
      restoredScrollRef.current = true
    }
  }, [scrollTop])

  // Close menu on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setActiveMenuId(null)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const openConversation = (id) => {
    setSelectedId(id)
    navigate(`/chat?conversation=${id}`)
  }
  const startNewChat = () => navigate('/chat')

  const toggleFavorite = async (id, favorite, e) => {
    e.stopPropagation()
    try {
      await updateConversation(id, { favorite: !favorite })
      setConversations(prev => prev.map(c => c.id === id ? { ...c, favorite: !favorite } : c))
    } catch (err) {
      console.error('Failed to favorite conversation:', err)
    }
  }

  const togglePin = async (id, pinned, e) => {
    e.stopPropagation()
    try {
      await updateConversation(id, { pinned: !pinned })
      setConversations(prev => prev.map(c => c.id === id ? { ...c, pinned: !pinned } : c))
    } catch (err) {
      console.error('Failed to pin conversation:', err)
    }
  }

  const toggleArchive = async (id, archived, e) => {
    e.stopPropagation()
    try {
      await updateConversation(id, { archived: !archived })
      setConversations(prev => prev.filter(c => c.id !== id))
    } catch (err) {
      console.error('Failed to archive conversation:', err)
    }
  }

  const startEdit = (c, e) => {
    e.stopPropagation()
    setActiveMenuId(null)
    setEditing(c.id)
    setEditTitle(c.title || 'New Chat')
  }

  const saveTitle = async (id) => {
    const title = editTitle.trim()
    if (!title) return
    try {
      await updateConversation(id, { title })
      setEditing(null)
      setConversations(prev => prev.map(c => c.id === id ? { ...c, title } : c))
    } catch (err) {
      console.error('Failed to rename conversation:', err)
    }
  }

  const requestDelete = (id, e) => {
    e.stopPropagation()
    setActiveMenuId(null)
    setDeleteId(id)
  }

  const confirmDelete = async () => {
    if (!deleteId) return
    try {
      await deleteConversation(deleteId)
      setDeleteId(null)
      setConversations(prev => prev.filter(c => c.id !== deleteId))
    } catch (err) {
      console.error('Failed to delete conversation:', err)
    }
  }

  const handleDuplicate = async (id, e) => {
    e.stopPropagation()
    setActiveMenuId(null)
    try {
      const { id: newId } = await duplicateConversation(id)
      fetchConversations(search, 0, false, showArchived)
      setSelectedId(newId)
    } catch (err) {
      console.error('Failed to duplicate conversation:', err)
    }
  }

  const openExport = (id, e) => {
    e.stopPropagation()
    setActiveMenuId(null)
    setExportId(id)
  }

  const doExport = async (format) => {
    if (!exportId) return
    try {
      const { conversation, messages } = await exportConversation(exportId)
      const { blob, filename } = buildExport(format, conversation, messages)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      setExportId(null)
    } catch (err) {
      console.error('Failed to export conversation:', err)
    }
  }

  const formatDate = (ts) => {
    if (!ts) return ''
    const d = new Date(ts * 1000)
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }

  const formatTime = (ts) => {
    if (!ts) return ''
    const d = new Date(ts * 1000)
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  }

  const previewText = (text) => {
    if (!text) return 'No messages yet'
    const cleaned = text.replace(/\s+/g, ' ').trim()
    return cleaned.length > 90 ? cleaned.slice(0, 90) + '...' : cleaned
  }

  const { pinned, favorites, grouped, archived } = useMemo(() => {
    const active = conversations.filter(c => !c.archived)
    const archived = conversations.filter(c => c.archived)
    const pinned = active.filter(c => c.pinned)
    const favorites = active.filter(c => c.favorite && !c.pinned)
    const rest = active.filter(c => !c.pinned && !c.favorite)
    return { pinned, favorites, grouped: groupConversations(rest), archived }
  }, [conversations])

  const flatListItems = useMemo(() => {
    const items = []
    if (pinned.length) {
      items.push({ type: 'header', label: 'Pinned', key: 'pinned-header' })
      pinned.forEach(c => items.push({ type: 'conversation', data: c, key: c.id }))
    }
    if (favorites.length) {
      items.push({ type: 'header', label: 'Favorites', key: 'favorites-header' })
      favorites.forEach(c => items.push({ type: 'conversation', data: c, key: c.id }))
    }
    grouped.forEach(g => {
      items.push({ type: 'header', label: g.label, key: `group-${g.key}` })
      g.items.forEach(c => items.push({ type: 'conversation', data: c, key: c.id }))
    })
    if (showArchived && archived.length) {
      items.push({ type: 'header', label: 'Archived', key: 'archived-header' })
      archived.forEach(c => items.push({ type: 'conversation', data: c, key: c.id }))
    }
    return items
  }, [pinned, favorites, grouped, archived, showArchived])

  const Row = useCallback(({ index, style }) => {
    const item = flatListItems[index]
    return (
      <ConversationRow
        item={item}
        style={style}
        selectedId={selectedId}
        editing={editing}
        editTitle={editTitle}
        setEditTitle={setEditTitle}
        onSaveTitle={saveTitle}
        onCancelEdit={() => setEditing(null)}
        onOpen={openConversation}
        onFavorite={toggleFavorite}
        onPin={togglePin}
        onArchive={toggleArchive}
        onEdit={startEdit}
        onDuplicate={handleDuplicate}
        onExport={openExport}
        onDelete={requestDelete}
        activeMenuId={activeMenuId}
        setActiveMenuId={setActiveMenuId}
        formatDate={formatDate}
        formatTime={formatTime}
        previewText={previewText}
      />
    )
  }, [flatListItems, selectedId, editing, editTitle, activeMenuId, saveTitle, handleDuplicate, openConversation])

  const listHeight = useMemo(() => {
    if (isMobile) return window.innerHeight - 260
    return 640
  }, [isMobile])

  return (
    <div style={pageStyle}>
      <div style={isMobile ? mobileHeaderStyle : sidebarStyle}>
        <div style={headerContentStyle}>
          <div style={titleBlockStyle}>
            <div style={iconWrapperStyle}>
              <History size={20} color="#00D4FF" />
            </div>
            <div>
              <h1 style={titleStyle}>History</h1>
              <p style={subtitleStyle}>Revisit and manage conversations</p>
            </div>
          </div>
          <button onClick={startNewChat} style={newChatBtnStyle}>
            <Plus size={16} />
            New Chat
          </button>
        </div>

        <div style={searchWrapStyle}>
          <Search size={16} color="#737373" style={searchIconStyle} />
          <input
            placeholder="Search titles, messages, and AI responses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={inputStyle}
          />
          {search && (
            <button onClick={() => setSearch('')} style={clearSearchStyle}>
              <X size={16} />
            </button>
          )}
        </div>

        <div style={filterBarStyle}>
          <button
            onClick={() => setShowArchived(false)}
            style={{ ...filterBtnStyle, background: !showArchived ? '#7C3AED20' : 'transparent', color: !showArchived ? '#A78BFA' : '#A3A3A3' }}
          >
            Active
          </button>
          <button
            onClick={() => setShowArchived(true)}
            style={{ ...filterBtnStyle, background: showArchived ? '#7C3AED20' : 'transparent', color: showArchived ? '#A78BFA' : '#A3A3A3' }}
          >
            Archived
          </button>
        </div>

        <div style={statsStyle}>
          <span>{conversations.length} conversation{conversations.length !== 1 ? 's' : ''}</span>
          {pinned.length > 0 && <span>• {pinned.length} pinned</span>}
          {favorites.length > 0 && <span>• {favorites.length} favorited</span>}
        </div>
      </div>

      <div ref={listContainerRef} style={listContainerStyle}>
        {conversations.length === 0 && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={emptyStateStyle}
          >
            <MessageSquare size={48} color="#2A2A2A" />
            <p style={{ margin: '0 0 4px', fontSize: 15, color: '#A3A3A3' }}>
              {search ? `No conversations match "${search}"` : showArchived ? 'No archived conversations' : 'Start your first conversation.'}
            </p>
            {!search && !showArchived && (
              <p style={{ margin: '0 0 12px', fontSize: 13, color: '#525252' }}>
                Your conversations will automatically appear here.
              </p>
            )}
            {!search && !showArchived && (
              <button onClick={startNewChat} style={newChatBtnStyle}>
                <Plus size={16} />
                New Chat
              </button>
            )}
          </motion.div>
        )}

        {flatListItems.length > 0 && (
          flatListItems.length > VIRTUAL_THRESHOLD ? (
            <VirtualList
              height={listHeight}
              itemCount={flatListItems.length}
              itemSize={isMobile ? 88 : 76}
              width="100%"
              style={{ outline: 'none' }}
            >
              {Row}
            </VirtualList>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {flatListItems.map(item => (
                <ConversationRow key={item.key} item={item} style={{}} selectedId={selectedId} editing={editing} editTitle={editTitle} setEditTitle={setEditTitle} onSaveTitle={saveTitle} onCancelEdit={() => setEditing(null)} onOpen={openConversation} onFavorite={toggleFavorite} onPin={togglePin} onArchive={toggleArchive} onEdit={startEdit} onDuplicate={handleDuplicate} onExport={openExport} onDelete={requestDelete} activeMenuId={activeMenuId} setActiveMenuId={setActiveMenuId} formatDate={formatDate} formatTime={formatTime} previewText={previewText} />
              ))}
            </div>
          )
        )}

        {loading && (
          <div style={{ textAlign: 'center', padding: 24, color: '#525252', fontSize: 13 }}>
            Loading conversations…
          </div>
        )}
      </div>

      {deleteId && <ConfirmDialog onCancel={() => setDeleteId(null)} onConfirm={confirmDelete} />}
      {exportId && <ExportDialog onCancel={() => setExportId(null)} onExport={doExport} />}
    </div>
  )
}

function ConversationCard({
  conversation: c, selected, editing, editTitle, setEditTitle, onSaveTitle, onCancelEdit,
  onOpen, onFavorite, onPin, onArchive, onEdit, onDuplicate, onExport, onDelete,
  menuOpen, onToggleMenu, menuRef, formatDate, formatTime, previewText
}) {
  const [isHovered, setIsHovered] = useState(false)
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.15 }}
      onClick={onOpen}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        ...cardStyle,
        background: selected ? '#1A1A2E' : '#141414',
        borderColor: selected ? '#7C3AED' : '#2A2A2A',
      }}
    >
      <div style={avatarStyle}>
        <MessageSquare size={14} color="#A78BFA" />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {editing ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              style={{ ...inputStyle, padding: '8px 12px' }}
              onKeyDown={(e) => e.key === 'Enter' && onSaveTitle(c.id)}
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
            <button onClick={(e) => { e.stopPropagation(); onSaveTitle(c.id); }} style={actionBtnStyle}><Check size={16} color="#00FF88" /></button>
            <button onClick={(e) => { e.stopPropagation(); onCancelEdit(); }} style={actionBtnStyle}><X size={16} color="#A3A3A3" /></button>
          </div>
        ) : (
          <>
            <div style={cardTitleRowStyle}>
              <span style={cardTitleStyle}>{c.title || 'New Chat'}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {c.pinned === 1 && <span style={{ ...badgeStyle, background: '#00D4FF20', color: '#00D4FF' }}><Pin size={10} style={{ marginRight: 3 }} />Pinned</span>}
                {c.favorite === 1 && <span style={{ ...badgeStyle, background: '#FFC80020', color: '#FFC800' }}><Star size={10} style={{ marginRight: 3 }} fill="#FFC800" />Fav</span>}
                <span style={badgeStyle}>{c.messageCount || 0}</span>
                {(c.attachmentCount || 0) > 0 && <span style={{ ...badgeStyle, background: '#7C3AED20', color: '#A78BFA' }}><FileText size={10} style={{ marginRight: 3 }} />{c.attachmentCount}</span>}
                {c.model && <span style={{ ...badgeStyle, background: '#00D4FF20', color: '#00D4FF' }}>{c.model}</span>}
              </div>
            </div>
            <div style={previewStyle}>{previewText(c.lastMessage)}</div>
            <div style={metaRowStyle}>
              <span>{formatDate(c.lastUpdated || c.updated_at)}</span>
              <span>{formatTime(c.lastUpdated || c.updated_at)}</span>
              <span>•</span>
              <span>{c.messageCount || 0} message{(c.messageCount || 0) !== 1 ? 's' : ''}</span>
            </div>
          </>
        )}
      </div>

      {!editing && (
        <div style={{ ...hoverActionsStyle, opacity: isHovered || menuOpen ? 1 : 0 }}>
          <button onClick={onPin} title={c.pinned ? 'Unpin' : 'Pin'} style={actionBtnStyle}>
            <Pin size={16} color={c.pinned ? '#00D4FF' : '#A3A3A3'} fill={c.pinned ? '#00D4FF' : 'none'} />
          </button>
          <button onClick={onFavorite} title={c.favorite ? 'Unfavorite' : 'Favorite'} style={actionBtnStyle}>
            <Star size={16} color={c.favorite ? '#FFC800' : '#A3A3A3'} fill={c.favorite ? '#FFC800' : 'none'} />
          </button>
          <button onClick={onEdit} title="Rename" style={actionBtnStyle}>
            <Edit2 size={16} color="#A3A3A3" />
          </button>
          <button onClick={onDuplicate} title="Duplicate" style={actionBtnStyle}>
            <Copy size={16} color="#A3A3A3" />
          </button>
          <button onClick={onExport} title="Export" style={actionBtnStyle}>
            <Download size={16} color="#A3A3A3" />
          </button>
          <button onClick={onArchive} title={c.archived ? 'Unarchive' : 'Archive'} style={actionBtnStyle}>
            {c.archived ? <RotateCcw size={16} color="#A3A3A3" /> : <Archive size={16} color="#A3A3A3" />}
          </button>
          <button onClick={onDelete} title="Delete" style={actionBtnStyle}>
            <Trash2 size={16} color="#FF4444" />
          </button>
        </div>
      )}

      {!editing && (
        <div style={{ position: 'relative' }} ref={menuOpen ? menuRef : null}>
          <button onClick={onToggleMenu} style={actionBtnStyle}>
            <MoreVertical size={16} color="#A3A3A3" />
          </button>
          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                transition={{ duration: 0.1 }}
                style={menuStyle}
              >
                <MenuItem icon={<Pin size={14} />} label={c.pinned ? 'Unpin' : 'Pin'} onClick={onPin} />
                <MenuItem icon={<Star size={14} />} label={c.favorite ? 'Unfavorite' : 'Favorite'} onClick={onFavorite} />
                <MenuItem icon={<Edit2 size={14} />} label="Rename" onClick={onEdit} />
                <MenuItem icon={<Copy size={14} />} label="Duplicate" onClick={onDuplicate} />
                <MenuItem icon={<Download size={14} />} label="Export" onClick={onExport} />
                <MenuItem icon={<Archive size={14} />} label={c.archived ? 'Unarchive' : 'Archive'} onClick={onArchive} />
                <div style={{ height: 1, background: '#2A2A2A', margin: '4px 0' }} />
                <MenuItem icon={<Trash2 size={14} />} label="Delete" danger onClick={onDelete} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  )
}

function MenuItem({ icon, label, danger, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 14px',
      background: 'transparent', border: 'none', color: danger ? '#FF4444' : '#F5F5F5',
      fontSize: 13, cursor: 'pointer', textAlign: 'left'
    }}>
      {icon}
      {label}
    </button>
  )
}

function ConfirmDialog({ onCancel, onConfirm }) {
  return (
    <div style={overlayStyle}>
      <div style={dialogStyle}>
        <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>Delete Conversation?</h3>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: '#A3A3A3' }}>
          This cannot be undone. The conversation and all its messages will be permanently removed.
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onCancel} style={{ ...btnBaseStyle, background: '#1E1E1E', color: '#F5F5F5' }}>Cancel</button>
          <button onClick={onConfirm} style={{ ...btnBaseStyle, background: '#FF4444', color: '#FFFFFF' }}>Delete</button>
        </div>
      </div>
    </div>
  )
}

function ExportDialog({ onCancel, onExport }) {
  const formats = [
    { key: 'txt', label: 'TXT', icon: <FileText size={16} /> },
    { key: 'md', label: 'Markdown', icon: <FileText size={16} /> },
    { key: 'json', label: 'JSON', icon: <FileJson size={16} /> },
    { key: 'pdf', label: 'PDF', icon: <FileImage size={16} /> }
  ]
  return (
    <div style={overlayStyle}>
      <div style={dialogStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>Export Conversation</h3>
          <button onClick={onCancel} style={{ background: 'transparent', border: 'none', color: '#A3A3A3', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {formats.map(f => (
            <button key={f.key} onClick={() => onExport(f.key)} style={exportBtnStyle}>
              {f.icon}
              <span>{f.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function buildExport(format, conversation, messages) {
  const title = conversation.title || 'New Chat'
  if (format === 'json') {
    const blob = new Blob([JSON.stringify({ conversation, messages }, null, 2)], { type: 'application/json' })
    return { blob, filename: `${title}.json` }
  }
  if (format === 'md') {
    const lines = [`# ${title}`, '', `Created: ${new Date((conversation.created_at || 0) * 1000).toLocaleString()}`, '']
    for (const m of messages) {
      const role = m.role === 'user' ? 'User' : 'AI'
      lines.push(`## ${role} — ${new Date((m.timestamp || 0) * 1000).toLocaleString()}`, '', m.content || '', '')
      if (m.attachments?.length) {
        lines.push('**Attachments:**', ...m.attachments.map(a => `- ${a.original_name || a.filename}`), '')
      }
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' })
    return { blob, filename: `${title}.md` }
  }
  if (format === 'pdf') {
    const lines = [`${title}`, `Created: ${new Date((conversation.created_at || 0) * 1000).toLocaleString()}`, '']
    for (const m of messages) {
      const role = m.role === 'user' ? 'User' : 'AI'
      lines.push(`${role}: ${m.content || ''}`)
      if (m.attachments?.length) {
        lines.push(`Attachments: ${m.attachments.map(a => a.original_name || a.filename).join(', ')}`)
      }
      lines.push('')
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    return { blob, filename: `${title}.pdf` }
  }
  const lines = [`${title}`, `Created: ${new Date((conversation.created_at || 0) * 1000).toLocaleString()}`, '']
  for (const m of messages) {
    const role = m.role === 'user' ? 'User' : 'AI'
    lines.push(`[${role}] ${new Date((m.timestamp || 0) * 1000).toLocaleString()}`, m.content || '')
    if (m.attachments?.length) {
      lines.push(`Attachments: ${m.attachments.map(a => a.original_name || a.filename).join(', ')}`)
    }
    lines.push('')
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
  return { blob, filename: `${title}.txt` }
}


function ConversationRow({
  item, style, selectedId, editing, editTitle, setEditTitle, onSaveTitle, onCancelEdit,
  onOpen, onFavorite, onPin, onArchive, onEdit, onDuplicate, onExport, onDelete,
  activeMenuId, setActiveMenuId, formatDate, formatTime, previewText
}) {
  if (item.type === 'header') {
    return (
      <div style={{ ...style, ...headerStyle }}>
        {item.label}
      </div>
    )
  }
  const c = item.data
  return (
    <ConversationCard
      conversation={c}
      selected={selectedId === c.id}
      editing={editing === c.id}
      editTitle={editTitle}
      setEditTitle={setEditTitle}
      onSaveTitle={onSaveTitle}
      onCancelEdit={onCancelEdit}
      onOpen={() => onOpen(c.id)}
      onFavorite={(e) => onFavorite(c.id, c.favorite, e)}
      onPin={(e) => onPin(c.id, c.pinned, e)}
      onArchive={(e) => onArchive(c.id, c.archived, e)}
      onEdit={(e) => onEdit(c, e)}
      onDuplicate={(e) => onDuplicate(c.id, e)}
      onExport={(e) => onExport(c.id, e)}
      onDelete={(e) => onDelete(c.id, e)}
      menuOpen={activeMenuId === c.id}
      onToggleMenu={(e) => { e.stopPropagation(); setActiveMenuId(activeMenuId === c.id ? null : c.id) }}
      formatDate={formatDate}
      formatTime={formatTime}
      previewText={previewText}
    />
  )
}

const pageStyle = {
  display: 'flex',
  flex: 1,
  height: '100%',
  overflow: 'hidden',
  background: '#0A0A0A'
}

const sidebarStyle = {
  width: 320,
  minWidth: 260,
  maxWidth: 360,
  borderRight: '1px solid #1A1A1A',
  padding: 24,
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  overflowY: 'auto'
}

const mobileHeaderStyle = {
  width: '100%',
  padding: 16,
  borderBottom: '1px solid #1A1A1A',
  display: 'flex',
  flexDirection: 'column',
  gap: 12
}

const headerContentStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12
}

const titleBlockStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 12
}

const iconWrapperStyle = {
  width: 40, height: 40, borderRadius: 10,
  background: '#00D4FF20', display: 'flex', alignItems: 'center', justifyContent: 'center'
}

const titleStyle = { fontSize: 20, fontWeight: 700, margin: 0, color: '#F5F5F5' }
const subtitleStyle = { fontSize: 12, color: '#737373', margin: '4px 0 0' }

const newChatBtnStyle = {
  display: 'flex', alignItems: 'center', gap: 8,
  padding: '10px 16px', borderRadius: 10, border: '1px solid #2A2A2A',
  background: '#7C3AED20', color: '#A78BFA', fontSize: 13, fontWeight: 600,
  cursor: 'pointer', whiteSpace: 'nowrap'
}

const searchWrapStyle = { position: 'relative', width: '100%' }
const searchIconStyle = { position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }
const clearSearchStyle = { position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: '#737373', cursor: 'pointer' }

const inputStyle = {
  background: '#0A0A0A', border: '1px solid #2A2A2A', borderRadius: 10, padding: '12px 14px 12px 40px',
  color: '#F5F5F5', fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box'
}

const filterBarStyle = { display: 'flex', gap: 8 }
const filterBtnStyle = {
  flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid #2A2A2A',
  fontSize: 13, fontWeight: 600, cursor: 'pointer'
}

const statsStyle = { fontSize: 12, color: '#525252', display: 'flex', gap: 8, flexWrap: 'wrap' }

const listContainerStyle = {
  flex: 1,
  padding: 24,
  overflowY: 'auto',
  height: '100%'
}

const emptyStateStyle = {
  color: '#525252', textAlign: 'center', padding: 60,
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16
}

const headerStyle = {
  fontSize: 12, fontWeight: 600, color: '#A3A3A3',
  textTransform: 'uppercase', letterSpacing: 0.5, padding: '12px 4px 8px'
}

const cardStyle = {
  background: '#141414', border: '1px solid #2A2A2A', borderRadius: 12, padding: '12px 14px',
  display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
  transition: 'background 0.15s, transform 0.15s, border-color 0.15s, box-shadow 0.15s',
  marginBottom: 8
}

const avatarStyle = {
  width: 32, height: 32, borderRadius: 8, background: '#1A1A2E',
  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
}

const cardTitleRowStyle = {
  fontSize: 14, fontWeight: 600, color: '#F5F5F5', marginBottom: 4,
  display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap'
}

const cardTitleStyle = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }

const previewStyle = { fontSize: 12, color: '#737373', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }

const metaRowStyle = { display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: '#525252', flexWrap: 'wrap' }

const hoverActionsStyle = {
  display: 'flex', alignItems: 'center', gap: 6,
  transition: 'opacity 0.15s'
}

const actionBtnStyle = {
  width: 32, height: 32, borderRadius: 8, border: '1px solid #2A2A2A',
  background: '#1E1E1E', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
}

const badgeStyle = {
  display: 'inline-flex', alignItems: 'center', padding: '2px 6px', borderRadius: 6,
  background: '#2A2A2A', color: '#A3A3A3', fontSize: 10, fontWeight: 600
}

const menuStyle = {
  position: 'absolute', right: 0, top: 38, zIndex: 20,
  background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: 10,
  minWidth: 150, padding: '6px 0', boxShadow: '0 10px 30px rgba(0,0,0,0.4)'
}


const overlayStyle = {
  position: 'fixed', inset: 0, zIndex: 100,
  background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center'
}

const dialogStyle = {
  background: '#141414', border: '1px solid #2A2A2A', borderRadius: 14,
  padding: 20, width: 340, maxWidth: '90vw', boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
}

const btnBaseStyle = {
  padding: '8px 14px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer'
}

const exportBtnStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  padding: '12px 0', borderRadius: 10, border: '1px solid #2A2A2A',
  background: '#1E1E1E', color: '#F5F5F5', fontSize: 13, fontWeight: 600, cursor: 'pointer'
}
