import { useNavigate, useLocation } from 'react-router-dom';

const NAV_ITEMS = [
  { icon: 'dashboard',           label: 'לוח בקרה',  path: '/dashboard' },
  { icon: 'rate_review',         label: 'ביקורות',   path: '/reviews' },
  { icon: 'analytics',           label: 'ניתוח',     path: '/analytics' },
  { icon: 'description',         label: 'דוחות',     path: '/reports' },
  { icon: 'assignment_turned_in', label: 'הטמעה',    path: '/onboarding' },
  { icon: 'settings',            label: 'הגדרות',    path: '/settings' },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleNav = (path: string) => {
    navigate(path);
    onClose();
  };

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={`
          fixed top-14 sm:top-20 md:top-28 end-0 h-[calc(100vh-56px)] sm:h-[calc(100vh-80px)] md:h-[calc(100vh-112px)] w-64 z-40
          flex flex-col border-s bg-background border-outline-variant
          transition-transform duration-300 ease-in-out
          ${open ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
        `}
        style={{ boxShadow: '-2px 0 8px rgba(0,0,0,0.06)' }}
      >
        {/* Brand */}
        <div className="px-5 py-5 border-b border-outline-variant">
          <p className="text-sm font-semibold text-outline">ניהול מוניטין</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map(({ icon, label, path }) => {
            const active = location.pathname === path;
            return (
              <button
                key={path}
                onClick={() => handleNav(path)}
                className={`
                  w-full flex items-center gap-3 px-4 py-3 rounded-lg
                  transition-all duration-200 cursor-pointer text-right
                  ${active
                    ? 'font-bold bg-secondary/8 text-secondary'
                    : 'text-on-surface-variant hover:bg-surface-container-high'
                  }
                `}
              >
                <span
                  className={`material-symbols-outlined text-[22px] ${active ? 'icon-filled' : ''}`}
                >
                  {icon}
                </span>
                <span className="text-sm font-medium">{label}</span>
                {active && (
                  <span className="mr-auto w-1.5 h-1.5 rounded-full bg-secondary" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Upgrade CTA */}
        <div className="p-4 border-t border-outline-variant">
          <div
            className="rounded-xl p-4 mb-3"
            style={{ background: 'linear-gradient(135deg, #00113a 0%, #871dd3 100%)' }}
          >
            <p className="text-white text-xs font-semibold mb-1">שדרג ל-Pro</p>
            <p className="text-white/70 text-xs mb-3">קבל גישה לכל הכלים המתקדמים</p>
            <button
              onClick={() => { navigate('/settings?tab=billing'); onClose(); }}
              className="w-full bg-white text-secondary text-xs font-bold py-2 rounded-lg transition-opacity hover:opacity-90 cursor-pointer"
            >
              שדרג עכשיו
            </button>
          </div>
          <button
            onClick={() => navigate('/auth/login')}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors hover:bg-surface-container cursor-pointer text-on-surface-variant"
          >
            <span className="material-symbols-outlined text-[18px]">logout</span>
            יציאה
          </button>
        </div>
      </aside>
    </>
  );
}
