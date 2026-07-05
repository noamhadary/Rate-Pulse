import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    // Supabase sets the session automatically from the hash tokens.
    // Wait for the session to be available before allowing the form.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setSessionReady(true);
      } else {
        // Listen for the PASSWORD_RECOVERY event
        const { data: listener } = supabase.auth.onAuthStateChange((event) => {
          if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
            setSessionReady(true);
            listener.subscription.unsubscribe();
          }
        });
      }
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('הסיסמה חייבת להכיל לפחות 6 תווים.');
      return;
    }
    if (password !== confirm) {
      setError('הסיסמאות אינן תואמות.');
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError('שגיאה בעדכון הסיסמה. ייתכן שהלינק פג תוקף — נסה לבקש לינק חדש.');
    } else {
      setDone(true);
      setTimeout(() => navigate('/dashboard', { replace: true }), 2500);
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

          {done ? (
            <div className="text-center">
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-5"
                style={{ background: 'linear-gradient(135deg,#002366,#871dd3)', boxShadow: '0 8px 32px rgba(135,29,211,0.35)' }}
              >
                <span className="material-symbols-outlined text-white text-[36px] icon-filled">check_circle</span>
              </div>
              <h2 className="text-xl font-extrabold mb-2 text-primary">הסיסמה עודכנה!</h2>
              <p className="text-sm text-on-surface-variant">מעביר אותך לדשבורד...</p>
            </div>
          ) : (
            <>
              <div className="text-center mb-6">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{ background: 'linear-gradient(135deg,#002366,#871dd3)', boxShadow: '0 6px 20px rgba(135,29,211,0.3)' }}
                >
                  <span className="material-symbols-outlined text-white text-[28px] icon-filled">lock</span>
                </div>
                <h2 className="text-2xl font-bold text-primary">סיסמה חדשה</h2>
                <p className="text-sm mt-1 text-on-surface-variant">הכנס סיסמה חדשה לחשבונך</p>
              </div>

              {error && (
                <div className="mb-4 px-4 py-3 rounded-lg text-sm flex items-center gap-2 bg-error-container text-on-error-container">
                  <span className="material-symbols-outlined text-[18px]">error</span>
                  {error}
                </div>
              )}

              {!sessionReady ? (
                <div className="flex flex-col items-center gap-3 py-6">
                  <span className="material-symbols-outlined text-[32px] text-secondary animate-spin">progress_activity</span>
                  <p className="text-sm text-on-surface-variant">מאמת את הלינק...</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="new-password" className="block text-sm font-semibold mb-1.5 text-primary">
                      סיסמה חדשה
                    </label>
                    <input
                      id="new-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="לפחות 6 תווים"
                      required
                      minLength={6}
                      dir="ltr"
                      autoComplete="new-password"
                      autoFocus
                      className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all bg-surface-container-low text-on-surface border-2 border-outline-variant/50 focus:border-secondary"
                    />
                  </div>

                  <div>
                    <label htmlFor="confirm-password" className="block text-sm font-semibold mb-1.5 text-primary">
                      אימות סיסמה
                    </label>
                    <input
                      id="confirm-password"
                      type="password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="הכנס שוב את הסיסמה"
                      required
                      dir="ltr"
                      autoComplete="new-password"
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
                        מעדכן...
                      </span>
                    ) : (
                      'עדכן סיסמה'
                    )}
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
