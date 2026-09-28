import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Job } from '../types'

type JobWithClient = Job & { client: { name: string } | null }

export default function JobsList() {
  const [jobs, setJobs] = useState<JobWithClient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const { data, error } = await supabase
        .from('jobs')
        .select('*, client:clients(name)')
        .order('created_at', { ascending: false })

      if (cancelled) return

      if (error) {
        setError(error.message)
      } else {
        setJobs((data as JobWithClient[]) ?? [])
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
                <span>{job.client?.name ?? 'No client set'}</span>
                <span>{job.due_date ? `Due ${job.due_date}` : 'No due date'}</span>
              </div>
              <div className="job-price">
                {job.total.toLocaleString(undefined, { style: 'currency', currency: job.currency_code })}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
