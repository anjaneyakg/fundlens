// src/pages/admin/AdvisorApplications.jsx
// PH3-S4: Advisor application review — approve/reject pending applications,
// admin-direct registration form (collapsed by default).

import { useState, useEffect, useCallback } from 'react'
import { createSupabaseClient } from '../../lib/supabaseClient'
import { useAuth } from '../../hooks/useAuth'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
function fmtDate(s) {
  if (!s) return '—'
  const d = new Date(s)
  if (isNaN(d.getTime())) return String(s)
  return `${String(d.getDate()).padStart(2,'0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

const s = {
  page:      { maxWidth: 960, padding: '0 0 3rem' },
  h1:        { fontSize: 22, fontWeight: 700, color: '#1e1b4b', margin: '0 0 6px' },
  sub:       { fontSize: 14, color: '#64748b', marginBottom: 28 },
  card:      {
    background: '#fff', border: '1px solid rgba(99,102,241,0.12)',
    borderRadius: 16, padding: '24px 28px', marginBottom: 20,
    boxShadow: '0 2px 12px rgba(99,102,241,0.06)',
  },
  table:     { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th:        {
    padding: '10px 12px', textAlign: 'left', fontWeight: 700,
    fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase',
    color: '#8b5cf6', borderBottom: '2px solid #ede9fe', background: '#faf5ff',
  },
  td:        { padding: '11px 12px', borderBottom: '1px solid #f1f5f9', verticalAlign: 'top' },
  badge:     {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
  },
  approveBtn: {
    padding: '6px 14px', borderRadius: 8, cursor: 'pointer',
    fontSize: 12, fontWeight: 700, border: 'none',
    background: '#d1fae5', color: '#065f46', transition: 'background 0.15s',
  },
  rejectBtn: {
    padding: '6px 14px', borderRadius: 8, cursor: 'pointer',
    fontSize: 12, fontWeight: 700, border: 'none',
    background: '#fee2e2', color: '#991b1b', transition: 'background 0.15s',
    marginLeft: 6,
  },
  input: {
    width: '100%', boxSizing: 'border-box',
    border: '1px solid rgba(99,102,241,0.25)', borderRadius: 8,
    padding: '9px 12px', fontSize: 14,
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    outline: 'none',
  },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 5 },
  collapseBtn: {
    display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
    background: 'none', border: 'none', padding: 0,
    fontSize: 15, fontWeight: 700, color: '#4f46e5',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  },
  saveBtn: {
    padding: '10px 24px', borderRadius: 9, cursor: 'pointer',
    fontSize: 14, fontWeight: 700, border: 'none',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff',
    boxShadow: '0 2px 10px rgba(99,102,241,0.25)', transition: 'opacity 0.15s',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  },
  emptyState: { textAlign: 'center', padding: '3rem 0', color: '#9ca3af', fontSize: 15 },
  sectionHdr: { fontSize: 13, fontWeight: 700, color: '#4f46e5', marginBottom: 14, marginTop: 0 },
}

function DebarredBadge({ passed }) {
  if (passed === null || passed === undefined) return <span style={{ color: '#9ca3af' }}>—</span>
  return passed
    ? <span style={{ ...s.badge, background: '#d1fae5', color: '#065f46' }}>✓ Passed</span>
    : <span style={{ ...s.badge, background: '#fee2e2', color: '#991b1b' }}>✗ Failed</span>
}

function RegTypeBadge({ type }) {
  const label = type === 'sebi_ria' ? 'SEBI RIA' : type === 'mfd_arn' ? 'MFD/IFD' : type || '—'
  const bg    = type === 'sebi_ria' ? '#e0f2fe' : '#ecfdf5'
  const color = type === 'sebi_ria' ? '#0369a1' : '#065f46'
  return <span style={{ ...s.badge, background: bg, color }}>{label}</span>
}

export default function AdvisorApplications() {
  const { token } = useAuth()

  const [applications, setApplications] = useState([])
  const [loadErr,      setLoadErr]       = useState('')
  const [loadingApps,  setLoadingApps]   = useState(true)

  // Inline reject reason input (keyed by uid)
  const [rejectForms,  setRejectForms]   = useState({})
  const [actionStatus, setActionStatus]  = useState({}) // { [uid]: 'approving'|'rejecting'|'done'|'error' }

  // Admin-direct registration form
  const [showDirect,   setShowDirect]    = useState(false)
  const [directForm,   setDirectForm]    = useState({
    uid: '', email: '', registration_type: 'mfd_arn',
    arn_number: '', sebi_ria_number: '',
    applicant_name: '', firm_name: '', phone: '', city: '',
  })
  const [directStatus, setDirectStatus] = useState(null) // null|'saving'|'success'|'error'
  const [directError,  setDirectError]  = useState('')

  const setDirectField = (k, v) => setDirectForm(prev => ({ ...prev, [k]: v }))

  // ── Load pending applications ─────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!token) return
    setLoadingApps(true)
    setLoadErr('')
    try {
      const sb = createSupabaseClient(token)
      const { data, error } = await sb
        .from('advisor_profiles')
        .select(`
          user_id,
          applicant_name,
          registration_type,
          arn_number,
          sebi_ria_number,
          firm_name,
          phone,
          city,
          applied_at,
          debarred_check_passed,
          promo_code_used,
          profiles!user_id(email)
        `)
        .eq('status', 'pending')
        .order('applied_at', { ascending: false })

      if (error) {
        console.error('[AdvisorApplications] load error:', error)
        setLoadErr('Failed to load applications.')
      } else {
        setApplications(data || [])
      }
    } catch (err) {
      console.error('[AdvisorApplications] load unexpected error:', err)
      setLoadErr('Failed to load applications.')
    } finally {
      setLoadingApps(false)
    }
  }, [token])

  useEffect(() => { load() }, [load])

  // ── Approve ───────────────────────────────────────────────────────────────
  async function handleApprove(uid, regType) {
    setActionStatus(p => ({ ...p, [uid]: 'approving' }))
    try {
      const res = await fetch('/api/admin?action=approve-advisor', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ uid, registration_type: regType }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Server error')
      }
      setActionStatus(p => ({ ...p, [uid]: 'done' }))
      setApplications(prev => prev.filter(a => a.user_id !== uid))
    } catch (err) {
      console.error('[AdvisorApplications] approve error:', err)
      setActionStatus(p => ({ ...p, [uid]: 'error' }))
    }
  }

  // ── Reject ────────────────────────────────────────────────────────────────
  function openRejectForm(uid) {
    setRejectForms(p => ({ ...p, [uid]: p[uid] || '' }))
  }

  async function handleReject(uid) {
    const reason = rejectForms[uid] || ''
    setActionStatus(p => ({ ...p, [uid]: 'rejecting' }))
    try {
      const res = await fetch('/api/admin?action=reject-advisor', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ uid, reason }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Server error')
      }
      setActionStatus(p => ({ ...p, [uid]: 'done' }))
      setApplications(prev => prev.filter(a => a.user_id !== uid))
    } catch (err) {
      console.error('[AdvisorApplications] reject error:', err)
      setActionStatus(p => ({ ...p, [uid]: 'error' }))
    }
  }

  // ── Admin-direct registration ─────────────────────────────────────────────
  async function handleDirectRegister() {
    setDirectError('')
    if (!directForm.uid.trim() || !directForm.email.trim() || !directForm.applicant_name.trim() || !directForm.firm_name.trim()) {
      setDirectError('UID, email, applicant name, and firm name are required.')
      return
    }
    setDirectStatus('saving')
    try {
      const res = await fetch('/api/admin?action=admin-register-advisor', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(directForm),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (j.error === 'DEBARRED_MATCH') {
          setDirectError('Debarred check failed: this registration number appears on the regulatory debarred list.')
        } else {
          setDirectError(j.error || 'Server error')
        }
        setDirectStatus('error')
        return
      }
      setDirectStatus('success')
      setDirectForm({ uid: '', email: '', registration_type: 'mfd_arn', arn_number: '', sebi_ria_number: '', applicant_name: '', firm_name: '', phone: '', city: '' })
    } catch (err) {
      console.error('[AdvisorApplications] direct register error:', err)
      setDirectError('An unexpected error occurred.')
      setDirectStatus('error')
    }
  }

  const getEmail = (app) => app.profiles?.email || app.user_id?.slice(0, 8) + '…'

  return (
    <div style={s.page}>
      <div style={s.h1}>Advisor Applications</div>
      <div style={s.sub}>Review and approve or reject pending advisor / distributor applications.</div>

      {/* Pending applications table */}
      <div style={s.card}>
        <div style={s.sectionHdr}>Pending ({loadingApps ? '…' : applications.length})</div>
        {loadErr && <div style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{loadErr}</div>}
        {!loadingApps && applications.length === 0 && !loadErr && (
          <div style={s.emptyState}>No pending applications</div>
        )}
        {!loadingApps && applications.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Applicant</th>
                  <th style={s.th}>Email</th>
                  <th style={s.th}>Type</th>
                  <th style={s.th}>ARN / SEBI#</th>
                  <th style={s.th}>Firm</th>
                  <th style={s.th}>Phone</th>
                  <th style={s.th}>Applied</th>
                  <th style={s.th}>Debarred</th>
                  <th style={s.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {applications.map(app => {
                  const uid    = app.user_id
                  const status = actionStatus[uid]
                  const regNum = app.registration_type === 'sebi_ria' ? app.sebi_ria_number : app.arn_number
                  const hasRejectForm = uid in rejectForms

                  return (
                    <tr key={uid}>
                      <td style={s.td}>{app.applicant_name || '—'}</td>
                      <td style={s.td} title={getEmail(app)}>
                        <span style={{ maxWidth: 140, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {getEmail(app)}
                        </span>
                      </td>
                      <td style={s.td}><RegTypeBadge type={app.registration_type} /></td>
                      <td style={s.td}>{regNum || '—'}</td>
                      <td style={s.td}>{app.firm_name || '—'}</td>
                      <td style={s.td}>{app.phone || '—'}</td>
                      <td style={s.td}>{fmtDate(app.applied_at)}</td>
                      <td style={s.td}><DebarredBadge passed={app.debarred_check_passed} /></td>
                      <td style={{ ...s.td, minWidth: 200 }}>
                        {status === 'done' && (
                          <span style={{ color: '#065f46', fontWeight: 700, fontSize: 12 }}>Done ✓</span>
                        )}
                        {status === 'error' && (
                          <span style={{ color: '#991b1b', fontSize: 12 }}>Error — retry</span>
                        )}
                        {(status === 'approving' || status === 'rejecting') && (
                          <span style={{ color: '#6b7280', fontSize: 12 }}>Working…</span>
                        )}
                        {!status && (
                          <div>
                            <button
                              style={s.approveBtn}
                              onClick={() => handleApprove(uid, app.registration_type)}
                            >
                              Approve
                            </button>
                            {!hasRejectForm && (
                              <button
                                style={s.rejectBtn}
                                onClick={() => openRejectForm(uid)}
                              >
                                Reject
                              </button>
                            )}
                            {hasRejectForm && (
                              <div style={{ marginTop: 8 }}>
                                <input
                                  style={{ ...s.input, fontSize: 12, padding: '6px 10px', marginBottom: 6 }}
                                  type="text"
                                  placeholder="Rejection reason (optional)"
                                  value={rejectForms[uid]}
                                  onChange={e => setRejectForms(p => ({ ...p, [uid]: e.target.value }))}
                                />
                                <button style={s.rejectBtn} onClick={() => handleReject(uid)}>
                                  Confirm Reject
                                </button>
                                <button
                                  style={{ ...s.rejectBtn, background: '#f1f5f9', color: '#64748b', marginLeft: 4 }}
                                  onClick={() => setRejectForms(p => { const n = { ...p }; delete n[uid]; return n })}
                                >
                                  Cancel
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ marginTop: 16 }}>
          <button
            style={{ padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(99,102,241,0.3)', background: '#f5f3ff', color: '#4f46e5', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            onClick={load}
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Admin-direct registration */}
      <div style={s.card}>
        <button style={s.collapseBtn} onClick={() => setShowDirect(v => !v)} type="button">
          <span style={{ fontSize: 12 }}>{showDirect ? '▼' : '▶'}</span>
          Admin-Direct Registration
        </button>
        <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4, marginLeft: 20 }}>
          Register an advisor directly — bypasses pending state; role is set to advisor immediately.
        </div>

        {showDirect && (
          <div style={{ marginTop: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div>
                <label style={s.label} htmlFor="d-uid">Firebase UID *</label>
                <input id="d-uid" style={s.input} type="text" placeholder="Firebase UID" value={directForm.uid} onChange={e => setDirectField('uid', e.target.value)} />
              </div>
              <div>
                <label style={s.label} htmlFor="d-email">Email *</label>
                <input id="d-email" style={s.input} type="email" placeholder="advisor@example.com" value={directForm.email} onChange={e => setDirectField('email', e.target.value)} />
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={s.label}>Registration type *</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[['mfd_arn','MFD / IFD'], ['sebi_ria','SEBI RIA']].map(([val, lbl]) => (
                  <button
                    key={val}
                    type="button"
                    style={{
                      padding: '8px 16px', borderRadius: 8, cursor: 'pointer',
                      fontSize: 13, fontWeight: 600,
                      border: `1.5px solid ${directForm.registration_type === val ? '#6366f1' : '#e5e7eb'}`,
                      background: directForm.registration_type === val ? '#ede9fe' : '#f9fafb',
                      color: directForm.registration_type === val ? '#4f46e5' : '#6b7280',
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                    }}
                    onClick={() => setDirectField('registration_type', val)}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              {directForm.registration_type === 'mfd_arn' ? (
                <div>
                  <label style={s.label} htmlFor="d-arn">ARN Number</label>
                  <input id="d-arn" style={s.input} type="text" placeholder="ARN-12345" value={directForm.arn_number} onChange={e => setDirectField('arn_number', e.target.value.toUpperCase())} />
                </div>
              ) : (
                <div>
                  <label style={s.label} htmlFor="d-sebi">SEBI RIA Number</label>
                  <input id="d-sebi" style={s.input} type="text" placeholder="INA000XXXXXX" value={directForm.sebi_ria_number} onChange={e => setDirectField('sebi_ria_number', e.target.value.toUpperCase())} />
                </div>
              )}
              <div>
                <label style={s.label} htmlFor="d-phone">Phone</label>
                <input id="d-phone" style={s.input} type="tel" placeholder="9876543210" value={directForm.phone} onChange={e => setDirectField('phone', e.target.value.replace(/\D/g, '').slice(0, 10))} />
              </div>
              <div>
                <label style={s.label} htmlFor="d-name">Applicant Name *</label>
                <input id="d-name" style={s.input} type="text" placeholder="Rajesh Sharma" value={directForm.applicant_name} onChange={e => setDirectField('applicant_name', e.target.value)} />
              </div>
              <div>
                <label style={s.label} htmlFor="d-firm">Firm Name *</label>
                <input id="d-firm" style={s.input} type="text" placeholder="Sharma Wealth" value={directForm.firm_name} onChange={e => setDirectField('firm_name', e.target.value)} />
              </div>
              <div>
                <label style={s.label} htmlFor="d-city">City</label>
                <input id="d-city" style={s.input} type="text" placeholder="Mumbai" value={directForm.city} onChange={e => setDirectField('city', e.target.value)} />
              </div>
            </div>

            {directError && (
              <div style={{ color: '#dc2626', fontSize: 13, marginBottom: 12, padding: '8px 12px', background: '#fef2f2', borderRadius: 8 }}>
                {directError}
              </div>
            )}
            {directStatus === 'success' && (
              <div style={{ color: '#065f46', fontSize: 13, marginBottom: 12, padding: '8px 12px', background: '#f0fdf4', borderRadius: 8 }}>
                Advisor registered successfully. Role set to advisor immediately.
              </div>
            )}

            <button
              style={{ ...s.saveBtn, opacity: directStatus === 'saving' ? 0.6 : 1 }}
              onClick={handleDirectRegister}
              disabled={directStatus === 'saving'}
              type="button"
            >
              {directStatus === 'saving' ? 'Registering…' : 'Register Advisor Directly'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
