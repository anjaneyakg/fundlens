# pipeline_cell2.py
# FundLens Data Pipeline — Cell 2 — v4.0
# Uploads all output files from Cell 1 to their respective Gists.
#
# Gist map:
#   GIST_MAIN     — fundlens_schemes.json
#   GIST_RETURNS  — fundlens_returns.json
#   GIST_RATIOS   — fundlens_ratios.json
#   GIST_CATINDEX — fundlens_category_index.json
#   GIST_NAVHIST  — nav_history/*.json (one file per category x plan, ~74 files)
#
# Run Cell 1 first. Cell 2 reads the files Cell 1 saved locally.

import json
import os
import requests

try:
    from google.colab import userdata
    GITHUB_TOKEN = userdata.get('GITHUB_TOKEN')
except Exception:
    GITHUB_TOKEN = os.environ.get('GITHUB_TOKEN', '')

# ─── Gist IDs ────────────────────────────────────────────────────────────────
# Update GIST_RETURNS, GIST_RATIOS, GIST_CATINDEX, GIST_NAVHIST after
# creating them for the first time (see first-run instructions below).

GIST_MAIN     = "64368e3f1dfef3f82da8fa9f0f164211"   # existing — fundlens_schemes.json
GIST_RETURNS  = "REPLACE_WITH_NEW_GIST_ID"            # new — fundlens_returns.json
GIST_RATIOS   = "REPLACE_WITH_NEW_GIST_ID"            # new — fundlens_ratios.json
GIST_CATINDEX = "REPLACE_WITH_NEW_GIST_ID"            # new — fundlens_category_index.json
GIST_NAVHIST  = "REPLACE_WITH_NEW_GIST_ID"            # new — all nav_history/*.json files

NAV_HISTORY_DIR = "nav_history"

HEADERS = {
    "Authorization": f"token {GITHUB_TOKEN}",
    "Accept":        "application/vnd.github.v3+json",
}

# ─── Helpers ─────────────────────────────────────────────────────────────────

def upload_single_file_gist(gist_id, filename, local_path, label):
    """Upload one file to a single-file Gist."""
    print(f"\n  Uploading {label}...", end=" ")
    if not os.path.exists(local_path):
        print(f"SKIPPED — {local_path} not found.")
        return False

    content = open(local_path, encoding="utf-8").read()
    mb = len(content.encode()) / (1024 * 1024)

    resp = requests.patch(
        f"https://api.github.com/gists/{gist_id}",
        headers=HEADERS,
        json={"files": {filename: {"content": content}}},
        timeout=120,
    )
    if resp.status_code == 200:
        print(f"✅ ({mb:.2f}MB)")
        return True
    else:
        print(f"❌ {resp.status_code}: {resp.text[:200]}")
        return False


def upload_nav_history_gist(gist_id):
    """
    Upload all nav_history/*.json files to a single Gist.
    GitHub Gist supports multiple files per Gist — we use one Gist
    for all ~74 category x plan NAV history files.

    Handles stale file cleanup: if a category was renamed or removed,
    the old file is deleted from the Gist automatically.
    """
    print(f"\n  Uploading NAV history files to Gist {gist_id}...")

    if not os.path.isdir(NAV_HISTORY_DIR):
        print(f"  SKIPPED — {NAV_HISTORY_DIR}/ not found.")
        return False

    # Build files payload
    files_payload = {}
    local_files = [f for f in os.listdir(NAV_HISTORY_DIR) if f.endswith(".json")]
    total_mb = 0

    for fname in sorted(local_files):
        path    = os.path.join(NAV_HISTORY_DIR, fname)
        content = open(path, encoding="utf-8").read()
        mb      = len(content.encode()) / (1024 * 1024)
        total_mb += mb
        files_payload[fname] = {"content": content}

    print(f"  {len(files_payload)} files | {total_mb:.1f}MB total")

    # Fetch existing Gist file list to detect stale files
    existing_resp = requests.get(
        f"https://api.github.com/gists/{gist_id}",
        headers=HEADERS, timeout=30
    )
    if existing_resp.status_code == 200:
        existing_files = set(existing_resp.json().get("files", {}).keys())
        current_files  = set(files_payload.keys())
        stale_files    = existing_files - current_files
        for stale in stale_files:
            print(f"  Removing stale file: {stale}")
            files_payload[stale] = None  # GitHub API: null = delete file

    resp = requests.patch(
        f"https://api.github.com/gists/{gist_id}",
        headers=HEADERS,
        json={"files": files_payload},
        timeout=300,
    )
    if resp.status_code == 200:
        print(f"  ✅ NAV history uploaded: {len(local_files)} files")
        return True
    else:
        print(f"  ❌ {resp.status_code}: {resp.text[:200]}")
        return False


def create_new_gist(filename, content, description):
    """
    Create a brand-new Gist. Used on first run for new Gist IDs.
    Returns the new Gist ID.
    """
    resp = requests.post(
        "https://api.github.com/gists",
        headers=HEADERS,
        json={
            "description": description,
            "public":      False,
            "files":       {filename: {"content": content}},
        },
        timeout=120,
    )
    if resp.status_code == 201:
        gist_id = resp.json()["id"]
        print(f"  ✅ Created new Gist: {gist_id}")
        return gist_id
    else:
        print(f"  ❌ Failed to create Gist: {resp.status_code}")
        return None


# ─── First-Run Setup ─────────────────────────────────────────────────────────

def first_run_create_gists():
    """
    Run this ONCE to create the 4 new Gists.
    Copy the printed IDs into the GIST_* constants above,
    then commit pipeline_cell2.py back to GitHub.
    """
    print("=== FIRST RUN — Creating new Gists ===\n")

    new_gists = {}

    for fname, desc in [
        ("fundlens_returns.json",        "FundLens — Returns data"),
        ("fundlens_ratios.json",         "FundLens — Risk ratios"),
        ("fundlens_category_index.json", "FundLens — Category index"),
        ("fundlens_nav_placeholder.json","FundLens — NAV history (category x plan)"),
    ]:
        placeholder = json.dumps({"meta": {"note": "placeholder — run pipeline"}})
        gist_id = create_new_gist(fname, placeholder, desc)
        new_gists[fname] = gist_id
        print(f"  {fname}: {gist_id}\n")

    print("\n=== Copy these IDs into pipeline_cell2.py ===")
    print(f"GIST_RETURNS  = \"{new_gists.get('fundlens_returns.json')}\"")
    print(f"GIST_RATIOS   = \"{new_gists.get('fundlens_ratios.json')}\"")
    print(f"GIST_CATINDEX = \"{new_gists.get('fundlens_category_index.json')}\"")
    print(f"GIST_NAVHIST  = \"{new_gists.get('fundlens_nav_placeholder.json')}\"")
    return new_gists


# ─── Main Upload ─────────────────────────────────────────────────────────────

def run_upload():
    print("=" * 60)
    print("FundLens Pipeline v4.0 — Cell 2: Upload")
    print("=" * 60)

    # Guard against placeholder IDs
    placeholder_ids = [GIST_RETURNS, GIST_RATIOS, GIST_CATINDEX, GIST_NAVHIST]
    if any(g == "REPLACE_WITH_NEW_GIST_ID" for g in placeholder_ids):
        print("\n⚠️  New Gist IDs not set. Running first-run setup...\n")
        first_run_create_gists()
        print("\nPaste the IDs above into pipeline_cell2.py and run again.")
        return

    results = []

    results.append(upload_single_file_gist(
        GIST_MAIN, "fundlens_schemes.json",
        "fundlens_schemes.json", "Schemes (main)"
    ))
    results.append(upload_single_file_gist(
        GIST_RETURNS, "fundlens_returns.json",
        "fundlens_returns.json", "Returns"
    ))
    results.append(upload_single_file_gist(
        GIST_RATIOS, "fundlens_ratios.json",
        "fundlens_ratios.json", "Ratios"
    ))
    results.append(upload_single_file_gist(
        GIST_CATINDEX, "fundlens_category_index.json",
        "fundlens_category_index.json", "Category index"
    ))
    results.append(upload_nav_history_gist(GIST_NAVHIST))

    passed = sum(results)
    print(f"\n{'=' * 60}")
    print(f"Upload complete: {passed}/{len(results)} files succeeded.")
    if passed == len(results):
        print("✅ All Gists updated. Site will reflect changes within 60 seconds.")
    else:
        print("⚠️  Some uploads failed. Check errors above. Existing Gists preserved.")


if __name__ == "__main__":
    run_upload()
