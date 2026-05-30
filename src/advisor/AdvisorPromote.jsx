// src/advisor/AdvisorPromote.jsx
// PH3-S3 — Promote module
// Route: /advisor/promote  (ProtectedRoute requiredRole="advisor")

import { useState, useEffect, useRef, useCallback } from 'react'
import { Navigate, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useRole } from '../hooks/useRole'
import useWindowWidth from '../hooks/useWindowWidth'
import { createSupabaseClient, supabase } from '../lib/supabaseClient'

// ── CONSTANTS ─────────────────────────────────────────────────────────────────

const DEFAULT_BRAND_COLOUR = '#1A3C6E'
const DEFAULT_FONT         = 'DM Sans'

function fontApiName(name) {
  if (!name) return DEFAULT_FONT
  if (name === 'Source Sans Pro') return 'Source+Sans+3'
  return name.replace(/ /g, '+')
}

function cssFontFamily(name) {
  if (!name) return "'DM Sans', sans-serif"
  if (name === 'Source Sans Pro') return "'Source Sans 3', sans-serif"
  return `'${name}', sans-serif`
}

function lightTint(hex) {
  const h = (hex || DEFAULT_BRAND_COLOUR).replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},0.10)`
}

function slugify(str) {
  return (str || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}

// ── FONT LOADER ───────────────────────────────────────────────────────────────

function loadBrandFont(fontName) {
  const existing = document.getElementById('advisor-promote-font')
  if (existing) existing.remove()
  const link = document.createElement('link')
  link.id   = 'advisor-promote-font'
  link.rel  = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?family=${fontApiName(fontName)}:wght@400;500;600;700&display=swap`
  document.head.appendChild(link)
}

// ── TOAST ─────────────────────────────────────────────────────────────────────

function Toast({ message, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2600)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div style={{
      position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
      background: '#0f172a', color: '#fff', borderRadius: 10, padding: '10px 22px',
      fontSize: 13, fontWeight: 500, zIndex: 9999, whiteSpace: 'nowrap',
      boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
      fontFamily: "'DM Sans', sans-serif",
    }}>
      {message}
    </div>
  )
}

// ── CATEGORY BADGE ────────────────────────────────────────────────────────────

const BADGE_STYLES = {
  leaflet:   { bg: '#ede9fe', color: '#6d28d9' },
  email:     { bg: '#dbeafe', color: '#1d4ed8' },
  whatsapp:  { bg: '#dcfce7', color: '#16a34a' },
}

function CategoryBadge({ category }) {
  const labels = { leaflet: 'Leaflet', email: 'Email', whatsapp: 'WhatsApp' }
  const s = BADGE_STYLES[category] || { bg: '#f1f5f9', color: '#475569' }
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
      background: s.bg, color: s.color, borderRadius: 6, padding: '2px 8px',
    }}>
      {labels[category] || category}
    </span>
  )
}

function LayoutBadge({ layout }) {
  const labels = {
    header_split: 'Header split',
    corner_badge: 'Corner badge',
    footer_only:  'Footer only',
  }
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, letterSpacing: '0.04em',
      background: '#f1f5f9', color: '#64748b', borderRadius: 6, padding: '2px 8px',
    }}>
      {labels[layout] || layout || '—'}
    </span>
  )
}

// ── MINI PREVIEW (CSS-only, 160x100px) ───────────────────────────────────────

function MiniPreview({ template, branding }) {
  const colour = branding?.brand_colour_hex || DEFAULT_BRAND_COLOUR
  const font   = cssFontFamily(branding?.brand_font)

  return (
    <div style={{
      width: 160, height: 100, borderRadius: 6, overflow: 'hidden',
      border: '1px solid var(--color-border)',
      fontFamily: font, flexShrink: 0, position: 'relative',
      background: '#fff',
    }}>
      {template.template_layout === 'header_split' && (
        <>
          <div style={{ background: colour, height: 22, display: 'flex', alignItems: 'center', padding: '0 8px' }}>
            <span style={{ color: '#fff', fontSize: 7, fontWeight: 700 }}>
              {branding?.firm_name || 'Your Firm'}
            </span>
          </div>
          <div style={{ background: lightTint(colour), height: 36, padding: '4px 8px' }}>
            <div style={{ fontSize: 7, fontWeight: 700, color: '#1e293b', lineHeight: 1.3 }}>
              {template.title}
            </div>
          </div>
          <div style={{ padding: '4px 8px' }}>
            <div style={{ fontSize: 6, color: '#475569', lineHeight: 1.4 }}>
              {(template.text || '').slice(0, 60)}…
            </div>
          </div>
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            height: 14, borderTop: `1px solid ${colour}`,
            display: 'flex', alignItems: 'center', padding: '0 8px',
          }}>
            <span style={{ fontSize: 5, color: '#64748b' }}>Reg. numbers · disclaimer</span>
          </div>
        </>
      )}
      {template.template_layout === 'corner_badge' && (
        <>
          <div style={{ background: lightTint(colour), height: 48, padding: '6px 8px' }}>
            <div style={{ fontSize: 7, fontWeight: 700, color: '#1e293b' }}>{template.title}</div>
          </div>
          <div style={{ padding: '4px 8px' }}>
            <div style={{ fontSize: 6, color: '#475569' }}>{(template.text || '').slice(0, 50)}…</div>
          </div>
          <div style={{
            position: 'absolute',
            top: template.corner_position?.includes('bottom') ? undefined : 4,
            bottom: template.corner_position?.includes('bottom') ? 18 : undefined,
            left: template.corner_position?.includes('right') ? undefined : 4,
            right: template.corner_position?.includes('right') ? 4 : undefined,
            background: '#fff', border: `1px solid ${colour}`,
            borderRadius: 4, padding: '2px 4px',
          }}>
            <span style={{ fontSize: 5, fontWeight: 700, color: colour }}>
              {branding?.firm_name || 'Firm'}
            </span>
          </div>
        </>
      )}
      {template.template_layout === 'footer_only' && (
        <>
          <div style={{ background: lightTint(colour), height: 48, padding: '6px 8px' }}>
            <div style={{ fontSize: 7, fontWeight: 700, color: '#1e293b' }}>{template.title}</div>
          </div>
          <div style={{ padding: '4px 8px' }}>
            <div style={{ fontSize: 6, color: '#475569' }}>{(template.text || '').slice(0, 50)}…</div>
          </div>
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            height: 22, background: colour,
            display: 'flex', alignItems: 'center', padding: '0 8px', gap: 4,
          }}>
            <span style={{ fontSize: 6, color: '#fff', fontWeight: 600 }}>
              {branding?.firm_name || 'Your Firm'}
            </span>
            <span style={{ fontSize: 5, color: 'rgba(255,255,255,0.7)' }}>Advisor / Distributor</span>
          </div>
        </>
      )}
      {!['header_split', 'corner_badge', 'footer_only'].includes(template.template_layout) && (
        <div style={{ padding: 8 }}>
          <div style={{ fontSize: 7, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>{template.title}</div>
          <div style={{ fontSize: 6, color: '#475569', lineHeight: 1.4 }}>{(template.text || '').slice(0, 70)}…</div>
        </div>
      )}
    </div>
  )
}

// ── TEMPLATE CARD ─────────────────────────────────────────────────────────────

function TemplateCard({ template, branding, onGenerate, onCopy, onShare }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid var(--color-border)',
      borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <CategoryBadge category={template.category} />
        {template.template_layout && <LayoutBadge layout={template.template_layout} />}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', lineHeight: 1.3 }}>
        {template.title || 'Untitled template'}
      </div>
      <MiniPreview template={template} branding={branding} />
      <div>
        {template.category === 'leaflet' && (
          <button onClick={() => onGenerate(template)} style={ctaBtn('#1A3C6E')}>
            Generate JPEG
          </button>
        )}
        {template.category === 'email' && (
          <>
            <button onClick={() => onCopy(template)} style={ctaBtn('#1d4ed8')}>
              Copy draft
            </button>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 6, lineHeight: 1.4 }}>
              Paste into your email client. Replace [Client Name] and [bracketed placeholders] before sending.
            </div>
          </>
        )}
        {template.category === 'whatsapp' && (
          <>
            <button onClick={() => onShare(template)} style={ctaBtn('#16a34a')}>
              Share
            </button>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 6, lineHeight: 1.4 }}>
              Personalise the [bracketed placeholders] before sending.
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function ctaBtn(bg) {
  return {
    width: '100%', padding: '9px 0',
    background: bg, color: '#fff',
    border: 'none', borderRadius: 8, cursor: 'pointer',
    fontSize: 13, fontWeight: 600,
    fontFamily: "'DM Sans', sans-serif",
    transition: 'opacity 0.15s',
  }
}

// ── CTA BLOCK (shared across all 3 leaflet templates) ─────────────────────────

function CTABlock({ branding, ctaStyle, colour, font }) {
  const firmName = branding?.firm_name || 'Your Firm'
  const phone    = branding?.helpdesk_phone
  const email    = branding?.helpdesk_email
  const website  = branding?.website_url

  if (ctaStyle === 'strip') {
    return (
      <div style={{
        marginTop: 24, background: colour,
        borderRadius: 10, padding: '16px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>Your Advisor / Distributor</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>{firmName}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          {phone && <div style={{ fontSize: 15, color: '#fff' }}>{phone}</div>}
          {email && <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>{email}</div>}
        </div>
      </div>
    )
  }

  const initials = firmName.charAt(0).toUpperCase()
  return (
    <div style={{
      marginTop: 24, background: lightTint(colour),
      borderRadius: 10, padding: '16px 20px',
      borderLeft: `4px solid ${colour}`,
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: colour, marginBottom: 12 }}>
        Contact your Advisor / Distributor
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {branding?.logo_url ? (
          <img
            src={branding.logo_url}
            alt={firmName}
            crossOrigin="anonymous"
            style={{ width: 48, height: 48, borderRadius: 10, objectFit: 'contain', background: '#fff', padding: 4 }}
          />
        ) : (
          <div style={{
            width: 48, height: 48, borderRadius: 10,
            background: colour, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 20, fontWeight: 700,
          }}>
            {initials}
          </div>
        )}
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#1e293b' }}>{firmName}</div>
          {phone   && <div style={{ fontSize: 14, color: '#475569', marginTop: 2 }}>{phone}</div>}
          {email   && <div style={{ fontSize: 13, color: '#64748b' }}>{email}</div>}
          {website && <div style={{ fontSize: 12, color: '#94a3b8' }}>{website}</div>}
        </div>
      </div>
    </div>
  )
}

// ── LEAFLET CANVAS — TEMPLATE A (header_split) ────────────────────────────────

function TemplateHeaderSplit({ template, branding }) {
  const colour   = branding?.brand_colour_hex || DEFAULT_BRAND_COLOUR
  const font     = cssFontFamily(branding?.brand_font)
  const firmName = branding?.firm_name || 'Your Firm'
  const bullets  = Array.isArray(template.feature_bullets) ? template.feature_bullets : []
  const ctaStyle = template.cta_style || 'card'
  const regNums  = Array.isArray(branding?.registration_numbers) ? branding.registration_numbers : []
  const regStr   = regNums.map(r => r.display_label || `${r.type} ${r.number}`).join(' · ')

  return (
    <div style={{
      width: 1080, height: 1080, background: '#ffffff',
      fontFamily: font, display: 'flex', flexDirection: 'column',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Top bar */}
      <div style={{
        height: 120, background: colour, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 48px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {branding?.logo_url && (
            <img
              src={branding.logo_url}
              alt={firmName}
              crossOrigin="anonymous"
              style={{ maxHeight: 80, maxWidth: 200, objectFit: 'contain' }}
            />
          )}
          <span style={{ color: '#ffffff', fontSize: 28, fontWeight: 700 }}>{firmName}</span>
        </div>
        <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14 }}>Powered by FundLens</span>
      </div>

      {/* Hero */}
      <div style={{
        height: 280, background: template.background_colour_hex || lightTint(colour),
        flexShrink: 0, padding: '40px 48px', display: 'flex', flexDirection: 'column',
        justifyContent: 'center',
      }}>
        <div style={{ fontSize: 48, fontWeight: 700, color: '#1e293b', lineHeight: 1.2, marginBottom: 16 }}>
          {template.title}
        </div>
        <div style={{ fontSize: 22, color: '#475569', lineHeight: 1.5 }}>
          {template.text}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '36px 48px 0', overflow: 'hidden' }}>
        {template.body_text && (
          <div style={{ fontSize: 18, color: '#334155', lineHeight: 1.6, marginBottom: 24 }}>
            {template.body_text}
          </div>
        )}
        {bullets.map((b, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
            <span style={{
              width: 10, height: 10, borderRadius: '50%',
              background: colour, flexShrink: 0, marginTop: 6,
            }} />
            <span style={{ fontSize: 17, color: '#334155', lineHeight: 1.5 }}>{b}</span>
          </div>
        ))}
        <CTABlock branding={branding} ctaStyle={ctaStyle} colour={colour} font={font} />
      </div>

      {/* Footer */}
      <div style={{
        height: 80, borderTop: `2px solid ${colour}`,
        display: 'flex', alignItems: 'center', padding: '0 48px',
        justifyContent: 'space-between', flexShrink: 0,
      }}>
        <span style={{ fontSize: 13, color: '#64748b' }}>{regStr}</span>
        <span style={{
          fontSize: 12, color: '#94a3b8',
          maxWidth: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {branding?.disclaimer_text}
        </span>
      </div>
    </div>
  )
}

// ── LEAFLET CANVAS — TEMPLATE B (corner_badge) ────────────────────────────────

function TemplateCornerBadge({ template, branding }) {
  const colour   = branding?.brand_colour_hex || DEFAULT_BRAND_COLOUR
  const font     = cssFontFamily(branding?.brand_font)
  const firmName = branding?.firm_name || 'Your Firm'
  const bullets  = Array.isArray(template.feature_bullets) ? template.feature_bullets : []
  const ctaStyle = template.cta_style || 'card'
  const pos      = template.corner_position || 'top_right'
  const regNums  = Array.isArray(branding?.registration_numbers) ? branding.registration_numbers : []
  const regStr   = regNums.map(r => r.display_label || `${r.type} ${r.number}`).join(' · ')

  const badgePos = {
    top:    pos.includes('bottom') ? undefined : 16,
    bottom: pos.includes('bottom') ? 96        : undefined,
    left:   pos.includes('right')  ? undefined : 16,
    right:  pos.includes('right')  ? 16        : undefined,
  }

  return (
    <div style={{
      width: 1080, height: 1080, background: '#ffffff',
      fontFamily: font, display: 'flex', flexDirection: 'column',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Hero */}
      <div style={{
        height: 340, background: template.background_colour_hex || lightTint(colour),
        flexShrink: 0, padding: '48px 48px 36px', display: 'flex', flexDirection: 'column',
        justifyContent: 'flex-end',
      }}>
        <div style={{ fontSize: 52, fontWeight: 700, color: '#1e293b', lineHeight: 1.2, marginBottom: 14 }}>
          {template.title}
        </div>
        <div style={{ fontSize: 22, color: '#475569', lineHeight: 1.5 }}>
          {template.text}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '36px 48px 0', overflow: 'hidden' }}>
        {template.body_text && (
          <div style={{ fontSize: 18, color: '#334155', lineHeight: 1.6, marginBottom: 24 }}>
            {template.body_text}
          </div>
        )}
        {bullets.map((b, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
            <span style={{
              width: 10, height: 10, borderRadius: '50%',
              background: colour, flexShrink: 0, marginTop: 6,
            }} />
            <span style={{ fontSize: 17, color: '#334155', lineHeight: 1.5 }}>{b}</span>
          </div>
        ))}
        <CTABlock branding={branding} ctaStyle={ctaStyle} colour={colour} font={font} />
      </div>

      {/* Footer */}
      <div style={{
        height: 80, borderTop: `1px solid ${colour}`,
        display: 'flex', alignItems: 'center', padding: '0 48px',
        justifyContent: 'space-between', flexShrink: 0,
      }}>
        <span style={{ fontSize: 13, color: '#64748b' }}>{regStr}</span>
        <span style={{
          fontSize: 12, color: '#94a3b8',
          maxWidth: 480, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {branding?.disclaimer_text}
        </span>
      </div>

      {/* Floating badge */}
      <div style={{
        position: 'absolute',
        ...badgePos,
        background: '#ffffff', border: `1px solid ${colour}`,
        borderRadius: 8, padding: '8px 12px',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        {branding?.logo_url && (
          <img
            src={branding.logo_url}
            alt={firmName}
            crossOrigin="anonymous"
            style={{ height: 32, width: 32, objectFit: 'contain' }}
          />
        )}
        <span style={{ fontSize: 16, fontWeight: 700, color: colour }}>{firmName}</span>
      </div>
    </div>
  )
}

// ── LEAFLET CANVAS — TEMPLATE C (footer_only) ─────────────────────────────────

function TemplateFooterOnly({ template, branding }) {
  const colour   = branding?.brand_colour_hex || DEFAULT_BRAND_COLOUR
  const font     = cssFontFamily(branding?.brand_font)
  const firmName = branding?.firm_name || 'Your Firm'
  const bullets  = Array.isArray(template.feature_bullets) ? template.feature_bullets : []
  const ctaStyle = template.cta_style || 'card'
  const regNums  = Array.isArray(branding?.registration_numbers) ? branding.registration_numbers : []
  const regStr   = regNums.map(r => r.display_label || `${r.type} ${r.number}`).join(' · ')

  return (
    <div style={{
      width: 1080, height: 1080, background: '#ffffff',
      fontFamily: font, display: 'flex', flexDirection: 'column',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Hero */}
      <div style={{
        height: 340, background: template.background_colour_hex || '#F8F9FF',
        flexShrink: 0, padding: '48px', display: 'flex', flexDirection: 'column',
        justifyContent: 'flex-end', position: 'relative',
      }}>
        <div style={{
          position: 'absolute', top: 20, right: 28,
          fontSize: 13, color: '#94a3b8', fontStyle: 'italic',
        }}>
          A FundLens initiative
        </div>
        <div style={{ fontSize: 52, fontWeight: 700, color: '#1e293b', lineHeight: 1.2, marginBottom: 14 }}>
          {template.title}
        </div>
        <div style={{ fontSize: 22, color: '#475569', lineHeight: 1.5 }}>
          {template.text}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '36px 48px 0', overflow: 'hidden' }}>
        {template.body_text && (
          <div style={{ fontSize: 18, color: '#334155', lineHeight: 1.6, marginBottom: 24 }}>
            {template.body_text}
          </div>
        )}
        {bullets.map((b, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
            <span style={{
              width: 10, height: 10, borderRadius: '50%',
              background: colour, flexShrink: 0, marginTop: 6,
            }} />
            <span style={{ fontSize: 17, color: '#334155', lineHeight: 1.5 }}>{b}</span>
          </div>
        ))}
        <CTABlock branding={branding} ctaStyle={ctaStyle} colour={colour} font={font} />
      </div>

      {/* Footer — "Distributed by Advisor / Distributor" */}
      <div style={{
        height: 160, background: colour, flexShrink: 0,
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '0 48px', gap: 8,
      }}>
        <div style={{
          fontSize: 11, color: 'rgba(255,255,255,0.6)',
          fontVariant: 'small-caps', letterSpacing: '0.1em', textTransform: 'uppercase',
        }}>
          Distributed by Advisor / Distributor
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {branding?.logo_url && (
            <img
              src={branding.logo_url}
              alt={firmName}
              crossOrigin="anonymous"
              style={{ height: 40, objectFit: 'contain', filter: 'brightness(0) invert(1)' }}
            />
          )}
          <div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#ffffff' }}>{firmName}</div>
            {regStr && (
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>{regStr}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── LEAFLET CANVAS SWITCHER ───────────────────────────────────────────────────

function LeafletCanvas({ template, branding }) {
  const layout = template.template_layout
  if (layout === 'header_split') return <TemplateHeaderSplit template={template} branding={branding} />
  if (layout === 'corner_badge') return <TemplateCornerBadge template={template} branding={branding} />
  if (layout === 'footer_only')  return <TemplateFooterOnly  template={template} branding={branding} />
  // Fallback for any future layout
  return <TemplateHeaderSplit template={template} branding={branding} />
}

// ── LEAFLET MODAL ─────────────────────────────────────────────────────────────

function LeafletModal({ template, branding, onClose }) {
  // exportRef targets the hidden, untransformed 1080x1080px div — html2canvas target
  const exportRef = useRef(null)
  const [busy, setBusy] = useState(false)

  const colour      = branding?.brand_colour_hex || DEFAULT_BRAND_COLOUR
  const firmName    = branding?.firm_name || 'Your Firm'
  const CANVAS_SIZE = 1080
  const PREVIEW_MAX = Math.min(window.innerWidth - 80, window.innerHeight - 160, 540)
  const scale       = PREVIEW_MAX / CANVAS_SIZE

  async function handleDownload() {
    if (!exportRef.current) return
    setBusy(true)
    try {
      // FIX 2: wait for all fonts (including the advisor's Google Font) before capture
      await document.fonts.ready

      const html2canvas = (await import('html2canvas')).default

      // FIX 4: explicit options — no transforms, explicit size, white background
      const cvs = await html2canvas(exportRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        width: 1080,
        height: 1080,
        windowWidth: 1080,
        windowHeight: 1080,
        logging: false,
      })

      const url  = cvs.toDataURL('image/jpeg', 0.92)
      const link = document.createElement('a')
      link.href  = url
      link.download = `${slugify(firmName)}_${slugify(template.title)}_leaflet.jpg`
      link.click()
    } catch (err) {
      console.error('[AdvisorPromote] html2canvas export error:', err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 800,
          background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)',
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 801,
        background: 'var(--color-bg)', borderRadius: 14,
        padding: 24,
        maxWidth: '96vw',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
        boxShadow: '0 24px 80px rgba(0,0,0,0.4)',
        fontFamily: "'DM Sans', sans-serif",
      }}>
        {/* Header */}
        <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)' }}>
            Leaflet preview — {template.title}
          </span>
          <button onClick={onClose} style={{
            width: 32, height: 32, border: '1px solid var(--color-border)',
            borderRadius: 8, background: 'var(--color-bg)', cursor: 'pointer',
            fontSize: 14, color: 'var(--color-text-secondary)',
          }}>✕</button>
        </div>

        {/*
          FIX 1 — VISIBLE PREVIEW DIV
          CSS-transformed for display only. pointer-events: none.
          html2canvas never touches this div.
        */}
        <div style={{
          width: PREVIEW_MAX, height: PREVIEW_MAX, overflow: 'hidden',
          borderRadius: 8, border: '1px solid var(--color-border)',
          position: 'relative', pointerEvents: 'none',
        }}>
          <div style={{
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            width: CANVAS_SIZE,
            height: CANVAS_SIZE,
          }}>
            <LeafletCanvas template={template} branding={branding} />
          </div>
        </div>

        {/* Download button */}
        <button
          onClick={handleDownload}
          disabled={busy}
          style={{
            padding: '10px 32px',
            background: colour, color: '#fff',
            border: 'none', borderRadius: 9,
            cursor: busy ? 'not-allowed' : 'pointer',
            fontSize: 14, fontWeight: 600,
            fontFamily: "'DM Sans', sans-serif",
            opacity: busy ? 0.7 : 1,
          }}
        >
          {busy ? 'Generating…' : 'Download JPEG'}
        </button>
      </div>

      {/*
        FIX 1 + FIX 3 — HIDDEN EXPORT DIV
        Rendered at true 1080x1080px with NO CSS transform.
        Positioned off-screen so it never flashes to the user.
        This is the only div html2canvas captures.
      */}
      <div
        ref={exportRef}
        style={{
          position: 'fixed',
          left: -9999,
          top: -9999,
          width: 1080,
          height: 1080,
          overflow: 'hidden',
          // No transform, no scale, no zoom
        }}
      >
        <LeafletCanvas template={template} branding={branding} />
      </div>
    </>
  )
}

// ── SECTION HEADING ───────────────────────────────────────────────────────────

function SectionHeading({ title, count }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h2 style={{
        fontSize: 20, fontWeight: 700, color: 'var(--color-text-primary)',
        margin: 0, display: 'flex', alignItems: 'center', gap: 10,
      }}>
        {title}
        <span style={{
          fontSize: 12, fontWeight: 600,
          background: 'var(--color-surface)', color: 'var(--color-text-muted)',
          borderRadius: 20, padding: '2px 10px',
        }}>{count}</span>
      </h2>
    </div>
  )
}

// ── TEMPLATE GRID ─────────────────────────────────────────────────────────────

function TemplateGrid({ templates, branding, isMobile, onGenerate, onCopy, onShare }) {
  if (templates.length === 0) {
    return (
      <div style={{
        textAlign: 'center', padding: '36px 0',
        fontSize: 13, color: 'var(--color-text-muted)',
        border: '1px dashed var(--color-border)', borderRadius: 10,
      }}>
        No templates in this category yet.
      </div>
    )
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
      gap: 16,
    }}>
      {templates.map(t => (
        <TemplateCard
          key={t.id}
          template={t}
          branding={branding}
          onGenerate={onGenerate}
          onCopy={onCopy}
          onShare={onShare}
        />
      ))}
    </div>
  )
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────

export default function AdvisorPromote() {
  const navigate = useNavigate()
  const { user, token, loading: authLoading } = useAuth()
  const { isAdvisor, isAdmin } = useRole()
  const width    = useWindowWidth()
  const isMobile = width <= 768

  const [templates, setTemplates]     = useState([])
  const [branding, setBranding]       = useState(null)
  const [loadingData, setLoadingData] = useState(true)

  const [leafletModal, setLeafletModal] = useState(null)

  const [toast, setToast] = useState(null)
  const showToast = useCallback((msg) => setToast(msg), [])

  // ── Font loading ─────────────────────────────────────────────────────────────
  useEffect(() => {
    loadBrandFont(branding?.brand_font || DEFAULT_FONT)
  }, [branding?.brand_font])

  // ── Data fetch ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || !token || (!isAdvisor && !isAdmin)) return

    const sb = createSupabaseClient(token)
    let cancelled = false

    async function fetchAll() {
      setLoadingData(true)

      try {
        const { data, error } = await supabase
          .from('promo_messages')
          .select('*')
          .eq('is_active', true)
          .order('display_order', { ascending: true })

        if (error) {
          console.error('[AdvisorPromote] promo_messages fetch error:', error)
        } else if (!cancelled) {
          setTemplates(data || [])
        }
      } catch (err) {
        console.error('[AdvisorPromote] promo_messages fetch failed:', err)
      }

      try {
        const { data, error } = await sb
          .from('advisor_firm_profiles')
          .select('*')
          .eq('advisor_id', user.uid)
          .maybeSingle()

        if (error) {
          console.error('[AdvisorPromote] advisor_firm_profiles fetch error:', error)
        } else if (!cancelled) {
          setBranding(data || null)
        }
      } catch (err) {
        console.error('[AdvisorPromote] advisor_firm_profiles fetch failed:', err)
      }

      if (!cancelled) setLoadingData(false)
    }

    fetchAll()
    return () => { cancelled = true }
  }, [user, token, isAdvisor, isAdmin])

  const leaflets  = templates.filter(t => t.category === 'leaflet')
  const emails    = templates.filter(t => t.category === 'email')
  const whatsapps = templates.filter(t => t.category === 'whatsapp')

  function buildSignature() {
    const b = branding
    if (!b) return ''
    const regNums = Array.isArray(b.registration_numbers) ? b.registration_numbers : []
    const regStr  = regNums.map(r => r.display_label || `${r.type} ${r.number}`).join(' · ')
    return [
      'Warm regards,',
      b.firm_name || '',
      [b.helpdesk_phone, b.helpdesk_email].filter(Boolean).join(' · '),
      b.website_url || '',
      regStr || '',
      b.disclaimer_text || '',
      'Powered by FundLens — fundlens.in',
    ].filter(Boolean).join('\n')
  }

  async function handleCopy(template) {
    const full = `Subject: ${template.title || ''}\n\n${template.body_text || template.text || ''}\n\n${buildSignature()}`
    try {
      await navigator.clipboard.writeText(full)
      showToast('Email draft copied to clipboard')
    } catch (err) {
      console.error('[AdvisorPromote] clipboard write error:', err)
      showToast('Could not copy — please copy manually')
    }
  }

  async function handleShare(template) {
    const firmName = branding?.firm_name || 'Your Advisor / Distributor'
    const phone    = branding?.helpdesk_phone || ''
    const msg = [template.title, '', template.text || '', '', firmName, phone]
      .filter(line => line !== undefined)
      .join('\n')

    if (navigator.share) {
      try {
        await navigator.share({ text: msg })
        showToast('Shared successfully')
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('[AdvisorPromote] Web Share API error:', err)
        }
      }
    } else {
      try {
        await navigator.clipboard.writeText(msg)
        showToast('Message copied — paste into WhatsApp')
      } catch (err) {
        console.error('[AdvisorPromote] clipboard fallback error:', err)
        showToast('Could not copy — please copy manually')
      }
    }
  }

  // ── Auth / role gates ────────────────────────────────────────────────────────

  if (authLoading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '60vh', fontFamily: "'DM Sans', sans-serif",
      }}>
        <span style={{ color: 'var(--color-text-muted)', fontSize: 15 }}>Loading…</span>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  if (!isAdvisor && !isAdmin) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '60vh', fontFamily: "'DM Sans', sans-serif",
      }}>
        <div style={{ textAlign: 'center', maxWidth: 380, padding: '0 20px' }}>
          <div style={{ fontSize: 40, marginBottom: 20 }}>🔒</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 12px' }}>
            Advisor / Distributor access required.
          </h2>
          <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginBottom: 28, lineHeight: 1.6 }}>
            Upgrade to an Advisor / Distributor plan to unlock co-branded marketing materials.
          </p>
          <a
            href="/upgrade"
            style={{
              display: 'inline-flex', alignItems: 'center', padding: '10px 24px',
              background: 'var(--color-primary)', color: '#fff',
              borderRadius: 10, textDecoration: 'none', fontWeight: 600, fontSize: 14,
            }}
          >
            Upgrade
          </a>
        </div>
      </div>
    )
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');`}</style>

      <div style={{
        maxWidth: 1200, margin: '0 auto',
        padding: isMobile ? '20px 16px 48px' : '32px 28px 60px',
        fontFamily: "'DM Sans', sans-serif",
      }}>

        <div style={{ marginBottom: 32 }}>
          <h1 style={{
            fontSize: isMobile ? 22 : 28, fontWeight: 700,
            color: 'var(--color-text-primary)', margin: '0 0 6px',
          }}>
            Promote
          </h1>
          <div style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>
            Co-branded marketing materials for client acquisition
          </div>
        </div>

        {!loadingData && !branding && (
          <div style={{
            background: '#fffbeb', border: '1px solid #fbbf24',
            borderRadius: 10, padding: '14px 18px', marginBottom: 28,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: 10,
          }}>
            <span style={{ fontSize: 13, color: '#92400e' }}>
              Complete your branding setup to personalise these materials.
            </span>
            <Link
              to="/advisor/settings"
              style={{ fontSize: 13, fontWeight: 600, color: '#b45309', textDecoration: 'underline' }}
            >
              Set up branding →
            </Link>
          </div>
        )}

        {loadingData && (
          <div style={{ textAlign: 'center', padding: '48px 0', fontSize: 13, color: 'var(--color-text-muted)' }}>
            Loading templates…
          </div>
        )}

        {!loadingData && (
          <div style={{ marginBottom: 48 }}>
            <SectionHeading title="Leaflets (JPEG)" count={leaflets.length} />
            <TemplateGrid
              templates={leaflets} branding={branding} isMobile={isMobile}
              onGenerate={setLeafletModal} onCopy={handleCopy} onShare={handleShare}
            />
          </div>
        )}

        {!loadingData && (
          <div style={{ marginBottom: 48 }}>
            <SectionHeading title="Email campaigns" count={emails.length} />
            <TemplateGrid
              templates={emails} branding={branding} isMobile={isMobile}
              onGenerate={setLeafletModal} onCopy={handleCopy} onShare={handleShare}
            />
          </div>
        )}

        {!loadingData && (
          <div style={{ marginBottom: 24 }}>
            <SectionHeading title="WhatsApp messages" count={whatsapps.length} />
            <TemplateGrid
              templates={whatsapps} branding={branding} isMobile={isMobile}
              onGenerate={setLeafletModal} onCopy={handleCopy} onShare={handleShare}
            />
          </div>
        )}

        {!loadingData && templates.length === 0 && (
          <div style={{ textAlign: 'center', padding: '72px 0', color: 'var(--color-text-muted)' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>📋</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 8 }}>
              No templates yet.
            </div>
            <div style={{ fontSize: 13 }}>
              Templates will appear here once the admin publishes them.
            </div>
          </div>
        )}

      </div>

      {leafletModal && (
        <LeafletModal
          template={leafletModal}
          branding={branding}
          onClose={() => setLeafletModal(null)}
        />
      )}

      {toast && (
        <Toast message={toast} onDone={() => setToast(null)} />
      )}
    </>
  )
}
