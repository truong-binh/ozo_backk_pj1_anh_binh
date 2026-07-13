const { anthropicApiKey, anthropicModel } = require('../../config/env');
const { getDeclarations, executeTool } = require('./tools');
const { buildSystemPrompt } = require('./systemPrompt');

const isAnthropicConfigured = Boolean(anthropicApiKey);
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const MAX_TOOL_ROUNDS = 6;
const MAX_TOKENS = 2048;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Schema kiểu Gemini (type IN HOA) -> JSON Schema chuẩn (type thường) cho input_schema.
function lowerSchema(s) {
  if (!s || typeof s !== 'object') return s;
  const out = {};
  for (const k of Object.keys(s)) {
    if (k === 'type' && typeof s[k] === 'string') {
      out[k] = s[k].toLowerCase();
    } else if (k === 'properties') {
      out[k] = {};
      for (const p of Object.keys(s[k])) out[k][p] = lowerSchema(s[k][p]);
    } else if (k === 'items') {
      out[k] = lowerSchema(s[k]);
    } else {
      out[k] = s[k];
    }
  }
  return out;
}

// Tool declaration (dùng chung với Gemini/Groq) -> định dạng tools của Anthropic.
function anthropicTools() {
  return getDeclarations().map((d) => ({
    name: d.name,
    description: d.description,
    input_schema: lowerSchema(d.parameters) || { type: 'object', properties: {} },
  }));
}

async function callAnthropic(body) {
  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': anthropicApiKey,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: JSON.stringify(body),
  });
  if (res.status === 429) {
    const retry = Number(res.headers.get('retry-after')) || 20;
    const err = new Error('ANTHROPIC_RATE_LIMIT');
    err.status = 429;
    err.retrySec = retry;
    throw err;
  }
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Anthropic ${res.status}: ${data?.error?.message || JSON.stringify(data)}`);
  }
  return data;
}

// Gọi, tự chờ + thử lại 1 lần nếu 429 và thời gian chờ hợp lý.
async function callAnthropicRetry(body) {
  try {
    return await callAnthropic(body);
  } catch (err) {
    if (err.status === 429 && err.retrySec && err.retrySec <= 30) {
      await sleep((err.retrySec + 1) * 1000);
      return await callAnthropic(body);
    }
    throw err;
  }
}

/**
 * Chạy 1 lượt hội thoại qua Claude Messages API (có tool-calling).
 * @param {string} userText
 * @param {Array}  history  các lượt trước (chỉ user/assistant text — đã sạch)
 * @param {object} ctx      { authed, email, picName, dept, leadDepts }
 * @returns {{ text: string, history: Array }}
 */
async function runAgent(userText, history, ctx) {
  if (!isAnthropicConfigured) {
    return { text: '⚠️ Chatbot chưa cấu hình ANTHROPIC_API_KEY.', history: history || [] };
  }

  const system = buildSystemPrompt(ctx);
  // messages gửi API: history sạch (user/assistant text) + câu hỏi hiện tại.
  const messages = [...(history || []), { role: 'user', content: userText }];
  const tools = anthropicTools();

  let finalText = '';
  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const forceText = round === MAX_TOOL_ROUNDS - 1;
      const data = await callAnthropicRetry({
        model: anthropicModel,
        max_tokens: MAX_TOKENS,
        system,
        messages,
        tools,
        tool_choice: forceText ? { type: 'none' } : { type: 'auto' },
      });

      const blocks = Array.isArray(data.content) ? data.content : [];
      // Giữ nguyên assistant turn (gồm cả tool_use) để nối tool_result đúng cặp.
      messages.push({ role: 'assistant', content: blocks });

      const toolUses = blocks.filter((b) => b.type === 'tool_use');
      if (data.stop_reason !== 'tool_use' || !toolUses.length) {
        finalText = blocks
          .filter((b) => b.type === 'text')
          .map((b) => b.text)
          .join('\n')
          .trim();
        break;
      }

      // Thực thi từng tool_use -> gom tool_result vào 1 user message.
      const results = [];
      for (const tu of toolUses) {
        const result = await executeTool(tu.name, tu.input || {}, ctx);
        results.push({
          type: 'tool_result',
          tool_use_id: tu.id,
          content: JSON.stringify({ result }),
        });
      }
      messages.push({ role: 'user', content: results });
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

  // Lịch sử lưu lại chỉ giữ hội thoại text (không tool blocks) -> trimMessages an toàn,
  // luôn xen kẽ user/assistant và bắt đầu bằng user.
  const newHistory = [
    ...(history || []),
    { role: 'user', content: userText },
    { role: 'assistant', content: finalText },
  ];
  return { text: finalText, history: newHistory };
}

module.exports = { runAgent, isAnthropicConfigured };
