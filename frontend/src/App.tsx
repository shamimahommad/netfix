import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';
import { LoadingProvider } from './contexts/LoadingContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import PublicRoute from './components/PublicRoute';
import LoginPage from './pages/LoginPage';
import SaaSLayout from './components/layout/SaaSLayout';
import TenantLayout from './components/layout/TenantLayout';
import SaaSDashboard from './pages/SaaSDashboard';
import TenantDashboard from './pages/TenantDashboard';
import CustomersPage from './pages/CustomersPage';
import CustomerDetailPage from './pages/CustomerDetailPage';
import EditCustomerPage from './pages/EditCustomerPage';
import ISPsListPage from './pages/ISPsListPage';
import ISPProfilePage from './pages/ISPProfilePage';
import BillingPage from './pages/BillingPage';
import SMSPage from './pages/SMSPage';
import SupportPage from './pages/SupportPage';
import NetworkPage from './pages/NetworkPage';
import MikroTikPage from './pages/MikroTikPage';
import OltPage from './pages/OltPage';
import PackageCopyPage from './pages/PackageCopyPage';
import PlaceholderPage from './pages/PlaceholderPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import ProfilePage from './pages/ProfilePage';
import MerchantPaymentsPage from './pages/MerchantPaymentsPage';
import FeatureGuard from './components/FeatureGuard';
import PackagePlansPage from './pages/PackagePlansPage';
import { RouteGuard } from './components/RouteGuard';
import { AdminOnlyGuard } from './components/AdminOnlyGuard';
import AgentRestrictedGuard from './components/AgentRestrictedGuard';
import ServiceAreasPage from './pages/ServiceAreasPage';
import SubAreasPage from './pages/SubAreasPage';
import LiveTrafficPage from './pages/LiveTrafficPage';
import ResellerPage from './pages/ResellerPage';
import PlanPermissionPage from './pages/PlanPermissionPage';
import LoginLogPage from './pages/LoginLogPage';
import CustomerTaskLogsPage from './pages/CustomerTaskLogsPage';
import CustomerInvoicesPage from './pages/CustomerInvoicesPage';
import BulkCustomerRenewPage from './pages/BulkCustomerRenewPage';
import RechargeHistoryPage from './pages/RechargeHistoryPage';
import CustomerPaymentsPage from './pages/CustomerPaymentsPage';
import TopupBalancePage from './pages/TopupBalancePage';
import ResellerWiseCustomersPage from './pages/ResellerWiseCustomersPage';
import MyPackagesPage from './pages/MyPackagesPage';
import AreaWiseCustomersPage from './pages/AreaWiseCustomersPage';
import ServerWiseCustomersPage from './pages/ServerWiseCustomersPage';
import InvoicesReportPage from './pages/InvoicesReportPage';
import OnlineTransactionsPage from './pages/OnlineTransactionsPage';
import MapPage from './pages/MapPage';
import PaymentCallbackPage from './pages/PaymentCallbackPage';
import CustomerLoginPage from './pages/CustomerLoginPage';
import CustomerDashboardPage from './pages/CustomerDashboardPage';
import CustomerPayBillPage from './pages/CustomerPayBillPage';
import CustomerPaymentHistoryPage from './pages/CustomerPaymentHistoryPage';
import CustomerTicketPage from './pages/CustomerTicketPage';
import CustomerReportPage from './pages/CustomerReportPage';
import CustomerPaymentCallbackPage from './pages/CustomerPaymentCallbackPage';
import PublicTopupPage from './pages/PublicTopupPage';
import CustomerPortalLayout from './components/layout/CustomerPortalLayout';
import Footer from './components/layout/Footer';
import { CustomerPortalProvider } from './contexts/CustomerPortalContext';
import ErrorPage from './pages/ErrorPage';

/** Error page that reads status/message from location state (e.g. navigate('/error', { state: { status: 403 } })). */
function ErrorPageFromLocation() {
  const location = useLocation();
  const state = (location.state as { status?: number; title?: string; message?: string }) ?? {};
  return (
    <ErrorPage
      status={state.status ?? 404}
      title={state.title}
      message={state.message}
    />
  );
}

function AppContent() {
  return (
    <BrowserRouter>
      <div className="h-screen flex flex-col overflow-hidden">
        <main className="flex-1 flex flex-col min-h-0 overflow-auto">
          <Routes>
        {/* Public routes */}
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />
        <Route
          path="/customer/login"
          element={
            <PublicRoute>
              <CustomerLoginPage />
            </PublicRoute>
          }
        />
        <Route path="/customer/payment-callback" element={<CustomerPaymentCallbackPage />} />
        <Route path="/topup" element={<PublicTopupPage />} />
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Customer portal: layout with sidebar + nested pages */}
        <Route
          path="/customer"
          element={
            <RouteGuard allow={['customer']}>
              <CustomerPortalProvider>
                <CustomerPortalLayout />
              </CustomerPortalProvider>
            </RouteGuard>
          }
        >
          <Route index element={<Navigate to="/customer/dashboard" replace />} />
          <Route path="dashboard" element={<CustomerDashboardPage />} />
          <Route path="pay-bill" element={<CustomerPayBillPage />} />
          <Route path="payment-history" element={<CustomerPaymentHistoryPage />} />
          <Route path="ticket" element={<CustomerTicketPage />} />
          <Route path="report" element={<CustomerReportPage />} />
        </Route>

        {/* SaaS Admin routes */}
        <Route
          path="/saas"
          element={
            <RouteGuard allow={['saas']}>
              <SaaSLayout />
            </RouteGuard>
          }
        >
          <Route path="dashboard" element={<SaaSDashboard />} />
          <Route path="tenants" element={<ISPsListPage />} />
          <Route path="tenants/:tenantId/payment-callback" element={<PaymentCallbackPage />} />
          <Route path="tenants/:tenantId" element={<ISPProfilePage />} />
          <Route path="customers" element={<div className="p-4">Customers (Coming Soon)</div>} />
          <Route path="billing" element={<div className="p-4">Billing (Coming Soon)</div>} />
          <Route path="network" element={<div className="p-4">Network (Coming Soon)</div>} />
          <Route path="settings" element={<div className="p-4">Settings (Coming Soon)</div>} />
          <Route index element={<Navigate to="/saas/dashboard" replace />} />
        </Route>

        {/* Tenant routes */}
        <Route
          path="/dashboard"
          element={
            <RouteGuard allow={['isp']}>
              <TenantLayout />
            </RouteGuard>
          }
        >
          <Route index element={<TenantDashboard />} />
          <Route path="customers" element={<Navigate to="/dashboard/customers/all" replace />} />
          <Route path="customers/pppoe-logs" element={<PlaceholderPage title="PPPoE Logs" description="View PPPoE connection logs, session history, and authentication records." />} />
          <Route path="customers/task-logs/:customerId" element={<CustomerTaskLogsPage />} />
          <Route path="customers/:type" element={<CustomersPage />} />
          <Route path="customers/view/:id" element={<CustomerDetailPage />} />
          <Route path="customers/view/:id/invoices" element={<CustomerInvoicesPage />} />
          <Route path="customers/edit/:id" element={<EditCustomerPage />} />
          <Route path="billing/bulk-renew" element={<BulkCustomerRenewPage />} />
          <Route path="billing/:type" element={<BillingPage />} />
          <Route path="billing" element={<Navigate to="/dashboard/billing/all" replace />} />
          <Route path="sms/:type" element={<AgentRestrictedGuard><SMSPage /></AgentRestrictedGuard>} />
          <Route path="sms" element={<AgentRestrictedGuard><Navigate to="/dashboard/sms/send" replace /></AgentRestrictedGuard>} />
          <Route path="hotspot/card-search" element={<PlaceholderPage title="Card Search" description="Search for hotspot cards by card number, username, or other criteria." />} />
          <Route path="hotspot/card-generator" element={<PlaceholderPage title="Card Generator" description="Generate new hotspot access cards with customizable validity periods and data limits." />} />
          <Route path="hotspot/card-print" element={<PlaceholderPage title="Card Print" description="Print hotspot access cards with QR codes and credentials." />} />
          <Route path="hotspot/online" element={<PlaceholderPage title="Hotspot Online Customers" description="View all currently active hotspot sessions and connected users." />} />
          <Route path="hotspot/offline" element={<PlaceholderPage title="Hotspot Offline Customers" description="View all disconnected hotspot users and session history." />} />
          <Route path="area" element={<PlaceholderPage title="Area" description="Manage service areas and coverage zones." />} />
          <Route path="my-packages" element={<MyPackagesPage />} />
          <Route path="reseller" element={<AgentRestrictedGuard><ResellerPage /></AgentRestrictedGuard>} />
          <Route path="topup-balance" element={<TopupBalancePage />} />
          <Route path="reseller/plan-permission/:userId" element={<AgentRestrictedGuard><PlanPermissionPage /></AgentRestrictedGuard>} />
          <Route path="reseller/login-log/:userId" element={<AgentRestrictedGuard><LoginLogPage /></AgentRestrictedGuard>} />
          <Route path="report" element={<Navigate to="/dashboard/report/reseller-wise-customers" replace />} />
          <Route path="report/reseller-wise-customers" element={<ResellerWiseCustomersPage />} />
          <Route path="report/area-wise-customers" element={<AreaWiseCustomersPage />} />
          <Route path="report/server-wise-customers" element={<ServerWiseCustomersPage />} />
          <Route path="report/online-transactions" element={<OnlineTransactionsPage />} />
          <Route path="report/merchant-payments" element={<MerchantPaymentsPage />} />
          <Route path="report/customer-payments" element={<CustomerPaymentsPage />} />
          <Route path="report/recharge-history" element={<RechargeHistoryPage />} />
          <Route path="report/invoices" element={<InvoicesReportPage />} />
          <Route
            path="map"
            element={
              <FeatureGuard feature="map">
                <MapPage />
              </FeatureGuard>
            }
          />
          <Route path="support/:type" element={<SupportPage />} />
          <Route path="support" element={<Navigate to="/dashboard/support/ticket" replace />} />
          <Route path="network/mikrotik" element={<AdminOnlyGuard><MikroTikPage /></AdminOnlyGuard>} />
          <Route path="network/package-copy" element={<AdminOnlyGuard><PackageCopyPage /></AdminOnlyGuard>} />
          <Route path="network/packages" element={<AdminOnlyGuard><PackagePlansPage /></AdminOnlyGuard>} />
          <Route path="network/monitoring/live-traffic" element={<AdminOnlyGuard><LiveTrafficPage /></AdminOnlyGuard>} />
          <Route path="network/olt" element={<AdminOnlyGuard><OltPage /></AdminOnlyGuard>} />
          <Route path="network/:type" element={<AdminOnlyGuard><NetworkPage /></AdminOnlyGuard>} />
          <Route path="network" element={<Navigate to="/dashboard/network/mikrotik" replace />} />
          <Route path="service-area/areas" element={<ServiceAreasPage />} />
          <Route path="service-area/sub-areas" element={<SubAreasPage />} />
          <Route path="settings" element={<PlaceholderPage title="Settings" description="Configure system settings and preferences." />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="change-password" element={<ChangePasswordPage />} />
          {/* Dashboard catch-all: 404 for unknown paths under /dashboard */}
          <Route path="*" element={<ErrorPage status={404} />} />
        </Route>

        {/* Explicit error route: use navigate('/error', { state: { status: 403, message: '...' } }) to show error */}
        <Route path="/error" element={<ErrorPageFromLocation />} />

        {/* Catch-all: 404 for unknown routes */}
        <Route path="*" element={<ErrorPage status={404} />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <LoadingProvider>
            <AppContent />
          </LoadingProvider>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
