import { useEffect, useState } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { HiMenu, HiX } from 'react-icons/hi';
import { Sidebar } from './Sidebar';
import { useAuthStore } from '../../stores/authStore';
import { Toaster } from 'react-hot-toast';

export function AppLayout() {
  const { token } = useAuthStore();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="relative flex min-h-screen bg-bg">
      <Sidebar className="hidden lg:flex" />
      {sidebarOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
          />
          <Sidebar
            className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] shadow-xl lg:hidden"
            onNavigate={() => setSidebarOpen(false)}
          />
        </>
      )}
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center border-b border-border bg-surface px-4 py-3 sm:px-6 lg:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen((prev) => !prev)}
            className="inline-flex items-center rounded-lg border border-input-border p-2 text-text-secondary hover:bg-surface-alt"
            aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
          >
            {sidebarOpen ? <HiX className="h-5 w-5" /> : <HiMenu className="h-5 w-5" />}
          </button>
        </header>
        <main className="flex-1 overflow-auto bg-bg p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
      <Toaster position="top-right" />
    </div>
  );
}
