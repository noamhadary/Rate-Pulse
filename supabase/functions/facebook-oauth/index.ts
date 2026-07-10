import { createClient } from 'npm:@supabase/supabase-js';

const APP_ID     = Deno.env.get('FACEBOOK_APP_ID')     ?? '';
const APP_SECRET = Deno.env.get('FACEBOOK_APP_SECRET') ?? '';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  // Auth guard — read user from JWT, not from request body
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'unauthorized' }, 401);

  const authClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) return json({ error: 'unauthorized' }, 401);

  try {
    const { code, redirect_uri } = await req.json();

    if (!code || !redirect_uri) {
      return json({ error: 'missing_params' }, 400);
    }

    // 1. Exchange code for short-lived user token
    const tokenUrl = `https://graph.facebook.com/v19.0/oauth/access_token?` +
      `client_id=${APP_ID}&redirect_uri=${encodeURIComponent(redirect_uri)}` +
      `&client_secret=${APP_SECRET}&code=${code}`;

    const tokenRes  = await fetch(tokenUrl);
    const tokenData = await tokenRes.json();
    if (tokenData.error) return json({ error: tokenData.error.message }, 400);

    const shortToken: string = tokenData.access_token;

    // 2. Exchange for long-lived token (60 days)
    const longUrl = `https://graph.facebook.com/v19.0/oauth/access_token?` +
      `grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}` +
      `&fb_exchange_token=${shortToken}`;

    const longRes  = await fetch(longUrl);
    const longData = await longRes.json();
    const longToken: string = longData.access_token ?? shortToken;

    // 3. Get list of pages the user manages
    const pagesRes  = await fetch(
      `https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token,picture&access_token=${longToken}`,
    );
    const pagesData = await pagesRes.json();

    if (pagesData.error) return json({ error: pagesData.error.message }, 400);

    const pages = (pagesData.data ?? []).map((p: Record<string, unknown>) => ({
      id:           p.id,
      name:         p.name,
      access_token: p.access_token,
      picture:      (p.picture as Record<string, unknown> | undefined)?.data,
    }));

    return json({ pages });

  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}
