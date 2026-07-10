import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { FB_REDIRECT_URI } from '../../lib/facebookOAuth';

export default function FacebookCallback() {
  const [status, setStatus] = useState<'loading' | 'done' | 'error'>('loading');
  const [message, setMessage] = useState('מתחבר לפייסבוק...');

  useEffect(() => {
    const run = async () => {
      const params = new URLSearchParams(window.location.search);
      const code   = params.get('code');
      const state  = params.get('state');
      const error  = params.get('error');

      if (error) {
        send({ type: 'FB_OAUTH_RESULT', error: 'auth_denied' });
        return;
      }

      const savedState = sessionStorage.getItem('fb_oauth_state');
      if (!code || state !== savedState) {
        send({ type: 'FB_OAUTH_RESULT', error: 'invalid_state' });
        return;
      }

      sessionStorage.removeItem('fb_oauth_state');

      try {
        setMessage('מחליף טוקן...');

        const { data, error: fnError } = await supabase.functions.invoke('facebook-oauth', {
          body: { code, redirect_uri: FB_REDIRECT_URI },
        });

        if (fnError || data?.error) {
          send({ type: 'FB_OAUTH_RESULT', error: fnError?.message ?? data?.error ?? 'exchange_failed' });
          return;
        }

        setStatus('done');
        setMessage('חיבור הושלם!');
        send({ type: 'FB_OAUTH_RESULT', pages: data.pages });

      } catch (err) {
        send({ type: 'FB_OAUTH_RESULT', error: (err as Error).message });
      }
    };

    run();
  }, []);

  function send(msg: Record<string, unknown>) {
    if (window.opener) {
      window.opener.postMessage(msg, window.location.origin);
      setTimeout(() => window.close(), 800);
    } else {
      setStatus('error');
      setMessage('שגיאה בחיבור — נסה שנית');
    }
  }

  const isError = status === 'error';

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg,#00113a 0%,#002366 50%,#1a0040 100%)' }}
    >
      <div className="rounded-2xl p-10 bg-white text-center" style={{ boxShadow: '0 25px 50px rgba(0,0,0,0.4)', minWidth: 280 }}>
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{
            background: isError
              ? 'linear-gradient(135deg,#dc2626,#ef4444)'
              : status === 'done'
              ? 'linear-gradient(135deg,#16a34a,#22c55e)'
              : 'linear-gradient(135deg,#1877F2,#42a5f5)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          }}
        >
          <span className="material-symbols-outlined text-white text-[30px] icon-filled">
            {isError ? 'error' : status === 'done' ? 'check_circle' : 'groups'}
          </span>
        </div>
        <p className="text-sm font-semibold text-primary">{message}</p>
        {!isError && status === 'loading' && (
          <div className="flex justify-center gap-1.5 mt-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="w-2 h-2 rounded-full bg-blue-500"
                style={{ animation: `bounce 1.2s ${i * 0.2}s infinite` }} />
            ))}
          </div>
        )}
      </div>
      <style>{`
        @keyframes bounce {
          0%,80%,100%{transform:scale(0.7);opacity:.5}
          40%{transform:scale(1.2);opacity:1}
        }
      `}</style>
    </div>
  );
}
