export const ROLES = Object.freeze({
  OWNER: 'OWNER',
  PRODUCTION_MANAGER: 'PRODUCTION_MANAGER',
  STORE_MANAGER: 'STORE_MANAGER',
  QUALITY_INSPECTOR: 'QUALITY_INSPECTOR',
  ACCOUNTANT: 'ACCOUNTANT',
  BUYER: 'BUYER',
});

/** Every role that works inside the mill (everyone except buyers). */
export const STAFF_ROLES = Object.freeze(Object.values(ROLES).filter((role) => role !== ROLES.BUYER));
