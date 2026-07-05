import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBusiness } from '../../context/business-context';
import { useAuth } from '../../context/auth-context';
import { supabase } from '../../lib/supabase';

const NOTIFICATIONS = [
  {
    id: '1',
    icon: 'priority_high',
    color: '#ba1a1a',
    text: '3 ביקורות חדשות דורשות תגובה',
    time: 'לפני 5 דקות',
    path: '/reviews',
  },
  {
    id: '2',
    icon: 'trending_up',
    color: '#871dd3',
    text: 'הציון שלך עלה ל-4.8',
    time: 'לפני שעה',
    path: '/analytics',
  },
  {
    id: '3',
    icon: 'description',
    color: '#16a34a',
    text: 'הדוח השבועי מוכן להורדה',
    time: 'לפני 3 שעות',
    path: '/reports',
  },
];

interface TopBarProps {
  onMenuToggle: () => void;
}

export default function TopBar({ onMenuToggle }: TopBarProps) {
  const [notifOpen, setNotifOpen]             = useState(false);
  const [storeOpen, setStoreOpen]             = useState(false);
  const [profileOpen, setProfileOpen]         = useState(false);
  const [activeBranchIdx, setActiveBranchIdx] = useState(0);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const navigate        = useNavigate();
  const { business } = useBusiness();
  const { user, signOut, isDemo }              = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInitial = (
    ((user?.user_metadata?.full_name as string | undefined) ||
      (user?.user_metadata?.name as string | undefined) ||
      business?.name ||
      user?.email ||
      '')
      .charAt(0)
      .toUpperCase()
  );
  // Personal profile photo (used in the avatar circle top-right)
  const avatarUrl = (user?.user_metadata?.avatar_url as string | undefined)
                 || (user?.user_metadata?.picture     as string | undefined)
                 || null;
  // Business logo (used next to branch name)
  const businessLogoUrl = business?.logo_url ?? null;
  const notifRef   = useRef<HTMLDivElement>(null);
  const storeRef   = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  // Build display-ready branch list from saved data
  const branches = useMemo(() => {
    const raw = business?.branches;
    if (Array.isArray(raw) && raw.length > 0) {
      return raw.map((b, i) => ({
        label:    i === 0 ? 'סניף ראשי' : `סניף ${i + 1}`,
        location: (b as { location: string }).location ?? '',
      }));
    }
    // No branches saved yet — derive single entry from business name
    return [{ label: business?.name ?? 'סניף ראשי', location: '' }];
  }, [business?.branches, business?.name]);

  const activeBranch = branches[activeBranchIdx] ?? branches[0];
  const multiBranch  = branches.length > 1;

  // Reset selection when business changes
  useEffect(() => { setActiveBranchIdx(0); }, [business?.id]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (storeRef.current && !storeRef.current.contains(e.target as Node)) setStoreOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || isDemo) return;
    setUploadingAvatar(true);
    const ext  = file.name.split('.').pop() ?? 'jpg';
    const path = `${user.id}/profile.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from('business-logos')
      .upload(path, file, { upsert: true });
    if (uploadError) {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    const { data: { publicUrl } } = supabase.storage.from('business-logos').getPublicUrl(path);
    const urlWithBust = `${publicUrl}?t=${Date.now()}`;
    await supabase.auth.updateUser({ data: { avatar_url: urlWithBust } });
    setUploadingAvatar(false);
    setProfileOpen(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSignOut = async () => {
    await signOut();
    window.location.href = '/auth/login';
  };

  return (
    <header className="fixed top-0 right-0 left-0 z-50 h-14 sm:h-20 md:h-28 flex items-center justify-between px-4 md:px-16 shadow-md bg-primary-container text-white">
      {/* לוגו — צמוד ימין (ילד ראשון ב-RTL) */}
      <img
        src="/logo.png"
        alt="Rate Pulse"
        className="cursor-pointer select-none"
        style={{ height: 'clamp(42px, 6vw, 75px)', width: 'auto', maxWidth: 270, objectFit: 'contain' }}
        onClick={() => navigate('/dashboard')}
      />

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Branch switcher */}
        <div ref={storeRef} className="relative hidden sm:block">
          <button
            onClick={() => multiBranch && setStoreOpen(!storeOpen)}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-lg transition-colors ${multiBranch ? 'bg-white/10 hover:bg-white/20 cursor-pointer' : 'bg-white/5 cursor-default'}`}
          >
            {businessLogoUrl ? (
              <img
                src={businessLogoUrl}
                alt="לוגו העסק"
                className="w-16 h-16 rounded-xl object-contain flex-shrink-0"
                style={{ border: '2px solid rgba(255,255,255,0.6)', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <span className="material-symbols-outlined text-white text-[20px]">store</span>
            )}
            <div className="text-right">
              <p className="text-sm font-semibold text-white leading-tight">{activeBranch.label}</p>
              {activeBranch.location && (
                <p className="text-[11px] text-white/70 leading-tight">{activeBranch.location}</p>
              )}
            </div>
            {multiBranch && (
              <span
                className="material-symbols-outlined text-white text-[18px] transition-transform duration-200"
                style={{ transform: storeOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
              >
                expand_more
              </span>
            )}
          </button>
          {multiBranch && storeOpen && (
            <div
              className="absolute left-0 top-14 w-56 rounded-xl overflow-hidden bg-white border border-outline-variant/30"
              style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}
            >
              <div className="p-2 border-b border-outline-variant/30">
                <p className="text-xs font-semibold px-2 py-1 text-outline">בחר סניף</p>
              </div>
              {branches.map((branch, i) => (
                <button
                  key={i}
                  onClick={() => { setActiveBranchIdx(i); setStoreOpen(false); }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 text-right transition-colors cursor-pointer hover:bg-background ${
                    activeBranchIdx === i ? 'text-secondary' : 'text-on-surface'
                  }`}
                >
                  <div>
                    <p className="text-sm font-medium">{branch.label}</p>
                    {branch.location && (
                      <p className="text-xs text-outline">{branch.location}</p>
                    )}
                  </div>
                  {activeBranchIdx === i && (
                    <span className="material-symbols-outlined text-[16px] icon-filled text-secondary flex-shrink-0">
                      check
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Notifications */}
        <div ref={notifRef} className="relative">
          <button
            className="p-2.5 rounded-full hover:bg-white/10 transition-colors cursor-pointer relative"
            onClick={() => setNotifOpen(!notifOpen)}
            aria-label="התראות"
          >
            <span className="material-symbols-outlined text-white">notifications</span>
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-secondary" />
          </button>
          {notifOpen && (
            <div
              className="absolute left-0 top-13 w-80 rounded-xl overflow-hidden bg-white border border-outline-variant/30"
              style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}
            >
              <div className="px-4 py-3 border-b border-outline-variant/30 flex items-center justify-between">
                <p className="font-semibold text-sm text-primary">התראות</p>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-secondary/10 text-secondary">
                  {NOTIFICATIONS.length}
                </span>
              </div>
              <div className="divide-y divide-outline-variant/20">
                {NOTIFICATIONS.map(({ id, icon, color, text, time, path }) => (
                  <button
                    key={id}
                    onClick={() => { navigate(path); setNotifOpen(false); }}
                    className="w-full flex items-start gap-3 px-4 py-3 text-right transition-colors cursor-pointer hover:bg-gray-50"
                  >
                    <span className="material-symbols-outlined text-[18px] mt-0.5 flex-shrink-0" style={{ color }}>
                      {icon}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-on-surface">{text}</p>
                      <p className="text-xs mt-0.5 text-outline">{time}</p>
                    </div>
                  </button>
                ))}
              </div>
              <div className="p-3 border-t border-outline-variant/30">
                <button
                  onClick={() => { navigate('/reviews'); setNotifOpen(false); }}
                  className="w-full text-xs font-semibold text-center py-2 rounded-lg cursor-pointer transition-colors hover:bg-gray-50 text-secondary"
                >
                  צפה בכל ההתראות
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Profile */}
        <div ref={profileRef} className="relative">
          <button
            className="rounded-full hover:opacity-80 transition-opacity cursor-pointer flex-shrink-0 relative"
            aria-label="פרופיל"
            onClick={() => setProfileOpen(!profileOpen)}
            style={{ width: 38, height: 38 }}
          >
            {uploadingAvatar && (
              <div className="absolute inset-0 rounded-full flex items-center justify-center z-10 bg-black/40">
                <span className="material-symbols-outlined text-white text-[16px] animate-spin">progress_activity</span>
              </div>
            )}
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="לוגו העסק"
                className="w-full h-full rounded-full object-cover"
                style={{ border: '2px solid rgba(255,255,255,0.4)' }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div
                className="w-full h-full rounded-full flex items-center justify-center text-sm font-extrabold"
                style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '2px solid rgba(255,255,255,0.3)' }}
              >
                {avatarInitial || <span className="material-symbols-outlined text-[20px]">account_circle</span>}
              </div>
            )}
          </button>

          {profileOpen && (
            <div
              className="absolute left-0 top-12 w-64 rounded-2xl overflow-hidden bg-white border border-outline-variant/30"
              style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}
            >
              {/* Business info header */}
              <div className="px-4 py-4 border-b border-outline-variant/30 flex items-center gap-3"
                style={{ background: 'linear-gradient(135deg,rgba(0,35,102,0.04),rgba(135,29,211,0.06))' }}>
                <div className="relative flex-shrink-0" style={{ width: 42, height: 42 }}>
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt="לוגו"
                      className="w-full h-full rounded-xl object-contain"
                      style={{ border: '1.5px solid rgba(135,29,211,0.2)' }}
                    />
                  ) : (
                    <div
                      className="w-full h-full rounded-xl flex items-center justify-center text-sm font-extrabold"
                      style={{ background: 'linear-gradient(135deg,#002366,#871dd3)', color: '#fff' }}
                    >
                      {avatarInitial || <span className="material-symbols-outlined text-[18px]">store</span>}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate text-primary">{business?.name || 'העסק שלי'}</p>
                  <p className="text-xs truncate text-outline">{user?.email ?? ''}</p>
                </div>
              </div>

              {/* Menu items */}
              <div className="py-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
                <button
                  onClick={() => !isDemo && fileInputRef.current?.click()}
                  disabled={isDemo || uploadingAvatar}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-right transition-colors hover:bg-gray-50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined text-[18px] text-secondary">add_a_photo</span>
                  <span className="text-sm font-medium text-on-surface">
                    {uploadingAvatar ? 'מעלה תמונה...' : 'שנה תמונת פרופיל'}
                  </span>
                </button>

                <button
                  onClick={() => { navigate('/settings'); setProfileOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-right transition-colors hover:bg-gray-50 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px] text-on-surface-variant">settings</span>
                  <span className="text-sm font-medium text-on-surface">הגדרות</span>
                </button>

                <div className="border-t border-outline-variant/20 my-1" />

                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-right transition-colors hover:bg-red-50 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px] text-red-500">logout</span>
                  <span className="text-sm font-medium text-red-600">התנתק</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Mobile menu */}
        <button
          className="md:hidden p-2.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          onClick={onMenuToggle}
          aria-label="פתח תפריט"
        >
          <span className="material-symbols-outlined">menu</span>
        </button>
      </div>
    </header>
  );
}
