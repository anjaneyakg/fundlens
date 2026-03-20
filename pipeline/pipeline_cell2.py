# pipeline_cell2.py — FundLens v4.3
# Upload all 5 outputs to Gists
#
# Changes from v4.1:
# - NAV file location: looks in CWD root (where Cell 1 writes nav_*.json),
#   with nav_history/ as fallback. v4.1 was looking only in nav_history/ — wrong.
# - Per-file size guard: files > FILE_SIZE_THRESHOLD uploaded solo (1 file/batch)
#   nav_other_regular.json was 22.3MB and growing — batch of 5 hit 41MB → 422
# - Retry with exponential backoff on 5xx + ChunkedEncodingError
# - sys.exit(1) on any upload failure so GitHub Actions flags the run red

import json, os, sys, time, requests
from requests.exceptions import ChunkedEncodingError
from validate import validate_main_gist, print_validation_summary, ValidationError

try:
    from google.colab import userdata
    GITHUB_TOKEN = userdata.get('GITHUB_TOKEN')
except ImportError:
    GITHUB_TOKEN = os.environ.get('GITHUB_TOKEN', '')

def get_headers():
    token = os.environ.get('GITHUB_TOKEN', GITHUB_TOKEN)
    return {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github.v3+json",
    }

# ── Gist IDs ──────────────────────────────────────────────────────────────────

GIST_MAIN     = "64368e3f1dfef3f82da8fa9f0f164211"
GIST_RETURNS  = "f25b56e04e6c54a153fc1280ff259557"
GIST_RATIOS   = "90d783d7de0ba4a67b53138dd922a552"
GIST_CATINDEX = "377985ac0904a27a0a328c0834faffda"
GIST_NAVHIST  = "6f82d116b7067a8d13aa620e99aa783f"

# ── Configuration ─────────────────────────────────────────────────────────────

BATCH_SIZE          = 4
FILE_SIZE_THRESHOLD = 20 * 1024 * 1024   # 20MB — above this, upload solo
MAX_RETRIES         = 3
RETRY_BACKOFF_BASE  = 2                  # seconds: 2s, 4s, 8s
BATCH_DELAY         = 2                  # seconds between batches — avoids 403 rate limit

# ── Validation Gate ───────────────────────────────────────────────────────────

def run_validation_gate():
    from datetime import date
    today = date.today().isoformat()
    print("\n  Running validation gate...")
    if not os.path.exists("fundlens_schemes.json"):
        raise ValidationError("fundlens_schemes.json not found — cannot validate. Aborting.")
    with open("fundlens_schemes.json", encoding="utf-8") as f:
        data = json.load(f)
    warnings = validate_main_gist(data, today)
    print_validation_summary(warnings, label="Main Gist")

# ── Core upload with retry ────────────────────────────────────────────────────

def patch_gist(gist_id, files_dict):
    """
    PATCH a Gist. Retries on 5xx and ChunkedEncodingError.
    Returns (True, None) on success, (False, status_code) on failure.
    """
    url     = f"https://api.github.com/gists/{gist_id}"
    payload = json.dumps({"files": files_dict}).encode("utf-8")

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            resp = requests.patch(
                url, data=payload,
                headers={**get_headers(), "Content-Type": "application/json"},
                timeout=180,
            )
            if resp.status_code == 200:
                return True, None
            if resp.status_code in (502, 503, 504):
                wait = RETRY_BACKOFF_BASE ** attempt
                print(f"\n    ⚠ {resp.status_code} — attempt {attempt}/{MAX_RETRIES}, retry in {wait}s…",
                      end="", flush=True)
                time.sleep(wait)
                continue
            return False, resp.status_code
        except ChunkedEncodingError:
            wait = RETRY_BACKOFF_BASE ** attempt
            print(f"\n    ⚠ ChunkedEncodingError — attempt {attempt}/{MAX_RETRIES}, retry in {wait}s…",
                  end="", flush=True)
            time.sleep(wait)
            continue
        except Exception as e:
            print(f"\n    ❌ {e}")
            return False, -1

    return False, -1


def upload_file(gist_id, filename, local_path, label):
    print(f"\n  Uploading {label}...", end=" ", flush=True)
    if not os.path.exists(local_path):
        print("SKIPPED — not found"); return False
    content = open(local_path, encoding="utf-8").read()
    mb = len(content.encode()) / (1024 * 1024)
    ok, code = patch_gist(gist_id, {filename: {"content": content}})
    if ok:
        print(f"✅ ({mb:.2f}MB)"); return True
    print(f"❌ {code} ({mb:.2f}MB)"); return False


def find_nav_files():
    """
    Locate nav_*.json files.
    Cell 1 writes them to CWD (repo root). nav_history/ is fallback only.
    Returns list of (filename, full_path).
    """
    # Primary: root directory
    root = sorted([
        (f, f) for f in os.listdir(".")
        if f.startswith("nav_") and f.endswith(".json")
    ])
    if root:
        return root

    # Fallback: nav_history/ subdir
    if os.path.isdir("nav_history"):
        sub = sorted([
            (f, os.path.join("nav_history", f))
            for f in os.listdir("nav_history")
            if f.endswith(".json")
        ])
        if sub:
            print("  ℹ NAV files found in nav_history/ (fallback)")
            return sub

    return []


def upload_nav_history(gist_id):
    print(f"\n  Uploading NAV history files in batches...")

    nav_files = find_nav_files()
    if not nav_files:
        print("  SKIPPED — no nav_*.json files found"); return False

    # Read all + measure
    file_data = {}
    for fname, fpath in nav_files:
        content = open(fpath, encoding="utf-8").read()
        file_data[fname] = (content, len(content.encode()))

    total_files = len(file_data)
    total_mb    = sum(sz for _, sz in file_data.values()) / (1024 * 1024)
    print(f"  {total_files} files | {total_mb:.1f}MB total")

    # Remove stale files from Gist
    existing = requests.get(f"https://api.github.com/gists/{gist_id}",
                            headers=get_headers(), timeout=30)
    if existing.status_code == 200:
        existing_names = set(existing.json().get("files", {}).keys())
        stale = existing_names - set(file_data.keys())
        if stale:
            print(f"  Removing {len(stale)} stale: {sorted(stale)}")
            patch_gist(gist_id, {f: None for f in stale})

    # Split: oversized files go solo, rest batch at BATCH_SIZE
    oversized = [(fn, c, sz) for fn, (c, sz) in file_data.items() if sz >  FILE_SIZE_THRESHOLD]
    normal    = [(fn, c, sz) for fn, (c, sz) in file_data.items() if sz <= FILE_SIZE_THRESHOLD]

    if oversized:
        print(f"  ⚠ {len(oversized)} file(s) > {FILE_SIZE_THRESHOLD//1024//1024}MB — solo upload:")
        for fn, _, sz in oversized:
            print(f"     • {fn}: {sz/1024/1024:.1f}MB")

    batches = []
    for fn, c, _  in oversized:
        batches.append([(fn, c)])
    for i in range(0, len(normal), BATCH_SIZE):
        batches.append([(fn, c) for fn, c, _ in normal[i:i + BATCH_SIZE]])

    failed_batches = []
    for b_idx, batch in enumerate(batches, 1):
        batch_mb = sum(file_data[fn][1] for fn, _ in batch) / (1024 * 1024)
        is_solo  = len(batch) == 1 and file_data[batch[0][0]][1] > FILE_SIZE_THRESHOLD
        tag      = " [solo — oversized]" if is_solo else ""
        print(f"  Batch {b_idx}/{len(batches)}: {len(batch)} file(s) ({batch_mb:.1f}MB){tag}...",
              end=" ", flush=True)

        ok, code = patch_gist(gist_id, {fn: {"content": c} for fn, c in batch})
        if ok:
            print("✅")
        else:
            if code == 422:
                print(f"❌ 422 — still too large solo:")
                for fn, _ in batch:
                    print(f"     • {fn}: {file_data[fn][1]/1024/1024:.1f}MB — needs manual split")
            else:
                print(f"❌ {code}")
            failed_batches.append(b_idx)
        time.sleep(BATCH_DELAY)

    if failed_batches:
        print(f"\n  ❌ {len(failed_batches)} batch(es) failed: {failed_batches}")
        return False

    print(f"\n  ✅ All {len(batches)} batches uploaded ({total_files} files)")
    return True

# ── Main ──────────────────────────────────────────────────────────────────────

print("=" * 60)
print("FundLens Pipeline v4.2 — Cell 2: Upload")
print("=" * 60)

try:
    run_validation_gate()
except ValidationError as e:
    print(e)
    print("\n🚫 Upload aborted. Existing live Gists preserved. Site unaffected.")
    raise SystemExit(1)

print("\n✅ Validation passed. Proceeding with uploads...")
print("=" * 60)

results = [
    upload_file(GIST_MAIN,     "fundlens_schemes.json",       "fundlens_schemes.json",       "Schemes"),
    upload_file(GIST_RETURNS,  "fundlens_returns.json",        "fundlens_returns.json",        "Returns"),
    upload_file(GIST_RATIOS,   "fundlens_ratios.json",         "fundlens_ratios.json",         "Ratios"),
    upload_file(GIST_CATINDEX, "fundlens_category_index.json", "fundlens_category_index.json", "Category Index"),
    upload_nav_history(GIST_NAVHIST),
]

ok = sum(results)
print(f"\n{'=' * 60}")
if ok == len(results):
    print(f"✅ All {ok} uploads succeeded. Site updates in ~60 sec.")
else:
    print(f"⚠️  {ok}/{len(results)} succeeded. Check errors above.")
    sys.exit(1)
