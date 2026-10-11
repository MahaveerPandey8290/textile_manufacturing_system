import { LogOut, Menu } from 'lucide-react';
import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { ROLE_LABELS } from '../../config/navigation';
import { GlobalSearch } from './GlobalSearch';
import { Sidebar } from './Sidebar';

export function AppShell() {
  const { currentUser, signOut } = useAuth();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(() => {
    try {
      return localStorage.getItem('sidebar_collapsed') === 'true';
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
          localStorage.setItem('sidebar_collapsed', String(next));
        } catch {}
        return next;
      });
    }
  };

  const initials = currentUser.fullName
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('');

  return (
    <div className={`app-shell ${isDesktopCollapsed ? 'app-shell--collapsed' : ''}`}>
      <Sidebar
        isOpen={isMobileOpen}
        isCollapsed={isDesktopCollapsed}
        onNavigate={() => setIsMobileOpen(false)}
      />
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
          <GlobalSearch />
          <div className="topbar__user">
            <div className="topbar__user-text">
              <strong>{currentUser.fullName}</strong>
              <span>{currentUser.buyerCompany ?? ROLE_LABELS[currentUser.role]}</span>
            </div>
            <span className="avatar">{initials}</span>
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
