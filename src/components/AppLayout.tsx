import { Link, NavLink, Outlet } from 'react-router-dom'
import { supabase } from '../lib/supabase'

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
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="28" height="28" rx="7" fill="var(--accent)" />
              <path
                d="M9 14.5L12.5 18L19.5 10"
                stroke="white"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
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
          </nav>

          <div className="app-nav-actions">
            <Link className="button" to="/jobs/new">
              + New job
            </Link>
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
