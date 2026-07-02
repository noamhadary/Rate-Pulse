import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/auth-context';
import { useBusiness } from '../context/business-context';
import { seedDemoReviews } from '../lib/demoReviews';

const STEPS = [
  {
    id: 1,
    title: 'פרטי העסק',
    icon: 'store',
    description: 'הזן את פרטי העסק הבסיסיים',
  },
  {
    id: 2,
    title: 'חיבור פלטפורמות',
    icon: 'link',
    description: 'חבר את פלטפורמות הביקורות שלך',
  },
  {
    id: 3,
    title: 'התראות',
    icon: 'notifications',
    description: 'הגדר את העדפות ההתראות',
  },
  {
    id: 4,
    title: 'הושלם!',
    icon: 'check_circle',
    description: 'העסק שלך מוכן להתחיל',
  },
];

const PLATFORMS = [
  { id: 'google',      name: 'Google Business', icon: 'language', color: '#4285F4', comingSoon: false },
  { id: 'facebook',    name: 'Facebook Pages',  icon: 'groups',   color: '#1877F2', comingSoon: false },
  { id: 'tripadvisor', name: 'TripAdvisor',     icon: 'flight',   color: '#34E0A1', comingSoon: true  },
];

type OnbCredField = { key: string; label: string; placeholder: string; dir?: 'ltr' | 'rtl'; type?: string; hint: string };

const PLATFORM_CREDENTIAL_FIELDS: Record<string, OnbCredField[]> = {
  google: [
    { key: 'place_id', label: 'מזהה מיקום Google (Place ID)', placeholder: 'ChIJrTLr-GyuEmsRBfy61i59si4', dir: 'ltr', hint: 'ניתן למצוא ב-Google Maps → שתף → העתק קישור' },
  ],
  facebook: [
    { key: 'page_id',      label: 'מזהה הדף (Page ID)',       placeholder: '123456789012345',  dir: 'ltr',           hint: 'הגדרות הדף ← מידע כללי' },
    { key: 'access_token', label: 'טוקן גישה (Access Token)', placeholder: 'EAAxxxxxxxx...',   dir: 'ltr', type: 'password', hint: 'ניתן להנפיק דרך Facebook Developers' },
  ],
  tripadvisor: [
    { key: 'location_url', label: 'קישור לדף TripAdvisor', placeholder: 'https://www.tripadvisor.com/Restaurant_Review-...', dir: 'ltr', hint: 'העתק את הכתובת מהדפדפן כשאתה בדף העסק' },
  ],
};

export default function Onboarding() {
  const navigate = useNavigate();
  const { user, isDemo } = useAuth();
  const { business: existingBusiness, refetch: refetchBusiness } = useBusiness();

  const [step, setStep] = useState(1);
  const [business, setBusiness] = useState({
    name:     (user?.user_metadata?.business_name as string | undefined) ?? '',
    category: 'קמעונאות',
    phone:    '',
    website:  '',
  });
  const managerName = (user?.user_metadata?.full_name as string | undefined)
                   || (user?.user_metadata?.name      as string | undefined)
                   || '';
  const [connected, setConnected] = useState<string[]>([]);
  const [platformCreds, setPlatformCreds] = useState<Record<string, Record<string, string>>>({});
  const [notifs, setNotifs] = useState({ email: true, new_review: true, critical: true, weekly: false });
  const [saving, setSaving] = useState(false);
  const prefilled = useRef(false);

  // Pre-fill Step 1 form from existing business record — runs once, never overwrites user edits
  useEffect(() => {
    if (!existingBusiness || prefilled.current) return;
    prefilled.current = true;
    setBusiness({
      name:     existingBusiness.name     ?? '',
      category: existingBusiness.category || 'קמעונאות',
      phone:    existingBusiness.phone    ?? '',
      website:  existingBusiness.website  ?? '',
    });
  }, [existingBusiness]);

  // Load existing platform connections + credentials so returning users see their data
  useEffect(() => {
    if (!user || isDemo) return;
    supabase
      .from('platform_connections')
      .select('*')
      .eq('owner_id', user.id)
      .then(({ data, error }) => {
        if (error) { console.error('platform_connections load error:', error.message); return; }
        if (!data?.length) return;
        const creds: Record<string, Record<string, string>> = {};
        data.forEach((r: Record<string, unknown>) => {
          if (r.credentials) creds[r.platform as string] = r.credentials as Record<string, string>;
        });
        setPlatformCreds(creds);
        setConnected(data.map((r: Record<string, unknown>) => r.platform as string));
      });
  }, [user, isDemo]);

  const togglePlatform = async (id: string) => {
    setConnected((prev) => prev.includes(id) ? prev : [...prev, id]);
    if (user && !isDemo) {
      const { error } = await supabase
        .from('platform_connections')
        .upsert({ owner_id: user.id, platform: id }, { onConflict: 'owner_id,platform' });
      if (error) console.error('togglePlatform save error:', error.message);
    }
  };

  const disconnectPlatform = async (id: string) => {
    setConnected((prev) => prev.filter((p) => p !== id));
    setPlatformCreds((prev) => { const next = { ...prev }; delete next[id]; return next; });
    if (user && !isDemo) {
      await supabase.from('platform_connections').delete().eq('owner_id', user.id).eq('platform', id);
    }
  };

  const handleComplete = async () => {
    if (isDemo) { navigate('/dashboard'); return; }
    if (!user) return;
    setSaving(true);
    try {
      const fields = {
        name:     business.name.trim()     || 'העסק שלי',
        category: business.category.trim() || 'קמעונאות',
        phone:    business.phone.trim()    || null,
        website:  business.website.trim()  || null,
      };

      let businessId = existingBusiness?.id ?? null;

      if (existingBusiness?.id) {
        const { error } = await supabase.from('businesses').update(fields).eq('id', existingBusiness.id);
        if (error) console.error('businesses save error:', error.code, error.message);
      } else {
        const { data: newBiz, error } = await supabase
          .from('businesses')
          .insert({ owner_id: user.id, ...fields })
          .select('id')
          .single();
        if (error) console.error('businesses save error:', error.code, error.message);
        else businessId = newBiz?.id ?? null;
      }

      refetchBusiness();

      // Seed 10 contextual demo reviews for the business
      if (businessId) {
        await seedDemoReviews(businessId, fields.category, fields.name);
      }

      // Persist platform credentials so they appear pre-filled on return visits
      if (connected.length > 0) {
        await Promise.all(
          connected.map((platform) =>
            supabase.from('platform_connections').upsert(
              { owner_id: user.id, platform, credentials: platformCreds[platform] ?? {} },
              { onConflict: 'owner_id,platform' },
            )
          )
        );
      }
    } catch (err) {
      console.error('handleComplete error:', err);
    } finally {
      setSaving(false);
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen px-6 md:px-16 py-10 bg-background">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-xl md:text-2xl font-extrabold mb-2 text-primary">
          הגדרת העסק
        </h1>
        <p className="text-sm mb-8 text-on-surface-variant">
          עקוב אחר השלבים להגדרת Rate Pulse לעסק שלך
        </p>

        {/* Stepper */}
        <div className="flex items-center gap-0 mb-10 overflow-x-auto pb-2">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center">
              <div className="flex flex-col items-center gap-1.5 min-w-[80px]">
                <button
                  onClick={() => setStep(s.id)}
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all cursor-pointer ${
                    step === s.id ? 'scale-110' : ''
                  }`}
                  style={
                    s.id < step
                      ? { backgroundColor: '#16a34a', color: '#ffffff' }
                      : s.id === step
                      ? { backgroundColor: '#871dd3', color: '#ffffff', boxShadow: '0 0 0 4px rgba(135,29,211,0.2)' }
                      : { backgroundColor: '#edeeef', color: '#757682' }
                  }
                >
                  {s.id < step ? (
                    <span className="material-symbols-outlined text-[18px] icon-filled">check</span>
                  ) : (
                    <span className="material-symbols-outlined text-[18px]">{s.icon}</span>
                  )}
                </button>
                <span className={`text-xs font-medium text-center whitespace-nowrap ${step === s.id ? 'text-secondary' : 'text-on-surface-variant'}`}>
                  {s.title}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className="flex-1 h-0.5 min-w-[32px] mx-1 mb-5"
                  style={{ backgroundColor: i < step - 1 ? '#16a34a' : '#edeeef' }}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div
          className="rounded-2xl p-8 bg-white border border-outline-variant/30"
          style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}
        >
          {/* Step 1: Business Details */}
          {step === 1 && (
            <div className="space-y-5">
              <h2 className="text-xl font-bold text-primary">פרטי העסק</h2>

              {managerName && (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-secondary/8 border border-secondary/20">
                  <span className="material-symbols-outlined text-[20px] text-secondary icon-filled">account_circle</span>
                  <div>
                    <p className="text-xs text-on-surface-variant">מנהל החשבון</p>
                    <p className="text-sm font-semibold text-primary">{managerName}</p>
                  </div>
                </div>
              )}

              {[
                { key: 'name',    label: 'שם העסק',      placeholder: 'קפה ישראל' },
                { key: 'phone',   label: 'טלפון',         placeholder: '050-0000000' },
                { key: 'website', label: 'אתר אינטרנט',  placeholder: 'https://...' },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label htmlFor={`onb-${key}`} className="block text-sm font-semibold mb-1.5 text-primary">
                    {label}
                  </label>
                  <input
                    id={`onb-${key}`}
                    type="text"
                    value={business[key as keyof typeof business]}
                    onChange={(e) => setBusiness((b) => ({ ...b, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all bg-surface-container-low text-on-surface border-2 border-outline-variant/50 focus:border-secondary"
                  />
                </div>
              ))}

              <div>
                <label htmlFor="onb-category" className="block text-sm font-semibold mb-1.5 text-primary">
                  קטגוריה
                </label>
                <select
                  id="onb-category"
                  value={business.category}
                  onChange={(e) => setBusiness((b) => ({ ...b, category: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all cursor-pointer bg-surface-container-low text-on-surface border-2 border-outline-variant/50 focus:border-secondary"
                >
                  {['קמעונאות', 'מסעדנות', 'שירותים', 'בריאות', 'אחר'].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Step 2: Platforms */}
          {step === 2 && (
            <div className="space-y-3">
              <h2 className="text-xl font-bold mb-4 text-primary">חיבור פלטפורמות</h2>
              {PLATFORMS.map((p) => {
                const isConnected = connected.includes(p.id);
                const fields = PLATFORM_CREDENTIAL_FIELDS[p.id] ?? [];
                const creds = platformCreds[p.id] ?? {};
                return (
                  <div key={p.id}>
                    <div
                      className="flex items-center justify-between p-4 rounded-xl transition-all"
                      style={{
                        border: `2px solid ${isConnected ? p.color : 'rgba(197,198,210,0.4)'}`,
                        backgroundColor: p.comingSoon ? '#f8f9fa' : isConnected ? `${p.color}08` : '#f8f9fa',
                        cursor: p.comingSoon ? 'default' : isConnected ? 'default' : 'pointer',
                        opacity: p.comingSoon ? 0.65 : 1,
                      }}
                      onClick={() => !isConnected && !p.comingSoon && togglePlatform(p.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: isConnected ? `${p.color}18` : '#edeeef' }}
                        >
                          <span
                            className="material-symbols-outlined text-[20px]"
                            style={{ color: isConnected ? p.color : '#444650' }}
                          >
                            {p.icon}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-primary">{p.name}</span>
                          {p.comingSoon ? (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold"
                              style={{ backgroundColor: '#fef9c3', color: '#854d0e' }}
                            >
                              בקרוב
                            </span>
                          ) : isConnected ? (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold"
                              style={{ backgroundColor: '#dcfce7', color: '#16a34a' }}
                            >
                              <span className="material-symbols-outlined text-[12px] icon-filled">check_circle</span>
                              פעיל
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold"
                              style={{ backgroundColor: '#f3f4f6', color: '#9ca3af' }}
                            >
                              <span className="material-symbols-outlined text-[12px]">radio_button_unchecked</span>
                              לא פעיל
                            </span>
                          )}
                        </div>
                      </div>
                      {!p.comingSoon && (isConnected ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); disconnectPlatform(p.id); }}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all hover:opacity-80"
                          style={{ backgroundColor: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5' }}
                        >
                          <span className="material-symbols-outlined text-[13px]">link_off</span>
                          נתק
                        </button>
                      ) : (
                        <div
                          className="w-6 h-6 rounded-full flex-shrink-0"
                          style={{ border: '2px solid #c5c6d2', backgroundColor: 'transparent' }}
                        />
                      ))}
                    </div>

                    {!p.comingSoon && isConnected && fields.length > 0 && (
                      <div
                        className="mt-1 p-4 rounded-xl space-y-3"
                        style={{ border: `1.5px solid ${p.color}30`, backgroundColor: `${p.color}05` }}
                      >
                        {fields.map((f) => (
                          <div key={f.key}>
                            <label className="block text-xs font-semibold mb-1 text-on-surface-variant">
                              {f.label}
                            </label>
                            <input
                              type={f.type ?? 'text'}
                              value={creds[f.key] ?? ''}
                              onChange={(e) =>
                                setPlatformCreds((prev) => ({
                                  ...prev,
                                  [p.id]: { ...(prev[p.id] ?? {}), [f.key]: e.target.value },
                                }))
                              }
                              placeholder={f.placeholder}
                              dir={f.dir}
                              onClick={(e) => e.stopPropagation()}
                              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-colors border border-outline-variant/50 bg-white text-on-surface focus:border-secondary"
                            />
                            <p className="text-xs mt-1 text-outline">{f.hint}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Step 3: Notifications */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold mb-4 text-primary">הגדרות התראות</h2>
              {[
                { key: 'email', label: 'קבלת התראות במייל', desc: 'שלח התראות לאימייל שהזנת' },
                { key: 'new_review', label: 'ביקורת חדשה', desc: 'התראה כאשר מתקבלת ביקורת חדשה' },
                { key: 'critical', label: 'ביקורת ביקורתית', desc: 'התראה מיידית לביקורות עם דירוג 1-2' },
                { key: 'weekly', label: 'דוח שבועי', desc: 'סיכום שבועי של הביצועים שלך' },
              ].map(({ key, label, desc }) => {
                const active = notifs[key as keyof typeof notifs];
                return (
                  <div key={key} className="flex items-center justify-between p-4 rounded-xl border border-outline-variant/30 bg-background">
                    <div>
                      <p className="font-semibold text-sm text-primary">{label}</p>
                      <p className="text-xs mt-0.5 text-on-surface-variant">{desc}</p>
                    </div>
                    <button
                      onClick={() => setNotifs((n) => ({ ...n, [key]: !active }))}
                      role="switch"
                      aria-checked={active}
                      aria-label={label}
                      className={`relative w-12 h-6 rounded-full transition-all duration-300 cursor-pointer flex-shrink-0 ${active ? 'bg-secondary' : 'bg-outline-variant'}`}
                    >
                      <span
                        className="absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-300"
                        style={{ right: active ? 6 : 'auto', left: active ? 'auto' : 6 }}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Step 4: Done */}
          {step === 4 && (
            <div className="text-center py-6">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
                style={{ background: 'linear-gradient(135deg, #002366, #871dd3)' }}
              >
                <span className="material-symbols-outlined text-white text-[40px] icon-filled">celebration</span>
              </div>
              <h2 className="text-2xl font-extrabold mb-2 text-primary">
                ברכות! העסק שלך מוכן
              </h2>
              <p className="text-sm mb-6 text-on-surface-variant">
                Rate Pulse מוגדר ומוכן לנטר את הביקורות שלך בזמן אמת
              </p>
              <div className="flex flex-col gap-2 p-4 rounded-xl mb-6 text-right bg-surface-container-low">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] icon-filled text-green-600">check_circle</span>
                  <span className="text-sm text-on-surface">פרטי העסק הוגדרו</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`material-symbols-outlined text-[18px] icon-filled ${connected.length > 0 ? 'text-green-600' : 'text-outline'}`}>
                    {connected.length > 0 ? 'check_circle' : 'radio_button_unchecked'}
                  </span>
                  <span className="text-sm text-on-surface">
                    {connected.length} פלטפורמות מחוברות
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] icon-filled text-green-600">check_circle</span>
                  <span className="text-sm text-on-surface">התראות הוגדרו</span>
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          {(() => {
            const incompletePlatforms = step === 2
              ? connected.filter((id) => {
                  const fields = PLATFORM_CREDENTIAL_FIELDS[id] ?? [];
                  const creds = platformCreds[id] ?? {};
                  return fields.some((f) => !creds[f.key]?.trim());
                })
              : [];
            const blocked = incompletePlatforms.length > 0;
            return (
              <div className="flex flex-col gap-3 mt-8">
                {blocked && (
                  <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl text-xs bg-yellow-50 border border-yellow-200 text-yellow-800">
                    <span className="material-symbols-outlined text-[16px] flex-shrink-0 mt-0.5">warning</span>
                    <span>
                      {incompletePlatforms.length === 1
                        ? `נא למלא את פרטי ההתחברות עבור ${PLATFORMS.find((p) => p.id === incompletePlatforms[0])?.name}`
                        : `נא למלא את פרטי ההתחברות עבור: ${incompletePlatforms.map((id) => PLATFORMS.find((p) => p.id === id)?.name).join(', ')}`}
                    </span>
                  </div>
                )}
                <div className="flex gap-3">
                  {step > 1 && (
                    <button
                      onClick={() => setStep((s) => s - 1)}
                      className="flex-1 py-3 rounded-xl font-semibold text-sm border cursor-pointer transition-colors hover:bg-surface-container border-outline-variant text-on-surface-variant"
                    >
                      חזור
                    </button>
                  )}
                  <button
                    onClick={() => step < 4 ? setStep((s) => s + 1) : handleComplete()}
                    disabled={saving || blocked}
                    className="flex-1 py-3 rounded-xl font-bold text-sm transition-all hover:opacity-90 cursor-pointer bg-secondary text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {step === 4 ? (saving ? 'שומר...' : 'עבור ללוח הבקרה') : 'הבא'}
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
