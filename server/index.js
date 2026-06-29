const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// File upload endpoint
app.post('/api/upload', (req, res) => {
  const { filename, content, type } = req.body;
  if (!content) {
    return res.status(400).json({ error: 'No file content' });
  }
  
  const filePath = path.join(uploadsDir, `${Date.now()}_${filename}`);
  const base64Data = content.replace(/^data:.*;base64,/, '');
  fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
  
  res.json({ 
    success: true, 
    path: filePath,
    filename: filename,
    type: type || 'file'
  });
});

// Get uploaded files
app.get('/api/files', (req, res) => {
  const files = fs.readdirSync(uploadsDir).map(f => ({
    name: f,
    path: path.join(uploadsDir, f),
    size: fs.statSync(path.join(uploadsDir, f)).size
  }));
  res.json(files);
});

// SQLite DB
const db = new Database('./chat.db');
db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    timestamp INTEGER DEFAULT (unixepoch())
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
  CREATE TABLE IF NOT EXISTS memories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    timestamp INTEGER DEFAULT (unixepoch())
  );
`);

// Get messages
app.get('/api/messages', (req, res) => {
  const rows = db.prepare('SELECT * FROM messages ORDER BY timestamp ASC').all();
  res.json(rows);
});

// Memory endpoints
app.get('/api/memories', (req, res) => {
  const rows = db.prepare('SELECT * FROM memories ORDER BY timestamp DESC').all();
  res.json(rows);
});

app.post('/api/memories', (req, res) => {
  const { key, value } = req.body;
  const result = db.prepare('INSERT INTO memories (key, value) VALUES (?, ?)').run(key, value);
  res.json({ id: result.lastInsertRowid });
});

app.delete('/api/memories/:id', (req, res) => {
  db.prepare('DELETE FROM memories WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Save message
app.post('/api/messages', (req, res) => {
  const { role, content } = req.body;
  const result = db.prepare('INSERT INTO messages (role, content) VALUES (?, ?)').run(role, content);
  res.json({ id: result.lastInsertRowid });
});

// Clear messages
app.delete('/api/messages', (req, res) => {
  db.prepare('DELETE FROM messages').run();
  res.json({ success: true });
});

// Settings
app.get('/api/settings', (req, res) => {
  const rows = db.prepare('SELECT * FROM settings').all();
  const settings = {};
  rows.forEach(row => settings[row.key] = row.value);
  res.json(settings);
});

app.post('/api/settings', (req, res) => {
  const { key, value } = req.body;
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
  res.json({ success: true });
});

// Vision analysis endpoint
app.post('/api/vision', async (req, res) => {
  const { image, question } = req.body;
  
  if (!image) {
    return res.status(400).json({ error: 'No image provided' });
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'http://localhost:5173',
        'X-Title': 'AI Multimodal Assistant'
      },
      body: JSON.stringify({
        model: process.env.VISION_MODEL || 'openai/gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: question || 'What do you see in this image?' },
              { type: 'image_url', image_url: { url: image } }
            ]
          }
        ],
        max_tokens: 500
      })
    });

    const data = await response.json();
    
    if (data.error) {
      return res.status(500).json({ error: data.error.message || 'Vision API error' });
    }

    const description = data.choices?.[0]?.message?.content || 'No description available';
    res.json({ description });

  } catch (err) {
    console.error('Vision error:', err);
    res.status(500).json({ error: 'Failed to analyze image: ' + err.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', port: process.env.PORT || 4001 });
});

// Socket.io for real-time chat streaming
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('chat-message', async (data) => {
    const { message, history } = data;
    
    // Save user message
    db.prepare('INSERT INTO messages (role, content) VALUES (?, ?)').run('user', message);

    // Stream from OpenRouter
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'http://localhost:5173',
          'X-Title': 'AI Multimodal Assistant'
        },
    body: JSON.stringify({
      model: process.env.AI_MODEL || 'openai/gpt-3.5-turbo',
      messages: [
        ...history.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: message }
      ],
      stream: true
    })
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let aiResponse = '';
      let buffer = '';

      socket.emit('ai-start');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep last partial line in buffer

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          const data = trimmed.slice(6);
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content || '';
            if (content) {
              aiResponse += content;
              socket.emit('ai-chunk', content);
            }
          } catch (e) {
            // Ignore parse errors for incomplete JSON
          }
        }
      }

      // Process any remaining buffer
      if (buffer.trim().startsWith('data: ')) {
        const data = buffer.trim().slice(6);
        if (data !== '[DONE]') {
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content || '';
            if (content) {
              aiResponse += content;
              socket.emit('ai-chunk', content);
            }
          } catch (e) {}
        }
      }

      // Save AI response
      db.prepare('INSERT INTO messages (role, content) VALUES (?, ?)').run('assistant', aiResponse);
      socket.emit('ai-end');

    } catch (err) {
      console.error('OpenRouter error:', err);
      socket.emit('ai-error', 'Failed to get AI response');
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 4001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
