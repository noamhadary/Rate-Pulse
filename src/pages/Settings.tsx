import { useState, useEffect, useId, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { TONE_LABELS, type ToneType, type BranchData } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/auth-context';
import { useBusiness } from '../context/business-context';
import { seedDemoReviews } from '../lib/demoReviews';
import { syncGoogleReviews } from '../lib/googleBusinessAPI';
import { syncFacebookReviews } from '../lib/facebookReviewsAPI';
import { openFacebookOAuth, type FacebookPage } from '../lib/facebookOAuth';

// ── Types ──────────────────────────────────────────────────────────────────────

type Tab = 'profile' | 'notifications' | 'ai' | 'team' | 'integrations' | 'billing';
type MemberRole = 'admin' | 'manager' | 'viewer';
type MemberStatus = 'active' | 'pending';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: MemberRole;
  status: MemberStatus;
  initials: string;
  joined_at: string;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const TONES: ToneType[] = ['soft', 'gentle', 'firm', 'apologetic'];

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'profile',       label: 'פרופיל',       icon: 'person' },
  { id: 'notifications', label: 'התראות',        icon: 'notifications' },
  { id: 'ai',            label: 'AI תגובות',     icon: 'smart_toy' },
  { id: 'team',          label: 'צוות',          icon: 'group' },
  { id: 'integrations',  label: 'אינטגרציות',    icon: 'link' },
  { id: 'billing',       label: 'חיוב',          icon: 'credit_card' },
];

const ROLE_META: Record<MemberRole, { label: string; color: string; bg: string; icon: string; desc: string }> = {
  admin:   { label: 'מנהל מערכת', color: '#871dd3', bg: 'rgba(135,29,211,0.1)', icon: 'shield_person',   desc: 'גישה מלאה לכל הפונקציות' },
  manager: { label: 'מנהל',       color: '#2563eb', bg: '#dbeafe',               icon: 'manage_accounts', desc: 'ניהול ביקורות ודוחות' },
  viewer:  { label: 'צופה',       color: '#444650', bg: '#edeeef',               icon: 'visibility',      desc: 'צפייה בלבד, ללא עריכה' },
};

const PERMISSIONS: { feature: string; admin: boolean; manager: boolean; viewer: boolean }[] = [
  { feature: 'צפייה בביקורות',      admin: true,  manager: true,  viewer: true  },
  { feature: 'תגובה לביקורות',     admin: true,  manager: true,  viewer: false },
  { feature: 'הגדרות AI',           admin: true,  manager: true,  viewer: false },
  { feature: 'צפייה בדוחות',        admin: true,  manager: true,  viewer: true  },
  { feature: 'ניתוח מעמיק',         admin: true,  manager: true,  viewer: true  },
  { feature: 'ניהול אינטגרציות',    admin: true,  manager: false, viewer: false },
  { feature: 'ניהול צוות',          admin: true,  manager: false, viewer: false },
  { feature: 'הגדרות חיוב',         admin: true,  manager: false, viewer: false },
];

const INITIAL_MEMBERS: TeamMember[] = [
  { id: 'u1', name: 'מנהל המערכת',    email: 'admin@reviewpulse.co.il',    role: 'admin',   status: 'active',  initials: 'מנ', joined_at: '2024-01-01' },
  { id: 'u2', name: 'שרה כהן',        email: 'sarah@company.co.il',        role: 'manager', status: 'active',  initials: 'שכ', joined_at: '2024-03-15' },
  { id: 'u3', name: 'דוד לוי',        email: 'david@company.co.il',        role: 'viewer',  status: 'active',  initials: 'דל', joined_at: '2024-06-20' },
  { id: 'u4', name: 'מיכל גרין',      email: 'michal@company.co.il',       role: 'manager', status: 'pending', initials: 'מג', joined_at: '2024-12-01' },
];

const INTEGRATIONS_CONFIG = [
  { id: 'google',      name: 'Google Business', icon: 'language', color: '#4285F4', reviews: 142, lastSync: 'לפני 2 שעות', comingSoon: false },
  { id: 'facebook',    name: 'Facebook Pages',  icon: 'groups',   color: '#1877F2', reviews: 0,   lastSync: null,           comingSoon: false },
  { id: 'tripadvisor', name: 'TripAdvisor',     icon: 'flight',   color: '#34E0A1', reviews: 0,   lastSync: null,           comingSoon: true  },
];

type CredField = { key: string; label: string; placeholder: string; dir?: 'ltr' | 'rtl'; type?: string; hint: string };

const PLATFORM_CREDENTIAL_FIELDS: Record<string, CredField[]> = {
  google: [
    { key: 'place_id', label: 'מזהה מיקום Google (Place ID)', placeholder: 'ChIJrTLr-GyuEmsRBfy61i59si4', dir: 'ltr', hint: 'ניתן למצוא ב-Google Maps → שתף → העתק קישור' },
  ],
  facebook: [
    { key: 'page_id',      label: 'מזהה הדף (Page ID)',         placeholder: '123456789012345',  dir: 'ltr',           hint: 'הגדרות הדף ← מידע כללי' },
    { key: 'access_token', label: 'טוקן גישה (Access Token)',   placeholder: 'EAAxxxxxxxx...',   dir: 'ltr', type: 'password', hint: 'ניתן להנפיק דרך Facebook Developers' },
  ],
  tripadvisor: [
    { key: 'location_url', label: 'קישור לדף TripAdvisor', placeholder: 'https://www.tripadvisor.com/Restaurant_Review-...', dir: 'ltr', hint: 'העתק את הכתובת מהדפדפן כשאתה בדף העסק' },
  ],
};

// ── Persistence hook ───────────────────────────────────────────────────────────


// ── Loading skeleton ───────────────────────────────────────────────────────────

function LoadingCard() {
  return (
    <div className="rounded-2xl p-6 mb-5 animate-pulse bg-white border border-outline-variant/30">
      <div className="h-4 w-1/3 rounded-lg mb-5 bg-surface-container-low" />
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center justify-between py-3 border-b last:border-b-0 border-outline-variant/20">
          <div className="space-y-1.5">
            <div className="h-3.5 w-32 rounded bg-surface-container-low" />
            <div className="h-2.5 w-48 rounded bg-surface-container-low" />
          </div>
          <div className="w-12 h-6 rounded-full bg-surface-container-low" />
        </div>
      ))}
    </div>
  );
}

// ── Toast ──────────────────────────────────────────────────────────────────────

interface ToastProps { message: string; type: 'success' | 'error' | 'info'; visible: boolean }

function Toast({ message, type, visible }: ToastProps) {
  const colors = { success: '#16a34a', error: '#dc2626', info: '#2563eb' };
  const icons  = { success: 'check_circle', error: 'error', info: 'info' };
  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2.5 px-5 py-3 rounded-xl shadow-2xl transition-all duration-300 bg-white"
      style={{
        border: `1.5px solid ${colors[type]}`,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(16px)',
        pointerEvents: 'none',
      }}
    >
      <span className="material-symbols-outlined text-[18px] icon-filled" style={{ color: colors[type] }}>{icons[type]}</span>
      <span className="text-sm font-semibold text-primary">{message}</span>
    </div>
  );
}

function useToast() {
  const [toast, setToast] = useState<ToastProps>({ message: '', type: 'success', visible: false });
  const show = (message: string, type: ToastProps['type'] = 'success') => {
    setToast({ message, type, visible: true });
    setTimeout(() => setToast((t) => ({ ...t, visible: false })), 3000);
  };
  return { toast, show };
}

// ── Shared UI ──────────────────────────────────────────────────────────────────

function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-6 mb-5 bg-white border border-outline-variant/30" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
      <div className="mb-5">
        <h3 className="text-base font-bold text-primary">{title}</h3>
        {subtitle && <p className="text-xs mt-0.5 text-outline">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function Toggle({ value, onChange, label, desc, disabled }: {
  value: boolean; onChange: () => void; label: string; desc?: string; disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b last:border-b-0 border-outline-variant/30">
      <div>
        <p className={`text-sm font-semibold ${disabled ? 'text-outline-variant' : 'text-on-surface'}`}>{label}</p>
        {desc && <p className="text-xs mt-0.5 text-outline">{desc}</p>}
      </div>
      <button
        onClick={disabled ? undefined : onChange}
        disabled={disabled}
        role="switch"
        aria-checked={value}
        aria-label={label}
        className={`relative w-12 h-6 rounded-full transition-all duration-300 flex-shrink-0 ${
          value ? 'bg-secondary' : 'bg-outline-variant'
        } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span className="absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-300"
          style={{ right: value ? 6 : 'auto', left: value ? 'auto' : 6 }} />
      </button>
    </div>
  );
}

function InputField({ label, value, onChange, type = 'text', placeholder, dir, readOnly }: {
  label: string; value: string; onChange?: (v: string) => void;
  type?: string; placeholder?: string; dir?: 'ltr' | 'rtl'; readOnly?: boolean;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold mb-1 text-on-surface-variant">{label}</label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={readOnly ? undefined : (e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        dir={dir}
        className={`w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-colors border border-outline-variant/50 ${
          readOnly
            ? 'bg-background text-outline cursor-default'
            : 'bg-surface-container-low text-on-surface focus:border-secondary'
        }`}
      />
    </div>
  );
}

function SaveBtn({ onSave, saved }: { onSave: () => void; saved: boolean }) {
  return (
    <button
      onClick={onSave}
      className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm cursor-pointer transition-all hover:opacity-90 text-white ${
        saved ? 'bg-green-600' : 'bg-secondary'
      }`}
    >
      <span className="material-symbols-outlined text-[18px] icon-filled">{saved ? 'check_circle' : 'save'}</span>
      {saved ? 'נשמר!' : 'שמור שינויים'}
    </button>
  );
}

// ── Password modal ─────────────────────────────────────────────────────────────

function PasswordModal({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (!form.current) return setError('יש להזין את הסיסמה הנוכחית');
    if (form.next.length < 8) return setError('הסיסמה החדשה חייבת להכיל לפחות 8 תווים');
    if (form.next !== form.confirm) return setError('הסיסמאות אינן תואמות');
    setError('');
    onSave();
  };

  return (
    <Overlay onClose={onClose}>
      <ModalBox title="שינוי סיסמה" icon="lock" onClose={onClose}>
        <div className="space-y-4">
          {[
            { key: 'current', label: 'סיסמה נוכחית' },
            { key: 'next',    label: 'סיסמה חדשה' },
            { key: 'confirm', label: 'אימות סיסמה חדשה' },
          ].map(({ key, label }) => (
            <div key={key} className="relative">
              <InputField
                label={label}
                value={form[key as keyof typeof form]}
                onChange={(v) => setForm((f) => ({ ...f, [key]: v }))}
                type={show ? 'text' : 'password'}
                placeholder="••••••••"
              />
            </div>
          ))}
          <button
            onClick={() => setShow(!show)}
            className="flex items-center gap-1.5 text-xs cursor-pointer text-secondary"
          >
            <span className="material-symbols-outlined text-[14px]">{show ? 'visibility_off' : 'visibility'}</span>
            {show ? 'הסתר סיסמאות' : 'הצג סיסמאות'}
          </button>
          {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button onClick={handleSubmit}
              className="flex-1 py-2.5 rounded-xl font-bold text-sm cursor-pointer hover:opacity-90"
              style={{ background: 'linear-gradient(135deg,#002366,#871dd3)', color: '#fff' }}>
              שמור סיסמה
            </button>
            <button onClick={onClose}
              className="px-5 py-2.5 rounded-xl font-bold text-sm cursor-pointer border text-on-surface-variant border-outline-variant/50">
              ביטול
            </button>
          </div>
        </div>
      </ModalBox>
    </Overlay>
  );
}

// ── Two-Factor Authentication modal ────────────────────────────────────────────

function TwoFAModal({
  action,
  onClose,
  onSuccess,
}: {
  action: 'enable' | 'disable';
  onClose: () => void;
  onSuccess: (enabled: boolean) => void;
}) {
  const [step, setStep]         = useState<'loading' | 'qr' | 'verify' | 'confirm' | 'done'>('loading');
  const [code, setCode]         = useState('');
  const [error, setError]       = useState('');
  const [busy, setBusy]         = useState(false);
  const [factorId, setFactorId] = useState('');
  const [qrCode, setQrCode]     = useState('');
  const [secret, setSecret]     = useState('');

  useEffect(() => {
    if (action === 'disable') { setStep('confirm'); return; }
    // Enroll a new TOTP factor
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const email = sessionData.session?.user?.email ?? 'המשתמש';
      const { data, error: e } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: `Rate Pulse (${email})`,
        issuer: 'Rate Pulse',
      });
      if (e || !data) { setError(e?.message ?? 'שגיאה'); setStep('qr'); return; }
      setFactorId(data.id);
      setQrCode(data.totp.qr_code);   // data URI SVG
      setSecret(data.totp.secret);
      setStep('qr');
    })();
  }, [action]);

  const handleVerify = async () => {
    if (code.length !== 6) return;
    setBusy(true); setError('');
    const { error: e } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    setBusy(false);
    if (e) { setError('קוד שגוי — נסה שנית'); return; }
    setStep('done');
    setTimeout(() => { onSuccess(true); onClose(); }, 1200);
  };

  const handleDisable = async () => {
    if (code.length !== 6) return;
    setBusy(true); setError('');
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const factor = factors?.totp?.[0];
    if (!factor) { setBusy(false); setError('לא נמצא גורם אימות'); return; }
    // Must reach AAL2 before Supabase allows unenrolling a verified factor
    const { error: verifyErr } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
    if (verifyErr) { setBusy(false); setError('קוד שגוי — נסה שנית'); return; }
    const { error: unenrollErr } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
    setBusy(false);
    if (unenrollErr) { setError(unenrollErr.message); return; }
    setStep('done');
    setTimeout(() => { onSuccess(false); onClose(); }, 1200);
  };

  return (
    <Overlay onClose={onClose}>
      <ModalBox
        title={action === 'enable' ? 'הפעלת אימות דו-שלבי' : 'ביטול אימות דו-שלבי'}
        icon={action === 'enable' ? 'verified_user' : 'no_encryption'}
        onClose={onClose}
      >
        {step === 'loading' && (
          <div className="flex justify-center py-8">
            <span className="material-symbols-outlined text-[32px] text-secondary animate-spin">progress_activity</span>
          </div>
        )}

        {step === 'qr' && (
          <div className="space-y-4">
            <p className="text-sm text-on-surface-variant">
              סרוק את קוד ה-QR עם אפליקציית האימות שלך (Google Authenticator, Authy וכד׳).
            </p>
            {qrCode && (
              <div className="flex justify-center">
                <img src={qrCode} alt="QR Code" className="w-48 h-48 rounded-xl border border-outline-variant/30 p-2 bg-white" />
              </div>
            )}
            <div className="bg-surface-container-low rounded-xl px-4 py-2 text-center">
              <p className="text-xs text-outline mb-1">הזנה ידנית של סוד:</p>
              <p className="text-sm font-mono font-bold tracking-widest text-primary select-all">{secret}</p>
            </div>
            <button
              onClick={() => setStep('verify')}
              className="w-full py-2.5 rounded-xl font-bold text-sm cursor-pointer hover:opacity-90"
              style={{ background: 'linear-gradient(135deg,#002366,#871dd3)', color: '#fff' }}
            >
              סרקתי — המשך לאימות
            </button>
          </div>
        )}

        {step === 'verify' && (
          <div className="space-y-4">
            <p className="text-sm text-on-surface-variant">
              הזן את קוד 6 הספרות מאפליקציית האימות:
            </p>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
              className="w-full text-center text-2xl font-mono tracking-[0.5em] px-4 py-3 rounded-xl border border-outline-variant/50 outline-none focus:border-secondary bg-surface-container-low"
              autoFocus
            />
            {error && <p className="text-xs font-semibold text-red-600 text-center">{error}</p>}
            <div className="flex gap-3">
              <button
                onClick={handleVerify}
                disabled={busy || code.length !== 6}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm cursor-pointer hover:opacity-90 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg,#002366,#871dd3)', color: '#fff' }}
              >
                {busy ? 'מאמת...' : 'אמת ואפשר'}
              </button>
              <button onClick={() => setStep('qr')}
                className="px-4 py-2.5 rounded-xl font-bold text-sm cursor-pointer border text-on-surface-variant border-outline-variant/50">
                חזור
              </button>
            </div>
          </div>
        )}

        {step === 'confirm' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-red-50 rounded-xl">
              <span className="material-symbols-outlined text-[24px] text-red-600 icon-filled">warning</span>
              <p className="text-sm text-red-700 font-medium">
                כדי לבטל 2FA הזן את קוד 6 הספרות מאפליקציית האימות שלך:
              </p>
            </div>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
              className="w-full text-center text-2xl font-mono tracking-[0.5em] px-4 py-3 rounded-xl border border-outline-variant/50 outline-none focus:border-red-500 bg-surface-container-low"
              autoFocus
            />
            {error && <p className="text-xs font-semibold text-red-600 text-center">{error}</p>}
            <div className="flex gap-3">
              <button
                onClick={handleDisable}
                disabled={busy || code.length !== 6}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm cursor-pointer bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >
                {busy ? 'מבטל...' : 'בטל 2FA'}
              </button>
              <button onClick={onClose}
                className="px-4 py-2.5 rounded-xl font-bold text-sm cursor-pointer border text-on-surface-variant border-outline-variant/50">
                ביטול
              </button>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="flex flex-col items-center gap-4 py-6">
            <span className="material-symbols-outlined text-[48px] text-green-500 icon-filled">check_circle</span>
            <p className="text-base font-bold text-primary">
              {action === 'enable' ? 'אימות דו-שלבי הופעל!' : 'אימות דו-שלבי בוטל'}
            </p>
          </div>
        )}
      </ModalBox>
    </Overlay>
  );
}

// ── Invite modal ───────────────────────────────────────────────────────────────

function InviteModal({ onClose, onInvite }: {
  onClose: () => void;
  onInvite: (email: string, role: MemberRole) => void;
}) {
  const [email, setEmail] = useState('');
  const [role, setRole]   = useState<MemberRole>('manager');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (!email.includes('@')) return setError('כתובת אימייל לא תקינה');
    setError('');
    onInvite(email, role);
  };

  return (
    <Overlay onClose={onClose}>
      <ModalBox title="הזמנת חבר צוות" icon="person_add" onClose={onClose}>
        <div className="space-y-5">
          <InputField label="כתובת אימייל" value={email} onChange={setEmail} type="email" placeholder="name@company.co.il" dir="ltr" />

          <div>
            <p className="text-xs font-semibold mb-2 text-on-surface-variant">תפקיד</p>
            <div className="space-y-2">
              {(['admin', 'manager', 'viewer'] as MemberRole[]).map((r) => {
                const m = ROLE_META[r];
                return (
                  <button
                    key={r}
                    onClick={() => setRole(r)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl text-right transition-all cursor-pointer"
                    style={{ border: `2px solid ${role === r ? m.color : 'rgba(197,198,210,0.4)'}`, backgroundColor: role === r ? m.bg : '#f8f9fa' }}
                  >
                    <span className="material-symbols-outlined text-[18px] icon-filled" style={{ color: m.color }}>{m.icon}</span>
                    <div className="flex-1">
                      <p className="text-sm font-bold" style={{ color: m.color }}>{m.label}</p>
                      <p className="text-xs text-outline">{m.desc}</p>
                    </div>
                    {role === r && <span className="material-symbols-outlined text-[16px] icon-filled" style={{ color: m.color }}>check_circle</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {error && <p className="text-xs font-semibold text-red-600">{error}</p>}

          <div className="flex gap-3">
            <button onClick={handleSubmit}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm cursor-pointer hover:opacity-90"
              style={{ background: 'linear-gradient(135deg,#002366,#871dd3)', color: '#fff' }}>
              <span className="material-symbols-outlined text-[16px] icon-filled">send</span>
              שלח הזמנה
            </button>
            <button onClick={onClose}
              className="px-5 py-2.5 rounded-xl font-bold text-sm cursor-pointer border text-on-surface-variant border-outline-variant/50">
              ביטול
            </button>
          </div>
        </div>
      </ModalBox>
    </Overlay>
  );
}

// ── Connect platform modal ─────────────────────────────────────────────────────

function ConnectModal({ platform, onClose, onConnected, initialCreds }: {
  platform: typeof INTEGRATIONS_CONFIG[number];
  onClose: () => void;
  onConnected: (creds: Record<string, string>) => void;
  initialCreds?: Record<string, string>;
}) {
  const [step, setStep] = useState<'form' | 'connecting' | 'done'>('form');
  const [creds, setCreds] = useState<Record<string, string>>(initialCreds ?? {});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const fields = PLATFORM_CREDENTIAL_FIELDS[platform.id] ?? [];

  const validate = () => {
    const next: Record<string, string> = {};
    fields.forEach((f) => {
      if (!creds[f.key]?.trim()) next[f.key] = 'שדה חובה';
    });
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleConnect = () => {
    if (!validate()) return;
    setStep('connecting');
    setTimeout(() => { setStep('done'); onConnected(creds); }, 1800);
  };

  return (
    <Overlay onClose={onClose}>
      <ModalBox title={`חיבור ${platform.name}`} icon="link" onClose={onClose}>
        {step === 'form' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-surface-container-low">
              <span className="material-symbols-outlined text-[28px] icon-filled" style={{ color: platform.color }}>
                {platform.icon}
              </span>
              <div>
                <p className="text-sm font-bold text-primary">{platform.name}</p>
                <p className="text-xs text-outline">הזן את פרטי הגישה לסנכרון ביקורות אוטומטי</p>
              </div>
            </div>

            {fields.length > 0 ? (
              <div className="space-y-4">
                {fields.map((f) => (
                  <div key={f.key}>
                    <label className="block text-xs font-semibold mb-1 text-on-surface-variant">{f.label}</label>
                    <input
                      type={f.type ?? 'text'}
                      value={creds[f.key] ?? ''}
                      onChange={(e) => {
                        setCreds((prev) => ({ ...prev, [f.key]: e.target.value }));
                        if (errors[f.key]) setErrors((prev) => ({ ...prev, [f.key]: '' }));
                      }}
                      placeholder={f.placeholder}
                      dir={f.dir}
                      className={`w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-colors border ${
                        errors[f.key] ? 'border-red-400 bg-red-50' : 'border-outline-variant/50 bg-surface-container-low focus:border-secondary'
                      } text-on-surface`}
                    />
                    {errors[f.key]
                      ? <p className="text-xs mt-1 font-semibold text-red-500">{errors[f.key]}</p>
                      : <p className="text-xs mt-1 text-outline">{f.hint}</p>
                    }
                  </div>
                ))}
              </div>
            ) : (
              <ol className="space-y-2 text-sm text-on-surface-variant">
                <li className="flex items-start gap-2">
                  <span className="font-bold text-xs w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 bg-secondary/10 text-secondary">1</span>
                  לחץ "הפעל חיבור" כדי להתחיל
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-xs w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 bg-secondary/10 text-secondary">2</span>
                  אשר גישה לחשבון {platform.name} שלך
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-xs w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 bg-secondary/10 text-secondary">3</span>
                  ביקורות יסונכרנו אוטומטית מעתה
                </li>
              </ol>
            )}

            <div className="flex gap-3 pt-1">
              <button onClick={handleConnect}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm cursor-pointer hover:opacity-90"
                style={{ background: 'linear-gradient(135deg,#002366,#871dd3)', color: '#fff' }}>
                <span className="material-symbols-outlined text-[16px] icon-filled">link</span>
                הפעל חיבור
              </button>
              <button onClick={onClose}
                className="px-5 py-2.5 rounded-xl font-bold text-sm cursor-pointer border text-on-surface-variant border-outline-variant/50">
                ביטול
              </button>
            </div>
          </div>
        )}
        {step === 'connecting' && (
          <div className="flex flex-col items-center py-8 gap-3">
            <div className="w-14 h-14 rounded-full flex items-center justify-center animate-pulse"
              style={{ background: 'linear-gradient(135deg,#002366,#871dd3)' }}>
              <span className="material-symbols-outlined text-white text-[24px] icon-filled">link</span>
            </div>
            <p className="font-bold text-primary">מתחבר ל-{platform.name}...</p>
            <p className="text-sm text-outline">מאמת הרשאות</p>
          </div>
        )}
        {step === 'done' && (
          <div className="flex flex-col items-center py-8 gap-3">
            <div className="w-14 h-14 rounded-full flex items-center justify-center bg-green-100">
              <span className="material-symbols-outlined text-[28px] icon-filled text-green-600">check_circle</span>
            </div>
            <p className="font-bold text-primary">מחובר בהצלחה!</p>
            <p className="text-sm text-outline">ביקורות יסונכרנו אוטומטית</p>
            <button onClick={onClose}
              className="mt-2 px-6 py-2.5 rounded-xl font-bold text-sm cursor-pointer hover:opacity-90 bg-green-600 text-white">
              סגור
            </button>
          </div>
        )}
      </ModalBox>
    </Overlay>
  );
}

// ── Upgrade modal ──────────────────────────────────────────────────────────────

function UpgradeModal({ onClose }: { onClose: () => void }) {
  const [period, setPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [plan, setPlan]     = useState<'pro' | 'enterprise'>('pro');
  const [step, setStep]     = useState<'plans' | 'done'>('plans');

  const prices = { pro: { monthly: '₪149', yearly: '₪119' }, enterprise: { monthly: '₪399', yearly: '₪319' } };

  return (
    <Overlay onClose={onClose}>
      <div className="w-full max-w-xl rounded-2xl overflow-hidden bg-white" style={{ boxShadow: '0 24px 80px rgba(0,0,0,0.2)' }}>
        <div className="px-6 py-5 flex items-center justify-between border-b border-outline-variant/30" style={{ background: 'linear-gradient(135deg,#00113a,#002366)' }}>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] icon-filled text-white">stars</span>
            <h2 className="text-lg font-bold text-white">שדרוג תוכנית</h2>
          </div>
          <button onClick={onClose} aria-label="סגור" className="p-2 rounded-lg cursor-pointer text-white/70">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {step === 'plans' && (
          <div className="p-6">
            {/* Period toggle */}
            <div className="flex items-center justify-center gap-1 p-1 rounded-xl mb-5 w-fit mx-auto bg-surface-container-low">
              {(['monthly', 'yearly'] as const).map((p) => (
                <button key={p} onClick={() => setPeriod(p)}
                  className={`px-5 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all ${
                    period === p ? 'bg-white text-primary shadow-sm' : 'text-outline'
                  }`}>
                  {p === 'monthly' ? 'חודשי' : 'שנתי'}
                  {p === 'yearly' && <span className="mr-1 text-xs font-bold text-green-600">חסוך 20%</span>}
                </button>
              ))}
            </div>

            {/* Plan cards */}
            <div className="grid grid-cols-2 gap-4 mb-5">
              {(['pro', 'enterprise'] as const).map((p) => (
                <button key={p} onClick={() => setPlan(p)}
                  className="p-4 rounded-2xl text-right transition-all cursor-pointer"
                  style={{ border: `2px solid ${plan === p ? '#871dd3' : 'rgba(197,198,210,0.4)'}`, backgroundColor: plan === p ? 'rgba(135,29,211,0.04)' : '#f8f9fa' }}>
                  <p className={`text-sm font-bold mb-0.5 ${plan === p ? 'text-secondary' : 'text-primary'}`}>
                    {p === 'pro' ? 'Pro' : 'Enterprise'}
                  </p>
                  <p className="text-2xl font-extrabold text-primary">{prices[p][period]}</p>
                  <p className="text-xs mt-0.5 text-outline">לחודש</p>
                  <ul className="mt-3 space-y-1 text-xs text-on-surface-variant">
                    {(p === 'pro'
                      ? ['ביקורות ללא הגבלה', '5 משתמשים', 'AI תגובות מתקדם', 'דוחות מותאמים']
                      : ['הכל ב-Pro', 'משתמשים ללא הגבלה', 'API גישה', 'תמיכה VIP 24/7']
                    ).map((f) => (
                      <li key={f} className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px] icon-filled text-green-600">check</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                </button>
              ))}
            </div>

            <button onClick={() => setStep('done')}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm cursor-pointer hover:opacity-90"
              style={{ background: 'linear-gradient(135deg,#002366,#871dd3)', color: '#fff' }}>
              <span className="material-symbols-outlined text-[16px] icon-filled">credit_card</span>
              עבור לתשלום — {prices[plan][period]}/חודש
            </button>
          </div>
        )}

        {step === 'done' && (
          <div className="flex flex-col items-center py-12 gap-4 px-6">
            <div className="w-16 h-16 rounded-full flex items-center justify-center bg-green-100">
              <span className="material-symbols-outlined text-[32px] icon-filled text-green-600">check_circle</span>
            </div>
            <p className="text-lg font-bold text-primary">ברוך הבא לתוכנית Pro!</p>
            <p className="text-sm text-center text-outline">חשבונך שודרג בהצלחה. כל הפיצ'רים זמינים מיידית.</p>
            <button onClick={onClose}
              className="mt-2 px-6 py-2.5 rounded-xl font-bold text-sm cursor-pointer hover:opacity-90 bg-green-600 text-white">
              התחל להשתמש
            </button>
          </div>
        )}
      </div>
    </Overlay>
  );
}

// ── Generic modal wrappers ─────────────────────────────────────────────────────

function Overlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,17,58,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {children}
    </div>
  );
}

function ModalBox({ title, icon, onClose, children }: { title: string; icon: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="w-full max-w-md rounded-2xl overflow-hidden bg-white" style={{ boxShadow: '0 24px 80px rgba(0,0,0,0.2)' }}>
      <div className="px-6 py-5 flex items-center justify-between border-b border-outline-variant/30">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px] icon-filled text-secondary">{icon}</span>
          <h2 className="text-base font-bold text-primary">{title}</h2>
        </div>
        <button onClick={onClose} aria-label="סגור" className="p-2 rounded-lg hover:bg-gray-100 cursor-pointer">
          <span className="material-symbols-outlined text-on-surface-variant">close</span>
        </button>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

// ── Tab: Profile ───────────────────────────────────────────────────────────────

interface ProfileForm {
  contact_name: string;
  name: string;
  email: string;
  phone: string;
  website: string;
  category: string;
  description: string;
}

function ProfileTab({ showToast }: { showToast: (m: string, t?: ToastProps['type']) => void }) {
  const { user, isDemo, signOut } = useAuth();
  const { business, refetch: refetchBusiness } = useBusiness();

  // Demo values saved on a previous visit — read once on mount
  const [demoSaved] = useState<Partial<ProfileForm>>(() => {
    try {
      return JSON.parse(localStorage.getItem('rp_demo_profile') ?? '{}');
    } catch {
      return {};
    }
  });
  // User edits override the loaded base profile
  const [draft, setDraft] = useState<ProfileForm | null>(null);
  const [saved, setSaved] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [uploadingProfilePhoto, setUploadingProfilePhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const profilePhotoRef = useRef<HTMLInputElement>(null);
  const [branches, setBranches] = useState<BranchData[]>([{ location: '' }]);
  const [selectedBranchIdx, setSelectedBranchIdx] = useState(0);
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [showTwoFA, setShowTwoFA]       = useState(false);

  // Sync logo from business context (handles both initial load and updates)
  useEffect(() => {
    setLogoUrl(business?.logo_url ?? null);
  }, [business?.logo_url]);

  // Sync profile photo from user metadata
  useEffect(() => {
    const url = (user?.user_metadata?.avatar_url as string | undefined)
             || (user?.user_metadata?.picture   as string | undefined)
             || null;
    setProfilePhotoUrl(url);
  }, [user?.user_metadata]);

  // Check 2FA status on mount
  useEffect(() => {
    supabase.auth.mfa.listFactors().then(({ data }) => {
      const verified = data?.totp?.some((f) => f.status === 'verified') ?? false;
      setTwoFAEnabled(verified);
    });
  }, []);

  // Load branches from DB whenever business changes
  useEffect(() => {
    const raw = business?.branches;
    if (Array.isArray(raw) && raw.length > 0) {
      setBranches(raw as BranchData[]);
    } else {
      setBranches([{ location: '' }]);
    }
    setSelectedBranchIdx(0);
  }, [business?.id]);

  const handleBranchCountChange = (count: number) => {
    setBranches((prev) => {
      if (count > prev.length) {
        return [...prev, ...Array.from({ length: count - prev.length }, () => ({ location: '' }))];
      }
      return prev.slice(0, count);
    });
    setSelectedBranchIdx((prev) => Math.min(prev, count - 1));
  };

  const updateBranchLocation = (idx: number, location: string) => {
    setBranches((prev) => prev.map((b, i) => (i === idx ? { ...b, location } : b)));
  };

  const branchLabel = (idx: number) => idx === 0 ? 'סניף ראשי' : `סניף ${idx + 1}`;

  const handleProfilePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingProfilePhoto(true);
    const ext = file.name.split('.').pop() ?? 'jpg';
    const { error: uploadError } = await supabase.storage
      .from('business-logos')
      .upload(`${user.id}/profile.${ext}`, file, { upsert: true });
    if (uploadError) {
      showToast(`שגיאה בהעלאת התמונה: ${uploadError.message}`, 'error');
      setUploadingProfilePhoto(false);
      return;
    }
    const { data: { publicUrl } } = supabase.storage.from('business-logos').getPublicUrl(`${user.id}/profile.${ext}`);
    const urlWithBust = `${publicUrl}?t=${Date.now()}`;
    await supabase.auth.updateUser({ data: { avatar_url: urlWithBust } });
    setProfilePhotoUrl(urlWithBust);
    setUploadingProfilePhoto(false);
    showToast('תמונת הפרופיל עודכנה בהצלחה');
    if (profilePhotoRef.current) profilePhotoRef.current.value = '';
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingAvatar(true);
    const ext = file.name.split('.').pop() ?? 'jpg';
    const path = `${user.id}/logo.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from('business-logos')
      .upload(path, file, { upsert: true });
    if (uploadError) {
      showToast(`שגיאה בהעלאת התמונה: ${uploadError.message}`, 'error');
      setUploadingAvatar(false);
      return;
    }
    const { data: { publicUrl } } = supabase.storage.from('business-logos').getPublicUrl(path);
    const urlWithBust = `${publicUrl}?t=${Date.now()}`;
    await supabase.from('businesses').update({ logo_url: urlWithBust }).eq('owner_id', user.id);
    setLogoUrl(urlWithBust);
    refetchBusiness();
    setUploadingAvatar(false);
    showToast('לוגו העסק עודכן בהצלחה');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const baseProfile = useMemo<ProfileForm>(() => {
    const meta = (user?.user_metadata ?? {}) as Record<string, string>;
    if (business) {
      return {
        contact_name: meta.full_name      ?? '',
        name:         business.name       ?? '',
        email:        user?.email         ?? '',
        phone:        business.phone      ?? '',
        website:      business.website    ?? '',
        category:     business.category   ?? 'קמעונאות',
        description:  business.description ?? '',
      };
    }
    if (isDemo) {
      return {
        contact_name: '',
        name: '',
        email: user?.email ?? '',
        phone: '+972534777375',
        website: '',
        category: 'קמעונאות',
        description: '',
        ...demoSaved,
      };
    }
    // New real user — prefill from registration metadata
    return {
      contact_name: meta.full_name     || '',
      name:         meta.business_name || meta.full_name || '',
      email:        user?.email        ?? '',
      phone:        '',
      website:      '',
      category:     'קמעונאות',
      description:  '',
    };
  }, [business, isDemo, user, demoSaved]);

  const profile = draft ?? baseProfile;
  const setProfile = setDraft;

  const displayName = profile.contact_name || profile.name || '';
  const initials = displayName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() || 'מנ';

  const handleSave = async () => {
    if (isDemo) {
      // Demo — persist to localStorage so navigation doesn't wipe it
      localStorage.setItem('rp_demo_profile', JSON.stringify(profile));
      setSaved(true);
      showToast('הפרופיל נשמר בהצלחה');
      setTimeout(() => setSaved(false), 2500);
      return;
    }
    if (user) {
      // Save personal name to auth user_metadata
      if (profile.contact_name.trim()) {
        await supabase.auth.updateUser({ data: { full_name: profile.contact_name.trim() } });
      }

      const prevCategory = business?.category ?? null;
      const fields = {
        name:        profile.name.trim()        || 'העסק שלי',
        category:    profile.category.trim()    || 'קמעונאות',
        phone:       profile.phone.trim()       || null,
        website:     profile.website.trim()     || null,
        description: profile.description.trim() || null,
        branches,
      };

      const { data: upserted, error: bizError } = await supabase
        .from('businesses')
        .upsert({ owner_id: user.id, ...fields }, { onConflict: 'owner_id' })
        .select('id')
        .single();

      if (bizError) {
        console.error('businesses save error:', bizError.code, bizError.message, bizError.details);
        showToast(`שגיאה בשמירה: ${bizError.message}`, 'error');
        return;
      }

      const businessId = upserted?.id ?? business?.id ?? null;

      refetchBusiness();

      // Reseed demo reviews when category or business name changes
      if (businessId && (prevCategory !== fields.category || !prevCategory)) {
        await seedDemoReviews(businessId, fields.category, fields.name);
      }
    }
    setSaved(true);
    showToast('הפרופיל נשמר בהצלחה');
    setTimeout(() => setSaved(false), 2500);
  };

  const handleSignOut = async () => {
    await signOut();
    window.location.href = '/auth/login';
  };

  return (
    <>
      {showPwd && <PasswordModal onClose={() => setShowPwd(false)} onSave={() => { setShowPwd(false); showToast('הסיסמה עודכנה בהצלחה'); }} />}

      <SectionCard title="פרטים אישיים">
        {/* Profile photo + Business logo */}
        <div className="flex flex-wrap items-start gap-6 mb-6 pb-6 border-b border-outline-variant/30">

          {/* Profile photo */}
          <div className="flex flex-col items-center gap-1.5">
            <p className="text-xs font-semibold text-on-surface-variant mb-1">תמונת פרופיל</p>
            <div className="relative">
              {profilePhotoUrl ? (
                <img
                  src={profilePhotoUrl}
                  alt="תמונת פרופיל"
                  className="w-16 h-16 rounded-full object-cover"
                  style={{ border: '2px solid rgba(135,29,211,0.2)' }}
                  onError={() => setProfilePhotoUrl(null)}
                />
              ) : (
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-extrabold"
                  style={{ background: 'linear-gradient(135deg,#002366,#871dd3)', color: '#fff' }}
                >
                  {initials}
                </div>
              )}
              {uploadingProfilePhoto && (
                <div className="absolute inset-0 rounded-full flex items-center justify-center bg-black/40">
                  <span className="material-symbols-outlined text-white text-[20px] animate-spin">progress_activity</span>
                </div>
              )}
            </div>
            <button
              onClick={() => !isDemo && profilePhotoRef.current?.click()}
              disabled={uploadingProfilePhoto || isDemo}
              className="text-xs font-semibold cursor-pointer hover:underline text-secondary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploadingProfilePhoto ? 'מעלה...' : 'שנה תמונת פרופיל'}
            </button>
            <input ref={profilePhotoRef} type="file" accept="image/*" className="hidden" onChange={handleProfilePhotoChange} />
          </div>

          {/* Business logo */}
          <div className="flex flex-col items-center gap-1.5">
            <p className="text-xs font-semibold text-on-surface-variant mb-1">לוגו עסק</p>
            <div className="relative">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="לוגו העסק"
                  className="w-16 h-16 rounded-2xl object-contain"
                  style={{ border: '2px solid rgba(135,29,211,0.2)' }}
                  onError={() => setLogoUrl(null)}
                />
              ) : (
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-extrabold"
                  style={{ background: 'linear-gradient(135deg,#002366,#871dd3)', color: '#fff' }}
                >
                  {initials}
                </div>
              )}
              {uploadingAvatar && (
                <div className="absolute inset-0 rounded-2xl flex items-center justify-center bg-black/40">
                  <span className="material-symbols-outlined text-white text-[20px] animate-spin">progress_activity</span>
                </div>
              )}
            </div>
            <button
              onClick={() => !isDemo && fileInputRef.current?.click()}
              disabled={uploadingAvatar || isDemo}
              className="text-xs font-semibold cursor-pointer hover:underline text-secondary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploadingAvatar ? 'מעלה...' : 'שנה לוגו עסק'}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          </div>

          {/* User info */}
          <div className="flex flex-col justify-center">
            <p className="font-bold text-primary">
              {profile.contact_name || profile.name || user?.email?.split('@')[0] || ''}
            </p>
            {profile.contact_name && profile.name && (
              <p className="text-sm text-on-surface-variant">{profile.name}</p>
            )}
            <p className="text-xs text-outline">{profile.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InputField label="שם מלא (איש קשר)" value={profile.contact_name} onChange={(v) => setProfile({ ...profile, contact_name: v })} placeholder="ישראל ישראלי" />
          <InputField label="שם העסק" value={profile.name} onChange={(v) => setProfile({ ...profile, name: v })} />
          <InputField label="אימייל" value={profile.email} onChange={(v) => setProfile({ ...profile, email: v })} type="email" dir="ltr" />
          <InputField label="טלפון" value={profile.phone} onChange={(v) => setProfile({ ...profile, phone: v })} type="tel" dir="ltr" placeholder="+972-50-0000000" />
          <InputField label="אתר אינטרנט" value={profile.website} onChange={(v) => setProfile({ ...profile, website: v })} dir="ltr" placeholder="https://example.co.il" />
          <div>
            <label htmlFor="profile-category" className="block text-xs font-semibold mb-1 text-on-surface-variant">קטגוריה</label>
            <select
              id="profile-category"
              value={profile.category}
              onChange={(e) => setProfile({ ...profile, category: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none cursor-pointer bg-surface-container-low border border-outline-variant/50 text-on-surface focus:border-secondary"
            >
              {['קמעונאות', 'מסעדנות', 'שירותים', 'בריאות', 'אחר'].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="profile-description" className="block text-xs font-semibold mb-1 text-on-surface-variant">תיאור קצר</label>
            <textarea
              id="profile-description"
              value={profile.description}
              onChange={(e) => setProfile({ ...profile, description: e.target.value })}
              placeholder="תיאור קצר של סוג העסק ומה שמייחד אותו..."
              rows={2}
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-colors border border-outline-variant/50 bg-surface-container-low text-on-surface focus:border-secondary resize-none"
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="סניפים" subtitle="הגדר את מספר הסניפים ונהל את פרטי כל סניף">
        {/* Branch count selector */}
        <div className="flex items-center gap-4 pb-4 border-b border-outline-variant/20">
          <label htmlFor="branch-count" className="text-sm font-semibold whitespace-nowrap text-on-surface">מספר סניפים</label>
          <select
            id="branch-count"
            value={branches.length}
            onChange={(e) => handleBranchCountChange(Number(e.target.value))}
            className="w-28 px-3 py-2 rounded-xl text-sm outline-none cursor-pointer bg-surface-container-low border border-outline-variant/50 text-on-surface focus:border-secondary"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          {branches.length > 1 && (
            <span className="text-xs text-outline">סניף 1 הוא הסניף הראשי</span>
          )}
        </div>

        {/* Branch selector + location — only when more than one branch */}
        {branches.length > 1 && (
          <div className="mt-4 space-y-4">
            {/* Pill-style branch selector */}
            <div>
              <p className="text-xs font-semibold mb-2 text-on-surface-variant">בחר סניף</p>
              <div className="flex flex-wrap gap-2">
                {branches.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedBranchIdx(i)}
                    className="px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer"
                    style={
                      selectedBranchIdx === i
                        ? { background: 'linear-gradient(135deg,#002366,#871dd3)', color: '#fff' }
                        : { backgroundColor: '#edeeef', color: '#444650' }
                    }
                  >
                    {branchLabel(i)}
                  </button>
                ))}
              </div>
            </div>

            {/* Selected branch data */}
            <div
              className="p-4 rounded-xl"
              style={{ border: '1.5px solid rgba(135,29,211,0.15)', backgroundColor: 'rgba(135,29,211,0.03)' }}
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-[16px] icon-filled text-secondary">location_on</span>
                <p className="text-sm font-bold text-primary">{branchLabel(selectedBranchIdx)}</p>
                {selectedBranchIdx === 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-secondary/10 text-secondary">ראשי</span>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1 text-on-surface-variant">מיקום</label>
                <input
                  type="text"
                  value={branches[selectedBranchIdx]?.location ?? ''}
                  onChange={(e) => updateBranchLocation(selectedBranchIdx, e.target.value)}
                  placeholder="עיר, רחוב ומספר"
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-colors border border-outline-variant/50 bg-white text-on-surface focus:border-secondary"
                />
              </div>
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard title="אבטחה">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-on-surface">סיסמה</p>
            <p className="text-xs mt-0.5 text-outline">עודכנה לאחרונה לפני 30 יום</p>
          </div>
          <button onClick={() => setShowPwd(true)}
            className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl cursor-pointer transition-all hover:opacity-80 bg-secondary/8 text-secondary">
            <span className="material-symbols-outlined text-[16px]">lock</span>
            שנה סיסמה
          </button>
        </div>
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-outline-variant/30">
          <div>
            <p className="text-sm font-semibold text-on-surface">אימות דו-שלבי (2FA)</p>
            <p className="text-xs mt-0.5 text-outline">
              {twoFAEnabled ? 'מופעל — החשבון מוגן עם שכבת אבטחה נוספת' : 'הגן על החשבון שלך עם שכבת אבטחה נוספת'}
            </p>
          </div>
          <button
            onClick={() => setShowTwoFA(true)}
            className={`flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl cursor-pointer transition-all hover:opacity-80 ${
              twoFAEnabled
                ? 'bg-green-100 text-green-700 border border-green-200'
                : 'bg-surface-container-low text-on-surface-variant border border-outline-variant/50'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">
              {twoFAEnabled ? 'verified_user' : 'shield'}
            </span>
            {twoFAEnabled ? 'מופעל — בטל' : 'הפעל'}
          </button>
        </div>
      </SectionCard>

      {showTwoFA && (
        <TwoFAModal
          action={twoFAEnabled ? 'disable' : 'enable'}
          onClose={() => setShowTwoFA(false)}
          onSuccess={(enabled) => { setTwoFAEnabled(enabled); setShowTwoFA(false); }}
        />
      )}

      <SaveBtn onSave={handleSave} saved={saved} />

      {/* Sign out */}
      <div className="flex justify-end mt-2">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl cursor-pointer transition-all hover:opacity-80 bg-red-100 text-red-600"
        >
          <span className="material-symbols-outlined text-[16px]">logout</span>
          התנתק
        </button>
      </div>
    </>
  );
}

// ── Tab: Notifications ─────────────────────────────────────────────────────────

const NOTIFS_DEFAULTS = {
  email: true, push: false, new_review: true, critical: true, weekly: true, monthly: false, whatsapp: false,
};

function NotificationsTab({ showToast }: { showToast: (m: string, t?: ToastProps['type']) => void }) {
  const { user, isDemo } = useAuth();
  const userId = isDemo ? null : user?.id ?? null;
  const [fetched, setFetched] = useState<{ key: string; notifs: typeof NOTIFS_DEFAULTS } | null>(null);
  // User toggles override the loaded settings
  const [draft, setDraft] = useState<typeof NOTIFS_DEFAULTS | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    supabase
      .from('user_settings')
      .select('notifs')
      .eq('owner_id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setFetched({ key: userId, notifs: { ...NOTIFS_DEFAULTS, ...((data?.notifs as object) ?? {}) } });
      });
    return () => { cancelled = true; };
  }, [userId]);

  const loading = userId != null && (fetched == null || fetched.key !== userId);
  const notifs = draft ?? (fetched != null && fetched.key === userId ? fetched.notifs : NOTIFS_DEFAULTS);

  const toggle = async (key: keyof typeof notifs) => {
    const next = { ...notifs, [key]: !notifs[key] };
    setDraft(next);
    if (userId) {
      await supabase
        .from('user_settings')
        .upsert({ owner_id: userId, notifs: next, updated_at: new Date().toISOString() }, { onConflict: 'owner_id' });
    }
    showToast(next[key] ? 'התראה הופעלה' : 'התראה הושבתה', 'info');
  };

  if (loading) return <><LoadingCard /><LoadingCard /></>;

  return (
    <>
      <SectionCard title="ערוצי התראות" subtitle="בחר כיצד לקבל עדכונים">
        <Toggle value={notifs.email}    onChange={() => toggle('email')}    label="התראות אימייל"  desc="עדכונים ישלחו לכתובת האימייל שלך" />
        <Toggle value={notifs.push}     onChange={() => toggle('push')}     label="התראות דחיפה"  desc="התראות בדפדפן בזמן אמת" />
        <Toggle value={notifs.whatsapp} onChange={() => toggle('whatsapp')} label="WhatsApp"       desc="קבל עדכונים קריטיים ב-WhatsApp" />
      </SectionCard>

      <SectionCard title="אירועים" subtitle="בחר אילו אירועים יפעילו התראה">
        <Toggle value={notifs.new_review} onChange={() => toggle('new_review')} label="ביקורת חדשה"     desc="כאשר מתקבלת ביקורת חדשה מכל פלטפורמה" />
        <Toggle value={notifs.critical}   onChange={() => toggle('critical')}   label="ביקורת ביקורתית" desc="ביקורות עם דירוג 1 או 2 כוכבים" />
        <Toggle value={notifs.weekly}     onChange={() => toggle('weekly')}     label="דוח שבועי"        desc="סיכום ביצועים כל יום ראשון" />
        <Toggle value={notifs.monthly}    onChange={() => toggle('monthly')}    label="דוח חודשי"        desc="ניתוח מגמות בתחילת כל חודש" />
      </SectionCard>
    </>
  );
}

// ── Tab: AI ────────────────────────────────────────────────────────────────────

const AI_DEFAULTS = { enabled: false, default_tone: 'soft' as ToneType, whatsapp_number: '', auto_publish: false };

function AITab({ showToast }: { showToast: (m: string, t?: ToastProps['type']) => void }) {
  const { isDemo } = useAuth();
  const { business } = useBusiness();
  const businessId = isDemo ? null : business?.id ?? null;
  const [fetched, setFetched] = useState<{ key: string; ai: typeof AI_DEFAULTS } | null>(null);
  // User edits override the loaded settings
  const [draft, setDraft] = useState<typeof AI_DEFAULTS | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!businessId) return;
    let cancelled = false;
    supabase
      .from('auto_reply_settings')
      .select('*')
      .eq('business_id', businessId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setFetched({
          key: businessId,
          ai: data
            ? {
                enabled:         data.enabled ?? false,
                default_tone:    (data.default_tone as ToneType) ?? 'soft',
                whatsapp_number: data.whatsapp_number ?? '',
                auto_publish:    (data as Record<string, unknown>).auto_publish as boolean ?? false,
              }
            : AI_DEFAULTS,
        });
      });
    return () => { cancelled = true; };
  }, [businessId]);

  const loading = businessId != null && (fetched == null || fetched.key !== businessId);
  const ai = draft ?? (fetched != null && fetched.key === businessId ? fetched.ai : AI_DEFAULTS);
  const setAI = setDraft;

  const handleSave = async () => {
    if (businessId) {
      const { error } = await supabase
        .from('auto_reply_settings')
        .upsert(
          {
            business_id:     businessId,
            enabled:         ai.enabled,
            default_tone:    ai.default_tone,
            whatsapp_number: ai.whatsapp_number,
            auto_publish:    ai.auto_publish,
          },
          { onConflict: 'business_id' }
        );
      if (error) { showToast('שגיאה בשמירה — נסה שנית', 'error'); return; }
    }
    setSaved(true);
    showToast('הגדרות AI נשמרו בהצלחה');
    setTimeout(() => setSaved(false), 2500);
  };

  if (loading) return <><LoadingCard /><LoadingCard /></>;

  return (
    <>
      <SectionCard title="הגדרות AI תגובות">
        <Toggle value={ai.enabled} onChange={() => setAI({ ...ai, enabled: !ai.enabled })}
          label="תגובה אוטומטית" desc="המערכת תגיב אוטומטית לביקורות חדשות לפי הסגנון שבחרת" />
        <Toggle value={ai.auto_publish} onChange={() => setAI({ ...ai, auto_publish: !ai.auto_publish })}
          label="פרסום אוטומטי" desc="פרסם תגובות ישירות לפלטפורמה ללא אישור ידני"
          disabled={!ai.enabled} />

        <div className="pt-5">
          <p className="text-sm font-semibold mb-3 text-primary">סגנון תגובה ברירת מחדל</p>
          <div className="grid grid-cols-2 gap-2">
            {TONES.map((t) => {
              const info = TONE_LABELS[t];
              const active = ai.default_tone === t;
              return (
                <button key={t} onClick={() => setAI({ ...ai, default_tone: t })}
                  className="p-3 rounded-xl text-right transition-all cursor-pointer"
                  style={{ border: `2px solid ${active ? info.color : 'rgba(197,198,210,0.4)'}`, backgroundColor: active ? info.bg : '#f8f9fa' }}>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="font-bold text-sm" style={{ color: info.color }}>{info.he}</span>
                    {active && <span className="material-symbols-outlined text-[14px] icon-filled" style={{ color: info.color }}>check_circle</span>}
                  </div>
                  <p className="text-xs text-outline">{info.desc}</p>
                </button>
              );
            })}
          </div>
        </div>
      </SectionCard>

      <SectionCard title="WhatsApp לבחירת תגובה" subtitle="קבל 4 הצעות ב-WhatsApp, ענה 1–4 לבחירה">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-[22px] icon-filled flex-shrink-0" style={{ color: '#25D366' }}>chat</span>
          <input type="tel" value={ai.whatsapp_number}
            onChange={(e) => setAI({ ...ai, whatsapp_number: e.target.value })}
            placeholder="+972501234567"
            dir="ltr"
            aria-label="מספר WhatsApp"
            className="flex-1 px-3 py-2.5 rounded-xl text-sm outline-none bg-surface-container-low border border-outline-variant/50 text-on-surface focus:border-[#25D366] transition-colors" />
        </div>
        <p className="text-xs mt-2 text-outline">פורמט: +972 ואז מספר הטלפון (ללא 0 בהתחלה)</p>
      </SectionCard>

      <SaveBtn onSave={handleSave} saved={saved} />
    </>
  );
}

// ── Tab: Team ──────────────────────────────────────────────────────────────────

function TeamTab({ showToast }: { showToast: (m: string, t?: ToastProps['type']) => void }) {
  const { user, isDemo } = useAuth();
  const { business } = useBusiness();
  const userId = isDemo ? null : user?.id ?? null;
  const [members, setMembers] = useState<TeamMember[]>(
    () => (isDemo ? INITIAL_MEMBERS.filter(m => m.id !== 'u1') : [])
  );
  const [fetchedKey, setFetchedKey]     = useState<string | null>(null);
  const [showInvite, setShowInvite]     = useState(false);
  const [removeId, setRemoveId]         = useState<string | null>(null);
  const [showPermissions, setShowPerms] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    supabase
      .from('team_members')
      .select('*')
      .eq('owner_id', userId)
      .order('joined_at', { ascending: true })
      .then(({ data }) => {
        if (cancelled) return;
        if (data) setMembers(data.map(m => ({
          ...m,
          initials: (m.name as string).split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() || (m.email as string).slice(0, 2).toUpperCase(),
        })));
        setFetchedKey(userId);
      });
    return () => { cancelled = true; };
  }, [userId]);

  const loading = userId != null && fetchedKey !== userId;

  // Owner row — derived from auth, always shown first, not removable
  const meta = (user?.user_metadata ?? {}) as Record<string, string>;
  const ownerName = isDemo ? 'מנהל המערכת' : (meta.full_name || user?.email?.split('@')[0] || 'מנהל');
  const ownerRow: TeamMember = {
    id: `owner_${user?.id ?? 'demo'}`,
    name:      ownerName,
    email:     isDemo ? 'admin@reviewpulse.co.il' : (user?.email ?? ''),
    role:      'admin',
    status:    'active',
    initials:  ownerName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'מנ',
    joined_at: business?.created_at ?? new Date().toISOString(),
  };
  const OWNER_ID = ownerRow.id;

  const activeMembers  = [ownerRow, ...members.filter(m => m.status === 'active')];
  const pendingMembers = members.filter(m => m.status === 'pending');

  const handleRoleChange = async (id: string, role: MemberRole) => {
    setMembers(prev => prev.map(m => m.id === id ? { ...m, role } : m));
    if (!isDemo && user) {
      await supabase.from('team_members').update({ role }).eq('id', id).eq('owner_id', user.id);
    }
    showToast('התפקיד עודכן בהצלחה', 'success');
  };

  const handleRemove = async (id: string) => {
    if (!isDemo && user) {
      await supabase.from('team_members').delete().eq('id', id).eq('owner_id', user.id);
    }
    setMembers(prev => prev.filter(m => m.id !== id));
    setRemoveId(null);
    showToast('חבר הצוות הוסר', 'info');
  };

  const handleCancelInvite = async (id: string) => {
    if (!isDemo && user) {
      await supabase.from('team_members').delete().eq('id', id).eq('owner_id', user.id);
    }
    setMembers(prev => prev.filter(m => m.id !== id));
    showToast('ההזמנה בוטלה', 'info');
  };

  const handleInvite = async (email: string, role: MemberRole) => {
    const name     = email.split('@')[0];
    const initials = name.slice(0, 2).toUpperCase();
    const now      = new Date().toISOString();

    if (!isDemo && user) {
      const { data, error } = await supabase
        .from('team_members')
        .insert({ owner_id: user.id, name, email, role, status: 'pending', joined_at: now })
        .select()
        .single();
      if (error) { showToast('שגיאה בשליחת ההזמנה', 'error'); return; }
      if (data) { setMembers(prev => [...prev, { ...data, initials }]); }
    } else {
      setMembers(prev => [...prev, { id: `u${Date.now()}`, name, email, role, status: 'pending', initials, joined_at: now }]);
    }
    setShowInvite(false);
    showToast(`הזמנה נשלחה אל ${email}`);
  };

  if (loading) return <LoadingCard />;

  return (
    <>
      {showInvite && <InviteModal onClose={() => setShowInvite(false)} onInvite={handleInvite} />}

      {removeId && (
        <Overlay onClose={() => setRemoveId(null)}>
          <ModalBox title="הסרת חבר צוות" icon="person_remove" onClose={() => setRemoveId(null)}>
            <p className="text-sm mb-5 text-on-surface-variant">
              האם אתה בטוח שברצונך להסיר את{' '}
              <strong className="text-primary">{members.find(m => m.id === removeId)?.name}</strong> מהצוות?
              הפעולה לא ניתנת לביטול.
            </p>
            <div className="flex gap-3">
              <button onClick={() => handleRemove(removeId!)}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm cursor-pointer hover:opacity-80 bg-red-100 text-red-800">
                הסר מהצוות
              </button>
              <button onClick={() => setRemoveId(null)}
                className="px-5 py-2.5 rounded-xl font-bold text-sm cursor-pointer border text-on-surface-variant border-outline-variant/50">
                ביטול
              </button>
            </div>
          </ModalBox>
        </Overlay>
      )}

      <SectionCard title="חברי הצוות" subtitle={`${activeMembers.length} חברים פעילים${pendingMembers.length ? ` · ${pendingMembers.length} ממתינים` : ''}`}>
        <div className="flex justify-between items-center mb-5">
          <button onClick={() => setShowPerms(!showPermissions)}
            className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer text-secondary">
            <span className="material-symbols-outlined text-[14px]">info</span>
            {showPermissions ? 'הסתר הרשאות' : 'הצג מטריצת הרשאות'}
          </button>
          <button onClick={() => setShowInvite(true)}
            className="flex items-center gap-1.5 text-sm font-bold px-4 py-2 rounded-xl cursor-pointer hover:opacity-90 transition-all"
            style={{ background: 'linear-gradient(135deg,#002366,#871dd3)', color: '#fff' }}>
            <span className="material-symbols-outlined text-[16px] icon-filled">person_add</span>
            הזמן חבר צוות
          </button>
        </div>

        {showPermissions && (
          <div className="mb-5 rounded-xl overflow-hidden border border-outline-variant/30">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-container-low">
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-on-surface-variant">פיצ'ר</th>
                  {(['admin', 'manager', 'viewer'] as MemberRole[]).map(r => (
                    <th key={r} className="px-3 py-2.5 text-center text-xs font-bold" style={{ color: ROLE_META[r].color }}>
                      {ROLE_META[r].label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMISSIONS.map(({ feature, admin, manager, viewer }, i) => (
                  <tr key={feature} style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#fafafa', borderTop: '1px solid rgba(197,198,210,0.2)' }}>
                    <td className="px-4 py-2.5 text-xs text-on-surface">{feature}</td>
                    {[admin, manager, viewer].map((allowed, j) => (
                      <td key={j} className="px-3 py-2.5 text-center">
                        <span className="material-symbols-outlined text-[16px] icon-filled" style={{ color: allowed ? '#16a34a' : '#c5c6d2' }}>
                          {allowed ? 'check_circle' : 'cancel'}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="space-y-2">
          {activeMembers.map(m => (
            <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl transition-colors bg-background border border-outline-variant/30">
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{ backgroundColor: m.id === OWNER_ID ? 'rgba(135,29,211,0.15)' : '#edeeef', color: m.id === OWNER_ID ? '#871dd3' : '#444650' }}>
                {m.initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold truncate text-primary">{m.name}</p>
                  {m.id === OWNER_ID && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-surface-container text-outline">אתה</span>
                  )}
                </div>
                <p dir="ltr" className="text-xs truncate text-outline">{m.email}</p>
              </div>
              {m.id === OWNER_ID ? (
                <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: ROLE_META[m.role].bg, color: ROLE_META[m.role].color }}>
                  {ROLE_META[m.role].label}
                </span>
              ) : (
                <select
                  value={m.role}
                  onChange={e => handleRoleChange(m.id, e.target.value as MemberRole)}
                  className="text-xs font-bold px-2.5 py-1.5 rounded-lg cursor-pointer outline-none transition-colors"
                  style={{ backgroundColor: ROLE_META[m.role].bg, color: ROLE_META[m.role].color, border: 'none' }}
                >
                  {(['admin', 'manager', 'viewer'] as MemberRole[]).map(r => (
                    <option key={r} value={r}>{ROLE_META[r].label}</option>
                  ))}
                </select>
              )}
              {m.id !== OWNER_ID && (
                <button onClick={() => setRemoveId(m.id)}
                  aria-label={`הסר את ${m.name}`}
                  className="p-1.5 rounded-lg cursor-pointer transition-colors flex-shrink-0 text-error hover:bg-red-100">
                  <span className="material-symbols-outlined text-[18px]">person_remove</span>
                </button>
              )}
            </div>
          ))}
        </div>
      </SectionCard>

      {pendingMembers.length > 0 && (
        <SectionCard title="הזמנות ממתינות" subtitle="הוזמנו אך טרם הצטרפו">
          <div className="space-y-2">
            {pendingMembers.map(m => (
              <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl"
                style={{ backgroundColor: '#fef9c3', border: '1px solid rgba(234,179,8,0.3)' }}>
                <span className="material-symbols-outlined text-[20px] icon-filled" style={{ color: '#d97706' }}>schedule</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate text-primary">{m.email}</p>
                  <p className="text-xs text-outline">
                    הוזמן בתפקיד {ROLE_META[m.role].label} · {new Date(m.joined_at).toLocaleDateString('he-IL')}
                  </p>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full ml-auto" style={{ backgroundColor: ROLE_META[m.role].bg, color: ROLE_META[m.role].color }}>
                  {ROLE_META[m.role].label}
                </span>
                <button onClick={() => handleCancelInvite(m.id)}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer transition-colors flex-shrink-0"
                  style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>
                  בטל הזמנה
                </button>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </>
  );
}

// ── Tab: Integrations ──────────────────────────────────────────────────────────

function IntegrationsTab({ showToast }: { showToast: (m: string, t?: ToastProps['type']) => void }) {
  const { user, isDemo } = useAuth();
  const { business } = useBusiness();
  const userId = isDemo ? null : user?.id ?? null;
  const [connected, setConnected]           = useState<string[]>(isDemo ? ['google'] : []);
  const [savedCreds, setSavedCreds]         = useState<Record<string, Record<string, string>>>({});
  const [fetchedKey, setFetchedKey]         = useState<string | null>(null);
  const [syncing, setSyncing]               = useState<string | null>(null);
  const [savingPlatform, setSavingPlatform] = useState<string | null>(null);
  const [connecting, setConnecting]         = useState<typeof INTEGRATIONS_CONFIG[number] | null>(null);
  const [disconnectId, setDisconnectId]     = useState<string | null>(null);
  const [fbPages, setFbPages]               = useState<FacebookPage[] | null>(null);
  const [fbConnecting, setFbConnecting]     = useState(false);

  const updateCred = (platformId: string, key: string, value: string) =>
    setSavedCreds(prev => ({ ...prev, [platformId]: { ...(prev[platformId] ?? {}), [key]: value } }));

  const savePlatformCreds = async (platformId: string) => {
    const creds = savedCreds[platformId] ?? {};
    setSavingPlatform(platformId);
    if (!isDemo && user) {
      await supabase.from('platform_connections').upsert(
        { owner_id: user.id, platform: platformId, credentials: creds },
        { onConflict: 'owner_id,platform' },
      );
    }
    setSavingPlatform(null);
    const hasCredentials = Object.values(creds).some((v) => v?.trim());
    if (hasCredentials) {
      setConnected(prev => prev.includes(platformId) ? prev : [...prev, platformId]);
    }
    showToast('הפרטים נשמרו בהצלחה');
  };

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    supabase
      .from('platform_connections')
      .select('platform, credentials')
      .eq('owner_id', userId)
      .then(({ data }) => {
        if (cancelled) return;
        if (data) {
          const creds: Record<string, Record<string, string>> = {};
          data.forEach(r => {
            if (r.credentials) creds[r.platform as string] = r.credentials as Record<string, string>;
          });
          setSavedCreds(creds);
          setConnected(
            data
              .filter(r => {
                const c = r.credentials as Record<string, string> | null;
                return c && Object.values(c).some((v) => v?.trim());
              })
              .map(r => r.platform as string),
          );
        }
        setFetchedKey(userId);
      });
    return () => { cancelled = true; };
  }, [userId]);

  const loading = userId != null && fetchedKey !== userId;

  const handleSync = async (id: string) => {
    if (!business?.id) return;
    setSyncing(id);
    if (id === 'google') {
      const { synced, error } = await syncGoogleReviews(business.id);
      setSyncing(null);
      showToast(error ? `שגיאה בסנכרון: ${error}` : `סונכרנו ${synced} ביקורות`, error ? 'error' : 'success');
    } else if (id === 'facebook') {
      const creds = savedCreds['facebook'] ?? {};
      const { synced, error } = await syncFacebookReviews(business.id, creds.page_id ?? '', creds.access_token ?? '');
      setSyncing(null);
      showToast(error ? `שגיאה בסנכרון: ${error}` : `סונכרנו ${synced} ביקורות`, error ? 'error' : 'success');
    } else {
      setSyncing(null);
    }
  };

  const handleFacebookOAuth = async () => {
    if (isDemo) { showToast('לא זמין בגרסת הדמו', 'info'); return; }
    setFbConnecting(true);
    try {
      const pages = await openFacebookOAuth();
      setFbConnecting(false);
      if (pages.length === 1) {
        await connectFacebookPage(pages[0]);
      } else if (pages.length > 1) {
        setFbPages(pages);
      } else {
        showToast('לא נמצאו דפים עסקיים בחשבון', 'error');
      }
    } catch (err: unknown) {
      setFbConnecting(false);
      const msg = (err as Error).message;
      if (msg === 'popup_blocked') showToast('הפופאפ נחסם — אפשר פופאפים עבור אתר זה', 'error');
      else if (msg !== 'popup_closed') showToast('שגיאה בחיבור לפייסבוק', 'error');
    }
  };

  const connectFacebookPage = async (page: FacebookPage) => {
    const creds = { page_id: page.id, access_token: page.access_token, page_name: page.name };
    if (user) {
      await supabase.from('platform_connections').upsert(
        { owner_id: user.id, platform: 'facebook', credentials: creds },
        { onConflict: 'owner_id,platform' },
      );
    }
    setConnected(prev => prev.includes('facebook') ? prev : [...prev, 'facebook']);
    setSavedCreds(prev => ({ ...prev, facebook: creds }));
    setFbPages(null);
    showToast(`${page.name} חובר בהצלחה!`);
  };

  const handleConnected = async (id: string, creds: Record<string, string>) => {
    if (!isDemo && user) {
      await supabase
        .from('platform_connections')
        .upsert({ owner_id: user.id, platform: id, credentials: creds }, { onConflict: 'owner_id,platform' });
    }
    setConnected(prev => prev.includes(id) ? prev : [...prev, id]);
    setSavedCreds(prev => ({ ...prev, [id]: creds }));
    setConnecting(null);
    showToast(`${INTEGRATIONS_CONFIG.find(p => p.id === id)?.name} חובר בהצלחה!`);
  };

  const handleDisconnect = async (id: string) => {
    if (!isDemo && user) {
      await supabase.from('platform_connections').delete().eq('owner_id', user.id).eq('platform', id);
    }
    setConnected(prev => prev.filter(c => c !== id));
    setSavedCreds(prev => { const next = { ...prev }; delete next[id]; return next; });
    setDisconnectId(null);
    showToast('הפלטפורמה נותקה', 'info');
  };

  if (loading) return <LoadingCard />;

  return (
    <>
      {connecting && (
        <ConnectModal
          platform={connecting}
          onClose={() => setConnecting(null)}
          onConnected={(creds) => handleConnected(connecting.id, creds)}
          initialCreds={savedCreds[connecting.id]}
        />
      )}

      {disconnectId && (
        <Overlay onClose={() => setDisconnectId(null)}>
          <ModalBox title="ניתוק פלטפורמה" icon="link_off" onClose={() => setDisconnectId(null)}>
            <p className="text-sm mb-5 text-on-surface-variant">
              ניתוק הפלטפורמה יפסיק את סנכרון הביקורות. הביקורות הקיימות לא יימחקו.
            </p>
            <div className="flex gap-3">
              <button onClick={() => handleDisconnect(disconnectId)}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm cursor-pointer hover:opacity-80 bg-red-100 text-red-800">
                נתק
              </button>
              <button onClick={() => setDisconnectId(null)}
                className="px-5 py-2.5 rounded-xl font-bold text-sm cursor-pointer border text-on-surface-variant border-outline-variant/50">
                ביטול
              </button>
            </div>
          </ModalBox>
        </Overlay>
      )}

      {/* Facebook page selector dialog */}
      {fbPages && (
        <Overlay onClose={() => setFbPages(null)}>
          <ModalBox title="בחר דף עסקי" icon="groups" onClose={() => setFbPages(null)}>
            <p className="text-sm mb-4 text-on-surface-variant">נמצאו מספר דפים — בחר איזה לחבר:</p>
            <div className="space-y-2">
              {fbPages.map((page) => (
                <button
                  key={page.id}
                  onClick={() => connectFacebookPage(page)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl text-right transition-colors hover:bg-blue-50 border border-outline-variant/30"
                >
                  {page.picture?.url ? (
                    <img src={page.picture.url} alt={page.name} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#1877F2' }}>
                      <span className="material-symbols-outlined text-white text-[18px]">groups</span>
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-semibold text-primary">{page.name}</p>
                    <p className="text-xs text-outline">ID: {page.id}</p>
                  </div>
                </button>
              ))}
            </div>
          </ModalBox>
        </Overlay>
      )}

      <SectionCard title="פלטפורמות" subtitle="חבר פלטפורמות לסנכרון אוטומטי של ביקורות">
        <div className="space-y-3">
          {INTEGRATIONS_CONFIG.map((p) => {
            const isConnected = connected.includes(p.id);
            const isSyncing   = syncing === p.id;
            const isSaving    = savingPlatform === p.id;
            const credFields  = PLATFORM_CREDENTIAL_FIELDS[p.id] ?? [];
            const creds       = savedCreds[p.id] ?? {};
            return (
              <div key={p.id} className="rounded-xl overflow-hidden"
                style={{ border: `1px solid ${isConnected ? `${p.color}30` : 'rgba(197,198,210,0.3)'}` }}>

                {/* Header row */}
                <div className="flex items-center gap-3 p-4"
                  style={{ backgroundColor: isConnected ? `${p.color}08` : '#f8f9fa' }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: isConnected ? `${p.color}15` : '#edeeef' }}>
                    <span className="material-symbols-outlined text-[20px] icon-filled" style={{ color: isConnected ? p.color : '#757682' }}>{p.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-primary">{p.name}</p>
                      {isConnected && (
                        <span className="flex items-center gap-0.5 text-xs font-bold text-green-600">
                          <span className="w-1.5 h-1.5 rounded-full inline-block bg-green-600" />
                          מחובר
                        </span>
                      )}
                      {p.comingSoon && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: '#fef9c3', color: '#854d0e' }}>
                          בקרוב
                        </span>
                      )}
                    </div>
                    {isConnected && p.reviews > 0 && (
                      <p className="text-xs text-outline">{p.reviews} ביקורות · סונכרן {p.lastSync}</p>
                    )}
                    {p.comingSoon && (
                      <p className="text-xs text-outline">אינטגרציה בפיתוח — אין API ציבורי זמין</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isConnected && (
                      <button onClick={() => handleSync(p.id)} disabled={isSyncing}
                        className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer transition-all hover:opacity-80 disabled:opacity-50"
                        style={{ backgroundColor: `${p.color}15`, color: p.color }}>
                        <span className={`material-symbols-outlined text-[13px] ${isSyncing ? 'animate-spin' : ''}`}>
                          {isSyncing ? 'refresh' : 'sync'}
                        </span>
                        {isSyncing ? 'מסנכרן...' : 'סנכרן'}
                      </button>
                    )}
                    {!p.comingSoon && p.id !== 'facebook' && (
                      <button
                        onClick={() => isConnected ? setDisconnectId(p.id) : setConnecting(p)}
                        className="text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer transition-all hover:opacity-80"
                        style={isConnected
                          ? { backgroundColor: '#fee2e2', color: '#991b1b' }
                          : { background: 'linear-gradient(135deg,#002366,#871dd3)', color: '#fff' }
                        }>
                        {isConnected ? 'נתק' : 'חבר'}
                      </button>
                    )}
                    {p.id === 'facebook' && !isConnected && (
                      <button
                        onClick={handleFacebookOAuth}
                        disabled={fbConnecting}
                        className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer transition-all hover:opacity-80 disabled:opacity-60 text-white"
                        style={{ backgroundColor: '#1877F2' }}
                      >
                        {fbConnecting
                          ? <span className="material-symbols-outlined text-[13px] animate-spin">progress_activity</span>
                          : <span className="material-symbols-outlined text-[13px]">login</span>
                        }
                        {fbConnecting ? 'מתחבר...' : 'התחבר עם Facebook'}
                      </button>
                    )}
                    {p.id === 'facebook' && isConnected && (
                      <button
                        onClick={() => setDisconnectId(p.id)}
                        className="text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer transition-all hover:opacity-80"
                        style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>
                        נתק
                      </button>
                    )}
                  </div>
                </div>

                {/* Credential fields — shown when connected and platform has configurable fields */}
                {isConnected && credFields.length > 0 && (
                  <div className="px-4 py-4 space-y-3"
                    style={{ borderTop: `1px solid ${p.color}20`, backgroundColor: `${p.color}04` }}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {credFields.map((f) => (
                        <div key={f.key}>
                          <label className="block text-xs font-semibold mb-1 text-on-surface-variant">{f.label}</label>
                          <input
                            type={f.type ?? 'text'}
                            value={creds[f.key] ?? ''}
                            onChange={(e) => updateCred(p.id, f.key, e.target.value)}
                            placeholder={f.placeholder}
                            dir={f.dir}
                            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-colors border border-outline-variant/50 bg-white text-on-surface focus:border-secondary"
                          />
                          <p className="text-xs mt-1 text-outline">{f.hint}</p>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => savePlatformCreds(p.id)}
                      disabled={isSaving}
                      className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-lg cursor-pointer transition-all hover:opacity-90 disabled:opacity-50"
                      style={{ background: 'linear-gradient(135deg,#002366,#871dd3)', color: '#fff' }}>
                      <span className="material-symbols-outlined text-[14px] icon-filled">
                        {isSaving ? 'hourglass_empty' : 'save'}
                      </span>
                      {isSaving ? 'שומר...' : 'שמור פרטים'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </SectionCard>
    </>
  );
}

// ── Tab: Billing ───────────────────────────────────────────────────────────────

function BillingTab({ showToast }: { showToast: (m: string, t?: ToastProps['type']) => void }) {
  const [showUpgrade, setShowUpgrade] = useState(false);

  const usage = [
    { label: 'ביקורות החודש', used: 84, limit: 100, color: '#871dd3' },
    { label: 'תגובות AI',     used: 21, limit: 30,  color: '#2563eb' },
    { label: 'חברי צוות',     used: 3,  limit: 3,   color: '#d97706' },
  ];

  return (
    <>
      {showUpgrade && <UpgradeModal onClose={() => { setShowUpgrade(false); showToast('ברוך הבא לתוכנית Pro! 🎉'); }} />}

      <SectionCard title="תוכנית נוכחית">
        <div className="rounded-xl p-5 mb-5" style={{ background: 'linear-gradient(135deg,#00113a 0%,#871dd3 100%)' }}>
          <div className="flex justify-between items-center mb-3">
            <div>
              <p className="text-white font-bold text-lg">תוכנית חינמית</p>
              <p className="text-white/70 text-xs">חידוש ב-1 בינואר 2025</p>
            </div>
            <button onClick={() => setShowUpgrade(true)}
              className="bg-white px-4 py-2 rounded-xl text-xs font-bold cursor-pointer hover:opacity-90 flex items-center gap-1.5 text-secondary">
              <span className="material-symbols-outlined text-[14px] icon-filled">stars</span>
              שדרג ל-Pro
            </button>
          </div>
        </div>

        {/* Usage bars */}
        <div className="space-y-4">
          {usage.map(({ label, used, limit, color }) => {
            const pct = (used / limit) * 100;
            const critical = pct >= 90;
            return (
              <div key={label}>
                <div className="flex justify-between items-center mb-1.5">
                  <p className="text-sm font-semibold text-on-surface">{label}</p>
                  <p className={`text-xs font-bold ${critical ? 'text-red-600' : 'text-outline'}`}>{used} / {limit}</p>
                </div>
                <div className="h-2.5 rounded-full overflow-hidden bg-surface-container-low">
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, backgroundColor: critical ? '#dc2626' : color }} />
                </div>
                {critical && (
                  <p className="text-xs mt-1 font-semibold flex items-center gap-1 text-red-600">
                    <span className="material-symbols-outlined text-[13px]">warning</span>
                    מתקרב למגבלה — שדרג לגישה ללא הגבלה
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard title="מה כולל Pro?">
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: 'all_inclusive',  label: 'ביקורות ללא הגבלה' },
            { icon: 'smart_toy',      label: 'AI תגובות ללא הגבלה' },
            { icon: 'group',          label: 'עד 10 משתמשים' },
            { icon: 'description',    label: 'דוחות מותאמים' },
            { icon: 'link',           label: 'כל הפלטפורמות' },
            { icon: 'support_agent',  label: 'תמיכה מועדפת' },
          ].map(({ icon, label }) => (
            <div key={label} className="flex items-center gap-2.5 p-3 rounded-xl bg-background">
              <span className="material-symbols-outlined text-[18px] icon-filled text-secondary">{icon}</span>
              <span className="text-sm font-medium text-on-surface">{label}</span>
            </div>
          ))}
        </div>
        <button onClick={() => setShowUpgrade(true)}
          className="w-full mt-4 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm cursor-pointer hover:opacity-90"
          style={{ background: 'linear-gradient(135deg,#002366,#871dd3)', color: '#fff' }}>
          <span className="material-symbols-outlined text-[18px] icon-filled">stars</span>
          שדרג עכשיו — ₪149/חודש
        </button>
      </SectionCard>
    </>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function Settings() {
  const [searchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as Tab) ?? 'profile';
  const [tab, setTab] = useState<Tab>(initialTab);
  const { toast, show: showToast } = useToast();

  return (
    <div className="min-h-screen px-6 md:px-16 py-8 bg-background">
      <div className="max-w-screen-lg mx-auto">
        <h1 className="text-xl md:text-2xl font-extrabold mb-1 text-primary">הגדרות</h1>
        <p className="text-sm mb-6 text-on-surface-variant">נהל את הגדרות החשבון, הצוות והמערכת</p>

        <div className="flex flex-col md:flex-row gap-6">
          {/* Sidebar tabs */}
          <div className="md:w-52 rounded-2xl p-2 flex flex-row md:flex-col gap-1 h-fit overflow-x-auto md:overflow-visible md:sticky md:top-6 bg-white border border-outline-variant/30"
            style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.05)', scrollbarWidth: 'none' }}>
            {TABS.map(({ id, label, icon }) => (
              <button key={id} onClick={() => setTab(id)}
                className={`flex flex-col md:flex-row items-center md:items-center gap-1 md:gap-2.5 px-2 md:px-3 py-2 md:py-2.5 rounded-xl transition-all text-center md:text-right cursor-pointer flex-shrink-0 min-w-[56px] md:min-w-0 md:w-full ${
                  tab === id ? 'bg-secondary/8 text-secondary font-bold' : 'text-on-surface-variant font-medium'
                }`}>
                <span className={`material-symbols-outlined text-[20px] md:text-[18px] ${tab === id ? 'icon-filled' : ''}`}>{icon}</span>
                <span className="text-[10px] md:text-sm whitespace-nowrap leading-tight">{label}</span>
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {tab === 'profile'       && <ProfileTab       showToast={showToast} />}
            {tab === 'notifications' && <NotificationsTab showToast={showToast} />}
            {tab === 'ai'            && <AITab            showToast={showToast} />}
            {tab === 'team'          && <TeamTab          showToast={showToast} />}
            {tab === 'integrations'  && <IntegrationsTab  showToast={showToast} />}
            {tab === 'billing'       && <BillingTab       showToast={showToast} />}
          </div>
        </div>
      </div>

      <Toast {...toast} />
    </div>
  );
}
