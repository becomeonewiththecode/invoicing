import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppLayout } from './components/layout/AppLayout';
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
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
