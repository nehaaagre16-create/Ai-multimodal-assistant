import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import API_BASE from '../config/api'

export function useFiles() {
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [cursor, setCursor] = useState(null)
  const [hasMore, setHasMore] = useState(true)

  const paramsRef = useRef({ q: '' })

  const listFiles = useCallback(async ({ q = '', reset = true } = {}) => {
    paramsRef.current = { q }
    if (reset) {
      setFiles([])
      setCursor(null)
      setHasMore(true)
    }
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      if (q) qs.set('q', q)
      if (!reset && cursor) qs.set('cursor', cursor)
      qs.set('limit', '100')
      const res = await fetch(`${API_BASE}/api/files?${qs}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setFiles(prev => reset ? data : [...prev, ...data])
      setHasMore(data.length === 100)
      if (data.length > 0) setCursor(data[data.length - 1].id)
    } catch (err) {
      console.error('Failed to fetch files:', err)
      setFiles([])
    } finally {
      setLoading(false)
    }
  }, [cursor])

  const loadMore = useCallback(() => {
    if (hasMore && !loading) listFiles({ ...paramsRef.current, reset: false })
  }, [hasMore, loading, listFiles])

  const refresh = useCallback(() => {
    listFiles({ ...paramsRef.current, reset: true })
  }, [listFiles])

  useEffect(() => { refresh() }, [])

  const updateFile = useCallback(async (id, body) => {
    const res = await fetch(`${API_BASE}/api/files/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    setFiles(prev => prev.map(f => f.id === id ? { ...f, ...body } : f))
  }, [])

  const deleteFile = useCallback(async (id) => {
    const res = await fetch(`${API_BASE}/api/files/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    setFiles(prev => prev.filter(f => f.id !== id))
  }, [])

  const uploadFiles = useCallback(async (fileList, onProgress) => {
    const total = fileList.length
    let done = 0
    for (const file of fileList) {
      const form = new FormData()
      form.append('file', file)
      try {
        const res = await fetch(`${API_BASE}/api/upload`, { method: 'POST', body: form })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        await fetch(`${API_BASE}/api/files/record`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: data.filename,
            original_name: data.original_name,
            type: data.type,
            size: file.size
          })
        })
      } catch (err) {
        console.error('Upload failed:', err)
        throw err
      }
      done++
      onProgress?.({ current: done, total })
    }
    refresh()
  }, [refresh])

  return useMemo(() => ({
    files, loading, hasMore,
    listFiles, loadMore, refresh, updateFile, deleteFile, uploadFiles
  }), [files, loading, hasMore, listFiles, loadMore, refresh, updateFile, deleteFile, uploadFiles])
}
