import { NavLink } from 'react-router-dom';
import {
  HiOutlineDocumentText,
  HiOutlineUsers,
  HiOutlineHome,
  HiOutlineCog,
  HiOutlineSupport,
  HiOutlineShieldCheck,
  HiOutlineGlobeAlt,
  HiOutlineLogout,
} from 'react-icons/hi';
import { useAuthStore } from '../../stores/authStore';

const linkBase = 'flex items-center gap-3 px-3 py-2 rounded-lg mb-1 transition-colors';
const linkActive = 'bg-sidebar-active text-white';
const linkInactive = 'text-sidebar-text hover:bg-sidebar-hover';

interface SidebarProps {
  className?: string;
  onNavigate?: () => void;
}

export function Sidebar({ className = '', onNavigate }: SidebarProps) {
  const { user, logout } = useAuthStore();

  const handleSignOut = () => {
    onNavigate?.();
    logout();
  };

  return (
    <aside className={`flex min-h-screen w-64 flex-col bg-sidebar-bg text-sidebar-text ${className}`}>
      <div className="p-6">
        <h1 className="text-xl font-bold">{user?.businessName || 'Invoicing'}</h1>
        <p className="text-sm text-sidebar-muted mt-1 truncate">{user?.email}</p>
      </div>
      <nav className="min-h-0 flex-1 overflow-y-auto px-3">
        <NavLink
          to="/"
          end
          className={({ isActive }) => `${linkBase} mb-1 ${isActive ? linkActive : linkInactive}`}
          onClick={onNavigate}
        >
          <HiOutlineHome className="w-5 h-5 shrink-0" />
          Dashboard
        </NavLink>

        <NavLink
          to="/clients"
          end
          className={({ isActive }) => `${linkBase} mb-1 ${isActive ? linkActive : linkInactive}`}
          onClick={onNavigate}
        >
          <HiOutlineUsers className="w-5 h-5 shrink-0" />
          Clients
        </NavLink>

        <NavLink
          to="/invoices"
          className={({ isActive }) => `${linkBase} mb-1 ${isActive ? linkActive : linkInactive}`}
          onClick={onNavigate}
        >
          <HiOutlineDocumentText className="w-5 h-5 shrink-0" />
          Invoices
        </NavLink>

        <NavLink
          to="/settings"
          className={({ isActive }) => `${linkBase} mb-1 ${isActive ? linkActive : linkInactive}`}
          onClick={onNavigate}
        >
          <HiOutlineCog className="w-5 h-5 shrink-0" />
          Settings
        </NavLink>

        <NavLink
          to="/support"
          className={({ isActive }) => `${linkBase} mb-1 ${isActive ? linkActive : linkInactive}`}
          onClick={onNavigate}
        >
          <HiOutlineSupport className="w-5 h-5 shrink-0" />
          Support
        </NavLink>

        <NavLink
          to="/admin"
          className={({ isActive }) => `${linkBase} mb-1 ${isActive ? linkActive : linkInactive}`}
          onClick={onNavigate}
          target="_blank"
          rel="noreferrer"
        >
          <HiOutlineShieldCheck className="w-5 h-5 shrink-0" />
          Admin site
        </NavLink>

        <NavLink
          to="/portal/login"
          className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}
          onClick={onNavigate}
          target="_blank"
          rel="noreferrer"
        >
          <HiOutlineGlobeAlt className="w-5 h-5 shrink-0" />
          Client site
        </NavLink>
      </nav>
      <div className="shrink-0 border-t border-sidebar-border p-3">
        <button
          type="button"
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sidebar-muted transition-colors hover:bg-sidebar-hover"
        >
          <HiOutlineLogout className="h-5 w-5 shrink-0" aria-hidden />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
