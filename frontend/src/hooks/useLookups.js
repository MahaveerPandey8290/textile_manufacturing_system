import { useApiQuery } from './useApi';

// Dropdown sources that rarely change: cached for 5 minutes and shared across screens.
const LOOKUP_OPTIONS = { staleTime: 5 * 60_000 };

export const useBuyers = () => useApiQuery('/buyers', { pageSize: 100 }, LOOKUP_OPTIONS);
export const useSuppliers = () => useApiQuery('/suppliers', { pageSize: 100 }, LOOKUP_OPTIONS);
export const useFabricTypes = () => useApiQuery('/inventory/fabric-types', undefined, LOOKUP_OPTIONS);
export const useYarnTypes = () => useApiQuery('/inventory/yarn-types', { pageSize: 100 }, LOOKUP_OPTIONS);
export const useShifts = () => useApiQuery('/production/shifts', undefined, LOOKUP_OPTIONS);
export const useMachines = () => useApiQuery('/production/machines', undefined, { staleTime: 15_000 });
export const useActiveWorkers = () => useApiQuery('/workforce/workers', { pageSize: 100 }, LOOKUP_OPTIONS);
