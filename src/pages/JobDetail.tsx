import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Job } from '../types'

export default function JobDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [job, setJob] = useState<Job | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase.from('jobs').select('*').eq('id', id).single()
      if (error) {
        setError(error.message)
      } else {
        setJob(data)
      }
      setLoading(false)
    }
    load()
  }, [id])

  async function handleDelete() {
    if (!job || !confirm(`Delete "${job.name}"? This cannot be undone.`)) return
    const { error } = await supabase.from('jobs').delete().eq('id', job.id)
    if (error) {
      setError(error.message)
      return
    }
    navigate('/')
  }

  if (loading) return <div className="page-loading">Loading…</div>
  if (error) return <p className="form-error">{error}</p>
  if (!job) return <p>Job not found.</p>

  return (
    <div className="page">
      <header className="page-header">
        <h1>{job.name}</h1>
        <div className="header-actions">
          <Link className="button" to={`/jobs/${job.id}/edit`}>
            Edit
          </Link>
          <button className="link-button" onClick={handleDelete}>
            Delete
          </button>
        </div>
      </header>

      <div className="job-detail">
        <div className="job-detail-row">
          <span className="label">Status</span>
          <span className={`job-status job-status-${job.status}`}>{job.status}</span>
        </div>
        <div className="job-detail-row">
          <span className="label">Client</span>
          <span>{job.client || '—'}</span>
        </div>
        <div className="job-detail-row">
          <span className="label">Location</span>
          <span>{job.location || '—'}</span>
        </div>
        <div className="job-detail-row">
          <span className="label">Price</span>
          <span className="job-price">
            {job.price.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}
          </span>
        </div>
        {job.details?.notes && (
          <div className="job-detail-row">
            <span className="label">Notes</span>
            <p>{job.details.notes}</p>
          </div>
        )}
      </div>

      <Link className="link-button" to="/">
        ← Back to jobs
      </Link>
    </div>
  )
}
