import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/httpClient';
import { rememberOrganization } from './rememberedOrganization';

const AuthContext = createContext(null);

/**
 * One session at a time, of one of two kinds:
 *   tenant   - the owner, staff or a buyer of one organisation ({ user, organization })
 *   platform - a MillOS super admin ({ user }, no organisation)
 */
export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  const acceptSession = useCallback((nextSession, entry) => {
    if (nextSession?.organization) rememberOrganization(nextSession.organization, entry);
    setSession(nextSession);
    return nextSession;
  }, []);

  useEffect(() => {
    api
      .get('/auth/me')
      .then((current) => acceptSession(current))
      .catch(() => setSession(null))
      .finally(() => setIsCheckingSession(false));

    const handleExpiredSession = () => {
      setSession(null);
      queryClient.clear();
    };
    window.addEventListener('session-expired', handleExpiredSession);
    return () => window.removeEventListener('session-expired', handleExpiredSession);
  }, [queryClient, acceptSession]);

  const signInStaff = useCallback(async (credentials) => acceptSession(await api.post('/auth/login', credentials), 'staff'), [acceptSession]);
  const signInOrganizationAdmin = useCallback(
    async (credentials) => acceptSession(await api.post('/auth/organization/login', credentials), 'organization'),
    [acceptSession],
  );
  const signInPlatformAdmin = useCallback(async (credentials) => acceptSession(await api.post('/auth/platform/login', credentials)), [acceptSession]);
  const signUpOrganization = useCallback(
    async (details) => {
      const { organizationCode, session: newSession } = await api.post('/auth/organizations', details);
      acceptSession(newSession, 'organization');
      return organizationCode;
    },
    [acceptSession],
  );
  const refreshSession = useCallback(async () => acceptSession(await api.get('/auth/me')), [acceptSession]);

  const signOut = useCallback(async () => {
    await api.post('/auth/logout').catch(() => {});
    queryClient.clear();
    setSession(null);
  }, [queryClient]);

  const value = useMemo(() => {
    const currentUser = session?.user ?? null;
    return {
      session,
      currentUser,
      organization: session?.organization ?? null,
      isPlatformAdmin: session?.kind === 'platform',
      isCheckingSession,
      signInStaff,
      signInOrganizationAdmin,
      signInPlatformAdmin,
      signUpOrganization,
      refreshSession,
      signOut,
      hasRole: (...roles) => roles.includes(currentUser?.role) || currentUser?.role === 'OWNER',
    };
  }, [session, isCheckingSession, signInStaff, signInOrganizationAdmin, signInPlatformAdmin, signUpOrganization, refreshSession, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
