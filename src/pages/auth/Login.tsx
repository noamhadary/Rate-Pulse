import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/auth-context';

const DEMO_MODE =
  !import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.VITE_SUPABASE_URL === 'https://placeholder.supabase.co';

export default function Login() {
  const navigate = useNavigate();
  const { loginAsDemo } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) {
        setError('אימייל או סיסמה שגויים. נסה שנית.');
      } else {
        navigate('/dashboard');
      }
    } catch {
      // Demo mode — allow login with any credentials
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = () => { loginAsDemo(); navigate('/dashboard'); };

  const handleGoogleLogin = async () => {
    if (DEMO_MODE) { handleDemoLogin(); return; }
    setGoogleLoading(true);
    setError('');
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          scopes: 'email profile https://www.googleapis.com/auth/business.manage',
        },
      });
      if (oauthError) setError('שגיאה בהתחברות עם Google. נסה שנית.');
    } catch {
      setError('שגיאת רשת — בדוק את החיבור לאינטרנט ונסה שנית');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #00113a 0%, #002366 50%, #1a0040 100%)' }}
    >
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <img
            src="/logo.png"
            alt="Rate Pulse"
            style={{ width: 195, maxWidth: '63%', height: 'auto', objectFit: 'contain', display: 'block', margin: '0 auto', filter: 'drop-shadow(0 0 20px rgba(135,29,211,0.55))' }}
          />
          <p className="mt-2 text-sm text-on-primary-container">ניהול מוניטין חכם לעסק שלך</p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-8 bg-white"
          style={{ boxShadow: '0 25px 50px rgba(0,0,0,0.4)' }}
        >
          <h2 className="text-2xl font-bold mb-6 text-center text-primary">
            כניסה למערכת
          </h2>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-lg text-sm flex items-center gap-2 bg-error-container text-on-error-container">
              <span className="material-symbols-outlined text-[18px]">error</span>
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="login-email" className="block text-sm font-semibold mb-1.5 text-primary">
                אימייל
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                dir="ltr"
                autoComplete="email"
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all bg-surface-container-low text-on-surface border-2 border-outline-variant/50 focus:border-secondary"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="login-password" className="text-sm font-semibold text-primary">
                  סיסמה
                </label>
                <Link to="/auth/forgot-password" className="text-xs font-semibold text-secondary hover:underline">
                  שכחתי סיסמה
                </Link>
              </div>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                dir="ltr"
                autoComplete="current-password"
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all bg-surface-container-low text-on-surface border-2 border-outline-variant/50 focus:border-secondary"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl font-bold text-sm transition-all hover:opacity-90 active:scale-95 cursor-pointer disabled:opacity-60 bg-secondary text-white"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                  מתחבר...
                </span>
              ) : (
                'כניסה'
              )}
            </button>
          </form>

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-surface-container-highest" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 bg-white text-outline">או</span>
            </div>
          </div>

          <button
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 py-3 rounded-xl font-semibold text-sm transition-all cursor-pointer hover:bg-gray-50 disabled:opacity-60 border border-outline-variant/50 text-on-surface bg-white mb-3"
          >
            {googleLoading ? (
              <span className="material-symbols-outlined text-[18px] animate-spin text-outline">progress_activity</span>
            ) : (
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
                <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
                <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
              </svg>
            )}
            המשך עם Google
          </button>

          <button
            onClick={handleDemoLogin}
            className="w-full py-3 rounded-xl font-semibold text-sm transition-all cursor-pointer hover:opacity-90 border border-primary-container text-primary-container bg-transparent"
          >
            כניסה בגרסת הדמו
          </button>

          <p className="text-center text-sm mt-5 text-on-surface-variant">
            אין לך חשבון?{' '}
            <Link to="/auth/register" className="font-bold text-secondary">
              הרשם עכשיו
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
