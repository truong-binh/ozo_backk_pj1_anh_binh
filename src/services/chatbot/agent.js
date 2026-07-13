// Chọn nhà cung cấp LLM cho chatbot theo env LLM_PROVIDER (groq | gemini | anthropic).
const { llmProvider } = require('../../config/env');
const groq = require('./groqAgent');
const gemini = require('./geminiAgent');
const anthropic = require('./anthropicAgent');

const provider =
  llmProvider === 'gemini' ? gemini : llmProvider === 'anthropic' ? anthropic : groq;

const runAgent = provider.runAgent;
const isLlmConfigured =
  llmProvider === 'gemini'
    ? gemini.isGeminiConfigured
    : llmProvider === 'anthropic'
      ? anthropic.isAnthropicConfigured
      : groq.isGroqConfigured;

module.exports = { runAgent, isLlmConfigured, provider: llmProvider };
