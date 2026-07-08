import { motion } from 'framer-motion'

export default function Toast({ toast }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      style={{ ...toastStyle, background: toast.type === 'error' ? '#FF444420' : '#7C3AED20', borderColor: toast.type === 'error' ? '#FF4444' : '#7C3AED' }}
      role="status"
      aria-live="polite"
    >
      {toast.message}
    </motion.div>
  )
}

const toastStyle = { position: 'fixed', bottom: 24, right: 24, zIndex: 140, padding: '12px 18px', borderRadius: 10, border: '1px solid', color: '#F5F5F5', fontSize: 13, fontWeight: 600 }
