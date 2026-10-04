// api/github-upload.js
// Admin-only proxy for GitHub operations on the FundInsight repo.
// Every action requires a verified Firebase ID token (RS256) with profiles.role = 'admin'.
// Errors returned to the browser never include the PAT or raw GitHub response headers.
//
// Actions (POST only):
//   gh-get            — GET file contents (sha + base64 content)
//   gh-list-dir       — GET directory listing (data/raw/{month})
//   gh-delete         — DELETE file (data/raw/ only)
//   gh-put-small      — PUT amc_map.json only (≤ 200 KB raw)
//   gh-put-amfi       — PUT to data/amfi-marketcap/ (≤ 3 MB raw)
//   gh-get-upload-url — Return a signed Supabase Storage upload URL for large files
//   gh-put-from-storage — Copy file from Supabase Storage → GitHub, then delete it

import { verifyAdminToken } from './_lib/verifyFirebaseToken.js';
import { createClient }      from '@supabase/supabase-js';

const GITHUB_PAT   = process.env.GITHUB_PAT;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const GH_OWNER     = 'anjaneyakg';
const GH_REPO      = 'FundInsight';
const GH_BRANCH    = 'main';
const CORS_ORIGIN  = 'https://fundlens-six.vercel.app';
const BUCKET       = 'portfolio-pipeline-uploads';
const LIMIT_SMALL  = 200   * 1024;        // 200 KB  — amc_map.json
const LIMIT_AMFI   = 3     * 1024 * 1024; // 3 MB    — AMFI xlsx backup

const corsHeaders = {
  'Access-Control-Allow-Origin':  CORS_ORIGIN,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Content-Type':                 'application/json',
};

// ── Path validation ─────────────────────────────────────────────────────────────
// Patterns derived from the full git ls-tree of data/ in FundInsight (Oct 2026).
// \x20 = ASCII space (filenames like "Monthly HDFC Arbitrage Fund - 31 March 2026.xlsx").
// () = parentheses (filenames like "Choice_Gold_ETF___February_2026_(1).xlsx").

const RE_RAW_FILE  = /^data\/raw\/\d{4}-\d{2}\/[A-Za-z0-9._\-()\x20]{1,120}$/;
const RE_AMC_MAP   = /^data\/raw\/\d{4}-\d{2}\/amc_map\.json$/;
const RE_RAW_DIR   = /^data\/raw\/\d{4}-\d{2}$/;
const RE_AMFI_FILE = /^data\/amfi-marketcap\/[A-Za-z0-9._\-()\x20]{1,120}$/;
const RE_BANNED    = /\.\.|\/\/|\\|%|\.github/;

export function validatePath(path, type) {
  if (typeof path !== 'string') return false;
  if (RE_BANNED.test(path)) return false;
  const basename = path.split('/').pop();
  if (!basename || basename.startsWith('.git')) return false;
  switch (type) {
    case 'raw-file':  return RE_RAW_FILE.test(path);
    case 'amc-map':   return RE_AMC_MAP.test(path);
    case 'raw-dir':   return RE_RAW_DIR.test(path);
    case 'amfi-file': return RE_AMFI_FILE.test(path);
    default:          return false;
  }
}

// ── Supabase client (lazy) ──────────────────────────────────────────────────────
let _sb = null;
function sb() {
  if (!_sb) _sb = createClient(SUPABASE_URL, SERVICE_KEY);
  return _sb;
}

// ── GitHub API helper ───────────────────────────────────────────────────────────
async function ghFetch(method, path, body = null) {
  // Encode each path segment so spaces, parens, etc. are safe in the URL
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  const opts = {
    method,
    headers: {
      Authorization: `token ${GITHUB_PAT}`,
      Accept:        'application/vnd.github.v3+json',
      'User-Agent':  'fundlens-server',
    },
  };
  if (body !== null) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  return fetch(
    `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${encodedPath}`,
    opts,
  );
}

// ── Router ──────────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' });

  const uid = await verifyAdminToken(req.headers.authorization);
  if (!uid) return res.status(403).json({ error: 'Admin access required' });

  const { action } = req.query;
  if (action === 'gh-get')              return handleGet(req, res);
  if (action === 'gh-list-dir')         return handleListDir(req, res);
  if (action === 'gh-delete')           return handleDelete(req, res);
  if (action === 'gh-put-small')        return handlePutSmall(req, res);
  if (action === 'gh-put-amfi')         return handlePutAmfi(req, res);
  if (action === 'gh-get-upload-url')   return handleGetUploadUrl(req, res, uid);
  if (action === 'gh-put-from-storage') return handlePutFromStorage(req, res);
  return res.status(400).json({ error: 'Unknown action' });
}

// ── gh-get ──────────────────────────────────────────────────────────────────────
async function handleGet(req, res) {
  const { path } = req.body ?? {};
  const ok = validatePath(path, 'raw-file') ||
             validatePath(path, 'amc-map')  ||
             validatePath(path, 'amfi-file');
  if (!ok) return res.status(400).json({ error: 'Invalid path' });

  try {
    const r = await ghFetch('GET', path);
    if (r.status === 404) return res.status(404).json({ error: 'Not found' });
    if (!r.ok) {
      console.error('[gh-get] GitHub error:', r.status);
      return res.status(502).json({ error: 'GitHub request failed' });
    }
    const d = await r.json();
    return res.status(200).json({ sha: d.sha, content: d.content, encoding: d.encoding });
  } catch (err) {
    console.error('[gh-get] error:', err.message);
    return res.status(500).json({ error: 'Internal error' });
  }
}

// ── gh-list-dir ─────────────────────────────────────────────────────────────────
async function handleListDir(req, res) {
  const { path } = req.body ?? {};
  if (!validatePath(path, 'raw-dir')) return res.status(400).json({ error: 'Invalid path' });

  try {
    const r = await ghFetch('GET', path);
    if (r.status === 404) return res.status(200).json({ items: [] });
    if (!r.ok) {
      console.error('[gh-list-dir] GitHub error:', r.status);
      return res.status(502).json({ error: 'GitHub request failed' });
    }
    const d = await r.json();
    const items = Array.isArray(d)
      ? d.filter(f => f.type === 'file').map(f => ({ name: f.name, path: f.path, sha: f.sha, size: f.size }))
      : [];
    return res.status(200).json({ items });
  } catch (err) {
    console.error('[gh-list-dir] error:', err.message);
    return res.status(500).json({ error: 'Internal error' });
  }
}

// ── gh-delete ───────────────────────────────────────────────────────────────────
async function handleDelete(req, res) {
  const { path, sha, message } = req.body ?? {};
  const ok = validatePath(path, 'raw-file') || validatePath(path, 'amc-map');
  if (!ok)      return res.status(400).json({ error: 'Delete allowed only under data/raw/' });
  if (!sha)     return res.status(400).json({ error: 'sha required' });
  if (!message) return res.status(400).json({ error: 'message required' });

  try {
    const r = await ghFetch('DELETE', path, { message, sha, branch: GH_BRANCH });
    if (!r.ok) {
      console.error('[gh-delete] GitHub error:', r.status);
      return res.status(502).json({ error: 'GitHub request failed' });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[gh-delete] error:', err.message);
    return res.status(500).json({ error: 'Internal error' });
  }
}

// ── gh-put-small (amc_map.json only, ≤ 200 KB raw) ─────────────────────────────
async function handlePutSmall(req, res) {
  const { path, content, message, sha } = req.body ?? {};
  if (!validatePath(path, 'amc-map')) {
    return res.status(400).json({ error: 'gh-put-small is only allowed for amc_map.json' });
  }
  if (!content) return res.status(400).json({ error: 'content required' });
  if (!message) return res.status(400).json({ error: 'message required' });

  const rawBytes = Math.ceil(content.replace(/[^A-Za-z0-9+/]/g, '').length * 0.75);
  if (rawBytes > LIMIT_SMALL) {
    return res.status(413).json({ error: `amc_map.json too large (${rawBytes} bytes, limit 200 KB)` });
  }

  try {
    const r = await ghFetch('PUT', path, { message, content, branch: GH_BRANCH, ...(sha ? { sha } : {}) });
    if (!r.ok) {
      console.error('[gh-put-small] GitHub error:', r.status);
      return res.status(502).json({ error: 'GitHub request failed' });
    }
    const d = await r.json();
    return res.status(200).json({ sha: d.content?.sha });
  } catch (err) {
    console.error('[gh-put-small] error:', err.message);
    return res.status(500).json({ error: 'Internal error' });
  }
}

// ── gh-put-amfi (data/amfi-marketcap/ only, ≤ 3 MB raw) ────────────────────────
async function handlePutAmfi(req, res) {
  const { path, content, message, sha } = req.body ?? {};
  if (!validatePath(path, 'amfi-file')) {
    return res.status(400).json({ error: 'gh-put-amfi is only allowed under data/amfi-marketcap/' });
  }
  if (!content) return res.status(400).json({ error: 'content required' });
  if (!message) return res.status(400).json({ error: 'message required' });

  const rawBytes = Math.ceil(content.replace(/[^A-Za-z0-9+/]/g, '').length * 0.75);
  if (rawBytes > LIMIT_AMFI) {
    return res.status(413).json({
      error: `File too large to back up via proxy (${(rawBytes / 1048576).toFixed(1)} MB — limit 3 MB). The Supabase upload succeeded; only the GitHub backup was skipped.`,
    });
  }

  try {
    const r = await ghFetch('PUT', path, { message, content, branch: GH_BRANCH, ...(sha ? { sha } : {}) });
    if (!r.ok) {
      console.error('[gh-put-amfi] GitHub error:', r.status);
      return res.status(502).json({ error: 'GitHub request failed' });
    }
    const d = await r.json();
    return res.status(200).json({ sha: d.content?.sha });
  } catch (err) {
    console.error('[gh-put-amfi] error:', err.message);
    return res.status(500).json({ error: 'Internal error' });
  }
}

// ── gh-get-upload-url ────────────────────────────────────────────────────────────
async function handleGetUploadUrl(req, res, uid) {
  const { githubPath } = req.body ?? {};
  if (!validatePath(githubPath, 'raw-file')) {
    return res.status(400).json({ error: 'Invalid githubPath' });
  }

  // Derive storage path from the validated githubPath basename — never from raw user input
  const safeBasename = githubPath.split('/').pop();
  const storagePath  = `tmp/${uid}/${Date.now()}/${safeBasename}`;

  try {
    const { data, error } = await sb().storage.from(BUCKET).createSignedUploadUrl(storagePath);
    if (error) {
      console.error('[gh-get-upload-url] Storage error:', error.message);
      return res.status(500).json({ error: 'Could not create upload URL' });
    }
    return res.status(200).json({ uploadUrl: data.signedUrl, storagePath });
  } catch (err) {
    console.error('[gh-get-upload-url] error:', err.message);
    return res.status(500).json({ error: 'Internal error' });
  }
}

// ── gh-put-from-storage ──────────────────────────────────────────────────────────
async function handlePutFromStorage(req, res) {
  const { storagePath, githubPath, message, sha } = req.body ?? {};

  if (!validatePath(githubPath, 'raw-file')) {
    return res.status(400).json({ error: 'Invalid githubPath' });
  }
  // storagePath must start with 'tmp/' and its basename must match githubPath basename
  const expectedBasename = githubPath.split('/').pop();
  const storageBasename  = storagePath?.split('/').pop();
  if (typeof storagePath !== 'string' ||
      !storagePath.startsWith('tmp/') ||
      storageBasename !== expectedBasename) {
    return res.status(400).json({ error: 'Invalid storagePath' });
  }
  if (!message) return res.status(400).json({ error: 'message required' });

  const store = sb();

  // Download from Supabase Storage (service role — no size limit on response)
  let fileBlob;
  try {
    const { data, error } = await store.storage.from(BUCKET).download(storagePath);
    if (error) {
      console.error('[gh-put-from-storage] download error:', error.message);
      return res.status(500).json({ error: 'Could not read file from storage' });
    }
    fileBlob = data;
  } catch (err) {
    console.error('[gh-put-from-storage] download exception:', err.message);
    return res.status(500).json({ error: 'Internal error' });
  }

  // Base64-encode for GitHub Contents API
  const b64 = Buffer.from(await fileBlob.arrayBuffer()).toString('base64');

  // PUT to GitHub, then clean up temp storage regardless of outcome
  try {
    const ghBody = { message, content: b64, branch: GH_BRANCH, ...(sha ? { sha } : {}) };
    const r      = await ghFetch('PUT', githubPath, ghBody);

    if (!r.ok) {
      const errText = await r.text().catch(() => '');
      console.error('[gh-put-from-storage] GitHub PUT failed:', r.status, errText.slice(0, 120));
      store.storage.from(BUCKET).remove([storagePath])
        .catch(e => console.error('[gh-put-from-storage] cleanup-on-failure error:', e.message));
      return res.status(502).json({ error: 'GitHub upload failed' });
    }

    const d = await r.json();
    store.storage.from(BUCKET).remove([storagePath])
      .catch(e => console.error('[gh-put-from-storage] cleanup error:', e.message));
    return res.status(200).json({ sha: d.content?.sha });

  } catch (err) {
    store.storage.from(BUCKET).remove([storagePath])
      .catch(e => console.error('[gh-put-from-storage] cleanup-on-exception error:', e.message));
    console.error('[gh-put-from-storage] error:', err.message);
    return res.status(500).json({ error: 'Internal error' });
  }
}
