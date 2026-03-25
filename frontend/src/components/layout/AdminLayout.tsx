import { Outlet, Navigate } from 'react-router-dom';
import { HiOutlineLogout } from 'react-icons/hi';
import { AdminSidebar } from './AdminSidebar';
import { useAuthStore } from '../../stores/authStore';
import { Toaster } from 'react-hot-toast';

export function AdminLayout() {
  const { token, logout, isAdmin } = useAuthStore();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin()) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-8 py-4">
          <span className="text-sm font-semibold text-indigo-600">Admin Panel</span>
          <button
            type="button"
            onClick={logout}
            className="flex items-center gap-2 text-sm font-medium text-gray-700 transition-colors hover:text-gray-900"
          >
            <HiOutlineLogout className="h-5 w-5 shrink-0" aria-hidden />
            Sign Out
          </button>
        </header>
        <main className="flex-1 overflow-auto p-8">
          <Outlet />
        </main>
      </div>
      <Toaster position="top-right" />
    </div>
  );
}
