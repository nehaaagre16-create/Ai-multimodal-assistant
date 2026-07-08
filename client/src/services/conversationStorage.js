import API_BASE from '../config/api'

const DB_NAME = 'nexus-conversations'
const DB_VERSION = 1
const STORE = 'conversations'

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' })
        store.createIndex('updated_at', 'updated_at', { unique: false })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function localGetAll() {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const store = tx.objectStore(STORE)
      const request = store.getAll()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  } catch (err) {
    console.warn('[conversationStorage] IndexedDB read failed:', err)
    const raw = localStorage.getItem('nexus_conversations')
    return raw ? JSON.parse(raw) : []
  }
}

async function localGetOne(id) {
  const all = await localGetAll()
  return all.find(c => String(c.id) === String(id))
}

async function localSave(conversation) {
  try {
    const db = await openDB()
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      const store = tx.objectStore(STORE)
      const request = store.put(normalizeConversation(conversation))
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  } catch (err) {
    console.warn('[conversationStorage] IndexedDB save failed:', err)
    const all = await localGetAll()
    const idx = all.findIndex(c => String(c.id) === String(conversation.id))
    if (idx >= 0) all[idx] = normalizeConversation(conversation)
    else all.push(normalizeConversation(conversation))
    localStorage.setItem('nexus_conversations', JSON.stringify(all))
  }
}

async function localDelete(id) {
  try {
    const db = await openDB()
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      const store = tx.objectStore(STORE)
      const request = store.delete(id)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  } catch (err) {
    console.warn('[conversationStorage] IndexedDB delete failed:', err)
    const all = await localGetAll()
    localStorage.setItem('nexus_conversations', JSON.stringify(all.filter(c => String(c.id) !== String(id))))
  }
}

function normalizeConversation(c) {
  return {
    ...c,
    id: c.id ?? c.localId ?? `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    updated_at: c.updated_at || c.lastUpdated || Math.floor(Date.now() / 1000),
    messages: Array.isArray(c.messages) ? c.messages : []
  }
}

async function fetchJSON(url, options = {}) {
  try {
    const res = await fetch(url, options)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  } catch (err) {
    throw err
  }
}

async function isBackendAvailable() {
  try {
    await fetchJSON(`${API_BASE}/health`)
    return true
  } catch (err) {
    return false
  }
}

export async function listConversations(query = '', { offset = 0, limit = 200, includeArchived = false } = {}) {
  if (await isBackendAvailable()) {
    const params = new URLSearchParams({ offset: String(offset), limit: String(limit) })
    if (query) params.append('q', query)
    if (includeArchived) params.append('archived', '1')
    return fetchJSON(`${API_BASE}/api/conversations?${params.toString()}`)
  }
  const all = await localGetAll()
  let sorted = all.sort((a, b) => (b.updated_at || 0) - (a.updated_at || 0))
  if (!includeArchived) sorted = sorted.filter(c => !c.archived)
  if (!query) return sorted.slice(offset, offset + limit)
  const term = query.toLowerCase()
  return sorted.filter(c => (c.title || '').toLowerCase().includes(term)).slice(offset, offset + limit)
}

export async function getConversation(id) {
  if (await isBackendAvailable()) {
    return fetchJSON(`${API_BASE}/api/conversations/${id}/messages`)
  }
  const c = await localGetOne(id)
  if (!c) throw new Error('Conversation not found')
  return { conversation: c, messages: c.messages || [] }
}

export async function createConversation(title = 'New Chat') {
  if (await isBackendAvailable()) {
    return fetchJSON(`${API_BASE}/api/conversations`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title }) })
  }
  const id = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const convo = { id, title, created_at: Math.floor(Date.now() / 1000), updated_at: Math.floor(Date.now() / 1000), messages: [] }
  await localSave(convo)
  return { id }
}

export async function updateConversation(id, changes) {
  if (await isBackendAvailable()) {
    return fetchJSON(`${API_BASE}/api/conversations/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(changes) })
  }
  const c = await localGetOne(id)
  if (!c) throw new Error('Conversation not found')
  Object.assign(c, changes, { updated_at: Math.floor(Date.now() / 1000) })
  await localSave(c)
  return { success: true }
}

export async function deleteConversation(id) {
  if (await isBackendAvailable()) {
    return fetchJSON(`${API_BASE}/api/conversations/${id}`, { method: 'DELETE' })
  }
  await localDelete(id)
  return { success: true }
}

export async function appendMessage(id, role, content, attachments = []) {
  if (await isBackendAvailable()) {
    // Messages are saved via the socket chat handler; this path is used for offline fallback.
    return { success: true }
  }
  const c = await localGetOne(id)
  if (!c) throw new Error('Conversation not found')
  c.messages.push({ role, content, timestamp: Math.floor(Date.now() / 1000), attachments })
  c.updated_at = Math.floor(Date.now() / 1000)
  await localSave(c)
  return { success: true }
}

export async function saveConversation(conversation, messages) {
  if (await isBackendAvailable()) {
    // Backend owns persistence; nothing to do locally.
    return { success: true }
  }
  const c = normalizeConversation(conversation)
  c.messages = messages || c.messages || []
  c.updated_at = Math.floor(Date.now() / 1000)
  await localSave(c)
  return { success: true }
}

export async function duplicateConversation(id) {
  if (await isBackendAvailable()) {
    return fetchJSON(`${API_BASE}/api/conversations/${id}/duplicate`, { method: 'POST' })
  }
  const c = await localGetOne(id)
  if (!c) throw new Error('Conversation not found')
  const copy = { ...normalizeConversation(c), id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, title: `${c.title} (Copy)`, updated_at: Math.floor(Date.now() / 1000) }
  await localSave(copy)
  return { id: copy.id, title: copy.title }
}

export async function exportConversation(id) {
  if (await isBackendAvailable()) {
    return fetchJSON(`${API_BASE}/api/conversations/${id}/messages`)
  }
  const c = await localGetOne(id)
  if (!c) throw new Error('Conversation not found')
  return { conversation: c, messages: c.messages || [] }
}

export { API_BASE }
