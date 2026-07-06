const { geminiApiKey, geminiModel } = require('../../config/env');
const { getDeclarations, executeTool } = require('./tools');
const { buildSystemPrompt } = require('./systemPrompt');

const isGeminiConfigured = Boolean(geminiApiKey);

// @google/genai là ESM -> nạp động từ CommonJS.
let genaiPromise = null;
async function getClient() {
  if (!genaiPromise) {
    genaiPromise = import('@google/genai').then(({ GoogleGenAI }) => new GoogleGenAI({ apiKey: geminiApiKey }));
  }
  return genaiPromise;
}

const MAX_TOOL_ROUNDS = 6;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Nhận diện lỗi hết quota (429) và lấy số giây cần chờ (nếu có).
function parseQuota(err) {
  const msg = String(err?.message || err || '');
  const is429 = err?.status === 429 || /RESOURCE_EXHAUSTED|429/.test(msg);
  if (!is429) return null;
  const m = /retry(?:Delay)?["\s:]+(\d+(?:\.\d+)?)s/i.exec(msg);
  const perDay = /PerDay/i.test(msg);
  return { retrySec: m ? Math.ceil(Number(m[1])) : null, perDay };
}

// Gọi Gemini, tự chờ + thử lại 1 lần nếu dính 429 giới hạn ngắn hạn (theo phút).
async function generateWithRetry(ai, req) {
  try {
    return await ai.models.generateContent(req);
  } catch (err) {
    const q = parseQuota(err);
    // Chỉ retry khi là giới hạn ngắn hạn và thời gian chờ hợp lý (<=30s).
    if (q && !q.perDay && q.retrySec && q.retrySec <= 30) {
      await sleep((q.retrySec + 1) * 1000);
      return await ai.models.generateContent(req);
    }
    throw err;
  }
}

/**
 * Chạy 1 lượt hội thoại.
 * @param {string} userText  tin nhắn của người dùng
 * @param {Array}  history   lịch sử [{role:'user'|'model', parts:[...]}] (không gồm userText)
 * @param {object} ctx       { authed, email, picName }
 * @returns {{ text: string, history: Array }}
 */
async function runAgent(userText, history, ctx) {
  if (!isGeminiConfigured) {
    return { text: '⚠️ Chatbot chưa cấu hình GEMINI_API_KEY.', history: history || [] };
  }
  const ai = await getClient();
  const contents = [...(history || []), { role: 'user', parts: [{ text: userText }] }];
  const config = {
    systemInstruction: buildSystemPrompt(ctx),
    tools: [{ functionDeclarations: getDeclarations() }],
  };

  let finalText = '';
  try {
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await generateWithRetry(ai, {
      model: geminiModel,
      contents,
      config,
    });

    const candidate = response.candidates?.[0];
    const modelContent = candidate?.content || { role: 'model', parts: [] };
    contents.push(modelContent);

    const calls = response.functionCalls || [];
    if (!calls.length) {
      finalText = response.text || '';
      break;
    }

    // Thực thi từng tool và gửi kết quả lại cho model.
    const responseParts = [];
    for (const call of calls) {
      const result = await executeTool(call.name, call.args, ctx);
      responseParts.push({
        functionResponse: { name: call.name, response: { result } },
      });
    }
    contents.push({ role: 'user', parts: responseParts });

    if (round === MAX_TOOL_ROUNDS - 1) {
      // Vòng cuối: ép model chốt bằng text.
      const wrap = await generateWithRetry(ai, { model: geminiModel, contents, config });
      finalText = wrap.text || '';
      contents.push(wrap.candidates?.[0]?.content || { role: 'model', parts: [{ text: finalText }] });
    }
  }
  } catch (err) {
    const q = parseQuota(err);
    if (q) {
      // Hết quota Gemini -> trả lời lịch sự, GIỮ NGUYÊN history cũ (không lưu lượt lỗi).
      const when = q.perDay
        ? 'Hạn mức miễn phí trong ngày đã hết, vui lòng thử lại vào ngày mai (hoặc bật billing cho API key).'
        : `Hệ thống đang bận (giới hạn tốc độ). Bạn thử lại sau ${q.retrySec || 30} giây nhé.`;
      return { text: `⏳ ${when}`, history: history || [] };
    }
    throw err;
  }

  if (!finalText) finalText = 'Xin lỗi, tôi chưa tạo được câu trả lời. Bạn thử hỏi lại nhé.';

  // Lịch sử mới = toàn bộ contents (gồm lượt vừa rồi).
  return { text: finalText, history: contents };
}

module.exports = { runAgent, isGeminiConfigured };
