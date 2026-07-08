const GEMINI_BASE_URL = process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai';

async function complete({ model, messages, max_tokens = 400, temperature = 0.3 }) {
  if (!process.env.GOOGLE_API_KEY) {
    throw new Error('GOOGLE_API_KEY is not set');
  }

  const response = await fetch(`${GEMINI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.GOOGLE_API_KEY}`
    },
    body: JSON.stringify({ model, messages, max_tokens, temperature })
  });

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error.message || 'Gemini API error');
  }
  return data.choices?.[0]?.message?.content || '';
}

module.exports = { complete };
