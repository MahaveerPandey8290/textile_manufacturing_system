import { useQuery } from '@tanstack/react-query';
import { api } from '../api/httpClient';
import { getRememberedOrganization } from '../auth/rememberedOrganization';

/** Public name/logo of an organisation by its code, for the sign-in screens. */
export function useOrganizationBranding(organizationCode) {
  const code = String(organizationCode ?? '').toUpperCase();
  const remembered = getRememberedOrganization();
  return useQuery({
    queryKey: ['organization-branding', code],
    queryFn: ({ signal }) => api.get(`/public/organizations/${encodeURIComponent(code)}`, undefined, signal),
    enabled: Boolean(code),
    retry: false,
    staleTime: 5 * 60_000,
    // Paint the remembered brand instantly, then confirm it with the server.
    placeholderData: remembered?.code === code ? remembered : undefined,
  });
}
