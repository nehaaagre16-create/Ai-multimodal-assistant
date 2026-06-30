import { useState } from 'react'
import { Copy, Check, ThumbsUp, ThumbsDown, Volume2 } from 'lucide-react'

export default function MessageActions({ content, onReadAloud }) {
  const [copied, setCopied] = useState(false)
  const [liked, setLiked] = useState(false)
  const [disliked, setDisliked] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
      <button onClick={handleCopy} style={actionBtnStyle} title="Copy">
        {copied ? <Check size={14} color="#00FF88" /> : <Copy size={14} />}
      </button>
      <button onClick={() => setLiked(!liked)} style={actionBtnStyle} title="Like">
        <ThumbsUp size={14} color={liked ? '#00FF88' : '#737373'} />
      </button>
      <button onClick={() => setDisliked(!disliked)} style={actionBtnStyle} title="Dislike">
        <ThumbsDown size={14} color={disliked ? '#FF4444' : '#737373'} />
      </button>
      <button onClick={onReadAloud} style={actionBtnStyle} title="Read aloud">
        <Volume2 size={14} />
      </button>
    </div>
  )
}

const actionBtnStyle = {
  width: 26,
  height: 26,
  borderRadius: 6,
  border: '1px solid #2A2A2A',
  background: '#1E1E1E',
  color: '#737373',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
}
