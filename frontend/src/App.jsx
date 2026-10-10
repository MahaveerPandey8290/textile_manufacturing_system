import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { PlatformRoute, ProtectedRoute } from './auth/ProtectedRoute';
import { AppShell } from './components/layout/AppShell';
import { PlatformShell } from './components/platform/PlatformShell';
import { FullPageSpinner } from './components/ui/Spinner';
import { EmptyState } from './components/ui/EmptyState';

// Each area is its own chunk, so a store clerk never downloads the finance screens.
// Sign-up and sign-in
const WelcomePage = lazy(() => import('./pages/auth/WelcomePage'));
const OrganizationSignUpPage = lazy(() => import('./pages/auth/OrganizationSignUpPage'));
const SignUpSuccessPage = lazy(() => import('./pages/auth/SignUpSuccessPage'));
const OrganizationSignInPage = lazy(() => import('./pages/auth/OrganizationSignInPage'));
const OrganizationCodePage = lazy(() => import('./pages/auth/OrganizationCodePage'));
const OrganizationWelcomePage = lazy(() => import('./pages/auth/OrganizationWelcomePage'));
const SignedInWelcomePage = lazy(() => import('./pages/auth/SignedInWelcomePage'));
const StaffSignInPage = lazy(() => import('./pages/auth/StaffSignInPage'));
const PasswordResetPage = lazy(() => import('./pages/auth/PasswordResetPage'));
const PlatformSignInPage = lazy(() => import('./pages/auth/PlatformSignInPage'));
// Super admin console
const PlatformOverviewPage = lazy(() => import('./pages/platform/PlatformOverviewPage'));
const OrganizationsPage = lazy(() => import('./pages/platform/OrganizationsPage'));
const OrganizationDetailPage = lazy(() => import('./pages/platform/OrganizationDetailPage'));
const PlatformActivityPage = lazy(() => import('./pages/platform/PlatformActivityPage'));
// Organisation app
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage'));
const OrdersPage = lazy(() => import('./pages/orders/OrdersPage'));
const OrderDetailPage = lazy(() => import('./pages/orders/OrderDetailPage'));
const InventoryPage = lazy(() => import('./pages/inventory/InventoryPage'));
const ProductionPage = lazy(() => import('./pages/production/ProductionPage'));
const QualityPage = lazy(() => import('./pages/quality/QualityPage'));
const DispatchPage = lazy(() => import('./pages/dispatch/DispatchPage'));
const DispatchDocumentPage = lazy(() => import('./pages/dispatch/DispatchDocumentPage'));
const FinancePage = lazy(() => import('./pages/finance/FinancePage'));
const BuyerInvoicesPage = lazy(() => import('./pages/finance/BuyerInvoicesPage'));
const WorkforcePage = lazy(() => import('./pages/workforce/WorkforcePage'));
const ReportsPage = lazy(() => import('./pages/reports/ReportsPage'));
const PartiesPage = lazy(() => import('./pages/parties/PartiesPage'));
const UsersPage = lazy(() => import('./pages/admin/UsersPage'));
const AuditLogPage = lazy(() => import('./pages/admin/AuditLogPage'));
const OrganizationSettingsPage = lazy(() => import('./pages/admin/OrganizationSettingsPage'));
const AccountPage = lazy(() => import('./pages/admin/AccountPage'));
const TrackOrderPage = lazy(() => import('./pages/public/TrackOrderPage'));

const STAFF = ['OWNER', 'PRODUCTION_MANAGER', 'STORE_MANAGER', 'QUALITY_INSPECTOR', 'ACCOUNTANT'];

export function App() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <Routes>
        <Route path="/welcome" element={<WelcomePage />} />
        {/* Organisation owners: "Welcome back" sign-in, or register a new organisation */}
        <Route path="/organization/signin" element={<OrganizationSignInPage />} />
        <Route path="/organization/reset" element={<PasswordResetPage />} />
        <Route path="/signup" element={<OrganizationSignUpPage />} />
        <Route path="/signup/done" element={<SignUpSuccessPage />} />
        {/* Staff: organisation code -> welcome to the organisation -> sign in */}
        <Route path="/signin" element={<OrganizationCodePage />} />
        <Route path="/signin/:organizationCode/welcome" element={<OrganizationWelcomePage />} />
        <Route path="/signin/:organizationCode" element={<StaffSignInPage />} />
        <Route path="/signin/:organizationCode/reset" element={<PasswordResetPage />} />
        {/* After any organisation sign-in: the organisation's logo and name, and who signed in */}
        <Route path="/signed-in" element={<ProtectedRoute><SignedInWelcomePage /></ProtectedRoute>} />
        <Route path="/login" element={<Navigate to="/signin" replace />} />
        <Route path="/platform/login" element={<PlatformSignInPage />} />
        <Route path="/track/:organizationCode/:trackingToken" element={<TrackOrderPage />} />
        <Route
          path="/platform"
          element={
            <PlatformRoute>
              <PlatformShell />
            </PlatformRoute>
          }
        >
          <Route index element={<PlatformOverviewPage />} />
          <Route path="organizations" element={<OrganizationsPage />} />
          <Route path="organizations/:organizationId" element={<OrganizationDetailPage />} />
          <Route path="activity" element={<PlatformActivityPage />} />
        </Route>
        <Route
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="orders/:orderId" element={<OrderDetailPage />} />
          <Route path="production" element={<ProtectedRoute roles={['OWNER', 'PRODUCTION_MANAGER', 'QUALITY_INSPECTOR', 'STORE_MANAGER']}><ProductionPage /></ProtectedRoute>} />
          <Route path="inventory" element={<ProtectedRoute roles={['OWNER', 'STORE_MANAGER', 'PRODUCTION_MANAGER', 'ACCOUNTANT']}><InventoryPage /></ProtectedRoute>} />
          <Route path="quality" element={<ProtectedRoute roles={['OWNER', 'QUALITY_INSPECTOR', 'PRODUCTION_MANAGER', 'STORE_MANAGER', 'ACCOUNTANT']}><QualityPage /></ProtectedRoute>} />
          <Route path="dispatch" element={<DispatchPage />} />
          <Route path="dispatch/:dispatchId" element={<DispatchDocumentPage />} />
          <Route path="finance" element={<ProtectedRoute roles={['OWNER', 'ACCOUNTANT']}><FinancePage /></ProtectedRoute>} />
          <Route path="invoices" element={<ProtectedRoute roles={['BUYER']}><BuyerInvoicesPage /></ProtectedRoute>} />
          <Route path="workforce" element={<ProtectedRoute roles={['OWNER', 'PRODUCTION_MANAGER', 'ACCOUNTANT']}><WorkforcePage /></ProtectedRoute>} />
          <Route path="reports" element={<ProtectedRoute roles={['OWNER', 'ACCOUNTANT', 'PRODUCTION_MANAGER']}><ReportsPage /></ProtectedRoute>} />
          <Route path="parties" element={<ProtectedRoute roles={STAFF}><PartiesPage /></ProtectedRoute>} />
          <Route path="admin/organization" element={<ProtectedRoute roles={['OWNER']}><OrganizationSettingsPage /></ProtectedRoute>} />
          <Route path="admin/users" element={<ProtectedRoute roles={['OWNER']}><UsersPage /></ProtectedRoute>} />
          <Route path="admin/audit" element={<ProtectedRoute roles={['OWNER']}><AuditLogPage /></ProtectedRoute>} />
          <Route path="settings" element={<AccountPage />} />
          <Route path="*" element={<EmptyState title="Page not found" description="The page you were looking for doesn't exist." />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
