# pipeline_cell2.py — FundLens v4.0
# Upload all 5 outputs to Gists

import json, os, requests

# Works in both GitHub Actions (env var) and Colab (userdata)
try:
    from google.colab import userdata
    GITHUB_TOKEN = userdata.get('GITHUB_TOKEN')
except ImportError:
    GITHUB_TOKEN = os.environ.get('GITHUB_TOKEN', '')

HEADERS = {
    "Authorization": f"token {GITHUB_TOKEN}",
    "Accept": "application/vnd.github.v3+json",
}

# ── Gist IDs ─────────────────────────────────────────────────────────────────

GIST_MAIN     = "64368e3f1dfef3f82da8fa9f0f164211"
GIST_RETURNS  = "f25b56e04e6c54a153fc1280ff259557"
GIST_RATIOS   = "90d783d7de0ba4a67b53138dd922a552"
GIST_CATINDEX = "377985ac0904a27a0a328c0834faffda"
GIST_NAVHIST  = "6f82d116b7067a8d13aa620e99aa783f"

NAV_HISTORY_DIR = "nav_history"

# ── Helpers ───────────────────────────────────────────────────────────────────

def upload_file(gist_id, filename, local_path, label):
    print(f"\n  Uploading {label}...", end=" ")
    if not os.path.exists(local_path):
        print(f"SKIPPED — not found"); return False
    content = open(local_path, encoding="utf-8").read()
    mb = len(content.encode())/(1024*1024)
    resp = requests.patch(
        f"https://api.github.com/gists/{gist_id}",
        headers=HEADERS,
        json={"files": {filename: {"content": content}}},
        timeout=120,
    )
    if resp.status_code == 200:
        print(f"✅ ({mb:.2f}MB)"); return True
    print(f"❌ {resp.status_code}: {resp.text[:200]}"); return False


def upload_nav_history(gist_id):
    print(f"\n  Uploading NAV history files in batches...")
    if not os.path.isdir(NAV_HISTORY_DIR):
        print("  SKIPPED — nav_history/ not found"); return False

    local_files = sorted([f for f in os.listdir(NAV_HISTORY_DIR) if f.endswith(".json")])
    total_mb = sum(os.path.getsize(os.path.join(NAV_HISTORY_DIR,f))/(1024*1024) for f in local_files)
    print(f"  {len(local_files)} files | {total_mb:.1f}MB total")

    # Delete stale files first
    existing = requests.get(f"https://api.github.com/gists/{gist_id}",
                            headers=HEADERS, timeout=30)
    stale_payload = {}
    if existing.status_code == 200:
        existing_files = set(existing.json().get("files", {}).keys())
        current_files  = set(local_files)
        for stale in existing_files - current_files:
            print(f"  Removing stale: {stale}")
            stale_payload[stale] = None
        if stale_payload:
            requests.patch(f"https://api.github.com/gists/{gist_id}",
                           headers=HEADERS, json={"files": stale_payload}, timeout=60)

    # Upload in batches of 10 files
    BATCH_SIZE = 10
    batches = [local_files[i:i+BATCH_SIZE] for i in range(0, len(local_files), BATCH_SIZE)]
    failed  = []

    for b_idx, batch in enumerate(batches, 1):
        batch_mb = sum(os.path.getsize(os.path.join(NAV_HISTORY_DIR,f))/(1024*1024) for f in batch)
        print(f"  Batch {b_idx}/{len(batches)}: {len(batch)} files ({batch_mb:.1f}MB)...", end=" ")
        files_payload = {}
        for fname in batch:
            content = open(os.path.join(NAV_HISTORY_DIR, fname), encoding="utf-8").read()
            files_payload[fname] = {"content": content}
        resp = requests.patch(
            f"https://api.github.com/gists/{gist_id}",
            headers=HEADERS,
            json={"files": files_payload},
            timeout=120,
        )
        if resp.status_code == 200:
            print(f"✅")
        else:
            print(f"❌ {resp.status_code}: {resp.text[:150]}")
            failed.extend(batch)

    if failed:
        print(f"\n  ⚠️  {len(failed)} files failed: {failed}")
        return False

    print(f"\n  ✅ All {len(local_files)} NAV history files uploaded in {len(batches)} batches")
    return True


# ── Main ──────────────────────────────────────────────────────────────────────

print("=" * 60)
print("FundLens Pipeline v4.0 — Cell 2: Upload")
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
