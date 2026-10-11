import { Activity, Building2, Gauge, LogOut, Menu } from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { PLATFORM_NAME } from '../../config/platform';
import { describeEvent } from '../../config/platformEvents';
import { formatRelative } from '../../utils/format';
import { PlatformMark } from '../auth/OrganizationMark';

const PLATFORM_NAVIGATION = [
  { to: '/platform', label: 'Overview', icon: Gauge, end: true },
  { to: '/platform/organizations', label: 'Organisations', icon: Building2 },
  { to: '/platform/activity', label: 'Activity', icon: Activity },
];

/** Frame for the super admin console. Visually distinct from an organisation's app on purpose. */
export function PlatformShell() {
  const { currentUser, signOut } = useAuth();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(() => {
    try {
      return localStorage.getItem('platform_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleSidebar = () => {
    if (window.innerWidth <= 900) {
      setIsMobileOpen((prev) => !prev);
    } else {
      setIsDesktopCollapsed((prev) => {
        const next = !prev;
        try {
          localStorage.setItem('platform_sidebar_collapsed', String(next));
        } catch {}
        return next;
      });
    }
  };

  return (
    <div className={`app-shell app-shell--platform ${isDesktopCollapsed ? 'app-shell--collapsed' : ''}`}>
      <aside className={`sidebar sidebar--platform ${isMobileOpen ? 'is-open' : ''} ${isDesktopCollapsed ? 'is-collapsed' : ''}`}>
        <div className="sidebar__brand">
          <PlatformMark size={32} />
          <div>
            <div className="sidebar__brand-name">{PLATFORM_NAME}</div>
            <div className="sidebar__brand-sub">Platform console</div>
          </div>
        </div>
        <nav className="sidebar__nav">
          <div className="sidebar__group">
            <div className="sidebar__section">Monitor</div>
            {PLATFORM_NAVIGATION.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className="sidebar__link" onClick={() => setIsMobileOpen(false)}>
                <item.icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        </nav>
        <div className="sidebar__footer">Super admin · sees every organisation</div>
      </aside>
      {isMobileOpen && <div className="sidebar-scrim" onClick={() => setIsMobileOpen(false)} />}
      <div className="app-shell__main">
        <header className="topbar">
          <button
            type="button"
            className="icon-button topbar__menu"
            onClick={toggleSidebar}
            aria-label="Toggle navigation menu"
            title={isDesktopCollapsed ? 'Show sidebar' : 'Hide sidebar (full screen)'}
          >
            <Menu size={20} />
          </button>
          <span className="platform-badge">Platform console</span>
          <div className="topbar__user">
            <div className="topbar__user-text">
              <strong>{currentUser.fullName}</strong>
              <span>Super admin</span>
            </div>
            <span className="avatar avatar--platform">SA</span>
            <button className="icon-button" onClick={signOut} title="Sign out" aria-label="Sign out">
              <LogOut size={18} />
            </button>
          </div>
        </header>
        <main className="page">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

/** One line of the platform activity feed. */
export function EventLine({ event, showOrganization = true }) {
  const meta = describeEvent(event.event_type);
  return (
    <li className="event-line">
      <span className={`event-line__icon tone-${meta.tone}`}><meta.icon size={15} /></span>
      <div className="event-line__body">
        <div>
          <strong>{meta.label}</strong>
          {showOrganization && event.organization_name && <span className="soft"> · {event.organization_name}</span>}
        </div>
        <div className="cell-sub">
          {event.actor_email ?? 'System'}
          {event.details?.reason && <> · “{event.details.reason}”</>}
          {event.details?.invited && <> · {event.details.invited}</>}
        </div>
      </div>
      <time className="event-line__time" dateTime={event.created_at}>{formatRelative(event.created_at)}</time>
    </li>
  );
}
