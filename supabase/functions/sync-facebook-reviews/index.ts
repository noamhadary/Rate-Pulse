import { createClient } from 'npm:@supabase/supabase-js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

function ratingToSentiment(r: number) {
  if (r >= 5) return 'very_positive';
  if (r >= 4) return 'positive';
  if (r >= 3) return 'neutral';
  return 'critical';
}

function toInitials(name: string) {
  return name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() || 'FB';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  // Auth guard
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
    const { business_id } = await req.json();
    if (!business_id) return json({ error: 'missing business_id' }, 400);

    // Read page credentials server-side — token never touches the browser
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data: conn, error: connErr } = await supabase
      .from('platform_connections')
      .select('credentials')
      .eq('owner_id', user.id)
      .eq('platform', 'facebook')
      .single();

    if (connErr || !conn) return json({ synced: 0, error: 'no_credentials' });

    const creds = conn.credentials as { page_id?: string; access_token?: string } | null;
    const page_id = creds?.page_id;
    const access_token = creds?.access_token;

    if (!page_id || !access_token) return json({ synced: 0, error: 'no_credentials' });

    const res = await fetch(
      `https://graph.facebook.com/v19.0/${encodeURIComponent(page_id)}/ratings` +
      `?fields=reviewer,rating,review_text,created_time&limit=50` +
      `&access_token=${encodeURIComponent(access_token)}`,
    );
    const fbData = await res.json();

    if (!res.ok || fbData.error) {
      return json({ synced: 0, error: fbData.error?.message ?? `Facebook API ${res.status}` });
    }

    const ratings: Array<{
      reviewer?: { name?: string; id?: string };
      rating?: number;
      review_text?: string;
      created_time?: string;
    }> = fbData.data ?? [];

    if (!ratings.length) return json({ synced: 0 });

    const rows = ratings.map((r) => {
      const rating = r.rating ?? 3;
      const anonKey = r.review_text ? btoa(r.review_text).slice(0, 8) : String(Date.now());
      return {
        business_id,
        platform: 'facebook',
        external_id: `fb_${r.reviewer?.id ?? `anon_${anonKey}`}_${r.created_time ?? anonKey}`,
        reviewer_name: r.reviewer?.name ?? 'אנונימי',
        reviewer_initials: toInitials(r.reviewer?.name ?? 'FB'),
        rating,
        content: r.review_text ?? '',
        sentiment: ratingToSentiment(rating),
        status: 'pending',
        reply_text: null,
        created_at: r.created_time ?? new Date().toISOString(),
      };
    });

    const { error: upsertErr } = await supabase
      .from('reviews')
      .upsert(rows, { onConflict: 'external_id' });

    if (upsertErr) return json({ synced: 0, error: upsertErr.message });
    return json({ synced: rows.length });

  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
