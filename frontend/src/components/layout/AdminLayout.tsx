import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { HiMenu, HiOutlineLogout, HiX } from 'react-icons/hi';
import { AdminSidebar } from './AdminSidebar';
import { AdminLoginPage } from '../../pages/admin/AdminLoginPage';
import { useAuthStore } from '../../stores/authStore';
import { Toaster } from 'react-hot-toast';

export function AdminLayout() {
  const { token, logout, isAdmin } = useAuthStore();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  if (!token || !isAdmin()) {
    return (
      <>
        <AdminLoginPage />
        <Toaster position="top-right" />
      </>
    );
  }

  return (
    <div className="relative flex min-h-screen bg-gray-50">
      <AdminSidebar className="hidden lg:flex" />
      {sidebarOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
          />
          <AdminSidebar
            className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] shadow-xl lg:hidden"
            onNavigate={() => setSidebarOpen(false)}
          />
        </>
      )}
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 py-3 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => setSidebarOpen((prev) => !prev)}
            className="inline-flex items-center rounded-lg border border-gray-300 p-2 text-gray-700 hover:bg-gray-100 lg:hidden"
            aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
          >
            {sidebarOpen ? <HiX className="h-5 w-5" /> : <HiMenu className="h-5 w-5" />}
          </button>
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
        <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
      <Toaster position="top-right" />
    </div>
  );
}
