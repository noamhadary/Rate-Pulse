import { useState } from 'react';
import { supabase } from '../lib/supabase';
import type { ToneType } from '../types';

export interface AIReplyState {
  suggestions: string[];
  sessionId: string | null;
  isLoading: boolean;
  isSendingWhatsApp: boolean;
  whatsAppSent: boolean;
  error: string | null;
}

export function useAIReply() {
  const [state, setState] = useState<AIReplyState>({
    suggestions: [],
    sessionId: null,
    isLoading: false,
    isSendingWhatsApp: false,
    whatsAppSent: false,
    error: null,
  });

  const generate = async (
    review: { id: string; reviewer_name: string; rating: number; content: string },
    tone: ToneType,
  ): Promise<string[]> => {
    setState((s) => ({ ...s, isLoading: true, error: null, suggestions: [], whatsAppSent: false }));
    try {
      const { data, error } = await supabase.functions.invoke('generate-replies', {
        body: {
          review_id: review.id,
          reviewer_name: review.reviewer_name,
          rating: review.rating,
          content: review.content,
          tone,
        },
      });
      if (error) throw error;
      const suggestions: string[] = data.suggestions ?? [];
      setState((s) => ({
        ...s,
        suggestions,
        sessionId: data.session_id ?? null,
        isLoading: false,
      }));
      return suggestions;
    } catch {
      // Demo fallback when edge function is not deployed yet
      const demo = buildDemoSuggestions(review.reviewer_name, review.rating, review.content, tone);
      setState((s) => ({ ...s, suggestions: demo, isLoading: false, error: null }));
      return demo;
    }
  };

  const sendWhatsApp = async (
    to: string,
    review: { reviewer_name: string; rating: number; content: string },
  ): Promise<boolean> => {
    if (!state.suggestions.length) return false;
    setState((s) => ({ ...s, isSendingWhatsApp: true, error: null }));

    try {
      const { error } = await supabase.functions.invoke('send-whatsapp', {
        body: {
          to,
          session_id: state.sessionId,
          suggestions: state.suggestions,
          reviewer_name: review.reviewer_name,
          rating: review.rating,
          content_snippet: review.content,
        },
      });
      if (error) throw error;
      setState((s) => ({ ...s, isSendingWhatsApp: false, whatsAppSent: true }));
      return true;
    } catch {
      setState((s) => ({
        ...s,
        isSendingWhatsApp: false,
        error: 'שגיאה בשליחת WhatsApp — בדוק את הגדרות GREEN API',
      }));
      return false;
    }
  };

  const chooseReply = async (reviewId: string, text: string, index: number) => {
    const now = new Date().toISOString();
    await supabase
      .from('reviews')
      .update({ reply_text: text, status: 'replied', replied_at: now })
      .eq('id', reviewId);

    if (state.sessionId) {
      await supabase
        .from('reply_sessions')
        .update({ chosen_index: index + 1 })
        .eq('id', state.sessionId);
    }
  };

  const reset = () =>
    setState({ suggestions: [], sessionId: null, isLoading: false, isSendingWhatsApp: false, whatsAppSent: false, error: null });

  return { ...state, generate, sendWhatsApp, chooseReply, reset };
}

// ── Demo suggestions used when edge function is not yet deployed ───────────────

function buildDemoSuggestions(name: string, rating: number, content: string, tone: ToneType): string[] {
  const isWait    = /המתנה|חיכיתי|זמן|איטי|איחור/.test(content);
  const isProduct = /מוצר|פגום|שבור|איכות/.test(content);
  const isService = /שירות|נציג|צוות|עזרה/.test(content);
  const isFood    = /אוכל|טעים|מנה|מסעדה|קפה/.test(content);
  const topic = isWait ? 'זמני ההמתנה' : isProduct ? 'המוצר שקיבלת' : isService ? 'השירות שחווית' : isFood ? 'האוכל והחוויה' : 'החוויה שלך';

  const hasNegativeKeywords = /גרוע|איום|נורא|מאוכזב|מתוסכל|בעיה|תקלה|פגום|שבור|איחור|לא עבד|לא תקין|מזעזע|מבאס/.test(content);
  const isNegative = rating <= 2 || hasNegativeKeywords;
  const isPositive = rating >= 4 && !hasNegativeKeywords;

  if (isNegative) {
    if (tone === 'soft') return [
      `${name} היקר/ה, אנחנו מצטערים מאוד על ${topic}. המשוב שלך חשוב לנו ונעשה כל שביכולתנו לתקן זאת.`,
      `אנחנו ממש מצטערים שחווית כך, ${name}. ${topic} לא אמור להיות כך, ונשמח לפצות אותך.`,
      `${name}, הלב שלנו כואב לקרוא על ${topic}. זה לא הסטנדרט שלנו ואנחנו נטפל בזה מיידית.`,
      `מצטערים מאוד על ${topic}, ${name}. נשמח ליצור איתך קשר אישי ולפצות על אי הנוחות.`,
    ];
    if (tone === 'gentle') return [
      `${name}, תודה שיידעת אותנו על ${topic}. אנחנו מצטערים ונפעל לתיקון מיידי.`,
      `אנחנו מתנצלים על ${topic}, ${name}. נשמח לדבר איתך ולמצוא פתרון יחד.`,
      `${name}, קיבלנו את משובך על ${topic}. זה לא עומד בסטנדרטים שלנו ונטפל בכך.`,
      `תודה על הכנות, ${name}. אנחנו מצטערים על ${topic} ונעשה כל שביכולתנו לשפר.`,
    ];
    if (tone === 'firm') return [
      `${name}, קיבלנו את הפנייה שלך בנוגע ל${topic}. אנחנו מתנצלים ונטפל בכך ברצינות.`,
      `אנחנו שומעים אותך, ${name}. הנושא של ${topic} אינו מקובל ונבצע בדיקה מיידית.`,
      `${name}, תודה על הפידבק על ${topic}. אנחנו מחויבים לסטנדרטים גבוהים ונפעל לשיפור.`,
      `קיבלנו, ${name}. ${topic} אינו עומד בסטנדרטים שלנו ונטפל בכך בהקדם האפשרי.`,
    ];
    // apologetic
    return [
      `${name}, אנחנו מצטערים מאוד על ${topic}. נעשה הכל כדי לתקן זאת ולפצות אותך.`,
      `אנחנו מתנצלים בכנות על ${topic}, ${name}. זה לא הסטנדרט שלנו ואנחנו נטפל בזה מיידית.`,
      `${name}, מה שקרה עם ${topic} לא מקובל עלינו. אנחנו מצטערים ונפעל לשיפור מיידי.`,
      `מצטערים מאוד על ${topic}, ${name}. ניצור איתך קשר כדי לפצות על אי הנוחות שנגרמה.`,
    ];
  }

  if (isPositive) {
    if (tone === 'soft') return [
      `תודה רבה, ${name}! המשוב שלך על ${topic} ממלא אותנו בגאווה ומניע אותנו להמשיך.`,
      `${name} היקר/ה, כל כך שמחנו לקרוא את דבריך על ${topic}. אנחנו כאן בשבילך תמיד!`,
      `המשוב שלך על ${topic} נוגע ללב, ${name}. אנחנו שמחים שיכולנו לגרום לחוויה מיוחדת.`,
      `תודה על הדברים הנפלאים, ${name}! כשאנחנו שומעים על ${topic} כזה — זו הסיבה שאנחנו עושים את מה שאנחנו עושים.`,
    ];
    if (tone === 'gentle') return [
      `${name}, תודה רבה על המשוב החיובי לגבי ${topic}. נשמח תמיד לשרת אותך.`,
      `אנחנו מעריכים מאוד שלקחת את הזמן לכתוב לנו על ${topic}, ${name}. תודה!`,
      `תודה על הדברים הטובים לגבי ${topic}, ${name}. נמשיך לעשות כמיטב יכולתנו.`,
      `${name}, המשוב שלך על ${topic} חשוב לנו מאוד. תודה שבחרת בנו.`,
    ];
    if (tone === 'firm') return [
      `תודה על הפנייה, ${name}. שמחנו לשמוע על ${topic} ונמשיך לשמור על הרמה.`,
      `קיבלנו את דבריך על ${topic}, ${name}. אנחנו עומדים מאחורי השירות שלנו ונמשיך לשפר.`,
      `${name}, תודה. בנוגע ל${topic} — אנחנו מחויבים לסטנדרטים גבוהים ונמשיך כך.`,
      `אנחנו מתייחסים לכל משוב חיובי על ${topic} ברצינות, ${name}. תודה על השיתוף.`,
    ];
    // apologetic tone on positive review → use gentle
    return [
      `${name}, תודה רבה על המשוב החיובי לגבי ${topic}. נשמח תמיד לשרת אותך.`,
      `אנחנו מעריכים מאוד שלקחת את הזמן לכתוב לנו על ${topic}, ${name}. תודה!`,
      `תודה על הדברים הטובים לגבי ${topic}, ${name}. נמשיך לעשות כמיטב יכולתנו.`,
      `${name}, המשוב שלך על ${topic} חשוב לנו מאוד. תודה שבחרת בנו.`,
    ];
  }

  // Neutral (3 stars) — differentiated by tone
  if (tone === 'soft') return [
    `${name} היקר/ה, תודה שלקחת את הזמן לכתוב לנו. המשוב שלך על ${topic} חשוב לנו מאוד ונעשה כל שביכולתנו להשתפר.`,
    `תודה רבה, ${name}. שמחנו לשמוע על ${topic} וחבל שהחוויה לא הייתה מושלמת. נשתדל לפנק אותך יותר בביקור הבא.`,
    `${name}, קראנו את דבריך בעיון ומרגישים שיש לנו עוד דרך ללכת. נאמץ את המשוב שלך לשיפור מתמיד.`,
    `תודה על הכנות, ${name}. כשלקוח לוקח זמן לכתוב — אנחנו מתייחסים ברצינות. נעבוד על ${topic}.`,
  ];
  if (tone === 'gentle') return [
    `${name}, תודה על המשוב הכנה. אנחנו מקשיבים ונפעל לשיפור ${topic} בהמשך.`,
    `קיבלנו את הפידבק שלך, ${name}. נשקול את דבריך ונשתדל לעמוד בציפיות שלך בפעם הבאה.`,
    `${name}, אנחנו מעריכים את הכנות שלך לגבי ${topic}. נמשיך לשפר ונשמח לראותך שוב.`,
    `תודה, ${name}. המשוב שלך על ${topic} יעזור לנו להציע שירות טוב יותר לכולם.`,
  ];
  if (tone === 'firm') return [
    `${name}, קיבלנו את הפידבק. אנחנו מחויבים לסטנדרטים גבוהים ונטפל ב${topic} בהתאם.`,
    `תודה על המשוב, ${name}. בנוגע ל${topic} — נבצע בחינה ונפעל לשיפור מיידי שם שנדרש.`,
    `${name}, שמענו. ${topic} הוא תחום שאנחנו עוקבים אחריו ונפעל לשיפור רמת השירות.`,
    `קיבלנו, ${name}. אנחנו מתייחסים לכל משוב ברצינות ונפעל בהתאם.`,
  ];
  // apologetic
  return [
    `${name}, מצטערים שהחוויה לא עמדה בציפיות שלך. ${topic} אמור להיות טוב יותר ואנחנו מבינים את האכזבה.`,
    `אנחנו מתנצלים על ${topic}, ${name}. זה לא הסטנדרט שאנחנו שואפים אליו ונעשה כל שביכולתנו לשפר.`,
    `${name}, חבל שהחוויה לא הייתה מושלמת. נטפל ב${topic} ונשמח לקבל הזדמנות נוספת להפתיע אותך לטובה.`,
    `מצטערים מאוד, ${name}. המשוב שלך על ${topic} מאיר לנו נקודה חשובה שנדרש לשפר. תודה שיידעת אותנו.`,
  ];
}
