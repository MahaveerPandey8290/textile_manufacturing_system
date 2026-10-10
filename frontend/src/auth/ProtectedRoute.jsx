import { Navigate, useLocation } from 'react-router-dom';
import { FullPageSpinner } from '../components/ui/Spinner';
import { EmptyState } from '../components/ui/EmptyState';
import { useAuth } from './AuthContext';
import { getRememberedOrganization } from './rememberedOrganization';

/** Where a signed-out person should start: the sign-in page they used last on this device. */
export function signedOutPath() {
  const remembered = getRememberedOrganization();
  if (!remembered) return '/welcome';
  return remembered.entry === 'organization' ? '/organization/signin' : `/signin/${remembered.code}`;
}

/** Organisation area: guards by sign-in and, optionally, by role. */
export function ProtectedRoute({ roles, children }) {
  const { currentUser, isPlatformAdmin, isCheckingSession } = useAuth();
  const location = useLocation();
  if (isCheckingSession) return <FullPageSpinner />;
  if (!currentUser) return <Navigate to={signedOutPath()} replace state={{ from: location }} />;
  if (isPlatformAdmin) return <Navigate to="/platform" replace />;
  if (roles && !roles.includes(currentUser.role)) {
    return <EmptyState title="Not available for your role" description="Ask the owner if you need access to this area." />;
  }
  return children;
}

/** Super admin console. */
export function PlatformRoute({ children }) {
  const { currentUser, isPlatformAdmin, isCheckingSession } = useAuth();
  if (isCheckingSession) return <FullPageSpinner />;
  if (!currentUser) return <Navigate to="/platform/login" replace />;
  if (!isPlatformAdmin) return <Navigate to="/" replace />;
  return children;
}
