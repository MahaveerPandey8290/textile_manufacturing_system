import {
  BarChart3, Boxes, Building2, ClipboardCheck, Cog, Factory, FileText, Gauge, History, IndianRupee, PackageCheck,
  ShoppingBag, Truck, UserCog, Users,
} from 'lucide-react';

export const ROLE_LABELS = {
  OWNER: 'Owner',
  PRODUCTION_MANAGER: 'Production Manager',
  STORE_MANAGER: 'Store Manager',
  QUALITY_INSPECTOR: 'Quality Inspector',
  ACCOUNTANT: 'Accountant',
  BUYER: 'Buyer',
};

const ALL_STAFF = ['OWNER', 'PRODUCTION_MANAGER', 'STORE_MANAGER', 'QUALITY_INSPECTOR', 'ACCOUNTANT'];

// Role-based navigation. The server enforces the same rules; this only hides what a role cannot use.
export const NAVIGATION = [
  { section: 'Overview', items: [{ to: '/', label: 'Dashboard', icon: Gauge, roles: [...ALL_STAFF, 'BUYER'] }] },
  {
    section: 'Operations',
    items: [
      { to: '/orders', label: 'Orders', icon: ShoppingBag, roles: [...ALL_STAFF, 'BUYER'], buyerLabel: 'My orders' },
      { to: '/production', label: 'Production floor', icon: Factory, roles: ['OWNER', 'PRODUCTION_MANAGER', 'QUALITY_INSPECTOR', 'STORE_MANAGER'] },
      { to: '/inventory', label: 'Yarn store', icon: Boxes, roles: ['OWNER', 'STORE_MANAGER', 'PRODUCTION_MANAGER', 'ACCOUNTANT'] },
      { to: '/quality', label: 'Quality control', icon: ClipboardCheck, roles: ['OWNER', 'QUALITY_INSPECTOR', 'PRODUCTION_MANAGER'] },
      { to: '/dispatch', label: 'Dispatch', icon: Truck, roles: ['OWNER', 'STORE_MANAGER', 'PRODUCTION_MANAGER', 'ACCOUNTANT', 'BUYER'], buyerLabel: 'Deliveries' },
    ],
  },
  {
    section: 'Business',
    items: [
      { to: '/finance', label: 'Finance', icon: IndianRupee, roles: ['OWNER', 'ACCOUNTANT'] },
      { to: '/invoices', label: 'Invoices', icon: FileText, roles: ['BUYER'] },
      { to: '/workforce', label: 'Workforce', icon: Users, roles: ['OWNER', 'PRODUCTION_MANAGER', 'ACCOUNTANT'] },
      { to: '/reports', label: 'Reports', icon: BarChart3, roles: ['OWNER', 'ACCOUNTANT', 'PRODUCTION_MANAGER'] },
      { to: '/parties', label: 'Buyers & suppliers', icon: PackageCheck, roles: ALL_STAFF },
    ],
  },
  {
    section: 'Admin',
    items: [
      { to: '/admin/organization', label: 'Organisation', icon: Building2, roles: ['OWNER'] },
      { to: '/admin/users', label: 'Users & roles', icon: UserCog, roles: ['OWNER'] },
      { to: '/admin/audit', label: 'Audit log', icon: History, roles: ['OWNER'] },
      { to: '/settings', label: 'My account', icon: Cog, roles: [...ALL_STAFF, 'BUYER'] },
    ],
  },
];

export const canAccess = (role, roles) => roles.includes(role);
