# pipeline_cell2.py
# FundLens Pipeline — Cell 2
# Upload fundlens_schemes.json to GitHub Gist
# Unchanged in structure from v1 — just updated comments and error handling.
#
# Required: GITHUB_TOKEN env variable or set directly below (Colab secret)

import json
import os
import requests

# ─── Config ──────────────────────────────────────────────────────────────────

# In Colab: use userdata.get or os.environ
# In GitHub Action: set as repository secret GITHUB_TOKEN
try:
    from google.colab import userdata
    GITHUB_TOKEN = userdata.get("GITHUB_TOKEN")
except Exception:
    GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")

# Your existing Gist ID (fundlens_schemes.json)
MAIN_GIST_ID   = "64368e3f1dfef3f82da8fa9f0f164211"
MAIN_GIST_FILE = "fundlens_schemes.json"
INPUT_FILE     = "fundlens_schemes.json"

# ─── Upload ───────────────────────────────────────────────────────────────────

def upload_to_gist(gist_id: str, filename: str, content: str, token: str) -> bool:
    """PATCH an existing Gist file with new content."""
    url     = f"https://api.github.com/gists/{gist_id}"
    headers = {
        "Authorization": f"token {token}",
        "Accept":        "application/vnd.github.v3+json",
    }
    payload = {
        "files": {
            filename: {"content": content}
        }
    }
    resp = requests.patch(url, headers=headers, json=payload, timeout=60)
    if resp.status_code == 200:
        gist_data = resp.json()
        raw_url = gist_data["files"][filename]["raw_url"]
        print(f"  ✅ Uploaded to Gist: {raw_url}")
        return True
    else:
        print(f"  ❌ Upload failed: HTTP {resp.status_code}")
        print(f"     {resp.text[:300]}")
        return False


def create_new_gist(filename: str, content: str, token: str,
                    description: str = "FundLens Data") -> str | None:
    """Create a new Gist. Returns gist_id or None on failure."""
    url     = "https://api.github.com/gists"
    headers = {
        "Authorization": f"token {token}",
        "Accept":        "application/vnd.github.v3+json",
    }
    payload = {
        "description": description,
        "public":      True,
        "files": {
            filename: {"content": content}
        }
    }
    resp = requests.post(url, headers=headers, json=payload, timeout=60)
    if resp.status_code == 201:
        gist_data = resp.json()
        gist_id  = gist_data["id"]
        raw_url  = gist_data["files"][filename]["raw_url"]
        print(f"  ✅ New Gist created!")
        print(f"     Gist ID : {gist_id}")
        print(f"     Raw URL : {raw_url}")
        print(f"\n  ⚠️  IMPORTANT: Copy the Gist ID above into:")
        print(f"     1. pipeline_cell2.py → MAIN_GIST_ID")
        print(f"     2. Your FundLens app's data fetch URL")
        return gist_id
    else:
        print(f"  ❌ Gist creation failed: HTTP {resp.status_code}")
        print(f"     {resp.text[:300]}")
        return None


def run_upload():
    print("=" * 60)
    print("FundLens Pipeline v2.0 — Cell 2: Gist Upload")
    print("=" * 60)

    # Load the validated JSON from Cell 1 output
    if not os.path.exists(INPUT_FILE):
        print(f"❌ {INPUT_FILE} not found. Run Cell 1 first.")
        return

    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        content = f.read()

    size_mb = len(content.encode("utf-8")) / (1024 * 1024)
    print(f"  File loaded: {INPUT_FILE} ({size_mb:.2f}MB)")

    # Verify token
    if not GITHUB_TOKEN:
        print("❌ GITHUB_TOKEN not set. Add it to Colab secrets or env.")
        return

    # Upload
    print(f"\n  Uploading to Gist {MAIN_GIST_ID}...")
    success = upload_to_gist(MAIN_GIST_ID, MAIN_GIST_FILE, content, GITHUB_TOKEN)

    if success:
        # Quick parse to show summary
        data = json.loads(content)
        meta = data.get("meta", {})
        print(f"\n  Summary:")
        print(f"    Schemes    : {meta.get('schemeCount', '?')}")
        print(f"    Last update: {meta.get('lastUpdated', '?')}")
        print(f"    History    : {meta.get('historyMonths', '?')} months")
        print(f"    Source     : {meta.get('source', '?')}")
        print(f"\n  🚀 App will reflect new data on next page load (no Vercel redeploy needed).")
    else:
        print("\n  ⛔ Upload failed. Existing Gist preserved. Website unaffected.")


# ─── Run ─────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    run_upload()
