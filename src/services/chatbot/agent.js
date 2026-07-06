// Chọn nhà cung cấp LLM cho chatbot theo env LLM_PROVIDER (groq | gemini).
const { llmProvider } = require('../../config/env');
const groq = require('./groqAgent');
const gemini = require('./geminiAgent');

const provider = llmProvider === 'gemini' ? gemini : groq;

const runAgent = provider.runAgent;
const isLlmConfigured =
  llmProvider === 'gemini' ? gemini.isGeminiConfigured : groq.isGroqConfigured;

module.exports = { runAgent, isLlmConfigured, provider: llmProvider };
