import { NavLink } from 'react-router-dom';
import {
  HiOutlineHome,
  HiOutlineUsers,
  HiOutlineShieldCheck,
  HiOutlineTicket,
  HiOutlineDatabase,
  HiOutlineLightningBolt,
  HiOutlineCog,
} from 'react-icons/hi';

const linkBase = 'flex items-center gap-3 px-3 py-2 rounded-lg mb-1 transition-colors';
const linkActive = 'bg-indigo-600 text-white';
const linkInactive = 'text-gray-300 hover:bg-gray-800';

export function AdminSidebar() {
  return (
    <aside className="flex flex-col w-64 bg-gray-900 text-white min-h-screen">
      <div className="p-6">
        <h1 className="text-xl font-bold text-indigo-400">Admin</h1>
        <p className="text-sm text-gray-400 mt-1">System Management</p>
      </div>
      <nav className="flex-1 px-3">
        <NavLink
          to="/admin"
          end
          className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}
        >
          <HiOutlineHome className="w-5 h-5 shrink-0" />
          Dashboard
        </NavLink>

        <NavLink
          to="/admin/users"
          className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}
        >
          <HiOutlineUsers className="w-5 h-5 shrink-0" />
          Users
        </NavLink>

        <NavLink
          to="/admin/moderation"
          className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}
        >
          <HiOutlineShieldCheck className="w-5 h-5 shrink-0" />
          Moderation
        </NavLink>

        <NavLink
          to="/admin/tickets"
          className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}
        >
          <HiOutlineTicket className="w-5 h-5 shrink-0" />
          Tickets
        </NavLink>

        <NavLink
          to="/admin/backups"
          className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}
        >
          <HiOutlineDatabase className="w-5 h-5 shrink-0" />
          Backups
        </NavLink>

        <NavLink
          to="/admin/rate-limits"
          className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}
        >
          <HiOutlineLightningBolt className="w-5 h-5 shrink-0" />
          Rate Limits
        </NavLink>

        <NavLink
          to="/admin/settings"
          className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}
        >
          <HiOutlineCog className="w-5 h-5 shrink-0" />
          Settings
        </NavLink>
      </nav>

    </aside>
  );
}
