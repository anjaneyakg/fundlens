// src/pages/advisor/AdvisorDashboard.jsx
// PH3-S1 — Multi-client advisor dashboard
// Route: /advisor/clients

import { useState, useEffect, useRef, useCallback } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useRole } from '../../hooks/useRole'
import useWindowWidth from '../../hooks/useWindowWidth'
import { createSupabaseClient } from '../../lib/supabaseClient'

// ── HELPERS ───────────────────────────────────────────────────────────────────

function fmtDate(s) {
  if (!s) return '—'
  const d = new Date(s.includes('T') ? s : s + 'T00:00:00')
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function generateToken() {
  const arr = new Uint8Array(16)
  crypto.getRandomValues(arr)
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
}

function getInitials(label) {
  if (!label) return '?'
  const parts = label.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return parts[0].slice(0, 2).toUpperCase()
}

function openMailto(email, token) {
  const subject = encodeURIComponent("You've been invited to FundLens")
  const bodyText = [
    'Your advisor has invited you to view your portfolio on FundLens.',
    '',
    `Click here to register: https://fundlens.in/register?invite=${token}`,
  ].join('\n')
  window.open(`mailto:${email}?subject=${subject}&body=${encodeURIComponent(bodyText)}`)
}

// ── STAT TILE ─────────────────────────────────────────────────────────────────

function StatTile({ label, value }) {
  return (
    <div style={{
      flex: 1,
      background: '#f8faff',
      border: '1px solid #e8ecf0',
      borderRadius: 12,
      padding: 16,
      textAlign: 'center',
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <div style={{ fontSize: 28, fontWeight: 700, color: '#1A3C6E', lineHeight: 1.1 }}>
        {value}
      </div>
      <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
        {label}
      </div>
    </div>
  )
}

// ── AVATAR ────────────────────────────────────────────────────────────────────

function Avatar({ label }) {
  return (
    <div style={{
      width: 40, height: 40, borderRadius: '50%',
      background: '#1A3C6E', color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 15, fontWeight: 700, flexShrink: 0,
      fontFamily: "'DM Sans', sans-serif",
    }}>
      {getInitials(label)}
    </div>
  )
}

// ── ACTION MENU (⋮) ───────────────────────────────────────────────────────────

function ActionMenu({ onEdit, onRevoke, onViewInvite, onClose }) {
  const ref = useRef(null)

  useEffect(() => {
    function h(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [onClose])

  const itemBase = {
    display: 'block', width: '100%', textAlign: 'left',
    padding: '9px 14px', background: 'none', border: 'none',
    fontSize: 13, cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
    borderRadius: 6,
  }

  return (
    <div ref={ref} style={{
      position: 'absolute', right: 0, top: 36, zIndex: 300,
      background: '#fff', border: '1px solid #e8ecf0',
      borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
      padding: 6, minWidth: 190,
    }}>
      {[
        { label: 'Edit label / notes', action: onEdit, color: '#1a1a2a', hover: '#f8faff' },
        { label: 'View invite details', action: onViewInvite, color: '#1a1a2a', hover: '#f8faff' },
        { label: 'Revoke access', action: onRevoke, color: '#dc2626', hover: '#fff5f5' },
      ].map(({ label, action, color, hover }) => (
        <button
          key={label}
          style={{ ...itemBase, color }}
          onMouseEnter={e => { e.currentTarget.style.background = hover }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
          onClick={() => { action(); onClose() }}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

// ── CONFIRM MODAL ─────────────────────────────────────────────────────────────

function ConfirmModal({ title, message, confirmLabel, danger, onConfirm, onCancel }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 600,
        background: 'rgba(15,23,42,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '0 20px',
      }}
      onClick={onCancel}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 14,
          padding: '28px 28px 24px', maxWidth: 380, width: '100%',
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        <h3 style={{ margin: '0 0 10px', fontSize: 17, fontWeight: 700, color: '#1a1a2a' }}>
          {title}
        </h3>
        <p style={{ margin: '0 0 24px', fontSize: 14, color: '#64748b', lineHeight: 1.6 }}>
          {message}
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 18px', borderRadius: 8,
              border: '1px solid #e8ecf0', background: '#fff',
              fontSize: 13, cursor: 'pointer',
              fontFamily: "'DM Sans', sans-serif",
            }}
          >Cancel</button>
          <button
            onClick={onConfirm}
            style={{
              padding: '8px 18px', borderRadius: 8, border: 'none',
              background: danger ? '#dc2626' : '#1A3C6E',
              color: '#fff', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
            }}
          >{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}

// ── EDIT MODAL ────────────────────────────────────────────────────────────────

function EditModal({ client, token, onClose, onRefresh }) {
  const [label, setLabel] = useState(client.client_label || '')
  const [notes, setNotes] = useState(client.advisor_notes || '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const sb = createSupabaseClient(token)
      const { error } = await sb
        .from('advisor_client_links')
        .update({ client_label: label.trim() || null, advisor_notes: notes.trim() || null })
        .eq('id', client.id)
      if (error) {
        console.error('[EditModal] update error:', error)
        return
      }
      onClose()
      onRefresh()
    } catch (err) {
      console.error('[EditModal] save error:', err)
    } finally {
      setSaving(false)
    }
  }

  const inputStyle = {
    width: '100%', padding: '9px 12px', borderRadius: 8,
    border: '1px solid #e8ecf0', fontSize: 14,
    fontFamily: "'DM Sans', sans-serif", boxSizing: 'border-box',
    outline: 'none', color: '#1a1a2a',
  }
  const labelStyle = { fontSize: 13, fontWeight: 600, color: '#1a1a2a', display: 'block', marginBottom: 6 }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 600,
        background: 'rgba(15,23,42,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '0 20px',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 14, padding: 28,
          maxWidth: 400, width: '100%',
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        <h3 style={{ margin: '0 0 20px', fontSize: 17, fontWeight: 700, color: '#1A3C6E' }}>
          Edit Client
        </h3>
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Label</label>
          <input
            type="text"
            value={label}
            onChange={e => setLabel(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Notes</label>
          <textarea
            rows={3}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 18px', borderRadius: 8,
              border: '1px solid #e8ecf0', background: '#fff',
              fontSize: 13, cursor: 'pointer',
            }}
          >Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '8px 18px', borderRadius: 8, border: 'none',
              background: '#1A3C6E', color: '#fff',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              opacity: saving ? 0.7 : 1,
            }}
          >{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  )
}

// ── CLIENT CARD ───────────────────────────────────────────────────────────────

function ClientCard({ client, token, onRefresh }) {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen]         = useState(false)
  const [confirmRevoke, setConfirmRevoke] = useState(false)
  const [editOpen, setEditOpen]         = useState(false)

  const { id, status, client_label, client_id, invite_sent_at, invite_token } = client
  const name = client_label || 'Unnamed Client'

  async function handleResendInvite() {
    try {
      const sb = createSupabaseClient(token)
      const { error } = await sb
        .from('advisor_client_links')
        .update({ invite_sent_at: new Date().toISOString() })
        .eq('id', id)
      if (error) console.error('[ClientCard] resend update error:', error)
    } catch (err) {
      console.error('[ClientCard] resend invite error:', err)
    }
    if (invite_token) openMailto('', invite_token)
    onRefresh()
  }

  async function handleCancelInvite() {
    try {
      const sb = createSupabaseClient(token)
      const { error } = await sb
        .from('advisor_client_links')
        .update({ status: 'placeholder', invite_token: null, invite_sent_at: null, invite_expires_at: null })
        .eq('id', id)
      if (error) console.error('[ClientCard] cancel invite error:', error)
    } catch (err) {
      console.error('[ClientCard] cancel invite error:', err)
    }
    onRefresh()
  }

  async function handleSendInvite() {
    try {
      const sb = createSupabaseClient(token)
      const tok = generateToken()
      const now = new Date().toISOString()
      const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      const { error } = await sb
        .from('advisor_client_links')
        .update({ status: 'invited', invite_token: tok, invite_sent_at: now, invite_expires_at: expires })
        .eq('id', id)
      if (error) { console.error('[ClientCard] send invite error:', error); return }
      openMailto('', tok)
    } catch (err) {
      console.error('[ClientCard] send invite error:', err)
    }
    onRefresh()
  }

  async function handleRevoke() {
    try {
      const sb = createSupabaseClient(token)
      const { error } = await sb
        .from('advisor_client_links')
        .update({ status: 'declined' })
        .eq('id', id)
      if (error) console.error('[ClientCard] revoke error:', error)
    } catch (err) {
      console.error('[ClientCard] revoke error:', err)
    }
    setConfirmRevoke(false)
    onRefresh()
  }

  async function handleRemove() {
    try {
      const sb = createSupabaseClient(token)
      const { error } = await sb
        .from('advisor_client_links')
        .delete()
        .eq('id', id)
      if (error) console.error('[ClientCard] remove error:', error)
    } catch (err) {
      console.error('[ClientCard] remove error:', err)
    }
    onRefresh()
  }

  const btn = (label, onClick, bg, color) => (
    <button
      onClick={onClick}
      style={{
        background: bg, color,
        border: 'none', borderRadius: 6, padding: '6px 14px',
        fontSize: 13, fontWeight: 600, cursor: 'pointer',
        fontFamily: "'DM Sans', sans-serif", whiteSpace: 'nowrap',
      }}
    >{label}</button>
  )

  return (
    <>
      <div style={{
        background: '#fff',
        border: '1px solid #e8ecf0',
        borderRadius: 12,
        padding: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        opacity: status === 'invited' ? 0.85 : 1,
        fontFamily: "'DM Sans', sans-serif",
      }}>
        <Avatar label={name} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: '#1a1a2a' }}>{name}</span>
            {status === 'active' && (
              <span style={{
                fontSize: 11, padding: '2px 8px', borderRadius: 20,
                background: '#dcfce7', color: '#16a34a', fontWeight: 600,
              }}>Active</span>
            )}
            {status === 'declined' && (
              <span style={{
                fontSize: 11, padding: '2px 8px', borderRadius: 20,
                background: '#fee2e2', color: '#dc2626', fontWeight: 600,
              }}>Declined</span>
            )}
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
            {status === 'invited'     && <span style={{ color: '#d97706' }}>Invite sent {fmtDate(invite_sent_at)}</span>}
            {status === 'placeholder' && 'Not yet registered'}
            {status === 'pending'     && 'Awaiting confirmation'}
            {status === 'declined'    && 'Access declined'}
            {status === 'active'      && (client_id ? `ID …${client_id.slice(-8)}` : '—')}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
          {status === 'active' && (
            <>
              {btn('View Portfolio', () => navigate(`/portfolio/${client_id}`), '#f0f4ff', '#1A3C6E')}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setMenuOpen(o => !o)}
                  style={{
                    background: 'none', border: '1px solid #e8ecf0', borderRadius: 6,
                    width: 32, height: 32, cursor: 'pointer', fontSize: 18,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#94a3b8',
                  }}
                >⋮</button>
                {menuOpen && (
                  <ActionMenu
                    onEdit={() => setEditOpen(true)}
                    onRevoke={() => setConfirmRevoke(true)}
                    onViewInvite={() => {}}
                    onClose={() => setMenuOpen(false)}
                  />
                )}
              </div>
            </>
          )}

          {status === 'invited' && (
            <>
              {btn('Resend Invite', handleResendInvite, '#fffbeb', '#d97706')}
              {btn('Cancel Invite', handleCancelInvite, '#fff5f5', '#dc2626')}
            </>
          )}

          {status === 'placeholder' && btn('Send Invite', handleSendInvite, '#1A3C6E', '#fff')}

          {status === 'pending' && (
            <span style={{ fontSize: 12, color: '#94a3b8' }}>Pending</span>
          )}

          {status === 'declined' && btn('Remove', handleRemove, '#fff5f5', '#dc2626')}
        </div>
      </div>

      {confirmRevoke && (
        <ConfirmModal
          title="Revoke access?"
          message={`${name} will no longer be linked to your advisor account.`}
          confirmLabel="Revoke"
          danger
          onConfirm={handleRevoke}
          onCancel={() => setConfirmRevoke(false)}
        />
      )}

      {editOpen && (
        <EditModal
          client={client}
          token={token}
          onClose={() => setEditOpen(false)}
          onRefresh={onRefresh}
        />
      )}
    </>
  )
}

// ── ADD CLIENT SHEET ──────────────────────────────────────────────────────────

function AddClientSheet({ open, onClose, onSave, saving }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', notes: '' })

  useEffect(() => {
    if (!open) setForm({ name: '', email: '', phone: '', notes: '' })
  }, [open])

  if (!open) return null

  const inputStyle = {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: '1px solid #e8ecf0', fontSize: 14,
    fontFamily: "'DM Sans', sans-serif",
    boxSizing: 'border-box', outline: 'none', color: '#1a1a2a',
  }
  const labelStyle = {
    fontSize: 13, fontWeight: 600, color: '#1a1a2a',
    display: 'block', marginBottom: 6,
  }

  const canAdd    = !saving && form.name.trim()
  const canInvite = canAdd && form.email.trim()

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 500,
          background: 'rgba(15,23,42,0.35)',
        }}
      />
      <div style={{
        position: 'fixed', bottom: 0, left: '50%',
        transform: 'translateX(-50%)',
        width: '100%', maxWidth: 600,
        zIndex: 501,
        background: '#fff',
        borderRadius: '16px 16px 0 0',
        padding: '24px 20px 40px',
        boxShadow: '0 -8px 32px rgba(0,0,0,0.12)',
        fontFamily: "'DM Sans', sans-serif",
        boxSizing: 'border-box',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1A3C6E' }}>Add Client</h2>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, border: '1px solid #e8ecf0',
              borderRadius: 8, background: '#fff', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, color: '#64748b',
            }}
          >✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>Client name / label *</label>
            <input
              type="text"
              placeholder="e.g. Rajesh Kumar"
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Email address *</label>
            <input
              type="email"
              placeholder="client@email.com"
              value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Phone (optional)</label>
            <input
              type="tel"
              placeholder="+91 98765 43210"
              value={form.phone}
              onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Notes (optional)</label>
            <textarea
              rows={2}
              placeholder="Any notes about this client…"
              value={form.notes}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
          <button
            onClick={() => onSave(form, false)}
            disabled={!canAdd}
            style={{
              flex: 1, minWidth: 140, padding: '11px 20px',
              background: '#1A3C6E', color: '#fff',
              border: 'none', borderRadius: 8,
              fontSize: 14, fontWeight: 600, cursor: canAdd ? 'pointer' : 'default',
              fontFamily: "'DM Sans', sans-serif",
              opacity: canAdd ? 1 : 0.55,
            }}
          >{saving ? 'Adding…' : 'Add Client'}</button>
          <button
            onClick={() => onSave(form, true)}
            disabled={!canInvite}
            style={{
              flex: 1, minWidth: 160, padding: '11px 20px',
              background: '#fff', color: '#1A3C6E',
              border: '1.5px solid #1A3C6E', borderRadius: 8,
              fontSize: 14, fontWeight: 600, cursor: canInvite ? 'pointer' : 'default',
              fontFamily: "'DM Sans', sans-serif",
              opacity: canInvite ? 1 : 0.55,
            }}
          >{saving ? 'Sending…' : 'Send Invite Instead'}</button>
        </div>
      </div>
    </>
  )
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────

export default function AdvisorClients() {
  const { user, token, loading: authLoading } = useAuth()
  const { isAdvisor, isAdmin } = useRole()
  const width = useWindowWidth()
  const isMobile = width <= 768

  const [clients, setClients]           = useState([])
  const [loadingClients, setLoadingClients] = useState(true)
  const [sheetOpen, setSheetOpen]       = useState(false)
  const [toast, setToast]               = useState(null)
  const [saving, setSaving]             = useState(false)

  const loadClients = useCallback(async () => {
    if (!user || !token) return
    try {
      const sb = createSupabaseClient(token)
      const { data, error } = await sb
        .from('advisor_client_links')
        .select('*')
        .eq('advisor_id', user.uid)
        .order('created_at', { ascending: false })
      if (error) { console.error('[AdvisorClients] load error:', error); return }
      setClients(data || [])
    } catch (err) {
      console.error('[AdvisorClients] load failed:', err)
    } finally {
      setLoadingClients(false)
    }
  }, [user, token])

  useEffect(() => {
    if (user && token) loadClients()
  }, [user, token, loadClients])

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  async function handleAddClient(form, sendInvite) {
    setSaving(true)
    try {
      const sb = createSupabaseClient(token)
      const tok = sendInvite ? generateToken() : null
      const now = new Date().toISOString()
      const expires = sendInvite
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        : null

      const payload = {
        advisor_id:        user.uid,
        client_label:      form.name.trim(),
        advisor_notes:     form.notes.trim() || null,
        status:            sendInvite ? 'invited' : 'placeholder',
        can_view_portfolio: true,
        can_view_health:   true,
        created_at:        now,
      }
      if (tok) {
        payload.invite_token    = tok
        payload.invite_sent_at  = now
        payload.invite_expires_at = expires
      }

      const { error } = await sb.from('advisor_client_links').insert(payload)
      if (error) { console.error('[AdvisorClients] insert error:', error); return }

      if (sendInvite && tok && form.email.trim()) {
        openMailto(form.email.trim(), tok)
      }

      showToast(`✓ ${form.name.trim()} added as client`)
      setSheetOpen(false)
      await loadClients()
    } catch (err) {
      console.error('[AdvisorClients] addClient error:', err)
    } finally {
      setSaving(false)
    }
  }

  // ── Auth gates ────────────────────────────────────────────────────────────────

  if (authLoading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '60vh', fontFamily: "'DM Sans', sans-serif",
      }}>
        <span style={{ color: '#94a3b8', fontSize: 15 }}>Loading…</span>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  if (!isAdvisor && !isAdmin) {
    return (
      <>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');`}</style>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          minHeight: '60vh', padding: 20, background: '#f8f9fa',
          fontFamily: "'DM Sans', sans-serif",
        }}>
          <div style={{
            background: '#fff',
            border: '2px solid #1A3C6E',
            borderRadius: 16,
            padding: '40px 32px',
            maxWidth: 420,
            textAlign: 'center',
          }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1A3C6E', margin: '0 0 12px' }}>
              Advisor Dashboard
            </h2>
            <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6, margin: '0 0 8px' }}>
              This feature is available for Advisor accounts.
            </p>
            <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6, margin: '0 0 28px' }}>
              Apply for advisor access to manage multiple clients, share branded reports, and use the Promote module.
            </p>
            <a
              href="/advisor/apply"
              style={{
                display: 'inline-flex', alignItems: 'center',
                padding: '10px 24px',
                background: '#1A3C6E', color: '#fff',
                borderRadius: 10, textDecoration: 'none',
                fontWeight: 600, fontSize: 14,
              }}
            >Apply for Advisor Access</a>
          </div>
        </div>
      </>
    )
  }

  const total   = clients.length
  const active  = clients.filter(c => c.status === 'active').length
  const pending = clients.filter(c => c.status === 'invited' || c.status === 'pending').length

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');`}</style>

      <div style={{
        maxWidth: 1100,
        margin: '0 auto',
        padding: isMobile ? '20px 16px 60px' : '32px 28px 56px',
        fontFamily: "'DM Sans', sans-serif",
        minHeight: '100vh',
        background: '#f8f9fa',
        boxSizing: 'border-box',
      }}>

        {/* ── Header ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 20, gap: 12,
        }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1A3C6E', margin: 0 }}>
            My Clients
          </h1>
          <button
            onClick={() => setSheetOpen(true)}
            style={{
              background: '#1A3C6E', color: '#fff',
              border: 'none', borderRadius: 8,
              padding: '10px 20px', fontSize: 14, fontWeight: 600,
              cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
              whiteSpace: 'nowrap',
            }}
          >+ Add Client</button>
        </div>

        {/* ── Summary strip ── */}
        <div style={{
          display: 'flex', gap: 12, marginBottom: 24,
          flexDirection: isMobile ? 'column' : 'row',
        }}>
          <StatTile label="Total Clients"  value={total} />
          <StatTile label="Active"         value={active} />
          <StatTile label="Pending Invites" value={pending} />
        </div>

        {/* ── Client list ── */}
        {loadingClients ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#94a3b8', fontSize: 14 }}>
            Loading clients…
          </div>
        ) : clients.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '64px 20px',
            background: '#fff', border: '1px solid #e8ecf0', borderRadius: 16,
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>👥</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#1a1a2a', marginBottom: 8 }}>
              No clients yet
            </div>
            <div style={{ fontSize: 14, color: '#94a3b8', marginBottom: 24 }}>
              Add your first client to get started.
            </div>
            <button
              onClick={() => setSheetOpen(true)}
              style={{
                background: '#1A3C6E', color: '#fff',
                border: 'none', borderRadius: 8,
                padding: '10px 24px', fontSize: 14, fontWeight: 600,
                cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
              }}
            >+ Add First Client</button>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
            gap: 12,
          }}>
            {clients.map(c => (
              <ClientCard
                key={c.id}
                client={c}
                token={token}
                onRefresh={loadClients}
              />
            ))}
          </div>
        )}
      </div>

      <AddClientSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSave={handleAddClient}
        saving={saving}
      />

      {toast && (
        <div style={{
          position: 'fixed', bottom: 28, left: '50%',
          transform: 'translateX(-50%)',
          background: '#1A3C6E', color: '#fff',
          padding: '12px 24px', borderRadius: 10,
          fontSize: 14, fontWeight: 600,
          boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
          zIndex: 700,
          fontFamily: "'DM Sans', sans-serif",
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
        }}>{toast}</div>
      )}
    </>
  )
}
