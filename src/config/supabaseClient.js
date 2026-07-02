const { createClient } = require('@supabase/supabase-js');
const WebSocket = require('ws');
const { supabaseUrl, supabaseServiceRoleKey } = require('./env');

const isConfigured = Boolean(supabaseUrl && supabaseServiceRoleKey);

let cachedClient = null;

function getSupabaseClient() {
  if (!isConfigured) {
    throw new Error(
      'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in backend/.env',
    );
  }

  if (cachedClient) {
    return cachedClient;
  }

  cachedClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false },
    realtime: {
      transport: WebSocket,
    },
  });

  return cachedClient;
}

module.exports = { getSupabaseClient, isConfigured };

