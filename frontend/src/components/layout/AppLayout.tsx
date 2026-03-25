import { Outlet, Navigate } from 'react-router-dom';
import { HiOutlineLogout } from 'react-icons/hi';
import { Sidebar } from './Sidebar';
import { useAuthStore } from '../../stores/authStore';
import { Toaster } from 'react-hot-toast';

export function AppLayout() {
  const { token, logout } = useAuthStore();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-end border-b border-gray-200 bg-white px-8 py-4">
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
