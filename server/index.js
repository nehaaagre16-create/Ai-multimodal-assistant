const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const upload = multer({ dest: path.join(__dirname, 'tmp') });

// Optional server-side file text extraction (installed in this project)
let pdfParse, mammoth;
try { pdfParse = require('pdf-parse'); } catch (e) { pdfParse = null; }
try { mammoth = require('mammoth'); } catch (e) { mammoth = null; }

// Lazy Tesseract worker for OCR/indexing images
let tesseractModule;
let tesseractWorker = null;
const ocrCache = new Map();
async function getTesseractWorker() {
  if (!tesseractWorker) {
    tesseractModule = require('tesseract.js');
    tesseractWorker = await tesseractModule.createWorker('eng');
  }
  return tesseractWorker;
}

async function ocrImage(filePath) {
  if (ocrCache.has(filePath)) return ocrCache.get(filePath);
  const ext = path.extname(filePath).toLowerCase();
  if (!['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'].includes(ext)) {
    ocrCache.set(filePath, null);
    return null;
  }
  try {
    const worker = await getTesseractWorker();
    const result = await worker.recognize(filePath);
    const text = result?.data?.text || null;
    ocrCache.set(filePath, text);
    return text;
  } catch (e) {
    console.error('OCR error', e);
    ocrCache.set(filePath, null);
    return null;
  }
}

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

// SQLite DB
const db = new Database('./chat.db');
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    favorite INTEGER DEFAULT 0,
    folder TEXT,
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch())
  );
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    timestamp INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
  CREATE TABLE IF NOT EXISTS memories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    pinned INTEGER DEFAULT 0,
    timestamp INTEGER DEFAULT (unixepoch())
  );

  -- Phase 3 file management tables
  CREATE TABLE IF NOT EXISTS message_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id INTEGER,
    filename TEXT,
    original_name TEXT,
    type TEXT,
    size INTEGER DEFAULT 0,
    timestamp INTEGER DEFAULT (unixepoch()),
    last_accessed_at INTEGER DEFAULT (unixepoch()),
    folder_id INTEGER,
    favorite INTEGER DEFAULT 0,
    tags TEXT,
    content_hash TEXT,
    ocr_text TEXT,
    ai_extracted_text TEXT,
    indexed_at INTEGER,
    version_group TEXT,
    FOREIGN KEY (message_id) REFERENCES messages(id),
    FOREIGN KEY (folder_id) REFERENCES file_folders(id)
  );
  CREATE TABLE IF NOT EXISTS file_folders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    parent_id INTEGER,
    created_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (parent_id) REFERENCES file_folders(id)
  );
  CREATE TABLE IF NOT EXISTS file_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    color TEXT,
    created_at INTEGER DEFAULT (unixepoch())
  );
  CREATE TABLE IF NOT EXISTS file_tag_links (
    file_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    PRIMARY KEY (file_id, tag_id),
    FOREIGN KEY (file_id) REFERENCES message_files(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES file_tags(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS file_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id INTEGER NOT NULL,
    filename TEXT,
    original_name TEXT,
    type TEXT,
    size INTEGER,
    content_hash TEXT,
    created_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (file_id) REFERENCES message_files(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS file_activity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    meta TEXT,
    created_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (file_id) REFERENCES message_files(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS file_search_index (
    file_id INTEGER PRIMARY KEY,
    content TEXT,
    FOREIGN KEY (file_id) REFERENCES message_files(id) ON DELETE CASCADE
  );
`);

// Helper: add a column if it does not exist
function ensureColumn(table, column, def) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some(c => c.name === column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`).run();
  }
}

// Migrations for existing tables
ensureColumn('conversations', 'favorite', 'INTEGER DEFAULT 0');
ensureColumn('conversations', 'folder', 'TEXT');
ensureColumn('memories', 'pinned', 'INTEGER DEFAULT 0');

// Phase 3 migrations for message_files (in case table existed without new columns)
[
  ['message_id', 'INTEGER'],
  ['filename', 'TEXT'],
  ['original_name', 'TEXT'],
  ['type', 'TEXT'],
  ['size', 'INTEGER DEFAULT 0'],
  ['timestamp', 'INTEGER DEFAULT (unixepoch())'],
  ['last_accessed_at', 'INTEGER DEFAULT (unixepoch())'],
  ['folder_id', 'INTEGER'],
  ['favorite', 'INTEGER DEFAULT 0'],
  ['tags', 'TEXT'],
  ['content_hash', 'TEXT'],
  ['ocr_text', 'TEXT'],
  ['ai_extracted_text', 'TEXT'],
  ['indexed_at', 'INTEGER'],
  ['version_group', 'TEXT']
].forEach(([col, def]) => ensureColumn('message_files', col, def));

// ---------- Phase 3 file helpers ----------

function fileHash(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function buildVisionContent(text, attachments, options = {}) {
  const { imageType = 'auto', extractedText = null } = options;
  const content = [];
  const ocrParts = [];
  for (const a of attachments || []) {
    const mime = (a.type || 'image/png').toLowerCase();
    const name = (a.original_name || a.filename || '').toLowerCase();
    const isImage = mime.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp|bmp|svg)$/.test(name);
    if (!isImage) continue;
    const filePath = getFilePath(a.filename || a.name);
    if (!fs.existsSync(filePath)) continue;
    try {
      const ocrText = ocrCache.get(filePath) || null;
      if (ocrText) {
        ocrParts.push(`[OCR from ${a.original_name || a.filename}]:\n${ocrText.trim()}`);
      }
    } catch (e) { /* ignore */ }
  }

  const detectedType = imageType === 'auto' ? detectImageType(text, ocrParts, attachments) : imageType;
  const systemNote = buildVisionSystemNote(detectedType);

  let promptText = text || '';
  const contextParts = [];
  if (systemNote) contextParts.push(systemNote);
  if (extractedText && typeof extractedText === 'string' && extractedText.trim()) {
    contextParts.push(`Extracted text from the image:\n\n${extractedText.trim()}`);
  }
  if (ocrParts.length > 0) {
    contextParts.push(`Text visible in the screenshot(s):\n\n${ocrParts.join('\n\n---\n\n')}`);
  }
  if (contextParts.length > 0) {
    promptText = (promptText ? `${promptText}\n\n` : '') + contextParts.join('\n\n---\n\n') + '\n\nPlease answer naturally based on the above.';
  }
  if (promptText) content.push({ type: 'text', text: promptText });

  for (const a of attachments || []) {
    const mime = (a.type || '').toLowerCase();
    const name = (a.original_name || a.filename || '').toLowerCase();
    const isImage = mime.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp|bmp|svg)$/.test(name);
    if (!isImage) continue;
    const filePath = getFilePath(a.filename || a.name);
    if (!fs.existsSync(filePath)) continue;
    const base64 = fs.readFileSync(filePath).toString('base64');
    const detectedMime = mime.startsWith('image/') ? mime : `image/${name.split('.').pop().replace('jpg','jpeg')}`;
    content.push({
      type: 'image_url',
      image_url: { url: `data:${detectedMime};base64,${base64}` }
    });
  }
  return content;
}

function detectImageType(text, ocrParts, attachments) {
  const t = (text || '').toLowerCase();
  const ocr = (ocrParts || []).join(' ').toLowerCase();
  const names = (attachments || []).map(a => (a.original_name || a.filename || '').toLowerCase()).join(' ');
  const combined = `${t} ${ocr} ${names}`;

  if (/\berror\b|\bexception\b|\bfail\b|\bfailed\b|\btraceback\b|\bstatus\s*\d{3}\b/.test(combined)) {
    if (/\breact\b|\bcomponent\b|\bjsx\b|\brender\b|\bdom\b/.test(combined)) return 'ui_error';
    return 'terminal';
  }
  if (/\bcode\b|\bscreenshot\b.*\bcode\b|\bfunction\b|\bconst\b|\bimport\b|\bexport\b|\bclass\b/.test(combined)) return 'code';
  if (/\bui\b|\bpage\b|\binterface\b|\bscreenshot\b|\bbrowser\b|\blogin\b|\bbutton\b|\bform\b/.test(combined)) return 'ui';
  return 'general';
}

function buildVisionSystemNote(type) {
  switch (type) {
    case 'ui_error':
      return `You are analyzing a screenshot that likely shows a browser error, runtime exception, or failed UI state. First read any visible error message, stack trace, or status code. Then explain in plain language what went wrong, which component/file the error points to if visible, and suggest the most likely fix. Keep the tone helpful and concise.`;
    case 'terminal':
      return `You are reading a screenshot of terminal or command output. Summarize what the command did, whether it succeeded or failed, highlight the key error or result, and suggest the next troubleshooting step if something is wrong. Keep it natural and concise.`;
    case 'code':
      return `You are reading a screenshot of source code. Explain what the code does, identify any obvious bugs or issues visible in the snippet, and suggest improvements if relevant. Keep the explanation natural and concise.`;
    case 'ui':
      return `You are looking at a screenshot of a user interface. Describe what you see, identify the main elements, and answer the user's question about the layout, content, or any visible issue. Keep the response natural and concise.`;
    default:
      return `You are analyzing an uploaded image. Describe what you see clearly and answer the user's question naturally.`;
  }
}

function getFilePath(filename) {
  const safe = filename || 'unnamed';
  return path.join(uploadsDir, path.basename(safe));
}

async function readFileContent(filePath, type) {
  const ext = path.extname(filePath).toLowerCase();
  const mime = (type || '').toLowerCase();
  const textExts = ['.txt', '.md', '.json', '.csv', '.js', '.ts', '.jsx', '.tsx', '.html', '.css', '.py', '.log'];
  if (textExts.includes(ext) || mime.startsWith('text/')) {
    try { return fs.readFileSync(filePath, 'utf8'); } catch (e) { return null; }
  }
  if (ext === '.pdf' || mime === 'application/pdf') {
    if (!pdfParse) return null;
    try {
      const data = await pdfParse(fs.readFileSync(filePath));
      return data.text || null;
    } catch (e) { console.error('PDF parse error', e); return null; }
  }
  if (ext === '.docx' || mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    if (!mammoth) return null;
    try {
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value || null;
    } catch (e) { console.error('DOCX parse error', e); return null; }
  }
  return null;
}

async function ocrAndIndex(filePath, type) {
  const mime = (type || '').toLowerCase();
  const ext = path.extname(filePath).toLowerCase();
  if (!mime.startsWith('image/') && !['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'].includes(ext)) {
    return null;
  }
  try {
    const worker = await getTesseractWorker();
    const result = await worker.recognize(filePath);
    return result?.data?.text || null;
  } catch (e) { console.error('OCR error', e); return null; }
}

async function aiExtract(text) {
  if (!text || !process.env.GOOGLE_API_KEY) return null;
  try {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GOOGLE_API_KEY}` },
      body: JSON.stringify({
        model: 'gemini-2.0-flash',
        messages: [
          {
            role: 'user',
            content: `Extract 3-5 key entities/topics from the following text and provide a one-line summary.\n\n${text.slice(0, 4000)}`
          }
        ],
        max_tokens: 300
      })
    });
    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (e) { console.error('AI extract error', e); return null; }
}

function findVersionGroup(originalName) {
  if (!originalName) return null;
  const base = originalName.replace(/\.[^/.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return crypto.createHash('sha256').update(base).digest('hex').slice(0, 16);
}

function logActivity(fileId, action, meta = {}) {
  db.prepare('INSERT INTO file_activity (file_id, action, meta) VALUES (?, ?, ?)')
    .run(fileId, action, JSON.stringify(meta));
}

function recordFileVersion(fileId) {
  const file = db.prepare('SELECT * FROM message_files WHERE id = ?').get(fileId);
  if (!file) return;
  db.prepare(`
    INSERT INTO file_versions (file_id, filename, original_name, type, size, content_hash, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(fileId, file.filename, file.original_name, file.type, file.size, file.content_hash, file.timestamp || Date.now() / 1000);
}

async function indexFile(fileId) {
  const file = db.prepare('SELECT * FROM message_files WHERE id = ?').get(fileId);
  if (!file) return;
  const filePath = getFilePath(file.filename);
  if (!fs.existsSync(filePath)) return;

  const hash = fileHash(filePath);
  const extractedText = await readFileContent(filePath, file.type);
  const ocrText = await ocrAndIndex(filePath, file.type);
  const fullText = [extractedText, ocrText].filter(Boolean).join('\n\n');
  const aiText = fullText ? await aiExtract(fullText) : null;

  db.prepare(`
    UPDATE message_files
    SET content_hash = ?, ocr_text = ?, ai_extracted_text = ?, indexed_at = ?, version_group = ?
    WHERE id = ?
  `).run(hash, ocrText || null, aiText, Math.floor(Date.now() / 1000), findVersionGroup(file.original_name), fileId);

  db.prepare('INSERT OR REPLACE INTO file_search_index (file_id, content) VALUES (?, ?)')
    .run(fileId, [file.original_name, file.filename, file.type, extractedText, ocrText, aiText].filter(Boolean).join(' '));

  logActivity(fileId, 'indexed', { hash, size: file.size });
}

function rowToFile(row) {
  const tagList = row.tag_list || row.tags || '';
  const tagsArray = tagList.toString().split(',').map(t => t.trim()).filter(Boolean);
  return {
    id: row.id,
    name: row.filename,
    original_name: row.original_name,
    type: row.type,
    size: row.size,
    uploaded_at: row.timestamp,
    last_accessed_at: row.last_accessed_at,
    folder_id: row.folder_id,
    favorite: row.favorite,
    tags: tagsArray.join(','),
    tag_list: tagsArray.map(t => ({ name: t })),
    conversation_id: row.conversation_id,
    conversation_title: row.conversation_title,
    content_hash: row.content_hash,
    version_group: row.version_group
  };
}

// File upload endpoint (chat / Files page compatible)
// Accepts either JSON { filename, content (base64), type } or multipart/form-data
app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    let filePath, safeName, originalName, fileType, fileSize;

    if (req.file) {
      // Multipart upload
      safeName = `${Date.now()}_${path.basename(req.file.originalname || 'upload')}`;
      filePath = path.join(uploadsDir, safeName);
      fs.renameSync(req.file.path, filePath);
      originalName = req.file.originalname || safeName;
      fileType = req.file.mimetype || 'file';
      fileSize = req.file.size || 0;
    } else {
      // JSON base64 upload (legacy chat flow)
      const { filename, content, type } = req.body;
      if (!content) {
        return res.status(400).json({ error: 'No file content' });
      }
      safeName = `${Date.now()}_${path.basename(filename || 'upload')}`;
      filePath = path.join(uploadsDir, safeName);
      const base64Data = content.replace(/^data:.*;base64,/, '');
      const buf = Buffer.from(base64Data, 'base64');
      fs.writeFileSync(filePath, buf);
      originalName = filename || safeName;
      fileType = type || 'file';
      fileSize = buf.length;
    }

    res.json({
      success: true,
      path: filePath,
      filename: safeName,
      original_name: originalName,
      type: fileType,
      size: fileSize
    });
  } catch (err) {
    console.error('[upload] error:', err.message);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Serve uploaded files
app.use('/uploads', express.static(uploadsDir));

// ---------- Phase 3 file endpoints ----------
// IMPORTANT: static / collection routes must come BEFORE /:id routes

// List / search files
app.get('/api/files', (req, res) => {
  const { folder_id, favorite, tag, q, cursor, limit = '50' } = req.query;
  const params = [];
  const conditions = [];

  let sql = `
    SELECT mf.*,
      m.conversation_id,
      c.title AS conversation_title,
      GROUP_CONCAT(ft.name) AS tag_list
    FROM message_files mf
    LEFT JOIN messages m ON mf.message_id = m.id
    LEFT JOIN conversations c ON m.conversation_id = c.id
    LEFT JOIN file_tag_links ftl ON ftl.file_id = mf.id
    LEFT JOIN file_tags ft ON ft.id = ftl.tag_id
  `;

  if (folder_id !== undefined && folder_id !== '') {
    conditions.push('mf.folder_id = ?');
    params.push(folder_id);
  }
  if (favorite !== undefined && favorite !== '') {
    conditions.push('mf.favorite = ?');
    params.push(favorite === 'true' || favorite === '1' ? 1 : 0);
  }
  if (tag) {
    conditions.push('ft.name = ?');
    params.push(tag);
  }
  if (q) {
    conditions.push(`(mf.original_name LIKE ? OR mf.filename LIKE ? OR mf.type LIKE ? OR mf.ai_extracted_text LIKE ? OR EXISTS (
      SELECT 1 FROM file_search_index fsi WHERE fsi.file_id = mf.id AND fsi.content LIKE ?
    ))`);
    const like = `%${q}%`;
    params.push(like, like, like, like, like);
  }
  if (cursor) {
    conditions.push('mf.id < ?');
    params.push(cursor);
  }

  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' GROUP BY mf.id ORDER BY mf.id DESC LIMIT ?';
  params.push(parseInt(limit) || 50);

  try {
    const rows = db.prepare(sql).all(...params);
    res.json(rows.map(rowToFile));
  } catch (e) {
    console.error('GET /api/files error', e);
    res.status(500).json({ error: e.message });
  }
});

// Full-text search over file_search_index
app.get('/api/files/search', (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Missing query' });
  const like = `%${q}%`;
  try {
    const rows = db.prepare(`
      SELECT mf.*,
        m.conversation_id,
        c.title AS conversation_title,
        GROUP_CONCAT(ft.name) AS tag_list
      FROM message_files mf
      INNER JOIN file_search_index fsi ON fsi.file_id = mf.id
      LEFT JOIN messages m ON mf.message_id = m.id
      LEFT JOIN conversations c ON m.conversation_id = c.id
      LEFT JOIN file_tag_links ftl ON ftl.file_id = mf.id
      LEFT JOIN file_tags ft ON ft.id = ftl.tag_id
      WHERE fsi.content LIKE ?
      GROUP BY mf.id
      ORDER BY mf.id DESC
      LIMIT 50
    `).all(like);
    res.json(rows.map(rowToFile));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Record / version a file
app.post('/api/files/record', async (req, res) => {
  const { filename, original_name, type, size, message_id } = req.body;
  if (!filename) return res.status(400).json({ error: 'filename required' });

  const now = Math.floor(Date.now() / 1000);
  const filePath = getFilePath(filename);
  const actualSize = size || (fs.existsSync(filePath) ? fs.statSync(filePath).size : 0);
  const vg = findVersionGroup(original_name || filename);

  // Check duplicate by original_name (case-insensitive)
  const existing = db.prepare(`SELECT * FROM message_files WHERE LOWER(original_name) = LOWER(?) ORDER BY id DESC LIMIT 1`).get(original_name || filename);

  let fileId;
  if (existing) {
    recordFileVersion(existing.id);
    db.prepare(`
      UPDATE message_files
      SET filename = ?, type = ?, size = ?, timestamp = ?, last_accessed_at = ?, version_group = ?
      WHERE id = ?
    `).run(filename, type, actualSize, now, now, vg, existing.id);
    fileId = existing.id;
  } else {
    const result = db.prepare(`
      INSERT INTO message_files (message_id, filename, original_name, type, size, timestamp, last_accessed_at, version_group)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(message_id || null, filename, original_name || filename, type, actualSize, now, now, vg);
    fileId = result.lastInsertRowid;
  }

  // Index asynchronously; don't block response
  indexFile(fileId).catch(console.error);

  res.json({ id: fileId, filename, original_name: original_name || filename });
});

// Tags collection
app.get('/api/files/tags', (req, res) => {
  const rows = db.prepare(`
    SELECT ft.id, ft.name, ft.color, COUNT(ftl.file_id) AS count
    FROM file_tags ft
    LEFT JOIN file_tag_links tlt ON tlt.tag_id = ft.id
    LEFT JOIN file_tag_links ftl ON ftl.tag_id = ft.id
    GROUP BY ft.id
    ORDER BY ft.name
  `).all();
  res.json(rows);
});

// Folders collection
app.get('/api/files/folders', (req, res) => {
  const rows = db.prepare('SELECT * FROM file_folders ORDER BY name').all();
  res.json(rows);
});

app.post('/api/files/folders', (req, res) => {
  const { name, parent_id } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const result = db.prepare('INSERT INTO file_folders (name, parent_id) VALUES (?, ?)').run(name, parent_id || null);
  res.json({ id: result.lastInsertRowid, name, parent_id: parent_id || null });
});

app.patch('/api/files/folders/:id', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  db.prepare('UPDATE file_folders SET name = ? WHERE id = ?').run(name, req.params.id);
  res.json({ success: true });
});

app.delete('/api/files/folders/:id', (req, res) => {
  db.prepare('UPDATE message_files SET folder_id = NULL WHERE folder_id = ?').run(req.params.id);
  db.prepare('DELETE FROM file_folders WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Duplicates
app.get('/api/files/duplicates', (req, res) => {
  const rows = db.prepare(`
    SELECT content_hash, COUNT(*) AS count, GROUP_CONCAT(id) AS ids, GROUP_CONCAT(filename) AS names
    FROM message_files
    WHERE content_hash IS NOT NULL
    GROUP BY content_hash
    HAVING count > 1
  `).all();
  const result = rows.map(r => {
    const ids = r.ids.split(',');
    const names = r.names.split(',');
    return {
      hash: r.content_hash,
      count: r.count,
      files: ids.map((id, i) => ({ id: parseInt(id), filename: names[i] }))
    };
  });
  res.json(result);
});

app.post('/api/files/duplicates/resolve', (req, res) => {
  const { keep, remove } = req.body;
  if (!Array.isArray(remove)) return res.status(400).json({ error: 'remove array required' });
  const ids = remove.map(id => parseInt(id)).filter(Boolean);
  ids.forEach(id => {
    const file = db.prepare('SELECT * FROM message_files WHERE id = ?').get(id);
    if (!file || (keep !== undefined && String(file.id) === String(keep))) return;
    const filePath = getFilePath(file.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    db.prepare('DELETE FROM file_versions WHERE file_id = ?').run(id);
    db.prepare('DELETE FROM file_activity WHERE file_id = ?').run(id);
    db.prepare('DELETE FROM file_search_index WHERE file_id = ?').run(id);
    db.prepare('DELETE FROM message_files WHERE id = ?').run(id);
  });
  res.json({ success: true });
});

// Stats
app.get('/api/files/stats', (req, res) => {
  const totalFiles = db.prepare('SELECT COUNT(*) AS c FROM message_files').get().c;
  const totalSize = db.prepare('SELECT COALESCE(SUM(size), 0) AS s FROM message_files').get().s;
  const favoriteCount = db.prepare('SELECT COUNT(*) AS c FROM message_files WHERE favorite = 1').get().c;
  const dupRows = db.prepare(`
    SELECT content_hash, COUNT(*) AS count
    FROM message_files
    WHERE content_hash IS NOT NULL
    GROUP BY content_hash
    HAVING count > 1
  `).all();
  const duplicateGroups = dupRows.length;
  const duplicatesCount = dupRows.reduce((sum, r) => sum + r.count, 0);
  res.json({
    totalFiles,
    totalSize,
    favoriteCount,
    duplicateGroups,
    duplicatesCount,
    storageLimit: null
  });
});

// Single file metadata
app.get('/api/files/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
  const row = db.prepare(`
    SELECT mf.*,
      m.conversation_id,
      c.title AS conversation_title,
      GROUP_CONCAT(ft.name) AS tag_list
    FROM message_files mf
    LEFT JOIN messages m ON mf.message_id = m.id
    LEFT JOIN conversations c ON m.conversation_id = c.id
    LEFT JOIN file_tag_links ftl ON ftl.file_id = mf.id
    LEFT JOIN file_tags ft ON ft.id = ftl.tag_id
    WHERE mf.id = ?
    GROUP BY mf.id
  `).get(id);
  if (!row) return res.status(404).json({ error: 'File not found' });
  db.prepare('UPDATE message_files SET last_accessed_at = ? WHERE id = ?').run(Math.floor(Date.now() / 1000), id);
  res.json(rowToFile(row));
});

// Download
app.get('/api/files/:id/download', (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
  const file = db.prepare('SELECT * FROM message_files WHERE id = ?').get(id);
  if (!file) return res.status(404).json({ error: 'File not found' });
  const filePath = getFilePath(file.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found on disk' });
  db.prepare('UPDATE message_files SET last_accessed_at = ? WHERE id = ?').run(Math.floor(Date.now() / 1000), id);
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.original_name || file.filename)}"`);
  res.setHeader('Content-Type', file.type || 'application/octet-stream');
  fs.createReadStream(filePath).pipe(res);
});

// Preview
app.get('/api/files/:id/preview', (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
  const file = db.prepare('SELECT * FROM message_files WHERE id = ?').get(id);
  if (!file) return res.status(404).json({ error: 'File not found' });
  const filePath = getFilePath(file.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found on disk' });
  db.prepare('UPDATE message_files SET last_accessed_at = ? WHERE id = ?').run(Math.floor(Date.now() / 1000), id);
  res.setHeader('Content-Disposition', 'inline');
  res.setHeader('Content-Type', file.type || 'application/octet-stream');
  fs.createReadStream(filePath).pipe(res);
});

// Update file
app.patch('/api/files/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
  const { original_name, folder_id, favorite } = req.body;
  const updates = [];
  const params = [];
  if (original_name !== undefined) { updates.push('original_name = ?'); params.push(original_name); }
  if (folder_id !== undefined) { updates.push('folder_id = ?'); params.push(folder_id); }
  if (favorite !== undefined) { updates.push('favorite = ?'); params.push(favorite ? 1 : 0); }
  if (!updates.length) return res.status(400).json({ error: 'No fields to update' });
  params.push(id);
  db.prepare(`UPDATE message_files SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  logActivity(id, 'updated', req.body);
  res.json({ success: true });
});

// Manage tags on a file
app.post('/api/files/:id/tags', (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
  const { add = [], remove = [] } = req.body;

  for (const tagName of add) {
    let tag = db.prepare('SELECT * FROM file_tags WHERE name = ?').get(tagName);
    if (!tag) {
      const result = db.prepare('INSERT INTO file_tags (name, color) VALUES (?, ?)').run(tagName, null);
      tag = { id: result.lastInsertRowid };
    }
    db.prepare('INSERT OR IGNORE INTO file_tag_links (file_id, tag_id) VALUES (?, ?)').run(id, tag.id);
  }

  for (const tagName of remove) {
    const tag = db.prepare('SELECT * FROM file_tags WHERE name = ?').get(tagName);
    if (tag) {
      db.prepare('DELETE FROM file_tag_links WHERE file_id = ? AND tag_id = ?').run(id, tag.id);
    }
  }

  const tagRows = db.prepare(`
    SELECT ft.name FROM file_tag_links ftl
    JOIN file_tags ft ON ft.id = ftl.tag_id
    WHERE ftl.file_id = ?
  `).all(id);
  const tagNames = tagRows.map(r => r.name).join(',');
  db.prepare('UPDATE message_files SET tags = ? WHERE id = ?').run(tagNames, id);
  logActivity(id, 'tags_updated', { add, remove });
  res.json({ success: true, tags: tagNames });
});

// Versions
app.get('/api/files/:id/versions', (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
  const rows = db.prepare('SELECT * FROM file_versions WHERE file_id = ? ORDER BY created_at DESC').all(id);
  res.json(rows);
});

app.post('/api/files/:id/versions/:versionId/restore', (req, res) => {
  const id = parseInt(req.params.id);
  const versionId = parseInt(req.params.versionId);
  if (isNaN(id) || isNaN(versionId)) return res.status(400).json({ error: 'Invalid id' });
  const version = db.prepare('SELECT * FROM file_versions WHERE id = ? AND file_id = ?').get(versionId, id);
  if (!version) return res.status(404).json({ error: 'Version not found' });
  recordFileVersion(id);
  db.prepare(`
    UPDATE message_files
    SET filename = ?, original_name = ?, type = ?, size = ?, content_hash = ?
    WHERE id = ?
  `).run(version.filename, version.original_name, version.type, version.size, version.content_hash, id);
  logActivity(id, 'restored_version', { versionId });
  res.json({ success: true });
});

// Activity
app.get('/api/files/:id/activity', (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
  const rows = db.prepare('SELECT * FROM file_activity WHERE file_id = ? ORDER BY created_at DESC').all(id);
  res.json(rows);
});

// Delete file (by numeric id) OR legacy filename delete for backward compat
app.delete('/api/files/:id', (req, res) => {
  const param = req.params.id;
  if (/^\d+$/.test(param)) {
    const id = parseInt(param);
    const file = db.prepare('SELECT * FROM message_files WHERE id = ?').get(id);
    if (!file) return res.status(404).json({ error: 'File not found' });
    const filePath = getFilePath(file.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    db.prepare('DELETE FROM file_versions WHERE file_id = ?').run(id);
    db.prepare('DELETE FROM file_activity WHERE file_id = ?').run(id);
    db.prepare('DELETE FROM file_search_index WHERE file_id = ?').run(id);
    db.prepare('DELETE FROM file_tag_links WHERE file_id = ?').run(id);
    db.prepare('DELETE FROM message_files WHERE id = ?').run(id);
    res.json({ success: true });
  } else {
    // Legacy filename-based deletion
    const filePath = path.join(uploadsDir, path.basename(param));
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'File not found' });
    }
  }
});

// Bulk delete
app.post('/api/files/bulk-delete', (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids array required' });
  ids.forEach(id => {
    const file = db.prepare('SELECT * FROM message_files WHERE id = ?').get(id);
    if (!file) return;
    const filePath = getFilePath(file.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    db.prepare('DELETE FROM file_versions WHERE file_id = ?').run(id);
    db.prepare('DELETE FROM file_activity WHERE file_id = ?').run(id);
    db.prepare('DELETE FROM file_search_index WHERE file_id = ?').run(id);
    db.prepare('DELETE FROM file_tag_links WHERE file_id = ?').run(id);
    db.prepare('DELETE FROM message_files WHERE id = ?').run(id);
  });
  res.json({ success: true });
});

// Bulk download (returns base64 JSON; client builds ZIP with JSZip)
app.post('/api/files/bulk-download', (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids array required' });
  const files = [];
  for (const id of ids) {
    const file = db.prepare('SELECT * FROM message_files WHERE id = ?').get(id);
    if (!file) continue;
    const filePath = getFilePath(file.filename);
    if (!fs.existsSync(filePath)) continue;
    const content = fs.readFileSync(filePath).toString('base64');
    files.push({ id: file.id, name: file.original_name || file.filename, content });
  }
  res.json({ files });
});

// ---------- Existing app routes ----------

// Conversations
app.get('/api/conversations', (req, res) => {
  const { q } = req.query;
  let rows;
  if (q) {
    rows = db.prepare("SELECT * FROM conversations WHERE title LIKE ? ORDER BY favorite DESC, updated_at DESC").all(`%${q}%`);
  } else {
    rows = db.prepare('SELECT * FROM conversations ORDER BY favorite DESC, updated_at DESC').all();
  }
  res.json(rows);
});

app.post('/api/conversations', (req, res) => {
  const { title } = req.body;
  const result = db.prepare('INSERT INTO conversations (title) VALUES (?)').run(title || 'New Chat');
  res.json({ id: result.lastInsertRowid });
});

app.patch('/api/conversations/:id', (req, res) => {
  const { title, favorite, folder } = req.body;
  const updates = [];
  const params = [];
  if (title !== undefined) { updates.push('title = ?'); params.push(title); }
  if (favorite !== undefined) { updates.push('favorite = ?'); params.push(favorite ? 1 : 0); }
  if (folder !== undefined) { updates.push('folder = ?'); params.push(folder); }
  if (updates.length > 0) {
    params.push(req.params.id);
    db.prepare(`UPDATE conversations SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  }
  res.json({ success: true });
});

app.delete('/api/conversations/:id', (req, res) => {
  db.prepare('DELETE FROM messages WHERE conversation_id = ?').run(req.params.id);
  db.prepare('DELETE FROM conversations WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Get messages
app.get('/api/messages', (req, res) => {
  const rows = db.prepare('SELECT * FROM messages ORDER BY timestamp ASC').all();
  res.json(rows);
});

// Memory endpoints
app.get('/api/memories', (req, res) => {
  const { q } = req.query;
  let rows;
  if (q) {
    rows = db.prepare("SELECT * FROM memories WHERE key LIKE ? OR value LIKE ? ORDER BY pinned DESC, timestamp DESC").all(`%${q}%`, `%${q}%`);
  } else {
    rows = db.prepare('SELECT * FROM memories ORDER BY pinned DESC, timestamp DESC').all();
  }
  res.json(rows);
});

app.post('/api/memories', (req, res) => {
  const { key, value } = req.body;
  const result = db.prepare('INSERT INTO memories (key, value) VALUES (?, ?)').run(key, value);
  res.json({ id: result.lastInsertRowid });
});

app.patch('/api/memories/:id', (req, res) => {
  const { key, value } = req.body;
  db.prepare('UPDATE memories SET key = ?, value = ? WHERE id = ?').run(key, value, req.params.id);
  res.json({ success: true });
});

app.patch('/api/memories/:id/pin', (req, res) => {
  const { pinned } = req.body;
  db.prepare('UPDATE memories SET pinned = ? WHERE id = ?').run(pinned ? 1 : 0, req.params.id);
  res.json({ success: true });
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
    const baseUrl = process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai';
    const apiKey = process.env.GOOGLE_API_KEY;
    const model = process.env.VISION_MODEL || 'gemini-2.5-flash';

    const imageType = detectImageType(question, [], []);
    const systemNote = buildVisionSystemNote(imageType);
    const promptText = systemNote
      ? `${systemNote}\n\nUser question: ${question || 'What do you see in this image?'}`
      : (question || 'What do you see in this image?');

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: promptText },
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

// Web search endpoint (DuckDuckGo fallback)
app.get('/api/search', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Missing query' });

  try {
    const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NexusAI/1.0)' }
    });
    const html = await response.text();

    const results = [];
    const regex = /<a rel="nofollow" class="result__a" href="([^"]+)">([^<]+)<\/a>.*?<a class="result__snippet"[^>]*>([^<]+)<\/a>/gs;
    let match;
    while ((match = regex.exec(html)) && results.length < 5) {
      results.push({
        title: match[2].replace(/<[^>]+>/g, '').trim(),
        url: match[1].trim(),
        snippet: match[3].replace(/<[^>]+>/g, '').trim()
      });
    }

    res.json({ results });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Search failed' });
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

    // Get current model from settings
    const modelRow = db.prepare("SELECT value FROM settings WHERE key = 'model'").get();
    const model = modelRow?.value || process.env.AI_MODEL || 'gemini-2.5-flash';

    // Save user message and link any attachments
    const safeContent = typeof message === 'string' ? message : '';
    const userMessageInsert = db.prepare('INSERT INTO messages (role, content) VALUES (?, ?)');
    const userResult = userMessageInsert.run('user', safeContent || '(no text)');
    const userMessageId = userResult.lastInsertRowid;

    if (Array.isArray(data.attachments) && data.attachments.length > 0) {
      const linkAttachment = db.prepare(`
        INSERT INTO message_files (message_id, filename, original_name, type, size, timestamp, last_accessed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      const now = Math.floor(Date.now() / 1000);
      for (const a of data.attachments) {
        try {
          linkAttachment.run(
            userMessageId,
            a.filename || a.name,
            a.original_name || a.name || a.filename,
            a.type || 'file',
            a.size || 0,
            now,
            now
          );
        } catch (e) {
          console.error('[chat-message] failed to link attachment', a, e.message);
        }
      }
    }

    const hasImageAttachment = Array.isArray(data.attachments) && data.attachments.some(a => {
      const mime = (a.type || '').toLowerCase();
      if (mime.startsWith('image/')) return true;
      const name = (a.original_name || a.filename || '').toLowerCase();
      return /\.(png|jpg|jpeg|gif|webp|bmp|svg)$/.test(name);
    });
    const useVisionModel = hasImageAttachment;
    const selectedModel = useVisionModel
      ? (process.env.VISION_MODEL || 'gemini-2.5-flash')
      : model;

    // Pre-extract OCR from image attachments so the prompt can include visible text
    // OCR is best-effort; failures are logged and ignored so vision analysis continues.
    if (useVisionModel) {
      for (const a of data.attachments) {
        const mime = (a.type || '').toLowerCase();
        const name = (a.original_name || a.filename || '').toLowerCase();
        const isImage = mime.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp|bmp|svg)$/.test(name);
        if (!isImage) continue;
        const filePath = getFilePath(a.filename || a.name);
        if (fs.existsSync(filePath)) {
          try { await ocrImage(filePath).catch(() => {}); }
          catch (e) { console.error('[chat-message] OCR failed, continuing with image analysis:', e.message); }
        }
      }
    }

    const userContent = useVisionModel
      ? buildVisionContent(message, data.attachments, { imageType: 'auto' })
      : message;

    // Guard: if we intended to use vision but no images could be loaded, tell the user.
    if (useVisionModel) {
      const hasImageUrl = Array.isArray(userContent) && userContent.some(c => c.type === 'image_url');
      if (!hasImageUrl) {
        socket.emit('ai-start');
        socket.emit('ai-error', "I couldn't load the image. It may be missing or not a supported image format.");
        return;
      }
    }

    // Stream from LLM
    try {
      const apiUrl = process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai';
      const apiKey = process.env.GOOGLE_API_KEY;
      const response = await fetch(`${apiUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: [
            ...(Array.isArray(history) ? history.map(m => ({ role: m.role, content: m.content })) : []),
            { role: 'user', content: userContent }
          ],
          stream: true,
          max_tokens: 1024
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('[chat-message] LLM error body:', errText.slice(0, 500));
        const friendly = useVisionModel
          ? `I couldn't analyze the image right now (${response.status}). Please try again in a moment.`
          : `AI request failed (${response.status}). Please try again.`;
        socket.emit('ai-error', friendly);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let aiResponse = '';
      let buffer = '';
      let hasReceivedChunk = false;

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
              hasReceivedChunk = true;
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
              hasReceivedChunk = true;
              aiResponse += content;
              socket.emit('ai-chunk', content);
            }
          } catch (e) {}
        }
      }

      if (!hasReceivedChunk) {
        socket.emit('ai-error', 'The image could not be analyzed. Please try again or rephrase your question.');
        return;
      }

      // Save AI response
      db.prepare('INSERT INTO messages (role, content) VALUES (?, ?)').run('assistant', aiResponse);
      socket.emit('ai-end');

    } catch (err) {
      console.error('LLM error:', err);
      const friendly = useVisionModel
        ? "I couldn't analyze the image due to a connection issue. Please check your network and try again."
        : 'Failed to get AI response. Please try again.';
      socket.emit('ai-error', friendly);
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
