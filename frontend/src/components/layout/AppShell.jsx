import { LogOut, Menu } from 'lucide-react';
import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { ROLE_LABELS } from '../../config/navigation';
import { GlobalSearch } from './GlobalSearch';
import { Sidebar } from './Sidebar';

export function AppShell() {
  const { currentUser, signOut } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const initials = currentUser.fullName
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('');

  return (
    <div className="app-shell">
      <Sidebar isOpen={isSidebarOpen} onNavigate={() => setIsSidebarOpen(false)} />
      {isSidebarOpen && <div className="sidebar-scrim" onClick={() => setIsSidebarOpen(false)} />}
      <div className="app-shell__main">
        <header className="topbar">
          <button className="icon-button topbar__menu" onClick={() => setIsSidebarOpen(true)} aria-label="Open menu">
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
