import { useNavigate } from 'react-router-dom';

const LAST_UPDATED = '5 ביולי 2026';
const CONTACT_EMAIL = 'privacy@ratepulse.io';
const APP_NAME = 'Rate Pulse';
const APP_URL = 'https://rate-pulse-flame.vercel.app';

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-outline-variant/20 shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm font-semibold text-on-surface-variant hover:text-primary cursor-pointer transition-colors">
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            חזרה
          </button>
          <img src="/logo.png" alt={APP_NAME} style={{ height: 36, width: 'auto', objectFit: 'contain' }} />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* Title */}
        <div className="mb-10">
          <h1 className="text-3xl font-extrabold text-primary mb-2">מדיניות פרטיות</h1>
          <p className="text-sm text-outline">עודכן לאחרונה: {LAST_UPDATED}</p>
        </div>

        <div className="space-y-8 text-on-surface leading-relaxed">

          <Section title="1. מבוא">
            <p>
              {APP_NAME} ("אנחנו", "השירות") מפעילה את הפלטפורמה לניהול ביקורות ומוניטין עסקי הנמצאת בכתובת{' '}
              <a href={APP_URL} className="text-secondary underline">{APP_URL}</a>.
              מדיניות פרטיות זו מסבירה כיצד אנו אוספים, משתמשים ומגנים על המידע האישי שלך.
            </p>
            <p className="mt-3">
              בשימוש בשירות, אתה מסכים לאיסוף ושימוש במידע בהתאם למדיניות זו.
            </p>
          </Section>

          <Section title="2. מידע שאנו אוספים">
            <ul className="list-disc list-inside space-y-2 mr-2">
              <li><strong>פרטי חשבון:</strong> שם, כתובת דוא"ל, סיסמה מוצפנת.</li>
              <li><strong>פרטי העסק:</strong> שם העסק, קטגוריה, טלפון, אתר אינטרנט.</li>
              <li><strong>ביקורות ודירוגים:</strong> תוכן ביקורות שמסונכרן מ-Google Business, Facebook Pages ופלטפורמות נוספות.</li>
              <li><strong>אישורי פלטפורמות:</strong> מזהי דפים (Page IDs) וטוקני גישה של Facebook ו-Google, המאוחסנים בצורה מוצפנת.</li>
              <li><strong>נתוני שימוש:</strong> פעולות בתוך האפליקציה, תגובות שנוצרו, בחירות טון.</li>
              <li><strong>נתוני AI:</strong> תוכן הביקורות המועבר לשירות Claude AI לצורך יצירת תגובות. המידע לא נשמר על ידי ספק ה-AI.</li>
            </ul>
          </Section>

          <Section title="3. שימוש במידע">
            <p>אנו משתמשים במידע שנאסף למטרות הבאות:</p>
            <ul className="list-disc list-inside space-y-2 mr-2 mt-2">
              <li>הפעלת השירות וסנכרון ביקורות מפלטפורמות חיצוניות.</li>
              <li>יצירת תגובות AI מותאמות אישית לביקורות.</li>
              <li>שליחת התראות על ביקורות חדשות.</li>
              <li>שיפור ופיתוח השירות.</li>
              <li>תקשורת בנושאי תמיכה וחיוב.</li>
            </ul>
          </Section>

          <Section title="4. חיבור עם Facebook">
            <p>
              כאשר אתה מחבר את דף הפייסבוק העסקי שלך לשירות, אנו מבקשים גישה ל:
            </p>
            <ul className="list-disc list-inside space-y-2 mr-2 mt-2">
              <li><strong>pages_show_list</strong> — צפייה ברשימת הדפים העסקיים שבבעלותך.</li>
              <li><strong>pages_read_user_content</strong> — קריאת ביקורות ודירוגים שמשתמשים השאירו בדף העסק שלך.</li>
            </ul>
            <p className="mt-3">
              אנו <strong>אינם</strong> פורסים תוכן בשמך, אינם גולשים בפיד האישי שלך, ואינם ניגשים למידע מעבר למה שנדרש לסנכרון ביקורות.
              טוקני הגישה מאוחסנים בצורה מוצפנת ואינם נחשפים לצד שלישי.
            </p>
            <p className="mt-3">
              תוכל לנתק את חיבור Facebook בכל עת דרך הגדרות החשבון, או דרך{' '}
              <a href="https://www.facebook.com/settings?tab=applications" target="_blank" rel="noopener noreferrer" className="text-secondary underline">
                הגדרות האפליקציות של Facebook
              </a>.
            </p>
          </Section>

          <Section title="5. חיבור עם Google">
            <p>
              כאשר אתה מתחבר עם Google, אנו מבקשים גישה ל-Google Business Profile לצורך סנכרון ביקורות.
              אנו עומדים במדיניות הנתונים של Google ואינם מעבירים נתוני Google לצדדים שלישיים.
            </p>
          </Section>

          <Section title="6. שיתוף מידע">
            <p>אנו <strong>לא מוכרים</strong> את המידע האישי שלך. המידע עשוי להיות משותף עם:</p>
            <ul className="list-disc list-inside space-y-2 mr-2 mt-2">
              <li><strong>Supabase</strong> — ספק תשתית מסד הנתונים (מאוחסן באיחוד האירופי).</li>
              <li><strong>Anthropic (Claude AI)</strong> — לצורך יצירת תגובות AI. תוכן הביקורות מועבר לעיבוד בלבד.</li>
              <li><strong>Vercel</strong> — ספק אירוח האפליקציה.</li>
            </ul>
            <p className="mt-3">כל הספקים מחויבים לתנאי עיבוד נתונים (DPA) מתאימים.</p>
          </Section>

          <Section title="7. אבטחת מידע">
            <p>
              אנו נוקטים באמצעי אבטחה תעשייתיים סטנדרטיים: הצפנת נתונים במנוחה ובמעבר (TLS),
              אחסון מוצפן של טוקני גישה, ובקרות גישה מחמירות.
              עם זאת, אף מערכת אינה בטוחה לחלוטין ואיננו יכולים להבטיח אבטחה מוחלטת.
            </p>
          </Section>

          <Section title="8. שמירת מידע">
            <p>
              אנו שומרים את המידע שלך כל עוד החשבון פעיל. עם מחיקת החשבון, המידע ימחק תוך 30 ימים,
              למעט מידע הנדרש לצרכים חשבונאיים ומשפטיים.
            </p>
          </Section>

          <Section title="9. זכויותיך">
            <ul className="list-disc list-inside space-y-2 mr-2">
              <li>גישה למידע שנאסף עליך.</li>
              <li>תיקון מידע שגוי.</li>
              <li>מחיקת חשבון וכל הנתונים הקשורים אליו.</li>
              <li>ניוד נתונים (קבל עותק של המידע שלך).</li>
              <li>ביטול הסכמה לעיבוד נתונים.</li>
            </ul>
            <p className="mt-3">לממש זכויות אלה, פנה אלינו בכתובת: <a href={`mailto:${CONTACT_EMAIL}`} className="text-secondary underline">{CONTACT_EMAIL}</a></p>
          </Section>

          <Section title="10. עוגיות (Cookies)">
            <p>
              אנו משתמשים בעוגיות חיוניות לצורך ניהול הפגישה ואימות המשתמש בלבד.
              אין שימוש בעוגיות שיווקיות או מעקב.
            </p>
          </Section>

          <Section title="11. שינויים במדיניות">
            <p>
              אנו עשויים לעדכן מדיניות זו מעת לעת. שינויים מהותיים יפורסמו באפליקציה ויישלח עדכון בדוא"ל.
              המשך השימוש לאחר הפרסום מהווה הסכמה לשינויים.
            </p>
          </Section>

          <Section title="12. יצירת קשר">
            <p>
              לשאלות, בקשות למחיקת נתונים, או כל עניין הנוגע לפרטיות:
            </p>
            <div className="mt-3 p-4 rounded-xl bg-surface-container-low border border-outline-variant/30">
              <p className="font-semibold text-primary">{APP_NAME}</p>
              <p>דוא"ל: <a href={`mailto:${CONTACT_EMAIL}`} className="text-secondary underline">{CONTACT_EMAIL}</a></p>
              <p>אתר: <a href={APP_URL} className="text-secondary underline">{APP_URL}</a></p>
            </div>
          </Section>

        </div>
      </main>

      <footer className="border-t border-outline-variant/20 mt-16 py-6 text-center text-xs text-outline">
        © {new Date().getFullYear()} {APP_NAME} · <a href={`mailto:${CONTACT_EMAIL}`} className="hover:underline">{CONTACT_EMAIL}</a>
      </footer>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-bold text-primary mb-3 pb-2 border-b border-outline-variant/20">{title}</h2>
      <div className="text-sm space-y-2 text-on-surface-variant">{children}</div>
    </section>
  );
}
