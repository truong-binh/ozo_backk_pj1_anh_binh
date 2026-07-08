const { groqApiKey, groqModel } = require('../../config/env');
const { getDeclarations, executeTool } = require('./tools');
const { buildSystemPrompt } = require('./systemPrompt');

const isGroqConfigured = Boolean(groqApiKey);
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MAX_TOOL_ROUNDS = 6;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Chuyển schema kiểu Gemini (type IN HOA) -> JSON Schema chuẩn OpenAI (type thường).
// Với field số: cho phép CẢ number lẫn string vì Llama/Groq hay xuất số dưới dạng
// chuỗi ("15") rồi Groq validate strict -> 400. execute() đã Number() ép kiểu lại.
function lowerSchema(s) {
  if (!s || typeof s !== 'object') return s;
  const out = {};
  for (const k of Object.keys(s)) {
    if (k === 'type' && typeof s[k] === 'string') {
      const t = s[k].toLowerCase();
      out[k] = t === 'number' || t === 'integer' ? [t, 'string'] : t;
    } else if (k === 'properties') {
      out[k] = {};
      for (const p of Object.keys(s[k])) out[k][p] = lowerSchema(s[k][p]);
    } else if (k === 'items') out[k] = lowerSchema(s[k]);
    else out[k] = s[k];
  }
  return out;
}

function openAITools() {
  return getDeclarations().map((d) => ({
    type: 'function',
    function: {
      name: d.name,
      description: d.description,
      parameters: lowerSchema(d.parameters) || { type: 'object', properties: {} },
    },
  }));
}

async function callGroq(body) {
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${groqApiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (res.status === 429) {
    const retry = Number(res.headers.get('retry-after')) || 20;
    const err = new Error('GROQ_RATE_LIMIT');
    err.status = 429;
    err.retrySec = retry;
    throw err;
  }
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Groq ${res.status}: ${data?.error?.message || JSON.stringify(data)}`);
  }
  return data;
}

// Gọi Groq, tự chờ + thử lại 1 lần nếu 429 và thời gian chờ hợp lý.
async function callGroqRetry(body) {
  try {
    return await callGroq(body);
  } catch (err) {
    if (err.status === 429 && err.retrySec && err.retrySec <= 30) {
      await sleep((err.retrySec + 1) * 1000);
      return await callGroq(body);
    }
    throw err;
  }
}

/**
 * Chạy 1 lượt hội thoại (OpenAI-style messages).
 * @param {string} userText
 * @param {Array}  history  messages trước đó (KHÔNG gồm system, KHÔNG gồm userText)
 * @param {object} ctx      { authed, email, picName }
 * @returns {{ text: string, history: Array }}
 */
async function runAgent(userText, history, ctx) {
  if (!isGroqConfigured) {
    return { text: '⚠️ Chatbot chưa cấu hình GROQ_API_KEY.', history: history || [] };
  }

  const messages = [
    { role: 'system', content: buildSystemPrompt(ctx) },
    ...(history || []),
    { role: 'user', content: userText },
  ];
  const tools = openAITools();

  let finalText = '';
  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const forceText = round === MAX_TOOL_ROUNDS - 1;
      const data = await callGroqRetry({
        model: groqModel,
        messages,
        tools,
        tool_choice: forceText ? 'none' : 'auto',
        temperature: 0.3,
      });

      const msg = data.choices?.[0]?.message || { role: 'assistant', content: '' };
      messages.push(msg);

      const calls = msg.tool_calls || [];
      if (!calls.length) {
        finalText = msg.content || '';
        break;
      }

      for (const tc of calls) {
        let args = {};
        try {
          args = JSON.parse(tc.function.arguments || '{}');
        } catch {
          args = {};
        }
        const result = await executeTool(tc.function.name, args, ctx);
        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify({ result }),
        });
      }
    }
  } catch (err) {
    if (err.status === 429) {
      return {
        text: `⏳ Hệ thống đang bận (giới hạn tốc độ). Bạn thử lại sau ${err.retrySec || 30} giây nhé.`,
        history: history || [],
      };
    }
    throw err;
  }

  if (!finalText) finalText = 'Xin lỗi, tôi chưa tạo được câu trả lời. Bạn thử hỏi lại nhé.';

  // Lịch sử mới = messages trừ system (system dựng lại mỗi lượt).
  return { text: finalText, history: messages.slice(1) };
}

module.exports = { runAgent, isGroqConfigured };
