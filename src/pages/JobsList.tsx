import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Job } from '../types'

export default function JobsList() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .order('created_at', { ascending: false })

      if (cancelled) return

      if (error) {
        setError(error.message)
      } else {
        setJobs(data ?? [])
      }
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1>Jobs</h1>
        <div className="header-actions">
          <Link className="button" to="/jobs/new">
            + New job
          </Link>
          <button className="link-button" onClick={handleSignOut}>
            Sign out
          </button>
        </div>
      </header>

      {loading && <p>Loading…</p>}
      {error && <p className="form-error">{error}</p>}

      {!loading && jobs.length === 0 && (
        <p className="empty-state">No jobs yet. Price your first job to get started.</p>
      )}

      <ul className="job-list">
        {jobs.map((job) => (
          <li key={job.id}>
            <Link to={`/jobs/${job.id}`} className="job-card">
              <div className="job-card-main">
                <span className="job-name">{job.name}</span>
                <span className={`job-status job-status-${job.status}`}>{job.status}</span>
              </div>
              <div className="job-card-meta">
                <span>{job.client || 'No client set'}</span>
                <span>{job.location || 'No location set'}</span>
              </div>
              <div className="job-price">
                {job.price.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
