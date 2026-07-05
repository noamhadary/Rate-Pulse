import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback`,
    });

    setLoading(false);

    if (resetError) {
      setError('שגיאה בשליחת המייל. בדוק שהכתובת נכונה ונסה שנית.');
    } else {
      setSent(true);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #00113a 0%, #002366 50%, #1a0040 100%)' }}
    >
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img
            src="/logo.png"
            alt="Rate Pulse"
            style={{ width: 195, maxWidth: '63%', height: 'auto', objectFit: 'contain', display: 'block', margin: '0 auto', filter: 'drop-shadow(0 0 20px rgba(135,29,211,0.55))' }}
          />
          <p className="mt-2 text-sm text-on-primary-container">ניהול מוניטין חכם לעסק שלך</p>
        </div>

        <div className="rounded-2xl p-8 bg-white" style={{ boxShadow: '0 25px 50px rgba(0,0,0,0.4)' }}>

          {sent ? (
            <div className="text-center">
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-5"
                style={{ background: 'linear-gradient(135deg,#002366,#871dd3)', boxShadow: '0 8px 32px rgba(135,29,211,0.35)' }}
              >
                <span className="material-symbols-outlined text-white text-[36px] icon-filled">mark_email_read</span>
              </div>
              <h2 className="text-xl font-extrabold mb-2 text-primary">המייל נשלח!</h2>
              <p className="text-sm leading-relaxed text-on-surface-variant mb-6">
                שלחנו לינק לאיפוס סיסמה לכתובת <span className="font-semibold text-primary">{email}</span>.
                <br />בדוק את תיבת הדואר שלך (כולל ספאם).
              </p>
              <Link
                to="/auth/login"
                className="block w-full py-3 rounded-xl font-bold text-sm text-center transition-all hover:opacity-90 text-white"
                style={{ background: 'linear-gradient(135deg,#002366,#871dd3)' }}
              >
                חזרה להתחברות
              </Link>
            </div>
          ) : (
            <>
              <div className="text-center mb-6">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{ background: 'linear-gradient(135deg,#002366,#871dd3)', boxShadow: '0 6px 20px rgba(135,29,211,0.3)' }}
                >
                  <span className="material-symbols-outlined text-white text-[28px] icon-filled">lock_reset</span>
                </div>
                <h2 className="text-2xl font-bold text-primary">שכחתי סיסמה</h2>
                <p className="text-sm mt-1 text-on-surface-variant">נשלח לך לינק לאיפוס לכתובת המייל שלך</p>
              </div>

              {error && (
                <div className="mb-4 px-4 py-3 rounded-lg text-sm flex items-center gap-2 bg-error-container text-on-error-container">
                  <span className="material-symbols-outlined text-[18px]">error</span>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="forgot-email" className="block text-sm font-semibold mb-1.5 text-primary">
                    כתובת אימייל
                  </label>
                  <input
                    id="forgot-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    dir="ltr"
                    autoComplete="email"
                    autoFocus
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all bg-surface-container-low text-on-surface border-2 border-outline-variant/50 focus:border-secondary"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-xl font-bold text-sm transition-all hover:opacity-90 active:scale-95 cursor-pointer disabled:opacity-60 text-white"
                  style={{ background: 'linear-gradient(135deg,#002366,#871dd3)' }}
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                      שולח...
                    </span>
                  ) : (
                    'שלח לינק לאיפוס'
                  )}
                </button>
              </form>

              <p className="text-center text-sm mt-5 text-on-surface-variant">
                נזכרת?{' '}
                <Link to="/auth/login" className="font-bold text-secondary">
                  חזרה להתחברות
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
