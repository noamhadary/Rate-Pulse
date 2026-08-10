import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// נעילת CORS לדומיין האפליקציה (ניתן לדריסה ב-env). לא עוד '*'.
const ALLOWED_ORIGIN =
  Deno.env.get('ALLOWED_ORIGIN') ?? 'https://rate-pulse-flame.vercel.app';

const CORS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function toGreenChatId(phone: string): string {
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0')) digits = '972' + digits.slice(1);
  if (digits.length <= 10 && !digits.startsWith('972')) digits = '972' + digits;
  return `${digits}@c.us`;
}

function normalizePhone(phone: string): string {
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0')) digits = '972' + digits.slice(1);
  if (digits.length <= 10 && !digits.startsWith('972')) digits = '972' + digits;
  return `+${digits}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  // ---- שער אימות: רק משתמש מחובר מורשה לקרוא לפונקציה הזו ----
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  // קליינט מְתוּחָם למשתמש (ANON + ה-JWT שלו) — כל גישה ל-DB תעבור דרך RLS
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { to, session_id, suggestions, reviewer_name, rating, content_snippet } =
      await req.json();

    if (!to || !suggestions?.length) {
      return new Response(JSON.stringify({ error: 'Missing to or suggestions' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const instanceId = Deno.env.get('GREEN_API_INSTANCE_ID');
    const apiToken = Deno.env.get('GREEN_API_TOKEN');

    if (!instanceId || !apiToken) throw new Error('GREEN API credentials not set');

    const stars = String.fromCodePoint(0x2B50).repeat(Math.min(rating ?? 3, 5));
    const snippet = content_snippet
      ? `"${content_snippet.slice(0, 80)}${content_snippet.length > 80 ? '...' : ''}"`
      : '';

    const optionsText = suggestions
      .slice(0, 4)
      .map((s: string, i: number) => `${i + 1}. ${s}`)
      .join('\n\n');

    const message = [
      `ביקורת חדשה מ-${reviewer_name ?? 'לקוח'} (${stars})`,
      snippet,
      '',
      'בחר תגובה - שלח מספר:',
      '',
      optionsText,
      '',
      'שלח 1-4 לבחירת תגובה, או 0 לביטול.',
    ]
      .filter((l) => l !== undefined)
      .join('\n');

    // אם סופק session_id — לפני שליחת ה-WhatsApp נוודא שהוא שייך למשתמש הזה.
    // העדכון דרך userClient עובר את מדיניות ה-RLS "Owners can manage reply sessions":
    // סשן שאינו של המשתמש פשוט לא יוחזר / לא יתעדכן (0 שורות) → נחסום מראש.
    if (session_id) {
      const { data: owned, error: ownErr } = await userClient
        .from('reply_sessions')
        .select('id')
        .eq('id', session_id)
        .maybeSingle();
      if (ownErr) throw new Error(`ownership check failed: ${ownErr.message}`);
      if (!owned) {
        return new Response(JSON.stringify({ error: 'forbidden' }), {
          status: 403, headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }
    }

    const chatId = toGreenChatId(to);

    const greenRes = await fetch(
      `https://api.green-api.com/waInstance${instanceId}/sendMessage/${apiToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, message }),
      },
    );

    const greenData = await greenRes.json();
    if (!greenRes.ok) throw new Error(`GREEN API error: ${JSON.stringify(greenData)}`);

    // העדכון גם הוא דרך userClient — RLS מבטיח שאין דליפה בין משתמשים.
    if (session_id) {
      await userClient
        .from('reply_sessions')
        .update({ whatsapp_to: normalizePhone(to) })
        .eq('id', session_id);
    }

    return new Response(JSON.stringify({ ok: true, idMessage: greenData.idMessage }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
