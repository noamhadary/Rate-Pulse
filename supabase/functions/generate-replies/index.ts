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
      max_tokens: 1500,
      system: `אתה מומחה בכיר לשימור לקוחות ושירות לקוחות עם ניסיון של שנים בשוק הישראלי.
אתה יודע שתגובה נכונה לביקורת יכולה להחזיר לקוח אבוד, לשנות דעת של לקוח מתלבט, ולגרום ללקוח מרוצה להפוך לשגריר של המותג.
אתה כותב תגובות שמרגישות אנושיות לחלוטין — לא תבניות שיווקיות, לא שפת בוט, ולא ניסוחים שכולם כבר שמעו.
אתה מכיר את הרגשות שעומדים מאחורי ביקורת: תסכול, ציפייה שנשברה, אכזבה — ויודע לפנות אליהם בדיוק הנכון.`,
      messages: [{
        role: 'user',
        content: `כתוב בדיוק 4 תגובות שונות לביקורת הזו. כל תגובה צריכה להרגיש כאילו נכתבה על ידי בן אדם — לא AI.

ביקורת:
- שם: ${reviewer_name}
- דירוג: ${stars} (${rating}/5)
- תוכן: "${content}"

סגנון נדרש: ${toneInstruction}

חוקים:
1. קרא את הביקורת לעומק — התייחס לנושא הספציפי שהלקוח העלה. אל תכתוב תגובה שיכולה להתאים לכל ביקורת אחרת.
2. חשוב מה הלקוח הזה צריך לשמוע כדי להרגיש שמישהו באמת ראה ושמע אותו.
3. כל אחת מ-4 התגובות שונה בגישה, בזווית ובניסוח — לא העתקים עם שינויים קלים.
4. פנה תמיד בשם הלקוח.
5. עברית דבורה וטבעית — כמו שמנהל אנושי ומנוסה היה כותב.
6. אורך: כמה שנדרש לטיפול ראוי בביקורת — 1 עד 4 משפטים. אל תקצר על חשבון האמינות.
7. הפרד בין תגובה לתגובה בשורה ריקה אחת בלבד. אל תמספר, אל תוסיף כותרות.

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
