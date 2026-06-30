import { useState, useEffect } from 'react'
import { History, Search, Star, Trash2, Edit2, Check, X, MessageSquare, Folder } from 'lucide-react'

export default function HistoryPage() {
  const [conversations, setConversations] = useState([])
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null)
  const [editTitle, setEditTitle] = useState('')

  const fetchConversations = (query = '') => {
    const url = query ? `http://localhost:4001/api/conversations?q=${encodeURIComponent(query)}` : 'http://localhost:4001/api/conversations'
    fetch(url)
      .then(r => r.json())
      .then(data => setConversations(data))
      .catch(() => {})
  }

  useEffect(() => {
    fetchConversations()
  }, [])

  useEffect(() => {
    const timeout = setTimeout(() => fetchConversations(search), 300)
    return () => clearTimeout(timeout)
  }, [search])

  const toggleFavorite = async (id, favorite) => {
    await fetch(`http://localhost:4001/api/conversations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ favorite: !favorite })
    })
    fetchConversations(search)
  }

  const startEdit = (c) => {
    setEditing(c.id)
    setEditTitle(c.title || 'New Chat')
  }

  const saveTitle = async (id) => {
    await fetch(`http://localhost:4001/api/conversations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: editTitle.trim() })
    })
    setEditing(null)
    fetchConversations(search)
  }

  const deleteConversation = async (id) => {
    if (!confirm('Delete this conversation and its messages?')) return
    await fetch(`http://localhost:4001/api/conversations/${id}`, { method: 'DELETE' })
    fetchConversations(search)
  }

  const formatDate = (ts) => {
    if (!ts) return ''
    return new Date(ts * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }

  return (
    <div style={{ flex: 1, padding: 32, overflowY: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: '#00D4FF20', display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <History size={20} color="#00D4FF" />
        </div>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>History</h1>
          <p style={{ fontSize: 13, color: '#737373', margin: 0 }}>Manage past conversations</p>
        </div>
      </div>

      <div style={{ marginBottom: 20, position: 'relative' }}>
        <Search size={16} color="#737373" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
        <input
          placeholder="Search chats..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ ...inputStyle, paddingLeft: 40 }}
        />
        {search && (
          <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: '#737373', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {conversations.length === 0 && (
          <div style={{ color: '#525252', textAlign: 'center', padding: 40 }}>
            {search ? 'No conversations match your search.' : 'No conversations yet.'}
          </div>
        )}
        {conversations.map(c => (
          <div key={c.id} style={{
            background: '#141414', border: '1px solid #2A2A2A', borderRadius: 12, padding: 14,
            display: 'flex', alignItems: 'center', gap: 12,
            borderLeft: c.favorite ? '3px solid #FFC800' : '1px solid #2A2A2A',
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, background: '#1A1A2E',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}>
              <MessageSquare size={14} color="#A78BFA" />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              {editing === c.id ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    style={{ ...inputStyle, padding: '8px 12px' }}
                    onKeyDown={(e) => e.key === 'Enter' && saveTitle(c.id)}
                  />
                  <button onClick={() => saveTitle(c.id)} style={actionBtnStyle}><Check size={16} color="#00FF88" /></button>
                  <button onClick={() => setEditing(null)} style={actionBtnStyle}><X size={16} color="#A3A3A3" /></button>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#F5F5F5', marginBottom: 2 }}>{c.title || 'New Chat'}</div>
                  <div style={{ fontSize: 11, color: '#525252' }}>{formatDate(c.updated_at)}</div>
                </>
              )}
            </div>

            {editing !== c.id && (
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => startEdit(c)} title="Rename" style={actionBtnStyle}><Edit2 size={16} color="#A3A3A3" /></button>
                <button onClick={() => toggleFavorite(c.id, c.favorite)} title={c.favorite ? 'Unfavorite' : 'Favorite'} style={actionBtnStyle}>
                  <Star size={16} color={c.favorite ? '#FFC800' : '#A3A3A3'} fill={c.favorite ? '#FFC800' : 'none'} />
                </button>
                <button onClick={() => deleteConversation(c.id)} title="Delete" style={actionBtnStyle}><Trash2 size={16} color="#FF4444" /></button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

const inputStyle = {
  background: '#0A0A0A', border: '1px solid #2A2A2A', borderRadius: 10, padding: '12px 14px',
  color: '#F5F5F5', fontSize: 14, outline: 'none', width: '100%'
}

const actionBtnStyle = {
  width: 32, height: 32, borderRadius: 8, border: '1px solid #2A2A2A',
  background: '#1E1E1E', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
}
