import { Calculator, ClipboardCheck, Crown, Factory, Package, ShoppingBag } from 'lucide-react';

export const SIGN_IN_ROLES = [
  { role: 'OWNER', label: 'Owner', icon: Crown },
  { role: 'PRODUCTION_MANAGER', label: 'Production', icon: Factory },
  { role: 'STORE_MANAGER', label: 'Store', icon: Package },
  { role: 'QUALITY_INSPECTOR', label: 'Quality', icon: ClipboardCheck },
  { role: 'ACCOUNTANT', label: 'Accounts', icon: Calculator },
  { role: 'BUYER', label: 'Buyer', icon: ShoppingBag },
];

/** Role choice as a 3x2 grid of radio cards: quicker on a phone than a dropdown. */
export function RolePicker({ value, onChange }) {
  return (
    <div className="role-picker" role="radiogroup" aria-label="Your role">
      {SIGN_IN_ROLES.map(({ role, label, icon: Icon }) => (
        <button
          key={role}
          type="button"
          role="radio"
          aria-checked={value === role}
          className={`role-picker__option ${value === role ? 'is-selected' : ''}`}
          onClick={() => onChange(role)}
        >
          <Icon size={18} />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}
