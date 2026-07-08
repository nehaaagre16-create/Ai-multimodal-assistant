export default function DeleteDialog({ onCancel, onConfirm, count }) {
  return (
    <div style={overlayStyle} role="alertdialog" aria-modal="true">
      <div style={dialogStyle}>
        <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>Delete {count > 1 ? `${count} Files` : 'File'}?</h3>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: '#A3A3A3' }}>
          {count > 1 ? 'These files will be permanently deleted from storage and removed from any conversation.' : 'This file will be permanently deleted from storage and removed from any conversation.'}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onCancel} style={{ ...btnBaseStyle, background: '#1E1E1E', color: '#F5F5F5' }}>Cancel</button>
          <button onClick={onConfirm} style={{ ...btnBaseStyle, background: '#FF4444', color: '#FFFFFF' }}>Delete</button>
        </div>
      </div>
    </div>
  )
}

const overlayStyle = { position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }
const dialogStyle = { background: '#141414', border: '1px solid #2A2A2A', borderRadius: 14, padding: 20, width: 340, maxWidth: '90vw', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }
const btnBaseStyle = { padding: '8px 14px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
