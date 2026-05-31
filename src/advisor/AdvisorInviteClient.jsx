// src/advisor/AdvisorInviteClient.jsx
// PH3-S5 — Client Invitation Flow
// Route: /advisor/clients/invite  (ProtectedRoute requiredRole="advisor")

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { createSupabaseClient } from '../lib/supabaseClient'
import useWindowWidth from '../hooks/useWindowWidth'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
function fmtDate(s) {
  if (!s) return '—'
  const d = new Date(s)
  if (isNaN(d.getTime())) return String(s)
  return `${String(d.getDate()).padStart(2,'0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

const STATUS_CONFIG = {
  invited:     { label: 'Invited',     bg: '#fef3c7', color: '#92400e' },
  active:      { label: 'Active',      bg: '#d1fae5', color: '#065f46' },
  placeholder: { label: 'Placeholder', bg: '#f1f5f9', color: '#475569' },
  expired:     { label: 'Expired',     bg: '#fee2e2', color: '#991b1b' },
}

function getDisplayStatus(row) {
  if (row.status === 'invited' && row.invite_expires_at && new Date(row.invite_expires_at) < new Date()) {
    return 'expired'
  }
  return row.status || 'placeholder'
}

const pageStyle = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');

  .inv-page {
    max-width: 640px; margin: 0 auto;
    padding: 32px 20px 64px;
    font-family: 'DM Sans', sans-serif;
  }

  .inv-back {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 13px; color: var(--color-text-muted);
    text-decoration: none; margin-bottom: 24px;
    background: none; border: none; cursor: pointer;
    padding: 0; font-family: 'DM Sans', sans-serif;
    transition: color 0.15s;
  }
  .inv-back:hover { color: var(--color-primary); }

  .inv-h1 {
    font-size: 24px; font-weight: 700;
    color: var(--color-text-primary); margin: 0 0 6px;
  }
  .inv-sub {
    font-size: 14px; color: var(--color-text-secondary);
    margin: 0 0 32px; line-height: 1.6;
  }

  .inv-card {
    background: var(--color-surface-raised);
    border: 1px solid var(--color-border);
    border-radius: 16px; padding: 28px 28px;
    margin-bottom: 20px;
    box-shadow: 0 2px 12px rgba(0,0,0,0.04);
  }

  .inv-section-label {
    font-size: 12px; font-weight: 700;
    color: var(--color-text-muted); letter-spacing: 0.06em;
    text-transform: uppercase; margin-bottom: 16px;
  }

  .inv-field { margin-bottom: 16px; }
  .inv-label {
    display: block; font-size: 13px; font-weight: 600;
    color: var(--color-text-secondary); margin-bottom: 6px;
  }
  .inv-label .req { color: var(--color-error); margin-left: 2px; }
  .inv-input, .inv-textarea {
    width: 100%; box-sizing: border-box;
    border: 1.5px solid var(--color-border); border-radius: 9px;
    padding: 10px 14px; font-family: 'DM Sans'; font-size: 14px;
    color: var(--color-text-primary); background: var(--color-bg);
    outline: none; transition: border-color 0.15s, box-shadow 0.15s;
  }
  .inv-input:focus, .inv-textarea:focus {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px rgba(29,158,117,0.12);
  }
  .inv-textarea { resize: vertical; min-height: 72px; }
  .inv-hint { font-size: 12px; color: var(--color-text-muted); margin-top: 5px; }

  .inv-btn {
    display: inline-flex; align-items: center; justify-content: center;
    padding: 10px 24px; border-radius: 9px; cursor: pointer;
    font-family: 'DM Sans'; font-size: 14px; font-weight: 600;
    background: var(--color-primary); color: #fff; border: none;
    box-shadow: 0 2px 8px rgba(29,158,117,0.22);
    transition: background 0.15s; white-space: nowrap;
  }
  .inv-btn:hover { background: var(--color-primary-dark); }
  .inv-btn:disabled { background: var(--color-border); cursor: default; box-shadow: none; }

  .inv-btn-outline {
    display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    padding: 9px 18px; border-radius: 9px; cursor: pointer;
    font-family: 'DM Sans'; font-size: 13px; font-weight: 600;
    background: var(--color-bg); color: var(--color-text-secondary);
    border: 1.5px solid var(--color-border);
    transition: all 0.15s; white-space: nowrap;
  }
  .inv-btn-outline:hover { border-color: var(--color-primary); color: var(--color-primary); }

  .inv-link-box {
    display: flex; align-items: center; gap: 10px;
    background: var(--color-surface); border: 1px solid var(--color-border);
    border-radius: 9px; padding: 10px 14px;
    margin-bottom: 16px;
  }
  .inv-link-text {
    flex: 1; font-size: 13px; color: var(--color-text-secondary);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }

  .inv-share-row {
    display: flex; gap: 10px; flex-wrap: wrap;
  }

  .inv-error {
    padding: 10px 14px; border-radius: 9px; margin-bottom: 14px;
    background: rgba(239,68,68,0.06); color: var(--color-error);
    font-size: 13px; border: 1px solid rgba(239,68,68,0.15);
  }
  .inv-success {
    padding: 10px 14px; border-radius: 9px; margin-bottom: 14px;
    background: rgba(29,158,117,0.08); color: var(--color-primary);
    font-size: 13px; border: 1px solid rgba(29,158,117,0.2); font-weight: 600;
  }

  .inv-collapse-btn {
    display: flex; align-items: center; justify-content: space-between;
    width: 100%; background: none; border: none; cursor: pointer; padding: 0;
    font-family: 'DM Sans'; font-size: 14px; font-weight: 600;
    color: var(--color-text-primary);
  }
  .inv-collapse-arrow { font-size: 11px; color: var(--color-text-muted); }

  .inv-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .inv-th {
    text-align: left; padding: 7px 10px;
    font-size: 11px; font-weight: 600;
    color: var(--color-text-muted); letter-spacing: 0.04em;
    border-bottom: 2px solid var(--color-border);
    white-space: nowrap;
  }
  .inv-td {
    padding: 10px 10px; border-bottom: 1px solid var(--color-surface);
    color: var(--color-text-primary); vertical-align: middle;
  }
  .inv-badge {
    display: inline-flex; align-items: center;
    padding: 2px 10px; border-radius: 20px;
    font-size: 11px; font-weight: 700;
  }
  .inv-empty {
    text-align: center; padding: 32px 0;
    font-size: 14px; color: var(--color-text-muted);
  }
  .inv-action-btn {
    font-size: 12px; font-weight: 600; cursor: pointer;
    background: none; border: 1px solid var(--color-border);
    border-radius: 6px; padding: 4px 10px;
    color: var(--color-text-secondary); font-family: 'DM Sans';
    transition: all 0.15s; white-space: nowrap;
  }
  .inv-action-btn:hover { border-color: var(--color-primary); color: var(--color-primary); }
`

export default function AdvisorInviteClient() {
  const navigate = useNavigate()
  const { user, token } = useAuth()
  const width   = useWindowWidth()
  const isMobile = width <= 768

  // ── Create invite form ────────────────────────────────────────────────────
  const [clientLabel,   setClientLabel]   = useState('')
  const [clientEmail,   setClientEmail]   = useState('')
  const [advisorNotes,  setAdvisorNotes]  = useState('')
  const [generating,    setGenerating]    = useState(false)
  const [genError,      setGenError]      = useState('')

  // ── Current invite (shown after generation or Resend) ─────────────────────
  const [currentInvite, setCurrentInvite] = useState(null)
  // { invite_url, invite_token, client_label, client_email }

  const [copied, setCopied] = useState(false)

  // ── Placeholder client form ───────────────────────────────────────────────
  const [showPlaceholder,    setShowPlaceholder]    = useState(false)
  const [placeholderLabel,   setPlaceholderLabel]   = useState('')
  const [placeholderSaving,  setPlaceholderSaving]  = useState(false)
  const [placeholderSuccess, setPlaceholderSuccess] = useState(false)
  const [placeholderError,   setPlaceholderError]   = useState('')

  // ── Recent invites ────────────────────────────────────────────────────────
  const [recentClients,  setRecentClients]  = useState([])
  const [loadingRecent,  setLoadingRecent]  = useState(true)
  const [recentError,    setRecentError]    = useState('')

  // ── Load recent invites ───────────────────────────────────────────────────
  const loadRecent = useCallback(async () => {
    if (!token) return
    setLoadingRecent(true)
    setRecentError('')
    try {
      const sb = createSupabaseClient(token)
      const { data, error } = await sb
        .from('advisor_client_links')
        .select('id,client_id,client_label,status,invite_token,invite_sent_at,invite_expires_at,invite_accepted_at,link_origin,created_at')
        .eq('advisor_id', user.uid)
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) {
        console.error('[AdvisorInviteClient] load recent error:', error)
        setRecentError('Failed to load recent invites.')
      } else {
        setRecentClients(data || [])
      }
    } catch (err) {
      console.error('[AdvisorInviteClient] load recent unexpected error:', err)
      setRecentError('Failed to load recent invites.')
    } finally {
      setLoadingRecent(false)
    }
  }, [token, user])

  useEffect(() => { loadRecent() }, [loadRecent])

  // ── Generate invite ───────────────────────────────────────────────────────
  async function handleGenerate() {
    if (!token || !clientLabel.trim()) return
    setGenError('')
    setGenerating(true)
    setCurrentInvite(null)

    try {
      const res = await fetch('/api/advisor?action=create-invite', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          client_label:  clientLabel.trim(),
          client_email:  clientEmail.trim() || undefined,
          advisor_notes: advisorNotes.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setGenError(data.error || 'Failed to generate invite link.')
        return
      }
      setCurrentInvite({
        invite_url:   data.invite_url,
        invite_token: data.invite_token,
        client_label: clientLabel.trim(),
        client_email: clientEmail.trim(),
      })
      // Reset form fields
      setClientLabel('')
      setClientEmail('')
      setAdvisorNotes('')
      // Refresh recent list
      await loadRecent()
    } catch (err) {
      console.error('[AdvisorInviteClient] generate error:', err)
      setGenError('An unexpected error occurred. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  // ── Copy link ─────────────────────────────────────────────────────────────
  async function handleCopy() {
    if (!currentInvite?.invite_url) return
    try {
      await navigator.clipboard.writeText(currentInvite.invite_url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('[AdvisorInviteClient] clipboard error:', err)
    }
  }

  // ── Share via email ───────────────────────────────────────────────────────
  function handleEmailShare() {
    if (!currentInvite) return
    const subject = encodeURIComponent("You're invited to FundLens")
    const body    = encodeURIComponent(
      `Hi ${currentInvite.client_label},\n\nI'd like to share your portfolio analytics with you on FundLens. Click here to get started:\n${currentInvite.invite_url}\n\nThis link expires in 30 days.\n\nRegards`
    )
    const to = currentInvite.client_email ? encodeURIComponent(currentInvite.client_email) : ''
    window.open(`mailto:${to}?subject=${subject}&body=${body}`)
  }

  // ── Share via WhatsApp ────────────────────────────────────────────────────
  function handleWhatsAppShare() {
    if (!currentInvite) return
    const text = encodeURIComponent(
      `Hi ${currentInvite.client_label}, I've set up your portfolio analytics on FundLens. Click to get started: ${currentInvite.invite_url}`
    )
    window.open(`https://wa.me/?text=${text}`, '_blank')
  }

  // ── Resend (re-populate share section) ────────────────────────────────────
  function handleResend(row) {
    setCurrentInvite({
      invite_url:   `https://fundlens.in/accept-invite?token=${row.invite_token}`,
      invite_token: row.invite_token,
      client_label: row.client_label || '',
      client_email: '',
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ── Add placeholder client ────────────────────────────────────────────────
  async function handleAddPlaceholder() {
    if (!token || !placeholderLabel.trim()) return
    setPlaceholderError('')
    setPlaceholderSuccess(false)
    setPlaceholderSaving(true)

    try {
      const res = await fetch('/api/advisor?action=add-client-direct', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ client_label: placeholderLabel.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setPlaceholderError(data.error || 'Failed to add client.')
        return
      }
      setPlaceholderSuccess(true)
      setPlaceholderLabel('')
      await loadRecent()
    } catch (err) {
      console.error('[AdvisorInviteClient] add placeholder error:', err)
      setPlaceholderError('An unexpected error occurred.')
    } finally {
      setPlaceholderSaving(false)
    }
  }

  return (
    <>
      <style>{pageStyle}</style>
      <div className="inv-page">

        {/* Back button */}
        <button className="inv-back" onClick={() => navigate('/advisor')}>
          ← Advisor Dashboard
        </button>

        <h1 className="inv-h1">Invite a Client</h1>
        <p className="inv-sub">
          Generate a secure invite link to share with your client. They'll register or sign in, and you'll be connected automatically.
        </p>

        {/* ── Section 1: Create invite ───────────────────────────────────── */}
        <div className="inv-card">
          <div className="inv-section-label">Create invite link</div>

          <div className="inv-field">
            <label className="inv-label" htmlFor="clientLabel">
              Client name / label <span className="req">*</span>
            </label>
            <input
              id="clientLabel"
              className="inv-input"
              type="text"
              placeholder="Ramesh Kumar"
              value={clientLabel}
              onChange={e => setClientLabel(e.target.value)}
            />
          </div>

          <div className="inv-field">
            <label className="inv-label" htmlFor="clientEmail">Client email (optional)</label>
            <input
              id="clientEmail"
              className="inv-input"
              type="email"
              placeholder="ramesh@example.com"
              value={clientEmail}
              onChange={e => setClientEmail(e.target.value)}
            />
            <div className="inv-hint">If provided, used to pre-fill the email invite message.</div>
          </div>

          <div className="inv-field">
            <label className="inv-label" htmlFor="advisorNotes">Notes (optional)</label>
            <textarea
              id="advisorNotes"
              className="inv-textarea"
              placeholder="Internal notes — not shown to the client"
              value={advisorNotes}
              onChange={e => setAdvisorNotes(e.target.value)}
            />
          </div>

          {genError && <div className="inv-error">{genError}</div>}

          <button
            className="inv-btn"
            onClick={handleGenerate}
            disabled={!clientLabel.trim() || generating}
          >
            {generating ? 'Generating…' : 'Generate Invite Link'}
          </button>
        </div>

        {/* ── Section 2: Share options (shown after link generated) ──────── */}
        {currentInvite && (
          <div className="inv-card">
            <div className="inv-section-label">Share with {currentInvite.client_label}</div>

            <div className="inv-link-box">
              <span className="inv-link-text">{currentInvite.invite_url}</span>
            </div>

            <div className="inv-share-row" style={{ flexDirection: isMobile ? 'column' : 'row' }}>
              <button className="inv-btn-outline" onClick={handleCopy} style={{ flex: isMobile ? undefined : 1 }}>
                {copied ? '✓ Copied' : '📋 Copy Link'}
              </button>
              <button className="inv-btn-outline" onClick={handleEmailShare} style={{ flex: isMobile ? undefined : 1 }}>
                ✉ Share via Email
              </button>
              <button className="inv-btn-outline" onClick={handleWhatsAppShare} style={{ flex: isMobile ? undefined : 1 }}>
                💬 Share via WhatsApp
              </button>
            </div>
            <div className="inv-hint" style={{ marginTop: 12 }}>
              This link expires in 30 days. Clients can register or sign in after clicking.
            </div>
          </div>
        )}

        {/* ── Section 3: Placeholder client (collapsed) ─────────────────── */}
        <div className="inv-card">
          <button
            className="inv-collapse-btn"
            onClick={() => setShowPlaceholder(v => !v)}
            type="button"
          >
            <span>Add client without invite</span>
            <span className="inv-collapse-arrow">{showPlaceholder ? '▲' : '▼'}</span>
          </button>
          {!showPlaceholder && (
            <div className="inv-hint" style={{ marginTop: 8 }}>
              Add a client to your dashboard before they register. No data is shared until they accept an invite.
            </div>
          )}
          {showPlaceholder && (
            <div style={{ marginTop: 16 }}>
              <div className="inv-hint" style={{ marginBottom: 14 }}>
                Add a client to your dashboard before they register. No data is shared until they accept an invite.
              </div>
              <div className="inv-field">
                <label className="inv-label" htmlFor="placeholderLabel">
                  Client name <span className="req">*</span>
                </label>
                <input
                  id="placeholderLabel"
                  className="inv-input"
                  type="text"
                  placeholder="Sunita Patel"
                  value={placeholderLabel}
                  onChange={e => setPlaceholderLabel(e.target.value)}
                />
              </div>
              {placeholderError && <div className="inv-error">{placeholderError}</div>}
              {placeholderSuccess && (
                <div className="inv-success">Added to your client list.</div>
              )}
              <button
                className="inv-btn"
                onClick={handleAddPlaceholder}
                disabled={!placeholderLabel.trim() || placeholderSaving}
              >
                {placeholderSaving ? 'Adding…' : 'Add to dashboard'}
              </button>
            </div>
          )}
        </div>

        {/* ── Section 4: Recent invites ──────────────────────────────────── */}
        <div className="inv-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div className="inv-section-label" style={{ marginBottom: 0 }}>Recent invites</div>
            <button
              className="inv-action-btn"
              onClick={loadRecent}
              style={{ fontSize: 11 }}
            >
              Refresh
            </button>
          </div>

          {recentError && <div className="inv-error">{recentError}</div>}

          {loadingRecent && (
            <div className="inv-empty">Loading…</div>
          )}

          {!loadingRecent && recentClients.length === 0 && !recentError && (
            <div className="inv-empty">No invites sent yet.</div>
          )}

          {!loadingRecent && recentClients.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table className="inv-table">
                <thead>
                  <tr>
                    <th className="inv-th">Client</th>
                    <th className="inv-th">Status</th>
                    <th className="inv-th">Sent</th>
                    <th className="inv-th">Expires</th>
                    <th className="inv-th">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {recentClients.map(row => {
                    const dispStatus  = getDisplayStatus(row)
                    const statusCfg   = STATUS_CONFIG[dispStatus] || STATUS_CONFIG.placeholder
                    const isInvite    = !!row.invite_token && dispStatus !== 'expired' && dispStatus !== 'active'
                    const canResend   = !!row.invite_token && (dispStatus === 'invited' || dispStatus === 'expired')

                    return (
                      <tr key={row.id}>
                        <td className="inv-td" style={{ fontWeight: 500 }}>
                          {row.client_label || '—'}
                        </td>
                        <td className="inv-td">
                          <span
                            className="inv-badge"
                            style={{ background: statusCfg.bg, color: statusCfg.color }}
                          >
                            {statusCfg.label}
                          </span>
                        </td>
                        <td className="inv-td">{fmtDate(row.invite_sent_at || row.created_at)}</td>
                        <td className="inv-td">
                          {row.invite_expires_at ? fmtDate(row.invite_expires_at) : '—'}
                        </td>
                        <td className="inv-td">
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {canResend && (
                              <button
                                className="inv-action-btn"
                                onClick={() => handleResend(row)}
                              >
                                Resend
                              </button>
                            )}
                            {row.invite_token && (
                              <button
                                className="inv-action-btn"
                                onClick={() => {
                                  navigator.clipboard.writeText(
                                    `https://fundlens.in/accept-invite?token=${row.invite_token}`
                                  ).catch(err => console.error('[AdvisorInviteClient] copy error:', err))
                                }}
                                title="Copy invite link"
                              >
                                📋
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </>
  )
}
