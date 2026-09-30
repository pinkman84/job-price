import { Link, NavLink, Outlet } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { LogoMark } from './LogoMark'

function navLinkClass({ isActive }: { isActive: boolean }) {
  return isActive ? 'app-nav-link active' : 'app-nav-link'
}

export function AppLayout() {
  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  return (
    <div className="app-shell">
      <header className="app-nav">
        <div className="app-nav-inner">
          <Link to="/" className="app-logo">
            <LogoMark size={28} />
            <span>Job Pricer</span>
          </Link>

          <nav className="app-nav-links">
            <NavLink to="/" end className={navLinkClass}>
              Jobs
            </NavLink>
            <NavLink to="/clients" className={navLinkClass}>
              Clients
            </NavLink>
            <NavLink to="/materials" className={navLinkClass}>
              Materials
            </NavLink>
            <NavLink to="/labour" className={navLinkClass}>
              Labour
            </NavLink>
          </nav>

          <div className="app-nav-actions">
            <Link className="button" to="/jobs/new">
              + New job
            </Link>
            <NavLink to="/settings" className={navLinkClass}>
              Settings
            </NavLink>
            <button className="link-button" onClick={handleSignOut}>
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}