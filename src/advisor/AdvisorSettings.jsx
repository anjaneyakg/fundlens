// src/advisor/AdvisorSettings.jsx
// PH3-S2 — Advisor Settings · Branding tab
// Route: /advisor/settings  (ProtectedRoute requiredRole="advisor")

import { useState, useEffect, useRef, useCallback } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useRole } from '../hooks/useRole'
import useWindowWidth from '../hooks/useWindowWidth'
import { createSupabaseClient } from '../lib/supabaseClient'

// ── CONSTANTS ─────────────────────────────────────────────────────────────────

const TABS = ['Profile', 'Branding', 'Notifications', 'Billing']
const STORAGE_BUCKET = 'advisor-logos'
const DEFAULT_COLOUR = '#1A3C6E'
const DEFAULT_FONT   = 'DM Sans'

const BRAND_FONTS = [
  'DM Sans', 'Inter', 'Lato', 'Lexend', 'Libre Baskerville', 'Manrope',
  'Merriweather', 'Montserrat', 'Open Sans', 'Playfair Display', 'Poppins',
  'Public Sans', 'Raleway', 'Roboto', 'Source Sans Pro', 'Crimson Text',
]

const REG_TYPES = [
  { value: 'ARN',       label: 'ARN' },
  { value: 'RIA',       label: 'RIA' },
  { value: 'SEBI_CORP', label: 'SEBI Corp' },
  { value: 'GST',       label: 'GST' },
  { value: 'CIN',       label: 'CIN' },
  { value: 'OTHER',     label: 'Other' },
]

// Google Fonts @import — all 16 brand fonts in one request
const FONTS_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Crimson+Text:wght@400;600;700&family=DM+Sans:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=Lato:wght@400;700&family=Lexend:wght@400;500;600;700&family=Libre+Baskerville:wght@400;700&family=Manrope:wght@400;500;600;700&family=Merriweather:wght@400;700&family=Montserrat:wght@400;500;600;700&family=Open+Sans:wght@400;600;700&family=Playfair+Display:wght@400;600;700&family=Poppins:wght@400;500;600;700&family=Public+Sans:wght@400;500;600;700&family=Raleway:wght@400;500;600;700&family=Roboto:wght@400;500;700&family=Source+Sans+3:wght@400;600;700&display=swap');`

// CSS family name for Google Fonts (Source Sans Pro → Source Sans 3 in the API)
function cssFontFamily(font) {
  if (font === 'Source Sans Pro') return "'Source Sans 3', sans-serif"
  return `'${font}', sans-serif`
}

// ── HELPERS ───────────────────────────────────────────────────────────────────

function fmtDate(s) {
  if (!s) return '—'
  const d = new Date(s.includes('T') ? s : s + 'T00:00:00')
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function getExpiryStatus(dateStr) {
  if (!dateStr) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expiry = new Date(dateStr + 'T00:00:00')
  if (isNaN(expiry.getTime())) return null
  const msPerDay = 1000 * 60 * 60 * 24
  const daysUntil = Math.floor((expiry - today) / msPerDay)
  if (daysUntil < 0) return { status: 'expired', daysUntil }
  if (daysUntil <= 90) return { status: 'expiring', daysUntil }
  return null
}

function fileExtension(file) {
  return (file.name.split('.').pop() || 'jpg').toLowerCase()
}

function nowTimestamp() {
  const n = new Date()
  const p = v => String(v).padStart(2, '0')
  return `${n.getFullYear()}-${p(n.getMonth()+1)}-${p(n.getDate())}T${p(n.getHours())}:${p(n.getMinutes())}:${p(n.getSeconds())}Z`
}

function emptyRegistration() {
  return { type: 'ARN', number: '', display_label: '', expiry_date: '' }
}

// ── SUB-COMPONENTS ────────────────────────────────────────────────────────────

function FormSection({ title, children, last }) {
  return (
    <div style={{ marginBottom: last ? 0 : 28 }}>
      <div style={{
        fontSize: 12, fontWeight: 700, letterSpacing: '0.08em',
        textTransform: 'uppercase', color: 'var(--color-text-muted)',
        marginBottom: 14, paddingBottom: 6,
        borderBottom: '1px solid var(--color-border)',
      }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function FieldRow({ label, sub, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{
        display: 'block', fontSize: 13, fontWeight: 600,
        color: 'var(--color-text-primary)', marginBottom: 5,
      }}>
        {label}
        {sub && <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--color-text-muted)', marginLeft: 6 }}>{sub}</span>}
      </label>
      {children}
    </div>
  )
}

const inputStyle = {
  width: '100%', padding: '8px 11px', fontSize: 13,
  border: '1px solid var(--color-border)', borderRadius: 8,
  background: 'var(--color-bg)', color: 'var(--color-text-primary)',
  fontFamily: 'inherit', boxSizing: 'border-box',
  outline: 'none',
}

function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500)
    return () => clearTimeout(t)
  }, [onClose])

  const bg    = type === 'success' ? '#dcfce7' : '#fee2e2'
  const color = type === 'success' ? '#15803d' : '#dc2626'
  const border = type === 'success' ? '#86efac' : '#fca5a5'

  return (
    <div style={{
      position: 'fixed', bottom: 80, right: 24, zIndex: 1000,
      background: bg, color, border: `1px solid ${border}`,
      borderRadius: 10, padding: '12px 20px',
      fontSize: 14, fontWeight: 600,
      boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <span>{type === 'success' ? '✓' : '✕'}</span>
      <span>{message}</span>
      <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color, fontSize: 14, padding: 0, marginLeft: 6 }}>✕</button>
    </div>
  )
}

// ── LOGO DROP ZONE ────────────────────────────────────────────────────────────

function LogoDropZone({ onFile, uploading, uploadError }) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef(null)

  function handleDrop(e) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) onFile(file)
  }

  return (
    <div>
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? 'var(--color-primary)' : 'var(--color-border)'}`,
          borderRadius: 10, padding: '22px 16px', textAlign: 'center',
          cursor: uploading ? 'default' : 'pointer',
          background: dragging ? 'rgba(29,158,117,0.04)' : 'var(--color-surface)',
          transition: 'all 0.15s',
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".png,.jpg,.jpeg,.webp,.svg"
          style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = '' }}
        />
        {uploading ? (
          <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Uploading…</div>
        ) : (
          <>
            <div style={{ fontSize: 28, marginBottom: 8 }}>🖼️</div>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>
              Drag & drop or click to upload
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 3 }}>
              PNG, JPG, WEBP, SVG · max 2 MB
            </div>
          </>
        )}
      </div>
      {uploadError && (
        <div style={{ fontSize: 12, color: '#dc2626', marginTop: 6 }}>{uploadError}</div>
      )}
    </div>
  )
}

// ── FONT SELECTOR ─────────────────────────────────────────────────────────────

function FontSelector({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          ...inputStyle, display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', cursor: 'pointer',
          fontFamily: cssFontFamily(value),
        }}
      >
        <span style={{ fontFamily: cssFontFamily(value) }}>{value}</span>
        <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>▾</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 300,
          background: 'var(--color-bg)', border: '1px solid var(--color-border)',
          borderRadius: 10, maxHeight: 240, overflowY: 'auto',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        }}>
          {BRAND_FONTS.map(font => (
            <div
              key={font}
              onClick={() => { onChange(font); setOpen(false) }}
              style={{
                padding: '9px 14px', fontSize: 13, cursor: 'pointer',
                fontFamily: cssFontFamily(font),
                background: font === value ? 'rgba(29,158,117,0.08)' : 'transparent',
                color: font === value ? 'var(--color-primary)' : 'var(--color-text-primary)',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => { if (font !== value) e.currentTarget.style.background = 'var(--color-surface)' }}
              onMouseLeave={e => { if (font !== value) e.currentTarget.style.background = 'transparent' }}
            >
              {font}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── REGISTRATION ROW ──────────────────────────────────────────────────────────

function RegistrationRow({ reg, index, onChange, onDelete }) {
  const expiry = getExpiryStatus(reg.expiry_date)

  return (
    <div style={{
      border: '1px solid var(--color-border)', borderRadius: 10,
      padding: '12px 14px', marginBottom: 10,
      background: 'var(--color-bg)',
    }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        {/* Type */}
        <div style={{ flex: '0 0 130px', minWidth: 100 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }}>Type</div>
          <select
            value={reg.type}
            onChange={e => onChange(index, 'type', e.target.value)}
            style={{ ...inputStyle, padding: '7px 8px' }}
          >
            {REG_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {/* Number */}
        <div style={{ flex: '1 1 140px', minWidth: 120 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }}>Number</div>
          <input
            style={inputStyle}
            value={reg.number}
            onChange={e => onChange(index, 'number', e.target.value)}
            placeholder="e.g. ARN-12345"
          />
        </div>

        {/* Expiry */}
        <div style={{ flex: '0 0 150px', minWidth: 130 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }}>Expiry date</div>
          <input
            type="date"
            style={inputStyle}
            value={reg.expiry_date || ''}
            onChange={e => onChange(index, 'expiry_date', e.target.value || '')}
          />
        </div>

        {/* Delete */}
        <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
          <button
            type="button"
            onClick={() => onDelete(index)}
            title="Remove"
            style={{
              background: 'none', border: '1px solid var(--color-border)',
              borderRadius: 8, cursor: 'pointer', padding: '6px 10px',
              color: 'var(--color-text-muted)', fontSize: 14,
            }}
          >
            🗑
          </button>
        </div>
      </div>

      {/* Display label */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }}>Display label</div>
        <input
          style={inputStyle}
          value={reg.display_label}
          onChange={e => onChange(index, 'display_label', e.target.value)}
          placeholder="e.g. AMFI Registered Distributor"
        />
      </div>

      {/* Expiry badges */}
      {expiry && (
        <div style={{
          marginTop: 10, padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
          display: 'inline-block',
          background: expiry.status === 'expired' ? '#fee2e2' : '#fef3c7',
          color: expiry.status === 'expired' ? '#dc2626' : '#b45309',
          border: `1px solid ${expiry.status === 'expired' ? '#fca5a5' : '#fde68a'}`,
        }}>
          {expiry.status === 'expired'
            ? `Expired on ${fmtDate(reg.expiry_date)}`
            : `Expiring on ${fmtDate(reg.expiry_date)} — renew soon`}
        </div>
      )}
    </div>
  )
}

// ── BRAND COLOUR PICKER ───────────────────────────────────────────────────────

function BrandColourPicker({ value, onChange }) {
  const hex = value || DEFAULT_COLOUR

  function handleHexInput(raw) {
    if (/^#[0-9A-Fa-f]{0,6}$/.test(raw)) onChange(raw)
  }

  const isValid = /^#[0-9A-Fa-f]{6}$/.test(hex)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <input
        type="color"
        value={isValid ? hex : DEFAULT_COLOUR}
        onChange={e => onChange(e.target.value)}
        style={{
          width: 44, height: 40, padding: 3, cursor: 'pointer',
          border: '1px solid var(--color-border)', borderRadius: 8,
          background: 'var(--color-bg)',
        }}
      />
      <input
        type="text"
        value={hex}
        onChange={e => handleHexInput(e.target.value)}
        maxLength={7}
        style={{ ...inputStyle, width: 110, fontFamily: 'monospace', letterSpacing: '0.05em' }}
        placeholder="#1A3C6E"
      />
      {isValid && (
        <div style={{
          width: 36, height: 36, borderRadius: 8, background: hex,
          border: '1px solid var(--color-border)', flexShrink: 0,
        }} />
      )}
    </div>
  )
}

// ── LIVE PREVIEW PANEL ────────────────────────────────────────────────────────

function BrandingPreview({ form }) {
  const colour  = /^#[0-9A-Fa-f]{6}$/.test(form.brand_colour_hex) ? form.brand_colour_hex : DEFAULT_COLOUR
  const font    = form.brand_font || DEFAULT_FONT
  const fontCSS = cssFontFamily(font)

  const regLine = (form.registration_numbers || [])
    .filter(r => r.number.trim())
    .map(r => r.number.trim())
    .join(' · ')

  const contactLine = [form.helpdesk_phone, form.helpdesk_email, form.website_url]
    .filter(Boolean)
    .join(' · ')

  const previewCard = {
    border: '1px solid var(--color-border)', borderRadius: 10,
    overflow: 'hidden', marginBottom: 14,
    background: '#fff',
  }
  const sectionLabel = {
    fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
    textTransform: 'uppercase', color: 'var(--color-text-muted)',
    marginBottom: 8,
  }

  return (
    <div>
      {/* Preview 1 — Nav bar mock */}
      <div style={sectionLabel}>Nav bar</div>
      <div style={{
        ...previewCard,
        background: colour,
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 16px',
      }}>
        {form.logo_url && (
          <img src={form.logo_url} alt="" style={{ height: 28, maxWidth: 80, objectFit: 'contain', borderRadius: 4 }} onError={e => { e.currentTarget.style.display = 'none' }} />
        )}
        <span style={{ fontFamily: fontCSS, color: '#fff', fontWeight: 700, fontSize: 16, flex: 1 }}>
          {form.firm_name || 'Your Firm Name'}
        </span>
        <span style={{ display: 'flex', gap: 14 }}>
          {['Dashboard', 'Portfolio', 'Reports'].map(item => (
            <span key={item} style={{ fontFamily: fontCSS, color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>{item}</span>
          ))}
        </span>
      </div>
      <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginBottom: 16, fontStyle: 'italic' }}>
        Client-facing nav wiring in PH3-S5
      </div>

      {/* Preview 2 — PDF header mock */}
      <div style={sectionLabel}>PDF header</div>
      <div style={previewCard}>
        <div style={{ height: 4, background: colour }} />
        <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {form.logo_url && (
              <img src={form.logo_url} alt="" style={{ height: 40, maxWidth: 80, objectFit: 'contain' }} onError={e => { e.currentTarget.style.display = 'none' }} />
            )}
            <div>
              <div style={{ fontFamily: fontCSS, fontWeight: 700, fontSize: 18, color: colour }}>
                {form.firm_name || 'Your Firm Name'}
              </div>
              {form.tagline && (
                <div style={{ fontFamily: fontCSS, fontSize: 11, color: '#666', marginTop: 2 }}>
                  {form.tagline}
                </div>
              )}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#333', marginBottom: 2 }}>FundLens</div>
            <div style={{ fontSize: 9, color: '#888' }}>Powered by FundLens</div>
          </div>
        </div>
      </div>

      {/* Preview 3 — PDF footer mock */}
      <div style={sectionLabel}>PDF footer</div>
      <div style={previewCard}>
        <div style={{ height: 1, background: colour }} />
        <div style={{ padding: '10px 16px' }}>
          {regLine && (
            <div style={{ fontFamily: fontCSS, fontSize: 10, color: '#444', marginBottom: 3 }}>
              {regLine}
            </div>
          )}
          {form.disclaimer_text && (
            <div style={{
              fontFamily: fontCSS, fontSize: 10, color: '#888', marginBottom: 3,
              overflow: 'hidden', display: '-webkit-box',
              WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            }}>
              {form.disclaimer_text}
            </div>
          )}
          {contactLine && (
            <div style={{ fontFamily: fontCSS, fontSize: 10, color: '#888' }}>{contactLine}</div>
          )}
          {!regLine && !form.disclaimer_text && !contactLine && (
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
              Registration numbers, disclaimer, and contact details will appear here.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── PLACEHOLDER TAB ───────────────────────────────────────────────────────────

function PlaceholderTab({ tabName }) {
  return (
    <div style={{
      border: '1px solid var(--color-border)', borderRadius: 12,
      padding: '32px 24px', textAlign: 'center',
      background: 'var(--color-surface)',
    }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>🔜</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 8 }}>
        Coming soon
      </div>
      <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
        {tabName} settings will be available in a future update.
      </div>
    </div>
  )
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────

export default function AdvisorSettings() {
  const { user, token, loading: authLoading } = useAuth()
  const { isAdvisor, isAdmin } = useRole()
  const width    = useWindowWidth()
  const isMobile = width <= 768

  // ── Tab state ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('Branding')

  // ── Form state ────────────────────────────────────────────────────────────
  const [form, setForm] = useState({
    firm_name: '', tagline: '', website_url: '',
    helpdesk_phone: '', helpdesk_email: '', registered_address: '',
    logo_url: '', brand_colour_hex: DEFAULT_COLOUR,
    brand_font: DEFAULT_FONT, disclaimer_text: '',
    registration_numbers: [],
  })

  // ── Logo state ────────────────────────────────────────────────────────────
  const [uploading,      setUploading]      = useState(false)
  const [uploadError,    setUploadError]    = useState(null)
  const [removeLogoFlag, setRemoveLogoFlag] = useState(false)

  // ── Save state ────────────────────────────────────────────────────────────
  const [saving,      setSaving]    = useState(false)
  const [toast,       setToast]     = useState(null)  // { message, type }
  const [dataLoaded,  setDataLoaded] = useState(false)

  // ── Mobile preview collapse ───────────────────────────────────────────────
  const [previewOpen, setPreviewOpen] = useState(false)

  // ── Load branding on mount ────────────────────────────────────────────────
  useEffect(() => {
    if (!user || !token || (!isAdvisor && !isAdmin)) return

    const sb = createSupabaseClient(token)
    let cancelled = false

    async function loadBranding() {
      try {
        const { data, error } = await sb
          .from('advisor_firm_profiles')
          .select('*')
          .eq('advisor_id', user.uid)
          .maybeSingle()

        if (error) {
          console.error('[AdvisorSettings] loadBranding error:', error)
        }

        if (!cancelled && data) {
          setForm({
            firm_name:            data.firm_name           || '',
            tagline:              data.tagline             || '',
            website_url:          data.website_url         || '',
            helpdesk_phone:       data.helpdesk_phone      || '',
            helpdesk_email:       data.helpdesk_email      || '',
            registered_address:   data.registered_address  || '',
            logo_url:             data.logo_url            || '',
            brand_colour_hex:     data.brand_colour_hex    || DEFAULT_COLOUR,
            brand_font:           data.brand_font          || DEFAULT_FONT,
            disclaimer_text:      data.disclaimer_text     || '',
            registration_numbers: Array.isArray(data.registration_numbers)
              ? data.registration_numbers
              : [],
          })
        }
      } catch (err) {
        console.error('[AdvisorSettings] loadBranding failed:', err)
      } finally {
        if (!cancelled) setDataLoaded(true)
      }
    }

    loadBranding()
    return () => { cancelled = true }
  }, [user, token, isAdvisor, isAdmin])

  // ── Field change helpers ──────────────────────────────────────────────────
  const setField = useCallback((key, value) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }, [])

  // ── Logo upload ───────────────────────────────────────────────────────────
  async function handleLogoFile(file) {
    const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
    if (!allowed.includes(file.type)) {
      setUploadError('Only PNG, JPG, WEBP, SVG files are accepted.')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setUploadError('File must be under 2 MB.')
      return
    }

    setUploadError(null)
    setUploading(true)

    try {
      const sb       = createSupabaseClient(token)
      const ext      = fileExtension(file)
      const fileName = `${user.uid}_logo.${ext}`

      const { error: upErr } = await sb.storage
        .from(STORAGE_BUCKET)
        .upload(fileName, file, { upsert: true, contentType: file.type })

      if (upErr) {
        console.error('[AdvisorSettings] logo upload error:', upErr)
        setUploadError('Upload failed: ' + upErr.message)
        return
      }

      const { data: urlData } = sb.storage.from(STORAGE_BUCKET).getPublicUrl(fileName)
      const publicUrl = urlData?.publicUrl || ''

      setForm(prev => ({ ...prev, logo_url: publicUrl }))
      setRemoveLogoFlag(false)
    } catch (err) {
      console.error('[AdvisorSettings] handleLogoFile failed:', err)
      setUploadError('Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  async function handleRemoveLogo() {
    setRemoveLogoFlag(true)
    setForm(prev => ({ ...prev, logo_url: '' }))
    setUploadError(null)
  }

  // ── Registration numbers ──────────────────────────────────────────────────
  function addRegistration() {
    setForm(prev => ({ ...prev, registration_numbers: [...prev.registration_numbers, emptyRegistration()] }))
  }

  function updateRegistration(index, key, value) {
    setForm(prev => {
      const updated = prev.registration_numbers.map((r, i) => i === index ? { ...r, [key]: value } : r)
      return { ...prev, registration_numbers: updated }
    })
  }

  function deleteRegistration(index) {
    setForm(prev => ({ ...prev, registration_numbers: prev.registration_numbers.filter((_, i) => i !== index) }))
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!form.firm_name.trim()) {
      setToast({ message: 'Firm name is required.', type: 'error' })
      return
    }

    setSaving(true)

    try {
      const sb = createSupabaseClient(token)

      // Delete logo from Storage if flagged
      if (removeLogoFlag) {
        const logoExts = ['png', 'jpg', 'jpeg', 'webp', 'svg']
        for (const ext of logoExts) {
          await sb.storage.from(STORAGE_BUCKET).remove([`${user.uid}_logo.${ext}`])
        }
      }

      const payload = {
        advisor_id:           user.uid,
        firm_name:            form.firm_name.trim(),
        tagline:              form.tagline.trim()            || null,
        website_url:          form.website_url.trim()        || null,
        helpdesk_phone:       form.helpdesk_phone.trim()     || null,
        helpdesk_email:       form.helpdesk_email.trim()     || null,
        registered_address:   form.registered_address.trim() || null,
        logo_url:             removeLogoFlag ? null : (form.logo_url || null),
        brand_colour_hex:     /^#[0-9A-Fa-f]{6}$/.test(form.brand_colour_hex) ? form.brand_colour_hex : DEFAULT_COLOUR,
        brand_font:           form.brand_font || DEFAULT_FONT,
        disclaimer_text:      form.disclaimer_text.trim() || null,
        registration_numbers: form.registration_numbers.filter(r => r.number.trim()),
        updated_at:           nowTimestamp(),
      }

      const { error: saveErr } = await sb
        .from('advisor_firm_profiles')
        .upsert(payload, { onConflict: 'advisor_id' })

      if (saveErr) {
        console.error('[AdvisorSettings] save error:', saveErr)
        setToast({ message: 'Save failed: ' + saveErr.message, type: 'error' })
        return
      }

      if (removeLogoFlag) setRemoveLogoFlag(false)
      setToast({ message: 'Branding saved successfully', type: 'success' })
    } catch (err) {
      console.error('[AdvisorSettings] handleSave failed:', err)
      setToast({ message: 'Save failed. Please try again.', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  // ── Auth gates ────────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', fontFamily: "'DM Sans', sans-serif" }}>
        <span style={{ color: 'var(--color-text-muted)', fontSize: 15 }}>Loading…</span>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  if (!isAdvisor && !isAdmin) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ textAlign: 'center', maxWidth: 380, padding: '0 20px' }}>
          <div style={{ fontSize: 40, marginBottom: 20 }}>🔒</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 12px' }}>
            You need an Advisor account to access this page.
          </h2>
          <a href="/advisor/apply" style={{ display: 'inline-flex', alignItems: 'center', padding: '10px 24px', background: 'var(--color-primary)', color: '#fff', borderRadius: 10, textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>
            Apply for Advisor Access
          </a>
        </div>
      </div>
    )
  }

  // ── Branding form ─────────────────────────────────────────────────────────

  const brandingForm = (
    <div>
      {/* Section 1 — Firm Identity */}
      <FormSection title="Firm Identity">
        <FieldRow label="Firm name" sub="required">
          <input
            style={inputStyle}
            value={form.firm_name}
            onChange={e => setField('firm_name', e.target.value)}
            placeholder="Your firm's full name"
          />
        </FieldRow>

        <FieldRow label={`Tagline`} sub={`${form.tagline.length}/100`}>
          <input
            style={inputStyle}
            value={form.tagline}
            onChange={e => e.target.value.length <= 100 && setField('tagline', e.target.value)}
            placeholder="e.g. Trusted wealth management since 2010"
            maxLength={100}
          />
        </FieldRow>

        <FieldRow label="Company website">
          <input
            type="url"
            style={inputStyle}
            value={form.website_url}
            onChange={e => setField('website_url', e.target.value)}
            placeholder="https://yourfirm.com"
          />
        </FieldRow>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '0 16px' }}>
          <FieldRow label="Helpdesk phone">
            <input
              style={inputStyle}
              value={form.helpdesk_phone}
              onChange={e => setField('helpdesk_phone', e.target.value)}
              placeholder="+91 98765 43210"
            />
          </FieldRow>
          <FieldRow label="Helpdesk email">
            <input
              type="email"
              style={inputStyle}
              value={form.helpdesk_email}
              onChange={e => setField('helpdesk_email', e.target.value)}
              placeholder="support@yourfirm.com"
            />
          </FieldRow>
        </div>

        <FieldRow label="Registered address">
          <textarea
            style={{ ...inputStyle, resize: 'vertical', minHeight: 70 }}
            rows={3}
            value={form.registered_address}
            onChange={e => setField('registered_address', e.target.value)}
            placeholder="Full registered address…"
          />
        </FieldRow>
      </FormSection>

      {/* Section 2 — Logo Upload */}
      <FormSection title="Logo">
        {form.logo_url && !removeLogoFlag ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
            <img
              src={form.logo_url}
              alt="Firm logo"
              style={{ width: 80, height: 80, objectFit: 'contain', border: '1px solid var(--color-border)', borderRadius: 10, padding: 6, background: '#fff' }}
              onError={e => { e.currentTarget.style.display = 'none' }}
            />
            <div style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
              <button
                type="button"
                onClick={() => document.getElementById('logo-file-replace')?.click()}
                style={{ padding: '7px 16px', border: '1.5px solid var(--color-primary)', borderRadius: 8, background: 'none', color: 'var(--color-primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                Replace
              </button>
              <input
                id="logo-file-replace"
                type="file"
                accept=".png,.jpg,.jpeg,.webp,.svg"
                style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoFile(f); e.target.value = '' }}
              />
              <button
                type="button"
                onClick={handleRemoveLogo}
                style={{ padding: '7px 16px', border: '1.5px solid var(--color-border)', borderRadius: 8, background: 'none', color: 'var(--color-error)', fontSize: 13, cursor: 'pointer' }}
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <LogoDropZone
            onFile={handleLogoFile}
            uploading={uploading}
            uploadError={uploadError}
          />
        )}
        {uploading && (
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid var(--color-primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
            Uploading logo…
          </div>
        )}
      </FormSection>

      {/* Section 3 — Brand Colour */}
      <FormSection title="Brand colour">
        <FieldRow label="Primary colour">
          <BrandColourPicker
            value={form.brand_colour_hex}
            onChange={v => setField('brand_colour_hex', v)}
          />
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 6 }}>
            Used in report headers, footers, and client-facing nav.
          </div>
        </FieldRow>
      </FormSection>

      {/* Section 4 — Brand Font */}
      <FormSection title="Brand font">
        <FieldRow label="Font family">
          <FontSelector
            value={form.brand_font || DEFAULT_FONT}
            onChange={v => setField('brand_font', v)}
          />
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 6 }}>
            Applied to all report text and client-facing documents.
          </div>
        </FieldRow>
      </FormSection>

      {/* Section 5 — Registration Numbers */}
      <FormSection title="Registration numbers">
        {form.registration_numbers.map((reg, i) => (
          <RegistrationRow
            key={i}
            reg={reg}
            index={i}
            onChange={updateRegistration}
            onDelete={deleteRegistration}
          />
        ))}
        <button
          type="button"
          onClick={addRegistration}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', border: '1.5px dashed var(--color-border)',
            borderRadius: 8, background: 'none', cursor: 'pointer',
            fontSize: 13, color: 'var(--color-primary)', fontWeight: 600,
            fontFamily: 'inherit',
          }}
        >
          + Add registration number
        </button>
      </FormSection>

      {/* Section 6 — Disclaimer */}
      <FormSection title="Disclaimer / disclosure text" last>
        <FieldRow
          label="Disclaimer"
          sub={`${(form.disclaimer_text || '').length} chars`}
        >
          <textarea
            style={{ ...inputStyle, resize: 'vertical', minHeight: 90 }}
            rows={5}
            value={form.disclaimer_text}
            onChange={e => setField('disclaimer_text', e.target.value)}
            placeholder="e.g. Registered with AMFI as ARN-XXXXX. Mutual fund investments are subject to market risks. Past performance is not indicative of future results."
          />
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 5 }}>
            Appears in the footer of reports, PDFs, and emails.
          </div>
        </FieldRow>
      </FormSection>
    </div>
  )

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        ${FONTS_IMPORT}
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: isMobile ? '20px 16px 80px' : '32px 28px 60px', fontFamily: "'DM Sans', sans-serif" }}>

        {/* Page header */}
        <h1 style={{ fontSize: isMobile ? 22 : 26, fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 24px' }}>
          Advisor Settings
        </h1>

        {/* Tab headers */}
        <div style={{
          display: 'flex', gap: 0,
          borderBottom: '2px solid var(--color-border)',
          marginBottom: 28,
          overflowX: 'auto',
        }}>
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '10px 20px', background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 14, fontWeight: activeTab === tab ? 700 : 500,
                color: activeTab === tab ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                borderBottom: activeTab === tab ? '2px solid var(--color-primary)' : '2px solid transparent',
                marginBottom: -2, whiteSpace: 'nowrap', fontFamily: 'inherit',
                transition: 'color 0.15s',
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Non-branding tabs: placeholder */}
        {activeTab !== 'Branding' ? (
          <PlaceholderTab tabName={activeTab} />
        ) : (

          /* Branding tab — 2-col on desktop */
          <div style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            gap: 28,
            alignItems: 'flex-start',
          }}>
            {/* ── Form ── */}
            <div style={{
              flex: 1, minWidth: 0,
              background: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              borderRadius: 12, padding: isMobile ? 16 : 24,
            }}>
              {!dataLoaded ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--color-text-muted)', fontSize: 13 }}>Loading branding data…</div>
              ) : brandingForm}
            </div>

            {/* ── Preview ── desktop: sticky side panel · mobile: collapsible section */}
            <div style={{ flex: '0 0 320px', minWidth: isMobile ? 'auto' : 300, width: isMobile ? '100%' : undefined, position: isMobile ? undefined : 'sticky', top: 80 }}>
              {isMobile ? (
                <div style={{ border: '1px solid var(--color-border)', borderRadius: 12 }}>
                  <button
                    type="button"
                    onClick={() => setPreviewOpen(o => !o)}
                    style={{
                      width: '100%', padding: '14px 18px', background: 'none',
                      border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)',
                    }}
                  >
                    <span>Live Preview</span>
                    <span style={{ fontSize: 11 }}>{previewOpen ? '▲ Collapse' : '▼ Expand'}</span>
                  </button>
                  {previewOpen && (
                    <div style={{ padding: '0 16px 16px' }}>
                      <BrandingPreview form={form} />
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ border: '1px solid var(--color-border)', borderRadius: 12, padding: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 16 }}>
                    Live Preview
                  </div>
                  <BrandingPreview form={form} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Save button — fixed */}
      {activeTab === 'Branding' && (
        isMobile ? (
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
            background: 'var(--color-bg)', borderTop: '1px solid var(--color-border)',
            padding: '12px 16px',
          }}>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              style={{
                width: '100%', padding: '12px', border: 'none', borderRadius: 10,
                background: saving ? '#ccc' : 'var(--color-primary)',
                color: '#fff', fontSize: 15, fontWeight: 700, cursor: saving ? 'default' : 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {saving ? 'Saving…' : 'Save branding'}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            style={{
              position: 'fixed', bottom: 32, right: 32, zIndex: 100,
              padding: '12px 28px', border: 'none', borderRadius: 12,
              background: saving ? '#aaa' : 'var(--color-primary)',
              color: '#fff', fontSize: 14, fontWeight: 700,
              cursor: saving ? 'default' : 'pointer',
              boxShadow: '0 4px 20px rgba(29,158,117,0.3)',
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {saving ? 'Saving…' : 'Save branding'}
          </button>
        )
      )}

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </>
  )
}
