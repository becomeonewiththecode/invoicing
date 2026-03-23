import { NavLink } from 'react-router-dom';
import { HiOutlineDocumentText, HiOutlineUsers, HiOutlineHome, HiOutlineTag, HiOutlineLogout, HiOutlineCog } from 'react-icons/hi';
import { useAuthStore } from '../../stores/authStore';

const linkBase = 'flex items-center gap-3 px-3 py-2 rounded-lg mb-1 transition-colors';
const linkActive = 'bg-blue-600 text-white';
const linkInactive = 'text-gray-300 hover:bg-gray-800';

const subLinkBase = 'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors';
const subLinkActive = 'bg-blue-600 text-white';
const subLinkInactive = 'text-gray-300 hover:bg-gray-800';

export function Sidebar() {
  const { user, logout } = useAuthStore();

  return (
    <aside className="flex flex-col w-64 bg-gray-900 text-white min-h-screen">
      <div className="p-6">
        <h1 className="text-xl font-bold">{user?.businessName || 'Invoicing'}</h1>
        <p className="text-sm text-gray-400 mt-1 truncate">{user?.email}</p>
      </div>
      <nav className="flex-1 px-3">
        <NavLink
          to="/"
          end
          className={({ isActive }) => `${linkBase} mb-1 ${isActive ? linkActive : linkInactive}`}
        >
          <HiOutlineHome className="w-5 h-5 shrink-0" />
          Dashboard
        </NavLink>

        <div className="mb-1">
          <NavLink
            to="/clients"
            end
            className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}
          >
            <HiOutlineUsers className="w-5 h-5 shrink-0" />
            Clients
          </NavLink>
          <div className="mt-1 ml-3 pl-3 border-l border-gray-700 space-y-0.5">
            <NavLink
              to="/invoices"
              className={({ isActive }) => `${subLinkBase} ${isActive ? subLinkActive : subLinkInactive}`}
            >
              <HiOutlineDocumentText className="w-4 h-4 shrink-0" />
              Invoices
            </NavLink>
            <NavLink
              to="/discounts"
              end
              className={({ isActive }) => `${subLinkBase} ${isActive ? subLinkActive : subLinkInactive}`}
            >
              <HiOutlineTag className="w-4 h-4 shrink-0" />
              Discounts
            </NavLink>
          </div>
        </div>

        <NavLink
          to="/settings"
          className={({ isActive }) => `${linkBase} mb-1 ${isActive ? linkActive : linkInactive}`}
        >
          <HiOutlineCog className="w-5 h-5 shrink-0" />
          Settings
        </NavLink>
      </nav>
      <div className="p-3 border-t border-gray-700">
        <button
          type="button"
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
