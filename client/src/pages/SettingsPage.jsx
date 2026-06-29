import { useState, useEffect } from 'react'
import { Save, Check } from 'lucide-react'

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    apiKey: '',
    model: 'openai/gpt-3.5-turbo',
    voice: 'default',
    theme: 'dark',
    autoTTS: false,
  })
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('http://localhost:4001/api/settings')
      .then(r => r.json())
      .then(data => {
        setSettings(prev => ({ ...prev, ...data }))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const handleSave = () => {
    Object.entries(settings).forEach(([key, value]) => {
      fetch('http://localhost:4001/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      }).catch(() => {})
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#737373' }}>
        Loading settings...
      </div>
    )
  }

  return (
    <div style={{ padding: '32px 40px', maxWidth: 600, overflowY: 'auto', height: '100vh' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 24px' }}>Settings</h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <SettingRow
          label="AI Model"
          value={settings.model}
          onChange={(v) => setSettings({ ...settings, model: v })}
          options={['openai/gpt-3.5-turbo', 'openai/gpt-4', 'anthropic/claude-3-haiku']}
        />

        <SettingRow
          label="Voice"
          value={settings.voice}
          onChange={(v) => setSettings({ ...settings, voice: v })}
          options={['default', 'male', 'female']}
        />

        <ToggleRow
          label="Auto TTS"
          value={settings.autoTTS}
          onChange={(v) => setSettings({ ...settings, autoTTS: v })}
          desc="Automatically speak AI replies aloud"
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontSize: 14, fontWeight: 500, color: '#A3A3A3' }}>API Key</label>
          <input
            type="password"
            value={settings.apiKey}
            onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
            placeholder="OpenRouter API key..."
            style={inputStyle}
          />
        </div>
      </div>

      <button
        onClick={handleSave}
        style={{
          marginTop: 32,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 24px',
          borderRadius: 10,
          border: 'none',
          background: saved ? '#00FF88' : '#00D4FF',
          color: '#0A0A0A',
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
      >
        {saved ? <Check size={16} /> : <Save size={16} />}
        {saved ? 'Saved!' : 'Save Settings'}
      </button>
    </div>
  )
}

function SettingRow({ label, value, onChange, options }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label style={{ fontSize: 14, fontWeight: 500, color: '#A3A3A3' }}>{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle}
      >
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

function ToggleRow({ label, value, onChange, desc }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <label style={{ fontSize: 14, fontWeight: 500, color: '#A3A3A3' }}>{label}</label>
        <button
          onClick={() => onChange(!value)}
          style={{
            width: 44,
            height: 24,
            borderRadius: 12,
            border: 'none',
            background: value ? '#00D4FF' : '#2A2A2A',
            position: 'relative',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          <div style={{
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: '#fff',
            position: 'absolute',
            top: 3,
            left: value ? 22 : 3,
            transition: 'all 0.2s',
          }} />
        </button>
      </div>
      {desc && <span style={{ fontSize: 12, color: '#737373' }}>{desc}</span>}
    </div>
  )
}

const inputStyle = {
  background: '#141414',
  border: '1px solid #2A2A2A',
  borderRadius: 10,
  padding: '12px 16px',
  color: '#F5F5F5',
  fontSize: 14,
  outline: 'none',
  width: '100%',
}
