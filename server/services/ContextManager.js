const DEFAULT_CONFIG = {
  maxMessagesInWindow: 15,
  maxTokensInWindow: 6000,
  summaryThreshold: 30,
  summaryRegenerationMargin: 10, // new messages since last summary before regenerating
  summaryModel: process.env.SUMMARY_MODEL || 'gemini-2.5-flash',
  maxSummaryAgeMs: 24 * 60 * 60 * 1000, // 24 hours
  systemPrompt: 'You are a helpful AI assistant. You can see a summary of older conversation and the most recent messages below.'
};

class ContextManager {
  constructor(db, config = {}) {
    this.db = db;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initSchema();
  }

  initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS conversation_summaries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id INTEGER NOT NULL,
        summary TEXT NOT NULL,
        message_count INTEGER NOT NULL,
        created_at INTEGER DEFAULT (unixepoch()),
        updated_at INTEGER DEFAULT (unixepoch()),
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_summary_conversation ON conversation_summaries(conversation_id);
    `);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS conversation_metadata (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id INTEGER NOT NULL,
        key TEXT NOT NULL,
        value TEXT,
        timestamp INTEGER DEFAULT (unixepoch()),
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_metadata_conversation ON conversation_metadata(conversation_id);
    `);
  }

  migrateOrphanMessages() {
    // Link existing messages without a conversation to the default conversation.
    // This preserves all history across the app upgrade.
    const table = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='messages'").get();
    if (!table) return;

    const orphans = this.db.prepare('SELECT COUNT(*) as count FROM messages WHERE conversation_id IS NULL').get();
    if (orphans.count === 0) return;

    const defaultId = this.ensureConversation('Default Conversation');
    const tx = this.db.transaction(() => {
      this.db.prepare('UPDATE messages SET conversation_id = ? WHERE conversation_id IS NULL').run(defaultId);
      this.db.prepare('UPDATE conversations SET updated_at = unixepoch() WHERE id = ?').run(defaultId);
    });
    tx();
    console.log(`[ContextManager] Migrated ${orphans.count} orphan messages to conversation ${defaultId}`);
  }

  // Token estimator: rough, fast, no external dependencies
  // ~4 chars per token for English; 1 message overhead = ~4 tokens
  estimateTokens(messages) {
    let tokens = 0;
    for (const m of messages) {
      const text = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
      tokens += Math.ceil(text.length / 4) + 4; // message overhead
    }
    return tokens;
  }

  ensureConversation(title = 'Default Conversation') {
    const existing = this.db.prepare('SELECT id FROM conversations WHERE title = ?').get(title);
    if (existing) return existing.id;
    const result = this.db.prepare('INSERT INTO conversations (title) VALUES (?)').run(title);
    return result.lastInsertRowid;
  }

  createConversation(title = 'New Chat') {
    const result = this.db.prepare('INSERT INTO conversations (title, updated_at) VALUES (?, unixepoch())').run(title);
    return result.lastInsertRowid;
  }

  updateConversationTitle(id, title) {
    this.db.prepare('UPDATE conversations SET title = ?, updated_at = unixepoch() WHERE id = ?').run(title, id);
  }

  touchConversation(id) {
    this.db.prepare('UPDATE conversations SET updated_at = unixepoch() WHERE id = ?').run(id);
  }

  getOrCreateActiveConversation() {
    // For now, app uses one active conversation. Future: support multiple.
    const active = this.db.prepare('SELECT id FROM conversations ORDER BY updated_at DESC LIMIT 1').get();
    if (active) return active.id;
    return this.ensureConversation('Default Conversation');
  }

  generateTitleFromMessage(message) {
    if (!message) return 'New Chat';
    const text = typeof message === 'string' ? message : JSON.stringify(message);
    const cleaned = text.trim().replace(/\s+/g, ' ');
    if (!cleaned) return 'New Chat';
    // Truncate to first ~40 chars or first sentence
    const sentence = cleaned.split(/[.!?]/)[0].trim();
    const title = sentence.length > 0 && sentence.length <= 60 ? sentence : cleaned.slice(0, 60);
    return title.length >= cleaned.length ? title : title + '...';
  }

  getMessagesForConversation(conversationId) {
    return this.db.prepare(
      'SELECT id, role, content, timestamp FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC'
    ).all(conversationId);
  }

  getRecentMessages(conversationId, limit) {
    return this.db.prepare(
      'SELECT id, role, content, timestamp FROM messages WHERE conversation_id = ? ORDER BY timestamp DESC LIMIT ?'
    ).all(conversationId, limit).reverse();
  }

  getLatestSummary(conversationId) {
    const ageCutoff = Math.floor((Date.now() - this.config.maxSummaryAgeMs) / 1000);
    return this.db.prepare(
      `SELECT * FROM conversation_summaries 
       WHERE conversation_id = ? AND updated_at > ? 
       ORDER BY updated_at DESC LIMIT 1`
    ).get(conversationId, ageCutoff);
  }

  async maybeGenerateSummary(conversationId, llmService) {
    const messages = this.getMessagesForConversation(conversationId);
    if (messages.length < this.config.summaryThreshold) return null;

    const existing = this.getLatestSummary(conversationId);
    if (existing) {
      // Regenerate only if enough new messages have accumulated since the last summary
      const newMessagesSinceSummary = messages.length - existing.message_count - this.config.maxMessagesInWindow;
      if (newMessagesSinceSummary < this.config.summaryRegenerationMargin) {
        return existing;
      }
    }

    // Summarize all messages older than the sliding window
    const messagesToSummarize = messages.slice(0, -this.config.maxMessagesInWindow);
    if (messagesToSummarize.length < 5) return null;

    const summaryText = await this.generateSummary(messagesToSummarize, llmService);
    if (!summaryText) return null;

    const result = this.db.prepare(
      'INSERT INTO conversation_summaries (conversation_id, summary, message_count) VALUES (?, ?, ?)'
    ).run(conversationId, summaryText, messagesToSummarize.length);

    return {
      id: result.lastInsertRowid,
      conversation_id: conversationId,
      summary: summaryText,
      message_count: messagesToSummarize.length
    };
  }

  async generateSummary(messages, llmService) {
    if (!llmService) return null;
    const promptMessages = messages.map(m => ({ role: m.role, content: m.content }));
    promptMessages.push({
      role: 'user',
      content: 'Summarize the key facts, user preferences, decisions, and context from this conversation in 2-3 concise paragraphs. Only include information that would be useful for continuing the conversation.'
    });

    try {
      return await llmService.complete({
        model: this.config.summaryModel,
        messages: promptMessages,
        max_tokens: 400,
        temperature: 0.3
      });
    } catch (err) {
      console.error('[ContextManager] Summary generation failed:', err.message);
      return null;
    }
  }

  // Future: replace with embedding-based retrieval
  async retrieveRelevantContext(conversationId, query) {
    // RAG placeholder: for now, return summary + recent messages.
    // Future implementation: vectorize query, search stored embeddings of older messages.
    return this.getRecentMessages(conversationId, this.config.maxMessagesInWindow);
  }

  async buildContext({ conversationId, history, userPrompt, llmService, recentOnly = false }) {
    const activeConversationId = conversationId || this.getOrCreateActiveConversation();
    
    // If DB is empty or no conversation id, fall back to frontend history
    let dbMessages = this.getMessagesForConversation(activeConversationId);
    if (!dbMessages.length && history && history.length) {
      dbMessages = history.map((m, i) => ({ id: -i, role: m.role, content: m.content, timestamp: Date.now() + i }));
    }

    if (recentOnly) {
      const recent = dbMessages.slice(-this.config.maxMessagesInWindow);
      return this.toMessages(recent, userPrompt);
    }

    // Generate summary if threshold reached
    let summary = null;
    if (llmService && dbMessages.length >= this.config.summaryThreshold) {
      summary = await this.maybeGenerateSummary(activeConversationId, llmService);
    }

    // Get recent window; exclude the very last message because it is the
    // current user turn and we will append the augmented userPrompt separately.
    let recentMessages = dbMessages.slice(-(this.config.maxMessagesInWindow + 1), -1);
    if (recentMessages.length === 0) {
      recentMessages = dbMessages.slice(-this.config.maxMessagesInWindow);
    }

    // Apply token budget: trim from oldest in window if needed
    const userPromptTokens = this.estimateTokens([{ content: userPrompt }]);
    const summaryText = summary ? summary.summary : '';
    const summaryMessageTokens = summaryText ? this.estimateTokens([{ content: summaryText }]) : 0;
    const systemTokens = this.estimateTokens([{ content: this.config.systemPrompt }]);
    const availableTokens = this.config.maxTokensInWindow - userPromptTokens - summaryMessageTokens - systemTokens;

    while (recentMessages.length > 0 && this.estimateTokens(recentMessages) > availableTokens) {
      recentMessages.shift();
    }

    return this.toMessages(recentMessages, userPrompt, summaryText);
  }

  toMessages(recentMessages, userPrompt, summaryText = '') {
    const messages = [];

    if (this.config.systemPrompt) {
      messages.push({ role: 'system', content: this.config.systemPrompt });
    }

    if (summaryText) {
      messages.push({ role: 'system', content: `Summary of earlier conversation: ${summaryText}` });
    }

    for (const m of recentMessages) {
      messages.push({ role: m.role, content: m.content });
    }

    messages.push({ role: 'user', content: userPrompt });
    return messages;
  }

  // Link a saved message to a conversation
  linkMessageToConversation(messageId, conversationId) {
    if (!conversationId || !messageId) return;
    this.db.prepare('UPDATE messages SET conversation_id = ? WHERE id = ?').run(conversationId, messageId);
  }

  updateConfig(overrides) {
    this.config = { ...this.config, ...overrides };
  }
}

module.exports = ContextManager;
