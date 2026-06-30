import { useState, useEffect, useRef } from 'react'
import { Save, Check, Volume2 } from 'lucide-react'

const VOICE_PRESETS = [
  { key: 'default', label: 'System Default' },
  { key: 'male', label: 'Male' },
  { key: 'female', label: 'Female' },
]

const MODEL_OPTIONS = [
  'openai/gpt-3.5-turbo',
  'anthropic/claude-3-haiku',
]

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    model: 'openai/gpt-3.5-turbo',
    voice: 'default',
    theme: 'dark',
    autoTTS: false,
    voiceSpeed: 1,
    voicePitch: 1,
  })
  const [voices, setVoices] = useState([])
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const synthRef = useRef(window.speechSynthesis)

  useEffect(() => {
    const loadVoices = () => setVoices(synthRef.current?.getVoices() || [])
    loadVoices()
    if (synthRef.current?.onvoiceschanged !== undefined) {
      synthRef.current.onvoiceschanged = loadVoices
    }
  }, [])

  useEffect(() => {
    fetch('http://localhost:4001/api/settings')
      .then(r => r.json())
      .then(data => {
        const normalized = { ...data }
        if (normalized.autoTTS !== undefined) {
          normalized.autoTTS = normalized.autoTTS === 'true' || normalized.autoTTS === true
        }
        if (normalized.voiceSpeed) normalized.voiceSpeed = parseFloat(normalized.voiceSpeed)
        if (normalized.voicePitch) normalized.voicePitch = parseFloat(normalized.voicePitch)
        setSettings(prev => ({ ...prev, ...normalized }))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    try {
      await Promise.all(
        Object.entries(settings).map(([key, value]) => {
          const storedValue = typeof value === 'boolean' ? String(value) : String(value)
          return fetch('http://localhost:4001/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key, value: storedValue }),
          }).then(r => {
            if (!r.ok) throw new Error(`Failed to save ${key}: ${r.status}`)
          })
        })
      )
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      console.error('Save failed:', err)
      alert('Failed to save settings. Is the backend running?')
    }
  }

  const previewVoice = () => {
    if (!synthRef.current) return
    synthRef.current.cancel()
    const text = 'Hello, I am Nexus AI. This is your selected voice.'
    const utter = new SpeechSynthesisUtterance(text)
    utter.rate = settings.voiceSpeed
    utter.pitch = settings.voicePitch
    const allVoices = synthRef.current.getVoices()
    const preset = VOICE_PRESETS.find(v => v.key === settings.voice)
    if (settings.voice === 'male') {
      const maleVoice = allVoices.find(v => v.name.toLowerCase().includes('male'))
        || allVoices.find(v => /david|mark|james|alex|daniel/i.test(v.name))
      if (maleVoice) utter.voice = maleVoice
    } else if (settings.voice === 'female') {
      const femaleVoice = allVoices.find(v => v.name.toLowerCase().includes('female'))
        || allVoices.find(v => /zira|jenny|linda|samantha|victoria/i.test(v.name))
      if (femaleVoice) utter.voice = femaleVoice
    }
    synthRef.current.speak(utter)
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
          options={MODEL_OPTIONS}
        />

        <SettingRow
          label="Voice"
          value={settings.voice}
          onChange={(v) => setSettings({ ...settings, voice: v })}
          options={VOICE_PRESETS.map(v => v.key)}
          optionLabels={VOICE_PRESETS.reduce((acc, v) => ({ ...acc, [v.key]: v.label }), {})}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontSize: 14, fontWeight: 500, color: '#A3A3A3' }}>Voice Speed</label>
          <input
            type="range"
            min={0.5}
            max={2}
            step={0.1}
            value={settings.voiceSpeed}
            onChange={(e) => setSettings({ ...settings, voiceSpeed: parseFloat(e.target.value) })}
            style={rangeStyle}
          />
          <div style={{ fontSize: 12, color: '#737373' }}>{settings.voiceSpeed.toFixed(1)}x</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontSize: 14, fontWeight: 500, color: '#A3A3A3' }}>Voice Pitch</label>
          <input
            type="range"
            min={0.5}
            max={2}
            step={0.1}
            value={settings.voicePitch}
            onChange={(e) => setSettings({ ...settings, voicePitch: parseFloat(e.target.value) })}
            style={rangeStyle}
          />
          <div style={{ fontSize: 12, color: '#737373' }}>{settings.voicePitch.toFixed(1)}x</div>
        </div>

        <button
          onClick={previewVoice}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 18px',
            borderRadius: 10,
            border: '1px solid #2A2A2A',
            background: '#141414',
            color: '#A3A3A3',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            alignSelf: 'flex-start',
          }}
        >
          <Volume2 size={16} />
          Preview Voice
        </button>

        <ToggleRow
          label="Auto TTS"
          value={settings.autoTTS}
          onChange={(v) => setSettings({ ...settings, autoTTS: v })}
          desc="Automatically speak AI replies aloud"
        />
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

function SettingRow({ label, value, onChange, options, optionLabels = {} }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label style={{ fontSize: 14, fontWeight: 500, color: '#A3A3A3' }}>{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle}
      >
        {options.map(o => <option key={o} value={o}>{optionLabels[o] || o}</option>)}
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

const rangeStyle = {
  width: '100%',
  accentColor: '#00D4FF',
  background: '#141414',
}
