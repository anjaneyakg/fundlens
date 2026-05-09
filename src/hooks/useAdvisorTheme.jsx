import { useState, useEffect } from 'react'
import { useAuth } from './useAuth'
import { useRole } from './useRole'

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY
const STYLE_TAG_ID  = 'advisor-theme'

// Only --color-primary and --color-primary-dark are permitted as overrides.
// Any other variable names in css_override are silently dropped.
function buildSafeOverride(rawCss) {
  if (!rawCss) return null
  const primaryMatch   = rawCss.match(/--color-primary\s*:\s*(#[0-9a-fA-F]{3,8})/)
  const primaryDkMatch = rawCss.match(/--color-primary-dark\s*:\s*(#[0-9a-fA-F]{3,8})/)
  const parts = []
  if (primaryMatch)   parts.push(`--color-primary: ${primaryMatch[1]}`)
  if (primaryDkMatch) parts.push(`--color-primary-dark: ${primaryDkMatch[1]}`)
  return parts.length ? `:root { ${parts.join('; ')} }` : null
}

function removeThemeTag() {
  const tag = document.getElementById(STYLE_TAG_ID)
  if (tag) tag.remove()
}

function injectThemeTag(css) {
  let tag = document.getElementById(STYLE_TAG_ID)
  if (!tag) {
    tag = document.createElement('style')
    tag.id = STYLE_TAG_ID
    document.head.appendChild(tag)
  }
  tag.textContent = css
}

export function useAdvisorTheme() {
  const { user, token } = useAuth()
  const { isAdvisor }   = useRole()
  const [advisorLogo, setAdvisorLogo] = useState(null)

  useEffect(() => {
    if (!user || !isAdvisor || !token) {
      removeThemeTag()
      setAdvisorLogo(null)
      return
    }

    async function loadProfile() {
      try {
        const uid = user.uid
        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/advisor_profiles?user_id=eq.${encodeURIComponent(uid)}&select=logo_url,css_override&limit=1`,
          {
            headers: {
              apikey:         SUPABASE_ANON,
              Authorization:  `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }
        )
        if (!res.ok) {
          console.error('useAdvisorTheme: profile fetch failed:', res.status)
          return
        }
        const rows    = await res.json()
        const profile = rows?.[0]
        if (!profile) return

        const safeCss = buildSafeOverride(profile.css_override)
        if (safeCss) injectThemeTag(safeCss)
        else         removeThemeTag()

        setAdvisorLogo(profile.logo_url || null)
      } catch (err) {
        console.error('useAdvisorTheme: error loading advisor profile:', err)
      }
    }

    loadProfile()
  }, [user, isAdvisor, token])

  // Remove the injected tag on unmount
  useEffect(() => {
    return () => removeThemeTag()
  }, [])

  return { advisorLogo }
}
