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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  return (
    <div className="app-shell app-shell--platform">
      <aside className={`sidebar sidebar--platform ${isSidebarOpen ? 'is-open' : ''}`}>
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
              <NavLink key={item.to} to={item.to} end={item.end} className="sidebar__link" onClick={() => setIsSidebarOpen(false)}>
                <item.icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        </nav>
        <div className="sidebar__footer">Super admin · sees every organisation</div>
      </aside>
      {isSidebarOpen && <div className="sidebar-scrim" onClick={() => setIsSidebarOpen(false)} />}
      <div className="app-shell__main">
        <header className="topbar">
          <button className="icon-button topbar__menu" onClick={() => setIsSidebarOpen(true)} aria-label="Open menu">
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
