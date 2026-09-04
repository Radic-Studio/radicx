const SUPABASE_BROWSER_SDK = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.4/+esm';

let clientPromise;

function readRuntimeConfig() {
  const config = globalThis.window?.__RADICX_CONFIG__ ?? {};
  const supabaseUrl = String(config.supabaseUrl ?? '').trim();
  const supabasePublishableKey = String(config.supabasePublishableKey ?? '').trim();

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error('RadicX authentication is not configured for this environment.');
  }

  let parsed;
  try {
    parsed = new URL(supabaseUrl);
  } catch {
    throw new Error('RadicX authentication configuration is invalid.');
  }

  const local = parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost';
  if (parsed.protocol !== 'https:' && !local) {
    throw new Error('RadicX authentication requires HTTPS outside local development.');
  }

  if (!supabasePublishableKey.startsWith('sb_publishable_') && !supabasePublishableKey.startsWith('eyJ')) {
    throw new Error('RadicX publishable-key configuration is invalid.');
  }

  return { supabaseUrl, supabasePublishableKey };
}

export async function getSupabaseClient() {
  if (!clientPromise) {
    clientPromise = (async () => {
      const { supabaseUrl, supabasePublishableKey } = readRuntimeConfig();
      const { createClient } = await import(SUPABASE_BROWSER_SDK);
      return createClient(supabaseUrl, supabasePublishableKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
          flowType: 'pkce'
        }
      });
    })();
  }

  return clientPromise;
}

export function getSupabaseBrowserSdkVersion() {
  return '2.112.4';
}
