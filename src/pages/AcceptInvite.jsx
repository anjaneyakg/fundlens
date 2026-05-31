// src/pages/AcceptInvite.jsx
// PH3-S5 — Client invite acceptance page
// Route: /accept-invite  (public — no ProtectedRoute)
// ?token= URL param carries the invite token.
//
// Flow:
//   Not logged in → show invite landing card with Create account / Sign in buttons
//   Logged in     → auto-call accept-invite API, show result

import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const pageStyle = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');

  .ai-page {
    min-height: 100vh;
    display: flex; align-items: center; justify-content: center;
    background: var(--color-bg);
    font-family: 'DM Sans', sans-serif;
    padding: 2rem 1rem;
  }

  .ai-card {
    width: 100%; max-width: 440px;
    background: var(--color-surface-raised);
    border: 1px solid var(--color-border);
    border-radius: 20px;
    padding: 40px 36px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.06);
    text-align: center;
  }

  .ai-icon {
    width: 72px; height: 72px; border-radius: 20px;
    display: flex; align-items: center; justify-content: center;
    margin: 0 auto 24px;
  }
  .ai-icon-invite {
    background: linear-gradient(135deg, var(--color-primary-light), #a7f3d0);
    box-shadow: 0 4px 20px rgba(29,158,117,0.15);
  }
  .ai-icon-success {
    background: linear-gradient(135deg, #d1fae5, #a7f3d0);
    box-shadow: 0 4px 20px rgba(29,158,117,0.15);
  }
  .ai-icon-error {
    background: linear-gradient(135deg, #fee2e2, #fecaca);
    box-shadow: 0 4px 20px rgba(239,68,68,0.12);
  }

  .ai-h1 {
    font-size: 22px; font-weight: 700;
    color: var(--color-text-primary); margin: 0 0 12px;
  }
  .ai-p {
    font-size: 14px; color: var(--color-text-secondary);
    line-height: 1.65; margin: 0 0 28px;
  }

  .ai-btn {
    display: inline-flex; align-items: center; justify-content: center;
    width: 100%; height: 44px;
    border-radius: 10px; cursor: pointer;
    font-family: 'DM Sans'; font-size: 15px; font-weight: 600;
    background: var(--color-primary); color: #fff;
    border: none; text-decoration: none;
    box-shadow: 0 2px 12px rgba(29,158,117,0.25);
    transition: background 0.15s; margin-bottom: 10px;
  }
  .ai-btn:hover { background: var(--color-primary-dark); }

  .ai-btn-outline {
    display: inline-flex; align-items: center; justify-content: center;
    width: 100%; height: 44px;
    border-radius: 10px; cursor: pointer;
    font-family: 'DM Sans'; font-size: 15px; font-weight: 600;
    background: var(--color-surface); color: var(--color-text-secondary);
    border: 1px solid var(--color-border); text-decoration: none;
    transition: all 0.15s;
  }
  .ai-btn-outline:hover { border-color: var(--color-primary); color: var(--color-primary); }

  .ai-loading {
    font-size: 14px; color: var(--color-text-muted);
    padding: 12px 0;
  }

  .ai-note {
    margin-top: 16px; font-size: 12px; color: var(--color-text-muted);
  }
`

export default function AcceptInvite() {
  const { user, token, loading: authLoading } = useAuth()
  const navigate        = useNavigate()
  const [searchParams]  = useSearchParams()
  const inviteToken     = searchParams.get('token') || ''

  const [status,        setStatus]     = useState('idle')
  // 'idle' | 'accepting' | 'success' | 'expired' | 'already_linked' | 'already_used' | 'error'
  const [advisorId,     setAdvisorId]  = useState(null)
  const hasAttempted = useRef(false)

  // ── Auto-accept once authenticated ───────────────────────────────────────
  useEffect(() => {
    if (authLoading || !user || !token || !inviteToken || hasAttempted.current) return
    hasAttempted.current = true
    acceptInvite()
  }, [authLoading, user, token, inviteToken])

  async function acceptInvite() {
    setStatus('accepting')
    try {
      const res  = await fetch('/api/advisor?action=accept-invite', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ invite_token: inviteToken }),
      })
      const data = await res.json()

      if (res.ok) {
        setAdvisorId(data.advisor_id || null)
        setStatus(data.already_linked ? 'already_linked' : 'success')
        return
      }

      if (data.error === 'INVITE_EXPIRED') { setStatus('expired'); return }
      if (data.error === 'ALREADY_ACCEPTED') { setStatus('already_used'); return }
      if (data.error === 'INVITE_NOT_FOUND') { setStatus('expired'); return }

      console.error('[AcceptInvite] accept error:', data)
      setStatus('error')
    } catch (err) {
      console.error('[AcceptInvite] accept unexpected error:', err)
      setStatus('error')
    }
  }

  // ── Loading (auth state not yet resolved) ─────────────────────────────────
  if (authLoading) {
    return (
      <div className="ai-page">
        <style>{pageStyle}</style>
        <div className="ai-card">
          <div className="ai-loading">Loading…</div>
        </div>
      </div>
    )
  }

  // ── Not logged in — show landing card ─────────────────────────────────────
  if (!user) {
    return (
      <div className="ai-page">
        <style>{pageStyle}</style>
        <div className="ai-card">
          <div className="ai-icon ai-icon-invite">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"
                stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="12" cy="7" r="4"
                stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="ai-h1">You've been invited to FundLens</h1>
          <p className="ai-p">
            Your advisor has set up your portfolio analytics on FundLens. Create a free account or sign in to get started.
          </p>
          {!inviteToken && (
            <p className="ai-p" style={{ color: 'var(--color-error)', fontSize: 13 }}>
              No invite token found in this link. Please use the link sent by your advisor.
            </p>
          )}
          {inviteToken && (
            <>
              <button
                className="ai-btn"
                onClick={() => navigate(`/register?invite=${encodeURIComponent(inviteToken)}`)}
              >
                Create account
              </button>
              <button
                className="ai-btn-outline"
                onClick={() => navigate('/login', { state: { from: `/accept-invite?token=${encodeURIComponent(inviteToken)}` } })}
              >
                Sign in
              </button>
            </>
          )}
          <p className="ai-note">Free to join. No credit card required.</p>
        </div>
      </div>
    )
  }

  // ── Logged in — process acceptance ────────────────────────────────────────
  return (
    <div className="ai-page">
      <style>{pageStyle}</style>
      <div className="ai-card">

        {/* Accepting / loading */}
        {(status === 'idle' || status === 'accepting') && (
          <>
            <div className="ai-icon ai-icon-invite">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="var(--color-primary)" strokeWidth="2" />
                <path d="M12 6v6l4 2" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="ai-loading">Linking your account…</div>
          </>
        )}

        {/* Success */}
        {(status === 'success' || status === 'already_linked') && (
          <>
            <div className="ai-icon ai-icon-success">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <path d="M20 6L9 17l-5-5" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h1 className="ai-h1">
              {status === 'already_linked' ? 'Already connected!' : "You're now connected with your advisor"}
            </h1>
            <p className="ai-p">
              {status === 'already_linked'
                ? 'Your account is already linked to your advisor.'
                : 'Your advisor can now view your portfolio analytics when you upload your statement.'}
            </p>
            <button className="ai-btn" onClick={() => navigate('/')}>
              Go to my dashboard
            </button>
          </>
        )}

        {/* Expired */}
        {status === 'expired' && (
          <>
            <div className="ai-icon ai-icon-error">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="#dc2626" strokeWidth="2" />
                <line x1="12" y1="8" x2="12" y2="12" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" />
                <line x1="12" y1="16" x2="12.01" y2="16" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <h1 className="ai-h1">Invite link expired</h1>
            <p className="ai-p">
              This invite link has expired or is not valid. Contact your advisor for a new one.
            </p>
            <button className="ai-btn" onClick={() => navigate('/')}>
              Go to FundLens
            </button>
          </>
        )}

        {/* Already accepted by someone else */}
        {status === 'already_used' && (
          <>
            <div className="ai-icon ai-icon-error">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="#dc2626" strokeWidth="2" />
                <line x1="15" y1="9" x2="9" y2="15" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" />
                <line x1="9" y1="9" x2="15" y2="15" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <h1 className="ai-h1">Link already used</h1>
            <p className="ai-p">This account is already linked. Contact your advisor if you need a new invite.</p>
            <button className="ai-btn" onClick={() => navigate('/')}>
              Go to FundLens
            </button>
          </>
        )}

        {/* Unexpected error */}
        {status === 'error' && (
          <>
            <div className="ai-icon ai-icon-error">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
                  stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <line x1="12" y1="9" x2="12" y2="13" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" />
                <line x1="12" y1="17" x2="12.01" y2="17" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <h1 className="ai-h1">Something went wrong</h1>
            <p className="ai-p">We couldn't complete the connection. Please try again or contact your advisor.</p>
            <button className="ai-btn" onClick={() => { hasAttempted.current = false; acceptInvite() }}>
              Try again
            </button>
          </>
        )}

      </div>
    </div>
  )
}
