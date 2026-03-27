import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { usePortalAuthStore } from '../../stores/portalAuthStore';

const nav = [
  { to: '/portal', label: 'Dashboard', end: true },
  { to: '/portal/invoices', label: 'Invoices' },
  { to: '/portal/projects', label: 'Projects' },
  { to: '/portal/account', label: 'Account' },
  { to: '/portal/security', label: 'Security' },
];

export function PortalLayout() {
  const location = useLocation();
  const token = usePortalAuthStore((s) => s.token);
  const session = usePortalAuthStore((s) => s.session);
  const logout = usePortalAuthStore((s) => s.logout);
  const clientDisplayName = session?.client?.company?.trim() || session?.client?.name || '';

  if (!token) {
    return <Navigate to="/portal/login" replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-blue-50/40 to-purple-50/50 flex flex-col">
      <header className="bg-white/90 backdrop-blur-sm border-b border-sky-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs text-gray-600 uppercase tracking-wide">Client portal</p>
            <p className="text-lg font-semibold text-gray-900 truncate">
              {session?.vendor?.businessName || 'Your vendor'}
            </p>
            <p className="text-sm text-gray-700 truncate">{clientDisplayName}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              logout();
              window.location.href = '/portal/login';
            }}
            className="self-start sm:self-center px-4 py-2 text-sm border border-sky-200 text-slate-800 rounded-lg hover:bg-sky-50"
          >
            Sign out
          </button>
        </div>
        <nav className="max-w-5xl mx-auto px-4 pb-2 flex flex-wrap gap-1">
          {nav.map((item) => {
            const active =
              item.end
                ? location.pathname === item.to || location.pathname === `${item.to}/`
                : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-sky-100 text-purple-900 shadow-sm'
                    : 'text-slate-700 hover:bg-sky-50/80'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
