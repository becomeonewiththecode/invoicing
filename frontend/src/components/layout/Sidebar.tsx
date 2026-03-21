import { NavLink } from 'react-router-dom';
import { HiOutlineDocumentText, HiOutlineUsers, HiOutlineHome, HiOutlineTag, HiOutlineLogout } from 'react-icons/hi';
import { useAuthStore } from '../../stores/authStore';

const navItems = [
  { to: '/', icon: HiOutlineHome, label: 'Dashboard' },
  { to: '/invoices', icon: HiOutlineDocumentText, label: 'Invoices' },
  { to: '/clients', icon: HiOutlineUsers, label: 'Clients' },
  { to: '/discounts', icon: HiOutlineTag, label: 'Discounts' },
];

export function Sidebar() {
  const { user, logout } = useAuthStore();

  return (
    <aside className="flex flex-col w-64 bg-gray-900 text-white min-h-screen">
      <div className="p-6">
        <h1 className="text-xl font-bold">{user?.businessName || 'Invoicing'}</h1>
        <p className="text-sm text-gray-400 mt-1 truncate">{user?.email}</p>
      </div>
      <nav className="flex-1 px-3">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg mb-1 transition-colors ${
                isActive ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800'
              }`
            }
          >
            <Icon className="w-5 h-5" />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="p-3 border-t border-gray-700">
        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-gray-300 hover:bg-gray-800 transition-colors"
        >
          <HiOutlineLogout className="w-5 h-5" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
