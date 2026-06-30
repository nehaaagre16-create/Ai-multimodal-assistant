import { useState, useEffect } from 'react'
import { Brain, Plus, Trash2, Sparkles, Pin, Search, X, Edit2, Check, RotateCcw } from 'lucide-react'

export default function MemoryPage() {
  const [memories, setMemories] = useState([])
  const [key, setKey] = useState('')
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null)
  const [editKey, setEditKey] = useState('')
  const [editValue, setEditValue] = useState('')

  const fetchMemories = (query = '') => {
    const url = query ? `http://localhost:4001/api/memories?q=${encodeURIComponent(query)}` : 'http://localhost:4001/api/memories'
    fetch(url)
      .then(r => r.json())
      .then(data => setMemories(data))
      .catch(() => {})
  }

  useEffect(() => {
    fetchMemories()
  }, [])

  useEffect(() => {
    const timeout = setTimeout(() => fetchMemories(search), 300)
    return () => clearTimeout(timeout)
  }, [search])

  const handleSave = async () => {
    if (!key.trim() || !value.trim()) return
    setLoading(true)
    try {
      await fetch('http://localhost:4001/api/memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: key.trim(), value: value.trim() })
      })
      setKey('')
      setValue('')
      fetchMemories(search)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    await fetch(`http://localhost:4001/api/memories/${id}`, { method: 'DELETE' })
    fetchMemories(search)
  }

  const togglePin = async (id, pinned) => {
    await fetch(`http://localhost:4001/api/memories/${id}/pin`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pinned: !pinned })
    })
    fetchMemories(search)
  }

  const startEdit = (m) => {
    setEditing(m.id)
    setEditKey(m.key)
    setEditValue(m.value)
  }

  const saveEdit = async (id) => {
    await fetch(`http://localhost:4001/api/memories/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: editKey.trim(), value: editValue.trim() })
    })
    setEditing(null)
    fetchMemories(search)
  }

  return (
    <div style={{ flex: 1, padding: 32, overflowY: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: '#00FF8820', display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <Brain size={20} color="#00FF88" />
        </div>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Memory</h1>
          <p style={{ fontSize: 13, color: '#737373', margin: 0 }}>Long-term facts the AI remembers about you</p>
        </div>
      </div>

      <div style={{
        background: '#141414', border: '1px solid #2A2A2A', borderRadius: 16, padding: 20, marginBottom: 24
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sparkles size={16} color="#A78BFA" /> Add Memory
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            placeholder="e.g. favorite_color"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            style={inputStyle}
          />
          <textarea
            placeholder="What should the AI remember?"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={3}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
          <button onClick={handleSave} disabled={loading || !key.trim() || !value.trim()} style={saveBtnStyle}>
            <Plus size={16} />
            {loading ? 'Saving...' : 'Save Memory'}
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 16, position: 'relative' }}>
        <Search size={16} color="#737373" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
        <input
          placeholder="Search memories..."
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {memories.length === 0 && (
          <div style={{ color: '#525252', textAlign: 'center', padding: 40 }}>
            {search ? 'No memories match your search.' : 'No memories saved yet.'}
          </div>
        )}
        {memories.map(m => (
          <div key={m.id} style={{
            background: '#141414', border: '1px solid #2A2A2A', borderRadius: 12, padding: 16,
            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16,
            transition: 'all 0.2s',
            borderLeft: m.pinned ? '3px solid #FFC800' : '1px solid #2A2A2A',
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {editing === m.id ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <input value={editKey} onChange={(e) => setEditKey(e.target.value)} style={inputStyle} />
                  <textarea value={editValue} onChange={(e) => setEditValue(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => saveEdit(m.id)} style={smallBtnStyle('#00FF88', '#0A0A0A')}>
                      <Check size={14} /> Save
                    </button>
                    <button onClick={() => setEditing(null)} style={smallBtnStyle('#2A2A2A', '#A3A3A3')}>
                      <RotateCcw size={14} /> Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <div style={{ fontSize: 12, color: '#A78BFA', fontWeight: 600 }}>{m.key}</div>
                    {m.pinned ? <Pin size={12} color="#FFC800" fill="#FFC800" /> : null}
                  </div>
                  <div style={{ fontSize: 14, color: '#F5F5F5', wordBreak: 'break-word' }}>{m.value}</div>
                  <div style={{ fontSize: 11, color: '#525252', marginTop: 8 }}>
                    {new Date(m.timestamp * 1000).toLocaleString()}
                  </div>
                </>
              )}
            </div>
            {editing !== m.id && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => startEdit(m)} title="Edit" style={actionBtnStyle}>
                  <Edit2 size={16} color="#A3A3A3" />
                </button>
                <button onClick={() => togglePin(m.id, m.pinned)} title={m.pinned ? 'Unpin' : 'Pin'} style={actionBtnStyle}>
                  <Pin size={16} color={m.pinned ? '#FFC800' : '#A3A3A3'} fill={m.pinned ? '#FFC800' : 'none'} />
                </button>
                <button onClick={() => handleDelete(m.id)} title="Delete" style={actionBtnStyle}>
                  <Trash2 size={16} color="#FF4444" />
                </button>
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

const saveBtnStyle = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  padding: '12px 20px', borderRadius: 10, border: 'none', background: '#7C3AED',
  color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-start'
}

const actionBtnStyle = {
  width: 34, height: 34, borderRadius: 8, border: '1px solid #2A2A2A',
  background: '#1E1E1E', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
}

const smallBtnStyle = (bg, color) => ({
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 12px', borderRadius: 8, border: 'none', background: bg, color,
  fontSize: 12, fontWeight: 600, cursor: 'pointer'
})
