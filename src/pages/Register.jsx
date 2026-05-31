// src/pages/Register.jsx
// PH3-S4: Unified registration wizard — 4 steps.
// PH3-S5: Reads ?invite=TOKEN — after registration calls accept-invite to link client.
// Requires Firebase auth (redirects to /login if no user).
// Redirects to / if user already has a profiles row (profileExists === true).
// Never auto-creates the profiles row — that is this wizard's job.

import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase, createSupabaseClient } from '../lib/supabaseClient'
import useWindowWidth from '../hooks/useWindowWidth'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
function fmtDate(s) {
  if (!s) return '—'
  const d = new Date(s)
  if (isNaN(d.getTime())) return String(s)
  return `${String(d.getDate()).padStart(2,'0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

const regStyles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');

  .reg-page {
    min-height: 100vh;
    background: var(--color-bg);
    font-family: 'DM Sans', sans-serif;
    display: flex; flex-direction: column; align-items: center;
    padding: 2rem 1rem 4rem;
  }
  .reg-logo {
    display: flex; align-items: center; gap: 10px;
    text-decoration: none; margin-bottom: 2.5rem; align-self: flex-start;
    max-width: 600px; width: 100%;
  }
  .reg-logo-mark {
    width: 30px; height: 30px; border-radius: 8px;
    background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dark));
    display: flex; align-items: center; justify-content: center;
    font-size: 14px; font-weight: 700; color: #fff;
    flex-shrink: 0;
  }
  .reg-logo-text {
    font-size: 17px; font-weight: 700; color: var(--color-text-primary);
    letter-spacing: -0.3px;
  }
  .reg-logo-text span { color: var(--color-primary); }

  .reg-wrap { width: 100%; max-width: 600px; }

  .reg-steps {
    display: flex; align-items: center; gap: 0;
    margin-bottom: 2.5rem; justify-content: center;
  }
  .reg-step-node {
    width: 32px; height: 32px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 13px; font-weight: 700; flex-shrink: 0;
    transition: all 0.2s;
  }
  .reg-step-node.active {
    background: var(--color-primary); color: #fff;
    box-shadow: 0 0 0 4px rgba(29,158,117,0.15);
  }
  .reg-step-node.done {
    background: var(--color-primary); color: #fff;
  }
  .reg-step-node.inactive {
    background: var(--color-surface); color: var(--color-text-muted);
    border: 1.5px solid var(--color-border);
  }
  .reg-step-line {
    flex: 1; height: 2px; background: var(--color-border);
    min-width: 32px; max-width: 80px;
  }
  .reg-step-line.done { background: var(--color-primary); }

  .reg-card {
    background: var(--color-surface-raised);
    border: 1px solid var(--color-border);
    border-radius: 20px;
    padding: 36px 40px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.06);
    margin-bottom: 1.5rem;
  }
  @media (max-width: 640px) {
    .reg-card { padding: 24px 20px; }
    .reg-logo { align-self: center; }
  }

  .reg-h1 { font-size: 22px; font-weight: 700; color: var(--color-text-primary); margin: 0 0 6px; }
  .reg-sub { font-size: 14px; color: var(--color-text-secondary); margin: 0 0 28px; line-height: 1.6; }

  .path-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  @media (max-width: 480px) { .path-cards { grid-template-columns: 1fr; } }

  .path-card {
    border: 2px solid var(--color-border); border-radius: 14px;
    padding: 20px 18px; cursor: pointer;
    transition: all 0.18s; background: var(--color-bg);
    text-align: left;
  }
  .path-card:hover { border-color: var(--color-primary); }
  .path-card.selected {
    border-color: var(--color-primary);
    background: rgba(29,158,117,0.04);
    box-shadow: 0 0 0 3px rgba(29,158,117,0.1);
  }
  .path-card-icon { font-size: 26px; margin-bottom: 10px; }
  .path-card-title { font-size: 16px; font-weight: 700; color: var(--color-text-primary); margin-bottom: 6px; }
  .path-card-desc { font-size: 13px; color: var(--color-text-secondary); line-height: 1.55; }

  .subtype-row {
    display: flex; gap: 8px; margin-bottom: 22px;
  }
  .subtype-btn {
    flex: 1; padding: 9px 12px; border-radius: 9px; cursor: pointer;
    font-family: 'DM Sans'; font-size: 13px; font-weight: 600;
    border: 1.5px solid var(--color-border); background: var(--color-bg);
    color: var(--color-text-secondary); transition: all 0.15s; text-align: center;
  }
  .subtype-btn.active {
    border-color: var(--color-primary); background: rgba(29,158,117,0.06);
    color: var(--color-primary);
  }

  .reg-field { margin-bottom: 18px; }
  .reg-label {
    display: block; font-size: 13px; font-weight: 600;
    color: var(--color-text-secondary); margin-bottom: 6px;
  }
  .reg-label .req { color: var(--color-error); margin-left: 2px; }
  .reg-input {
    width: 100%; box-sizing: border-box;
    border: 1.5px solid var(--color-border); border-radius: 9px;
    padding: 10px 14px; font-family: 'DM Sans'; font-size: 15px;
    color: var(--color-text-primary); background: var(--color-bg);
    outline: none; transition: border-color 0.15s, box-shadow 0.15s;
  }
  .reg-input:focus {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px rgba(29,158,117,0.12);
  }
  .reg-hint { font-size: 12px; color: var(--color-text-muted); margin-top: 5px; }

  .reg-check { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 14px; }
  .reg-check input[type=checkbox] {
    width: 17px; height: 17px; flex-shrink: 0; cursor: pointer; margin-top: 2px;
    accent-color: var(--color-primary);
  }
  .reg-check-label { font-size: 13.5px; color: var(--color-text-primary); line-height: 1.55; cursor: pointer; }

  .promo-row { display: flex; gap: 10px; }
  .promo-row .reg-input { flex: 1; text-transform: uppercase; }
  .promo-apply-btn {
    padding: 10px 18px; border-radius: 9px; cursor: pointer;
    font-family: 'DM Sans'; font-size: 14px; font-weight: 600;
    background: var(--color-primary); color: #fff; border: none;
    white-space: nowrap; transition: background 0.15s;
    flex-shrink: 0;
  }
  .promo-apply-btn:hover { background: var(--color-primary-dark); }
  .promo-apply-btn:disabled { background: var(--color-border); cursor: default; }

  .promo-valid {
    margin-top: 8px; padding: 8px 12px; border-radius: 8px;
    background: rgba(29,158,117,0.08); color: var(--color-primary);
    font-size: 13px; font-weight: 600;
    border: 1px solid rgba(29,158,117,0.2);
  }
  .promo-invalid {
    margin-top: 8px; font-size: 13px; color: var(--color-error);
  }

  .review-row {
    display: flex; justify-content: space-between; align-items: flex-start;
    padding: 10px 0; border-bottom: 1px solid var(--color-border);
  }
  .review-row:last-child { border-bottom: none; }
  .review-key { font-size: 13px; color: var(--color-text-muted); }
  .review-val { font-size: 13px; font-weight: 600; color: var(--color-text-primary); text-align: right; max-width: 60%; }

  .reg-btn-row { display: flex; gap: 12px; justify-content: flex-end; }
  .reg-back-btn {
    padding: 11px 24px; border-radius: 10px; cursor: pointer;
    font-family: 'DM Sans'; font-size: 15px; font-weight: 500;
    background: var(--color-surface); color: var(--color-text-secondary);
    border: 1px solid var(--color-border); transition: all 0.15s;
  }
  .reg-back-btn:hover { background: var(--color-bg); }
  .reg-next-btn {
    padding: 11px 28px; border-radius: 10px; cursor: pointer;
    font-family: 'DM Sans'; font-size: 15px; font-weight: 600;
    background: var(--color-primary); color: #fff;
    border: none; transition: background 0.15s;
    box-shadow: 0 2px 10px rgba(29,158,117,0.22);
  }
  .reg-next-btn:hover { background: var(--color-primary-dark); }
  .reg-next-btn:disabled { background: var(--color-border); cursor: default; box-shadow: none; }

  .reg-error {
    margin-bottom: 16px; padding: 10px 14px; border-radius: 9px;
    background: rgba(239,68,68,0.06); color: var(--color-error);
    font-size: 13.5px; border: 1px solid rgba(239,68,68,0.15);
  }

  .reg-success {
    text-align: center; padding: 2rem 0;
  }
  .reg-success-icon {
    width: 72px; height: 72px; border-radius: 20px;
    background: linear-gradient(135deg, #d1fae5, #a7f3d0);
    display: flex; align-items: center; justify-content: center;
    margin: 0 auto 24px;
    box-shadow: 0 4px 20px rgba(29,158,117,0.15);
  }
  .reg-success-h { font-size: 22px; font-weight: 700; color: var(--color-text-primary); margin: 0 0 12px; }
  .reg-success-p { font-size: 15px; color: var(--color-text-secondary); line-height: 1.65; margin: 0 0 28px; }
  .reg-success-go {
    display: inline-flex; align-items: center; justify-content: center;
    padding: 12px 32px; border-radius: 10px;
    background: var(--color-primary); color: #fff;
    font-family: 'DM Sans'; font-size: 15px; font-weight: 600;
    border: none; cursor: pointer; text-decoration: none;
    box-shadow: 0 2px 10px rgba(29,158,117,0.22);
    transition: background 0.15s;
  }
  .reg-success-go:hover { background: var(--color-primary-dark); }

  .reg-tier-note {
    background: var(--color-surface); border-radius: 9px;
    padding: 12px 14px; font-size: 13px; color: var(--color-text-secondary);
    border-left: 3px solid var(--color-primary); margin-top: 8px;
  }

  .reg-invite-banner {
    background: rgba(29,158,117,0.06); border: 1px solid rgba(29,158,117,0.2);
    border-radius: 10px; padding: 12px 16px; margin-bottom: 24px;
    font-size: 13px; color: var(--color-primary); font-weight: 600;
    display: flex; align-items: center; gap: 8px;
  }
`

function StepIndicator({ current }) {
  const labels = ['Path', 'Details', 'Promo', 'Submit']
  return (
    <div className="reg-steps">
      {labels.map((_, i) => {
        const n = i + 1
        const state = n < current ? 'done' : n === current ? 'active' : 'inactive'
        return (
          <div key={n} style={{ display: 'flex', alignItems: 'center' }}>
            <div className={`reg-step-node ${state}`} title={labels[i]}>
              {state === 'done' ? '✓' : n}
            </div>
            {i < labels.length - 1 && (
              <div className={`reg-step-line${state === 'done' ? ' done' : ''}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function Register() {
  const { user, token, loading: authLoading, profileExists, refreshRole } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const width = useWindowWidth()
  const isMobile = width <= 640

  const [step, setStep]         = useState(1)
  const [regType, setRegType]   = useState(null)   // 'investor' | 'advisor'
  const [subType, setSubType]   = useState('mfd_arn') // 'mfd_arn' | 'sebi_ria'
  const [form, setForm]         = useState({
    displayName:   '',
    applicantName: '',
    firmName:      '',
    arnNumber:     '',
    euinNumber:    '',
    euinPending:   false,
    sebiRiaNumber: '',
    phone:         '',
    city:          '',
  })
  const [promoCode,   setPromoCode]   = useState('')
  const [promoStatus, setPromoStatus] = useState(null)
  const [promoData,   setPromoData]   = useState(null)
  const [declarations, setDeclarations] = useState({ notDebarred: false, registrationCurrent: false })
  const [submitting,  setSubmitting]  = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [done, setDone]               = useState(false)

  // PH3-S5: invite token from URL
  const [inviteToken,   setInviteToken]   = useState('')
  const [inviteAccepted, setInviteAccepted] = useState(false)

  const setField = (key, val) => setForm(prev => ({ ...prev, [key]: val }))

  // Handle URL params: ?type=, ?invite=
  useEffect(() => {
    const type   = searchParams.get('type')
    const invite = searchParams.get('invite')
    if (type === 'advisor')  { setRegType('advisor');  setStep(2) }
    if (type === 'investor') { setRegType('investor'); setStep(2) }
    if (invite) setInviteToken(invite.trim())
  }, [])

  // Redirect guards
  useEffect(() => {
    if (authLoading) return
    if (!user) { navigate('/login', { replace: true }); return }
    if (profileExists === true) { navigate('/', { replace: true }); return }
  }, [authLoading, user, profileExists])

  // Auto-navigate to / after success
  useEffect(() => {
    if (!done) return
    const id = setTimeout(() => navigate('/'), 4000)
    return () => clearTimeout(id)
  }, [done])

  // ── Loading / redirect states ─────────────────────────────────────────────
  if (authLoading || (!!user && profileExists === null)) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)' }}>
        <div style={{ color: 'var(--color-text-muted)', fontSize: 15, fontFamily: 'DM Sans' }}>Loading…</div>
      </div>
    )
  }

  // ── Promo code validation ─────────────────────────────────────────────────
  async function handleApplyPromo() {
    const code = promoCode.trim().toUpperCase()
    if (!code) return
    setPromoStatus('checking')
    setPromoData(null)
    try {
      const { data, error } = await supabase
        .from('promo_codes')
        .select('id,code,max_uses,used_count,tier_target,registration_type,expires_at,is_active')
        .eq('code', code)
        .eq('is_active', true)
        .maybeSingle()

      if (error) { console.error('[Register] promo check error:', error); setPromoStatus('invalid'); return }
      if (!data) { setPromoStatus('invalid'); return }

      if (data.used_count >= data.max_uses) { setPromoStatus('invalid'); return }
      if (data.expires_at && new Date(data.expires_at) < new Date()) { setPromoStatus('invalid'); return }
      if (data.registration_type !== regType) { setPromoStatus('invalid'); return }

      setPromoData(data)
      setPromoStatus('valid')
    } catch (err) {
      console.error('[Register] promo check unexpected error:', err)
      setPromoStatus('invalid')
    }
  }

  // ── Debarred check ────────────────────────────────────────────────────────
  async function runDebarredCheck() {
    if (regType !== 'advisor') return true
    const entityType  = subType === 'sebi_ria' ? 'sebi_ria' : 'arn'
    const entityValue = (subType === 'sebi_ria' ? form.sebiRiaNumber : form.arnNumber).trim().toUpperCase()
    if (!entityValue) return true

    try {
      const { data } = await supabase
        .from('regulatory_debarred')
        .select('id')
        .eq('entity_type', entityType)
        .eq('entity_value', entityValue)
        .limit(1)

      return !(data && data.length > 0)
    } catch (err) {
      console.error('[Register] debarred check error:', err)
      return true
    }
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    setSubmitError('')
    setSubmitting(true)

    try {
      // 1. Debarred check
      const debarredOK = await runDebarredCheck()
      if (!debarredOK) {
        setSubmitError('We were unable to complete your registration. If you believe this is an error, please contact support.')
        setSubmitting(false)
        return
      }

      const sb = createSupabaseClient(token)

      // 2. Create profiles row (race-condition safe)
      const { data: existingProfile } = await sb
        .from('profiles')
        .select('id')
        .eq('id', user.uid)
        .maybeSingle()

      if (!existingProfile) {
        const { error: insertErr } = await sb.from('profiles').insert({
          id:        user.uid,
          email:     user.email || '',
          role:      'individual',
          plan_tier: 'free',
        })
        if (insertErr && insertErr.code !== '23505') {
          console.error('[Register] profiles INSERT error:', insertErr)
          setSubmitError('Registration failed. Please try again.')
          setSubmitting(false)
          return
        }
      }

      // 3. For advisors: create advisor_profiles row (status=pending)
      if (regType === 'advisor') {
        const apPayload = {
          user_id:               user.uid,
          registration_type:     subType,
          arn_number:            subType === 'mfd_arn' ? form.arnNumber.trim() : null,
          euin_number:           (!form.euinPending && form.euinNumber.trim()) ? form.euinNumber.trim() : null,
          euin_pending:          form.euinPending,
          sebi_ria_number:       subType === 'sebi_ria' ? form.sebiRiaNumber.trim() : null,
          applicant_name:        form.applicantName.trim(),
          firm_name:             form.firmName.trim(),
          phone:                 form.phone.trim(),
          city:                  form.city.trim() || null,
          status:                'pending',
          debarred_check_passed: true,
          debarred_check_at:     new Date().toISOString(),
          promo_code_used:       promoData ? promoCode.trim().toUpperCase() : null,
        }
        const { error: apErr } = await sb.from('advisor_profiles').insert(apPayload)
        if (apErr && apErr.code !== '23505') {
          console.error('[Register] advisor_profiles INSERT error:', apErr)
          setSubmitError('Registration failed. Please try again.')
          setSubmitting(false)
          return
        }
      }

      // 4. Notify admin (fire and forget)
      const displayName = regType === 'advisor'
        ? form.applicantName.trim()
        : form.displayName.trim() || user.email
      try {
        await fetch('/api/admin?action=notify-registration', {
          method: 'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            type:     regType === 'advisor' ? 'new_advisor_application' : 'new_investor_registration',
            message:  `New ${regType === 'advisor' ? 'Advisor' : 'Investor'} registration: ${displayName} (${user.email})`,
            metadata: {
              uid:               user.uid,
              email:             user.email,
              registration_type: regType === 'advisor' ? subType : null,
              arn_number:        subType === 'mfd_arn' ? form.arnNumber.trim() : null,
              sebi_ria_number:   subType === 'sebi_ria' ? form.sebiRiaNumber.trim() : null,
              applied_at:        new Date().toISOString(),
            },
            promoCode: promoData ? promoCode.trim().toUpperCase() : null,
          }),
        })
      } catch (notifErr) {
        console.error('[Register] admin notification error (non-fatal):', notifErr)
      }

      // 5. Refresh profile state → profileExists becomes true
      await refreshRole()

      // 6. Accept invite if coming from an invite link (PH3-S5)
      if (inviteToken) {
        try {
          const inviteRes = await fetch('/api/advisor?action=accept-invite', {
            method: 'POST',
            headers: {
              'Content-Type':  'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ invite_token: inviteToken }),
          })
          if (inviteRes.ok) {
            setInviteAccepted(true)
          } else {
            console.error('[Register] accept-invite failed (non-fatal):', await inviteRes.json().catch(() => ({})))
          }
        } catch (inviteErr) {
          console.error('[Register] accept-invite error (non-fatal):', inviteErr)
        }
      }

      setDone(true)
    } catch (err) {
      console.error('[Register] handleSubmit unexpected error:', err)
      setSubmitError('An unexpected error occurred. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Step validation ───────────────────────────────────────────────────────
  function step1Valid() { return !!regType }

  function step2Valid() {
    if (regType === 'investor') return form.displayName.trim().length > 0
    if (regType === 'advisor') {
      const commonOK = form.applicantName.trim() && form.firmName.trim() && form.phone.trim()
      if (subType === 'mfd_arn')  return !!(commonOK && form.arnNumber.trim())
      if (subType === 'sebi_ria') return !!(commonOK && form.sebiRiaNumber.trim())
    }
    return false
  }

  function canSubmit() {
    if (submitting) return false
    if (!declarations.notDebarred) return false
    if (regType === 'advisor' && !declarations.registrationCurrent) return false
    return true
  }

  // ── Success message logic ─────────────────────────────────────────────────
  function successMessage() {
    if (inviteToken && inviteAccepted) {
      return 'Registration complete — you\'re now connected with your advisor. They can view your portfolio analytics when you upload your statement.'
    }
    if (inviteToken && !inviteAccepted) {
      return 'Welcome to FundLens! Your invite link may have expired — contact your advisor for a new one.'
    }
    if (regType === 'advisor') {
      return 'Your advisor application is under review. You\'ll have full advisor access once approved — typically within 2 working days.\n\nIn the meantime, you can explore Plan and Research tools.'
    }
    return 'Welcome to FundLens! You now have access to Plan, Research, and Track tools.'
  }

  // ── Success screen ────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="reg-page">
        <style>{regStyles}</style>
        <a href="/" className="reg-logo">
          <div className="reg-logo-mark">F</div>
          <div className="reg-logo-text">Fund<span>Lens</span></div>
        </a>
        <div className="reg-wrap">
          <div className="reg-card">
            <div className="reg-success">
              <div className="reg-success-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                  <path d="M20 6L9 17l-5-5" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="reg-success-h">Registration complete!</div>
              <p className="reg-success-p">{successMessage()}</p>
              <button className="reg-success-go" onClick={() => navigate('/')}>
                Go to FundLens
              </button>
            </div>
          </div>
          <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--color-text-muted)', marginTop: 8 }}>
            Redirecting automatically in a few seconds…
          </p>
        </div>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="reg-page">
      <style>{regStyles}</style>

      <a href="/" className="reg-logo" style={{ maxWidth: 600, width: '100%' }}>
        <div className="reg-logo-mark">F</div>
        <div className="reg-logo-text">Fund<span>Lens</span></div>
      </a>

      <div className="reg-wrap">
        {/* Invite banner */}
        {inviteToken && (
          <div className="reg-invite-banner">
            <span>🔗</span>
            You were invited by an advisor — complete registration to connect automatically.
          </div>
        )}

        <StepIndicator current={step} />

        <div className="reg-card">

          {/* ── STEP 1: Choose path ─────────────────────────────────────── */}
          {step === 1 && (
            <>
              <div className="reg-h1">Welcome! Choose your path</div>
              <div className="reg-sub">Tell us how you'll be using FundLens.</div>
              <div className="path-cards">
                <div
                  className={`path-card${regType === 'investor' ? ' selected' : ''}`}
                  onClick={() => setRegType('investor')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && setRegType('investor')}
                >
                  <div className="path-card-icon">👤</div>
                  <div className="path-card-title">Investor</div>
                  <div className="path-card-desc">Access Plan, Research and Track tools for your own portfolio.</div>
                </div>
                <div
                  className={`path-card${regType === 'advisor' ? ' selected' : ''}`}
                  onClick={() => setRegType('advisor')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && setRegType('advisor')}
                >
                  <div className="path-card-icon">📊</div>
                  <div className="path-card-title">Advisor / Distributor</div>
                  <div className="path-card-desc">MFD/IFD or SEBI RIA — multi-client tools, white-label reports, Promote module.</div>
                </div>
              </div>
            </>
          )}

          {/* ── STEP 2: Details ─────────────────────────────────────────── */}
          {step === 2 && regType === 'investor' && (
            <>
              <div className="reg-h1">Your details</div>
              <div className="reg-sub">Just your name to get started.</div>
              <div className="reg-field">
                <label className="reg-label" htmlFor="displayName">
                  Your name <span className="req">*</span>
                </label>
                <input
                  id="displayName"
                  className="reg-input"
                  type="text"
                  placeholder="Ramesh Kumar"
                  value={form.displayName}
                  onChange={e => setField('displayName', e.target.value)}
                  autoFocus
                />
              </div>
              <div className="reg-tier-note">
                You'll join as an Individual plan. Upgrade anytime from your dashboard.
              </div>
            </>
          )}

          {step === 2 && regType === 'advisor' && (
            <>
              <div className="reg-h1">Your registration details</div>
              <div className="reg-sub">Tell us about your practice so we can set up your advisor account.</div>

              <div className="reg-field">
                <label className="reg-label">Registration type <span className="req">*</span></label>
                <div className="subtype-row">
                  <button
                    className={`subtype-btn${subType === 'mfd_arn' ? ' active' : ''}`}
                    onClick={() => setSubType('mfd_arn')}
                    type="button"
                  >
                    MFD / IFD (ARN holder)
                  </button>
                  <button
                    className={`subtype-btn${subType === 'sebi_ria' ? ' active' : ''}`}
                    onClick={() => setSubType('sebi_ria')}
                    type="button"
                  >
                    SEBI Registered IA
                  </button>
                </div>
              </div>

              {subType === 'mfd_arn' && (
                <>
                  <div className="reg-field">
                    <label className="reg-label" htmlFor="arnNumber">
                      ARN Number <span className="req">*</span>
                    </label>
                    <input
                      id="arnNumber"
                      className="reg-input"
                      type="text"
                      placeholder="ARN-12345"
                      value={form.arnNumber}
                      onChange={e => setField('arnNumber', e.target.value.toUpperCase())}
                      autoFocus
                    />
                    <div className="reg-hint">Format: ARN-followed by digits (e.g. ARN-12345)</div>
                  </div>
                  <div className="reg-field">
                    <label className="reg-label" htmlFor="euinNumber">EUIN Number (optional)</label>
                    {!form.euinPending && (
                      <input
                        id="euinNumber"
                        className="reg-input"
                        type="text"
                        placeholder="E123456"
                        value={form.euinNumber}
                        onChange={e => setField('euinNumber', e.target.value.toUpperCase())}
                        disabled={form.euinPending}
                      />
                    )}
                    <div style={{ marginTop: 6 }} className="reg-check">
                      <input
                        type="checkbox"
                        id="euinPending"
                        checked={form.euinPending}
                        onChange={e => setField('euinPending', e.target.checked)}
                      />
                      <label className="reg-check-label" htmlFor="euinPending">
                        EUIN not yet assigned
                      </label>
                    </div>
                    <div className="reg-hint">Required for transaction enablement. You can add this later in Advisor Settings.</div>
                  </div>
                </>
              )}

              {subType === 'sebi_ria' && (
                <div className="reg-field">
                  <label className="reg-label" htmlFor="sebiRiaNumber">
                    SEBI Registration Number <span className="req">*</span>
                  </label>
                  <input
                    id="sebiRiaNumber"
                    className="reg-input"
                    type="text"
                    placeholder="INA000XXXXXX"
                    value={form.sebiRiaNumber}
                    onChange={e => setField('sebiRiaNumber', e.target.value.toUpperCase())}
                    autoFocus
                  />
                </div>
              )}

              <div className="reg-field">
                <label className="reg-label" htmlFor="firmName">
                  Firm / Practice Name <span className="req">*</span>
                </label>
                <input
                  id="firmName"
                  className="reg-input"
                  type="text"
                  placeholder="Sharma Wealth Management"
                  value={form.firmName}
                  onChange={e => setField('firmName', e.target.value)}
                />
              </div>
              <div className="reg-field">
                <label className="reg-label" htmlFor="applicantName">
                  Applicant Full Name <span className="req">*</span>
                </label>
                <input
                  id="applicantName"
                  className="reg-input"
                  type="text"
                  placeholder="Rajesh Sharma"
                  value={form.applicantName}
                  onChange={e => setField('applicantName', e.target.value)}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14 }}>
                <div className="reg-field" style={{ marginBottom: 0 }}>
                  <label className="reg-label" htmlFor="phone">
                    Phone <span className="req">*</span>
                  </label>
                  <input
                    id="phone"
                    className="reg-input"
                    type="tel"
                    placeholder="9876543210"
                    value={form.phone}
                    onChange={e => setField('phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                  />
                </div>
                <div className="reg-field" style={{ marginBottom: 0 }}>
                  <label className="reg-label" htmlFor="city">City (optional)</label>
                  <input
                    id="city"
                    className="reg-input"
                    type="text"
                    placeholder="Mumbai"
                    value={form.city}
                    onChange={e => setField('city', e.target.value)}
                  />
                </div>
              </div>
              <div className="reg-tier-note" style={{ marginTop: 18 }}>
                You will join as {subType === 'sebi_ria' ? 'RIA' : 'MFD'} Base tier. Upgrade anytime from your dashboard.
                Full advisor access is granted after your application is reviewed (typically 2 working days).
              </div>
            </>
          )}

          {/* ── STEP 3: Promo code ──────────────────────────────────────── */}
          {step === 3 && (
            <>
              <div className="reg-h1">Discount code</div>
              <div className="reg-sub">Have a promo code? Enter it here. This is completely optional.</div>
              <div className="reg-field">
                <label className="reg-label" htmlFor="promoCode">Promo code (optional)</label>
                <div className="promo-row">
                  <input
                    id="promoCode"
                    className="reg-input"
                    type="text"
                    placeholder="WELCOME2026"
                    value={promoCode}
                    onChange={e => {
                      setPromoCode(e.target.value.toUpperCase())
                      setPromoStatus(null)
                      setPromoData(null)
                    }}
                  />
                  <button
                    className="promo-apply-btn"
                    onClick={handleApplyPromo}
                    disabled={!promoCode.trim() || promoStatus === 'checking'}
                    type="button"
                  >
                    {promoStatus === 'checking' ? 'Checking…' : 'Apply'}
                  </button>
                </div>
                {promoStatus === 'valid' && (
                  <div className="promo-valid">✓ Code applied — your discount has been noted.</div>
                )}
                {promoStatus === 'invalid' && (
                  <div className="promo-invalid">
                    Code not valid or already used. Continue without a code, or try a different one.
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── STEP 4: Declaration & submit ────────────────────────────── */}
          {step === 4 && (
            <>
              <div className="reg-h1">Review & confirm</div>
              <div className="reg-sub">Please review your details and confirm the declaration below.</div>

              <div style={{ marginBottom: 24 }}>
                <div className="review-row">
                  <span className="review-key">Registration type</span>
                  <span className="review-val">
                    {regType === 'investor'
                      ? 'Investor'
                      : subType === 'sebi_ria' ? 'SEBI Registered IA' : 'MFD / IFD (ARN holder)'}
                  </span>
                </div>
                {regType === 'investor' && (
                  <div className="review-row">
                    <span className="review-key">Name</span>
                    <span className="review-val">{form.displayName || user?.displayName || '—'}</span>
                  </div>
                )}
                {regType === 'advisor' && (
                  <>
                    <div className="review-row">
                      <span className="review-key">Applicant name</span>
                      <span className="review-val">{form.applicantName || '—'}</span>
                    </div>
                    <div className="review-row">
                      <span className="review-key">Firm name</span>
                      <span className="review-val">{form.firmName || '—'}</span>
                    </div>
                    {subType === 'mfd_arn' && (
                      <div className="review-row">
                        <span className="review-key">ARN Number</span>
                        <span className="review-val">{form.arnNumber || '—'}</span>
                      </div>
                    )}
                    {subType === 'sebi_ria' && (
                      <div className="review-row">
                        <span className="review-key">SEBI RIA Number</span>
                        <span className="review-val">{form.sebiRiaNumber || '—'}</span>
                      </div>
                    )}
                    <div className="review-row">
                      <span className="review-key">Phone</span>
                      <span className="review-val">{form.phone || '—'}</span>
                    </div>
                    {form.city && (
                      <div className="review-row">
                        <span className="review-key">City</span>
                        <span className="review-val">{form.city}</span>
                      </div>
                    )}
                  </>
                )}
                <div className="review-row">
                  <span className="review-key">Email</span>
                  <span className="review-val">{user?.email || '—'}</span>
                </div>
                {promoData && (
                  <div className="review-row">
                    <span className="review-key">Promo code</span>
                    <span className="review-val" style={{ color: 'var(--color-primary)' }}>
                      {promoCode.trim().toUpperCase()} ✓
                    </span>
                  </div>
                )}
                {inviteToken && (
                  <div className="review-row">
                    <span className="review-key">Invite</span>
                    <span className="review-val" style={{ color: 'var(--color-primary)' }}>
                      🔗 Advisor invite active
                    </span>
                  </div>
                )}
              </div>

              <div style={{ marginBottom: 20 }}>
                <div className="reg-check">
                  <input
                    type="checkbox"
                    id="decl-debarred"
                    checked={declarations.notDebarred}
                    onChange={e => setDeclarations(p => ({ ...p, notDebarred: e.target.checked }))}
                  />
                  <label className="reg-check-label" htmlFor="decl-debarred">
                    I confirm that I am not debarred, suspended, or under any regulatory prohibition by SEBI or AMFI,
                    and that all information provided is accurate.
                  </label>
                </div>
                {regType === 'advisor' && (
                  <div className="reg-check">
                    <input
                      type="checkbox"
                      id="decl-registration"
                      checked={declarations.registrationCurrent}
                      onChange={e => setDeclarations(p => ({ ...p, registrationCurrent: e.target.checked }))}
                    />
                    <label className="reg-check-label" htmlFor="decl-registration">
                      I confirm my ARN / SEBI registration is current and in good standing.
                    </label>
                  </div>
                )}
              </div>

              {submitError && <div className="reg-error">{submitError}</div>}
            </>
          )}

        </div>

        {/* Button row */}
        <div className="reg-btn-row">
          {step > 1 && (
            <button
              className="reg-back-btn"
              onClick={() => { setSubmitError(''); setStep(s => s - 1) }}
              disabled={submitting}
            >
              Back
            </button>
          )}
          {step < 4 && (
            <button
              className="reg-next-btn"
              disabled={step === 1 ? !step1Valid() : step === 2 ? !step2Valid() : false}
              onClick={() => {
                if (step === 1 && !step1Valid()) return
                if (step === 2 && !step2Valid()) return
                setStep(s => s + 1)
              }}
            >
              {step === 3 ? (promoData ? 'Continue with code' : 'Skip, continue →') : 'Continue →'}
            </button>
          )}
          {step === 4 && (
            <button
              className="reg-next-btn"
              disabled={!canSubmit()}
              onClick={handleSubmit}
            >
              {submitting ? 'Submitting…' : 'Complete Registration'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
