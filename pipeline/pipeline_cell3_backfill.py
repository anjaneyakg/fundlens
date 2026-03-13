# pipeline_cell3_backfill.py
# FundLens Pipeline — Cell 3: Historical NAV Backfill
#
# Purpose:
#   Slowly extend NAV history BEYOND the 36-month main window,
#   going backwards month by month, one batch per day.
#   Stores data in a SEPARATE archive Gist — never touches the main Gist.
#   Website is completely unaffected by this cell.
#
# How it works:
#   - First run: creates archive Gist, downloads months 37–48 (1 year back from 36M)
#   - Each subsequent run: extends archive by BATCH_MONTHS more months
#   - Tracks progress in archive Gist's meta.oldestDate
#   - Stops when inception date of oldest scheme is reached (~1995)
#
# Archive Gist structure:
#   {
#     "meta": {
#       "oldestDate": "2020-01-01",   ← how far back we've gone
#       "lastRun": "2026-03-14",
#       "totalMonthsFetched": 48,
#       "schemeCount": 3521
#     },
#     "archive": {
#       "119551": [                   ← scheme code
#         { "date": "2020-01-31", "nav": 142.10 },
#         ...
#       ]
#     }
#   }
#
# When archive is complete:
#   Run Cell 4 (merge) to combine archive + main Gist navHistory

import json
import os
import time
import requests
from datetime import date, datetime, timedelta
from dateutil.relativedelta import relativedelta
from collections import defaultdict

try:
    from google.colab import userdata
    GITHUB_TOKEN = userdata.get("GITHUB_TOKEN")
except Exception:
    GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")

# ─── Config ──────────────────────────────────────────────────────────────────

AMFI_NAV_HISTORY_URL = "https://portal.amfiindia.com/DownloadNAVHistoryReport_Po.aspx"
MAIN_GIST_ID         = "64368e3f1dfef3f82da8fa9f0f164211"   # existing main Gist
ARCHIVE_GIST_ID      = ""   # ← populated after first run (Cell 3 creates it)
ARCHIVE_GIST_FILE    = "fundlens_nav_archive.json"
ARCHIVE_LOCAL_FILE   = "fundlens_nav_archive.json"

BATCH_MONTHS         = 3    # months to fetch per daily run (conservative — ~4 AMFI calls)
MAIN_HISTORY_MONTHS  = 36   # don't overlap with main pipeline
REQUEST_DELAY_SEC    = 2.0  # slightly more polite for backfill
MAX_RETRIES          = 3
TODAY                = date.today()
TODAY_STR            = TODAY.strftime("%Y-%m-%d")

# ─── Helpers (duplicated from cell1 to keep cell3 standalone) ────────────────

def safe_get(url, params=None, label=""):
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            resp = requests.get(url, params=params, timeout=30)
            resp.raise_for_status()
            time.sleep(REQUEST_DELAY_SEC)
            return resp.text
        except Exception as e:
            print(f"  [fetch] {label} attempt {attempt}/{MAX_RETRIES}: {e}")
            if attempt < MAX_RETRIES:
                time.sleep(REQUEST_DELAY_SEC * attempt)
    raise RuntimeError(f"Failed to fetch {label} after {MAX_RETRIES} attempts.")


def parse_date(s):
    for fmt in ("%d-%b-%Y", "%Y-%m-%d", "%d/%m/%Y"):
        try:
            return datetime.strptime(s.strip(), fmt).date()
        except ValueError:
            continue
    return None


def date_windows_between(from_date: date, to_date: date):
    """Generate 90-day windows from from_date → to_date."""
    windows = []
    cursor = from_date
    while cursor < to_date:
        window_end = min(cursor + timedelta(days=89), to_date)
        windows.append((cursor, window_end))
        cursor = window_end + timedelta(days=1)
    return windows


# ─── Gist I/O ─────────────────────────────────────────────────────────────────

def fetch_gist_content(gist_id: str, filename: str) -> dict | None:
    """Fetch and parse a Gist file as JSON."""
    url = f"https://api.github.com/gists/{gist_id}"
    headers = {
        "Authorization": f"token {GITHUB_TOKEN}",
        "Accept": "application/vnd.github.v3+json",
    }
    resp = requests.get(url, headers=headers, timeout=30)
    if resp.status_code != 200:
        return None
    gist_data = resp.json()
    files = gist_data.get("files", {})
    if filename not in files:
        return None
    raw_url = files[filename]["raw_url"]
    raw_resp = requests.get(raw_url, timeout=60)
    if raw_resp.status_code != 200:
        return None
    return json.loads(raw_resp.text)


def create_archive_gist(content: dict) -> str | None:
    """Create the archive Gist. Returns gist_id."""
    url = "https://api.github.com/gists"
    headers = {
        "Authorization": f"token {GITHUB_TOKEN}",
        "Accept": "application/vnd.github.v3+json",
    }
    payload = {
        "description": "FundLens NAV Archive — Historical NAV data beyond 36 months",
        "public": True,
        "files": {
            ARCHIVE_GIST_FILE: {"content": json.dumps(content, separators=(",", ":"))}
        }
    }
    resp = requests.post(url, headers=headers, json=payload, timeout=60)
    if resp.status_code == 201:
        gist_id = resp.json()["id"]
        print(f"  ✅ Archive Gist created: {gist_id}")
        print(f"  ⚠️  IMPORTANT: Copy this Gist ID to ARCHIVE_GIST_ID in this file.")
        return gist_id
    print(f"  ❌ Failed to create archive Gist: {resp.status_code}")
    return None


def upload_archive_gist(gist_id: str, content: dict) -> bool:
    """Update existing archive Gist."""
    url = f"https://api.github.com/gists/{gist_id}"
    headers = {
        "Authorization": f"token {GITHUB_TOKEN}",
        "Accept": "application/vnd.github.v3+json",
    }
    payload = {
        "files": {
            ARCHIVE_GIST_FILE: {
                "content": json.dumps(content, separators=(",", ":"))
            }
        }
    }
    resp = requests.patch(url, headers=headers, json=payload, timeout=60)
    return resp.status_code == 200


# ─── Core Backfill Logic ──────────────────────────────────────────────────────

def fetch_batch(from_date: date, to_date: date) -> dict:
    """
    Fetch all NAVs between from_date and to_date.
    Returns { scheme_code: { 'YYYY-MM': { date, nav } } }
    """
    windows = date_windows_between(from_date, to_date)
    raw = defaultdict(dict)

    for i, (w_from, w_to) in enumerate(windows, 1):
        from_str = w_from.strftime("%d-%b-%Y")
        to_str   = w_to.strftime("%d-%b-%Y")
        print(f"    Window {i}/{len(windows)}: {from_str} → {to_str}", end=" ")
        try:
            params = {"frmdt": from_str, "todt": to_str}
            text = safe_get(AMFI_NAV_HISTORY_URL, params=params, label=f"backfill {i}")
            count = 0
            for line in text.splitlines():
                parts = line.strip().split(";")
                if len(parts) < 8:
                    continue
                try:
                    code    = parts[0].strip()
                    nav_str = parts[4].strip()
                    date_str= parts[7].strip()
                    if not code.isdigit() or not nav_str:
                        continue
                    nav_val = float(nav_str)
                    d = parse_date(date_str)
                    if d and nav_val > 0:
                        month_key = d.strftime("%Y-%m")
                        date_key  = d.strftime("%Y-%m-%d")
                        # Keep last seen date per month (will be last trading day)
                        if month_key not in raw[code] or date_key > raw[code][month_key]["date"]:
                            raw[code][month_key] = {"date": date_key, "nav": nav_val}
                        count += 1
                except Exception:
                    continue
            print(f"→ {count:,} points")
        except Exception as e:
            print(f"→ ❌ {e}")
            continue

    return raw


def merge_into_archive(archive: dict, new_batch: dict) -> dict:
    """Merge new batch data into existing archive dict."""
    for code, month_map in new_batch.items():
        if code not in archive:
            archive[code] = {}
        archive[code].update(month_map)
    return archive


def archive_to_sorted_arrays(archive_raw: dict) -> dict:
    """Convert { code: { 'YYYY-MM': {date,nav} } } to { code: [{date,nav},...] }"""
    result = {}
    for code, month_map in archive_raw.items():
        sorted_entries = [v for k, v in sorted(month_map.items())]
        result[code] = sorted_entries
    return result


# ─── Main ────────────────────────────────────────────────────────────────────

def run_backfill():
    print("=" * 60)
    print("FundLens Pipeline v2.0 — Cell 3: Historical Backfill")
    print(f"Run date: {TODAY_STR}")
    print("=" * 60)

    if not GITHUB_TOKEN:
        print("❌ GITHUB_TOKEN not set.")
        return

    # ── Determine fetch window ─────────────────────────────────────────────
    # Main pipeline covers: TODAY back to (TODAY - 36 months)
    # Backfill starts from: (TODAY - 36 months - 1 day) going further back

    main_oldest = TODAY - relativedelta(months=MAIN_HISTORY_MONTHS)

    # ── Load or create archive ─────────────────────────────────────────────
    archive_meta = {}
    archive_raw  = {}  # { code: { 'YYYY-MM': {date, nav} } }

    if ARCHIVE_GIST_ID:
        print(f"\n[1] Loading existing archive from Gist {ARCHIVE_GIST_ID}...")
        existing = fetch_gist_content(ARCHIVE_GIST_ID, ARCHIVE_GIST_FILE)
        if existing:
            archive_meta = existing.get("meta", {})
            # Convert arrays back to month-keyed dicts for merging
            for code, entries in existing.get("archive", {}).items():
                archive_raw[code] = {e["date"][:7]: e for e in entries}
            oldest_str = archive_meta.get("oldestDate", "")
            print(f"  Loaded. Current oldest date: {oldest_str}")
            print(f"  Schemes in archive: {len(archive_raw)}")
        else:
            print("  Could not load archive. Will create fresh.")

    # ── Determine this run's fetch range ──────────────────────────────────
    if archive_meta.get("oldestDate"):
        # Continue from where we left off
        current_oldest = parse_date(archive_meta["oldestDate"])
        batch_to   = current_oldest - timedelta(days=1)
        batch_from = batch_to - relativedelta(months=BATCH_MONTHS)
    else:
        # First run — start just before main pipeline's window
        batch_to   = main_oldest - timedelta(days=1)
        batch_from = batch_to - relativedelta(months=BATCH_MONTHS)

    # Don't go earlier than 1995 (oldest MF schemes in India)
    earliest_limit = date(1995, 1, 1)
    if batch_from < earliest_limit:
        batch_from = earliest_limit

    if batch_to <= earliest_limit:
        print("\n🎉 Backfill complete! Full history from 1995 is in the archive.")
        print("   Run Cell 4 (merge) to combine archive with main Gist.")
        return

    print(f"\n[2] This run will fetch: {batch_from} → {batch_to}")
    print(f"    ({(batch_to - batch_from).days} days ≈ {BATCH_MONTHS} months)")

    # ── Fetch batch ──────────────────────────────────────────────────────
    print(f"\n[3] Fetching from AMFI...")
    new_batch = fetch_batch(batch_from, batch_to)
    print(f"  Fetched data for {len(new_batch)} schemes.")

    # ── Merge ─────────────────────────────────────────────────────────────
    print(f"\n[4] Merging into archive...")
    archive_raw = merge_into_archive(archive_raw, new_batch)
    print(f"  Archive now covers {len(archive_raw)} schemes.")

    # ── Build output ──────────────────────────────────────────────────────
    archive_arrays = archive_to_sorted_arrays(archive_raw)
    total_months_fetched = (
        archive_meta.get("totalMonthsFetched", 0) + BATCH_MONTHS
    )

    output = {
        "meta": {
            "oldestDate":         batch_from.strftime("%Y-%m-%d"),
            "newestDate":         batch_to.strftime("%Y-%m-%d"),
            "lastRun":            TODAY_STR,
            "totalMonthsFetched": total_months_fetched,
            "schemeCount":        len(archive_arrays),
            "note":               "Archive covers history BEYOND the 36-month main Gist window.",
        },
        "archive": archive_arrays,
    }

    # ── Save locally ──────────────────────────────────────────────────────
    with open(ARCHIVE_LOCAL_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, separators=(",", ":"))
    size_mb = os.path.getsize(ARCHIVE_LOCAL_FILE) / (1024 * 1024)
    print(f"\n[5] Saved locally: {ARCHIVE_LOCAL_FILE} ({size_mb:.2f}MB)")

    # ── Upload to Gist ───────────────────────────────────────────────────
    print(f"\n[6] Uploading archive to Gist...")
    with open(ARCHIVE_LOCAL_FILE, "r") as f:
        content_str = f.read()

    if not ARCHIVE_GIST_ID:
        # First run — create the archive Gist
        new_gist_id = create_archive_gist(output)
        if new_gist_id:
            print(f"\n  ✅ Archive Gist created.")
            print(f"  👉 Update ARCHIVE_GIST_ID = '{new_gist_id}' in this file.")
    else:
        success = upload_archive_gist(ARCHIVE_GIST_ID, output)
        if success:
            print(f"  ✅ Archive Gist updated.")
            print(f"  Progress: {total_months_fetched} months archived.")
            print(f"  Oldest date now: {batch_from}")
        else:
            print(f"  ❌ Upload failed. Local file preserved.")

    print(f"\n  Main Gist untouched. Website unaffected. ✅")
    print(f"  Next run will fetch: {batch_from - relativedelta(months=BATCH_MONTHS)} → {batch_from - timedelta(days=1)}")


# ─── Run ─────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    run_backfill()
