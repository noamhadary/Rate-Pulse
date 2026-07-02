import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'npm:@supabase/supabase-js';

const TONE_INSTRUCTIONS: Record<string, string> = {
  soft:       'חמה ואישית — פנה לשם הלקוח, השתמש בשפה אמפתית ורגשית, צור תחושת קירבה אמיתית.',
  gentle:     'עדינה ומנומסת — שפה מכבדת, רגועה ומסבירה. אל תהיה יתר על המידה רגשי, אבל הראה הבנה.',
  firm:       'תקיפה ומקצועית — ישירה, עניינית ולעניין. מינימום מליצות, מקסימום ביטחון עצמי ומקצועיות.',
  apologetic: 'מתנצלת ומפצה — הכר בבעיה במפורש, הבע חרטה כנה, הצע פתרון או פיצוי. אל תתנצל יתר על המידה.',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    const { review_id, reviewer_name, rating, content, tone } = await req.json();

    const toneInstruction = TONE_INSTRUCTIONS[tone as string] ?? TONE_INSTRUCTIONS.gentle;
    const stars = '★'.repeat(Number(rating)) + '☆'.repeat(5 - Number(rating));

    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `אתה מנהל קשרי לקוחות של עסק ישראלי. כתוב בדיוק 4 תגובות שונות לביקורת הבאה.

ביקורת:
- שם: ${reviewer_name}
- דירוג: ${stars} (${rating}/5)
- תוכן: "${content}"

סגנון נדרש: ${toneInstruction}

חוקים:
1. כל תגובה שונה בניסוח ובגישה — לא העתקים עם שינויים קלים
2. פנה תמיד בשם הלקוח
3. עברית טבעית ואנושית, לא שפת בוט
4. בין משפט אחד לשלושה משפטים לכל היותר
5. הפרד בין תגובה לתגובה בשורה ריקה אחת בלבד
6. אל תמספר, אל תוסיף כותרות

תגובות:`,
      }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text.trim() : '';
    const suggestions = text
      .split(/\n\n+/)
      .map((s: string) => s.trim())
      .filter(Boolean)
      .slice(0, 4);

    while (suggestions.length < 4) suggestions.push(suggestions[0] ?? '');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data: session } = await supabase
      .from('reply_sessions')
      .insert({
        review_id,
        tone,
        suggestions,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      })
      .select('id')
      .single();

    return new Response(
      JSON.stringify({ suggestions, session_id: session?.id ?? null }),
      { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
});
