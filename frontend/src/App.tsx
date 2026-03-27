import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { PortalLayout } from './components/portal/PortalLayout';
import { PortalLoginPage } from './pages/portal/PortalLoginPage';
import { PortalDashboardPage } from './pages/portal/PortalDashboardPage';
import { PortalInvoicesPage } from './pages/portal/PortalInvoicesPage';
import { PortalProjectsPage } from './pages/portal/PortalProjectsPage';
import { PortalProjectDetailPage } from './pages/portal/PortalProjectDetailPage';
import { PortalSecurityPage } from './pages/portal/PortalSecurityPage';
import { PortalAccountPage } from './pages/portal/PortalAccountPage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppLayout } from './components/layout/AppLayout';
import { AdminLayout } from './components/layout/AdminLayout';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { InvoicesPage } from './pages/InvoicesPage';
import { InvoiceDetailPage } from './pages/InvoiceDetailPage';
import { NewInvoicePage } from './pages/NewInvoicePage';
import { ClientsPage } from './pages/ClientsPage';
import { ClientProfilePage } from './pages/ClientProfilePage';
import { DiscountsPage } from './pages/DiscountsPage';
import { SettingsPage } from './pages/SettingsPage';
import { SharedInvoicePage } from './pages/SharedInvoicePage';
import { SupportPage } from './pages/SupportPage';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminUsersPage } from './pages/admin/AdminUsersPage';
import { AdminUserDetailPage } from './pages/admin/AdminUserDetailPage';
import { AdminModerationPage } from './pages/admin/AdminModerationPage';
import { AdminTicketsPage } from './pages/admin/AdminTicketsPage';
import { AdminTicketDetailPage } from './pages/admin/AdminTicketDetailPage';
import { AdminBackupsPage } from './pages/admin/AdminBackupsPage';
import { AdminRateLimitsPage } from './pages/admin/AdminRateLimitsPage';
import { AdminSettingsPage } from './pages/admin/AdminSettingsPage';

function RedirectClientStatsToProfile() {
  const { clientId } = useParams();
  return <Navigate to={`/clients/${clientId}#invoice-status`} replace />;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/share/:token" element={<SharedInvoicePage />} />
          <Route path="/client-portal" element={<Navigate to="/portal" replace />} />
          <Route path="/client-portal/login" element={<Navigate to="/portal/login" replace />} />
          <Route path="/portal/login" element={<PortalLoginPage />} />
          <Route path="/portal" element={<PortalLayout />}>
            <Route index element={<PortalDashboardPage />} />
            <Route path="invoices" element={<PortalInvoicesPage />} />
            <Route path="projects" element={<PortalProjectsPage />} />
            <Route path="projects/:projectId" element={<PortalProjectDetailPage />} />
            <Route path="account" element={<PortalAccountPage />} />
            <Route path="security" element={<PortalSecurityPage />} />
          </Route>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="invoices" element={<InvoicesPage />} />
            <Route path="invoices/new" element={<NewInvoicePage />} />
            <Route path="invoices/:id/edit" element={<NewInvoicePage />} />
            <Route path="invoices/:id" element={<InvoiceDetailPage />} />
            <Route path="clients/:clientId/stats" element={<RedirectClientStatsToProfile />} />
            <Route path="clients/:clientId" element={<ClientProfilePage />} />
            <Route path="clients" element={<ClientsPage />} />
            <Route path="discounts" element={<DiscountsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="support" element={<SupportPage />} />
          </Route>
          <Route element={<AdminLayout />}>
            <Route path="admin" element={<AdminDashboardPage />} />
            <Route path="admin/users" element={<AdminUsersPage />} />
            <Route path="admin/users/:id" element={<AdminUserDetailPage />} />
            <Route path="admin/moderation" element={<AdminModerationPage />} />
            <Route path="admin/tickets" element={<AdminTicketsPage />} />
            <Route path="admin/tickets/:id" element={<AdminTicketDetailPage />} />
            <Route path="admin/backups" element={<AdminBackupsPage />} />
            <Route path="admin/rate-limits" element={<AdminRateLimitsPage />} />
            <Route path="admin/settings" element={<AdminSettingsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
