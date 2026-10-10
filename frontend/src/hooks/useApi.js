import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/httpClient';
import { useToast } from '../components/ui/Toast';

/** GET with caching. React Query hands us an AbortSignal, so stale requests are cancelled automatically. */
export function useApiQuery(path, params, options = {}) {
  return useQuery({
    queryKey: [path, params ?? {}],
    queryFn: ({ signal }) => api.get(path, params, signal),
    placeholderData: keepPreviousData,
    ...options,
  });
}

/** POST/PUT/PATCH that shows a toast and refreshes the listed query prefixes on success. */
export function useApiMutation({ method = 'post', path, invalidate = [], successMessage, onSuccess }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  return useMutation({
    mutationFn: ({ body, path: overridePath } = {}) => api[method](overridePath ?? path, body),
    onSuccess: async (data, variables) => {
      await Promise.all(
        invalidate.map((prefix) => queryClient.invalidateQueries({ predicate: (query) => String(query.queryKey[0]).startsWith(prefix) })),
      );
      if (successMessage) showToast({ tone: 'success', message: typeof successMessage === 'function' ? successMessage(data) : successMessage });
      onSuccess?.(data, variables);
    },
    onError: (error) => showToast({ tone: 'danger', message: error.message }),
  });
}
