import { NavLink } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { NAVIGATION, canAccess } from '../../config/navigation';
import { PLATFORM_NAME } from '../../config/platform';
import { OrganizationMark } from '../auth/OrganizationMark';

export function Sidebar({ isOpen, onNavigate }) {
  const { currentUser, organization } = useAuth();
  const isBuyer = currentUser.role === 'BUYER';
  return (
    <aside className={`sidebar ${isOpen ? 'is-open' : ''}`}>
      <div className="sidebar__brand">
        <OrganizationMark name={organization.name} logoUrl={organization.logoUrl} size={36} className="org-mark--on-dark" />
        <div style={{ minWidth: 0 }}>
          <div className="sidebar__brand-name" title={organization.name}>{organization.name}</div>
          <div className="sidebar__brand-sub">{isBuyer ? 'Buyer portal' : 'Mill operations'}</div>
        </div>
      </div>
      <nav className="sidebar__nav">
        {NAVIGATION.map((group) => {
          const visibleItems = group.items.filter((item) => canAccess(currentUser.role, item.roles));
          if (!visibleItems.length) return null;
          return (
            <div key={group.section} className="sidebar__group">
              <div className="sidebar__section">{group.section}</div>
              {visibleItems.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.to === '/'} className="sidebar__link" onClick={onNavigate}>
                  <item.icon size={18} />
                  <span>{isBuyer && item.buyerLabel ? item.buyerLabel : item.label}</span>
                </NavLink>
              ))}
            </div>
          );
        })}
      </nav>
      <div className="sidebar__footer">
        Code <span className="mono">{organization.code}</span> · {PLATFORM_NAME}
      </div>
    </aside>
  );
}
