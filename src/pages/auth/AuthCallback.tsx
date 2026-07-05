import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { syncGoogleReviews } from '../../lib/googleBusinessAPI';

type Stage = 'verifying' | 'saving' | 'error';

async function provisionBusiness(user: User): Promise<'new' | 'existing'> {
  const meta = user.user_metadata ?? {};

  // Check if a business record already exists for this user
  const { data: existing } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle();

  if (existing) return 'existing';

  await supabase.from('businesses').insert({
    owner_id: user.id,
    name:     (meta.business_name as string | undefined)?.trim() || 'העסק שלי',
    category: 'קמעונאות',
  });

  return 'new';
}

export default function AuthCallback() {
  const navigate  = useNavigate();
  const [stage, setStage]   = useState<Stage>('verifying');
  const [message, setMessage] = useState('מאמת את הכתובת...');

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        // PKCE flow: exchange code in URL for a session
        const params = new URLSearchParams(window.location.search);
        const code   = params.get('code');

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        }

        // Implicit flow (hash tokens) is handled automatically by the Supabase client.
        // Wait up to 4 s for onAuthStateChange to fire a session.
        const session = await new Promise<import('@supabase/supabase-js').Session | null>((resolve) => {
          const timeout = setTimeout(() => resolve(null), 4000);

          supabase.auth.getSession().then(({ data }) => {
            if (data.session) {
              clearTimeout(timeout);
              resolve(data.session);
              return;
            }
            const { data: listener } = supabase.auth.onAuthStateChange((event, s) => {
              if (event === 'PASSWORD_RECOVERY') {
                clearTimeout(timeout);
                listener.subscription.unsubscribe();
                navigate('/auth/reset-password', { replace: true });
                resolve(null);
                return;
              }
              if (s) {
                clearTimeout(timeout);
                listener.subscription.unsubscribe();
                resolve(s);
              }
            });
          });
        });

        if (cancelled) return;

        if (!session) {
          setStage('error');
          setMessage('לא הצלחנו לאמת את הכתובת. ייתכן שהלינק פג תוקף.');
          return;
        }

        // Create / ensure the business record exists
        setStage('saving');
        setMessage('מכין את החשבון שלך...');
        const status = await provisionBusiness(session.user);

        if (!cancelled) {
          // Store Google refresh token for background sync
          if (session.provider_refresh_token) {
            await supabase
              .from('user_settings')
              .upsert(
                { owner_id: session.user.id, google_refresh_token: session.provider_refresh_token },
                { onConflict: 'owner_id' },
              );
          }

          // Immediately sync Google reviews on login
          if (session.provider_token) {
            const { data: biz } = await supabase
              .from('businesses')
              .select('id')
              .eq('owner_id', session.user.id)
              .maybeSingle();
            if (biz?.id) syncGoogleReviews(biz.id); // fire-and-forget
          }

          navigate(status === 'new' ? '/onboarding' : '/dashboard', { replace: true });
        }

      } catch (err) {
        if (cancelled) return;
        console.error('AuthCallback error:', err);
        setStage('error');
        setMessage('אירעה שגיאה בתהליך האימות. נסה להתחבר מחדש.');
      }
    };

    run();
    return () => { cancelled = true; };
  }, [navigate]);

  // ── UI ───────────────────────────────────────────────────────────────────────

  const isError = stage === 'error';

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg,#00113a 0%,#002366 50%,#1a0040 100%)' }}
    >
      <div className="w-full max-w-sm text-center">
        {/* Card */}
        <div className="rounded-2xl p-10" style={{ backgroundColor: '#fff', boxShadow: '0 25px 50px rgba(0,0,0,0.4)' }}>

          {/* Icon */}
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6"
            style={{
              background: isError
                ? 'linear-gradient(135deg,#dc2626,#ef4444)'
                : 'linear-gradient(135deg,#002366,#871dd3)',
              boxShadow: isError
                ? '0 8px 32px rgba(220,38,38,0.35)'
                : '0 8px 32px rgba(135,29,211,0.35)',
            }}
          >
            <span className={`material-symbols-outlined text-white text-[36px] icon-filled ${!isError ? 'animate-pulse' : ''}`}>
              {isError ? 'error' : stage === 'saving' ? 'cloud_upload' : 'verified'}
            </span>
          </div>

          {/* Text */}
          <h2 className="text-xl font-extrabold mb-2" style={{ color: '#00113a' }}>
            {isError ? 'שגיאה באימות' : stage === 'saving' ? 'מכין את החשבון' : 'מאמת את הכתובת'}
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: '#757682' }}>{message}</p>

          {/* Spinner (non-error) */}
          {!isError && (
            <div className="flex justify-center gap-1.5 mt-6">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: '#871dd3',
                    animation: `bounce 1.2s ${i * 0.2}s infinite`,
                  }}
                />
              ))}
            </div>
          )}

          {/* Error actions */}
          {isError && (
            <div className="flex flex-col gap-3 mt-6">
              <button
                onClick={() => navigate('/auth/login', { replace: true })}
                className="w-full py-3 rounded-xl font-bold text-sm cursor-pointer hover:opacity-90"
                style={{ background: 'linear-gradient(135deg,#002366,#871dd3)', color: '#fff' }}>
                חזור לדף ההתחברות
              </button>
              <button
                onClick={() => navigate('/auth/register', { replace: true })}
                className="w-full py-3 rounded-xl font-bold text-sm cursor-pointer hover:opacity-80"
                style={{ backgroundColor: '#f3f4f5', color: '#444650' }}>
                הרשמה מחדש
              </button>
            </div>
          )}
        </div>

        {/* Logo below card */}
        <img src="/logo.png" alt="Rate Pulse" style={{ width: 270, maxWidth: '80%', height: 'auto', objectFit: 'contain', opacity: 0.65, marginTop: 24 }} />
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0.7); opacity: 0.5; }
          40%            { transform: scale(1.2); opacity: 1;   }
        }
      `}</style>
    </div>
  );
}
