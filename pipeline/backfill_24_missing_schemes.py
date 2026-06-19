"""
backfill_24_missing_schemes.py  —  ONE-TIME USE

Recovers NAV history for the 24 schemes that were publishing NAVs in AMFI
but were not yet in the Supabase schemes table, so their NAV rows were never
written to nav_history.

Affected window: 31 May 2026 → yesterday (up to the day before running this).

What this script does:
  1. For each amfi_code in KNOWN_MISSING_CODES, look up the scheme_id in
     Supabase (must already exist — run daily_nav_sync.py v2.0 first so
     the auto-insert runs for today's file, or confirm the scheme now exists).
  2. Fetch the full NAV history for 31 May 2026 → yesterday via AMFI
     DownloadNAVHistoryReport_Po.aspx (single request, < 90 days).
  3. Filter the parsed rows to only the KNOWN_MISSING_CODES.
  4. Upsert into nav_history on (scheme_id, nav_date) conflict — ignore
     duplicates so it is safe to re-run.
  5. Print a per-code and overall summary.

Usage:
    python pipeline/backfill_24_missing_schemes.py
    python pipeline/backfill_24_missing_schemes.py --dry-run

Environment variables:
    SUPABASE_URL               — Supabase project URL
    SUPABASE_SERVICE_ROLE_KEY  — Supabase service role key (also accepts SUPABASE_KEY)

Archive or delete this script after a successful run.
"""

import argparse
import logging
import os
import sys
import time
from datetime import date, datetime, timedelta

import requests

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

KNOWN_MISSING_CODES: list[int] = [
    154358, 154359, 154361, 154362, 154363, 154366, 154367, 154369, 154370,
    154372, 154373, 154375, 154379, 154380, 154381, 154382, 154384, 154394,
    154395, 154396, 154398, 154399, 154402, 154426,
]

# Schemes started appearing in NAVAll.txt but were skipped by v1.0 of daily_nav_sync.py.
BACKFILL_START = date(2026, 5, 31)

AMFI_NAV_HISTORY_URL = (
    "https://portal.amfiindia.com/DownloadNAVHistoryReport_Po.aspx"
)
AMFI_TIMEOUT_SEC  = 120
BATCH_SIZE        = 500
SUPABASE_TIMEOUT  = 60
RETRYABLE_STATUS  = {429, 500, 502, 503, 504}
UPSERT_MAX_RETRY  = 3
UPSERT_RETRY_WAIT = 10    # seconds; doubled per retry

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger("backfill_24")

# ---------------------------------------------------------------------------
# Supabase helpers
# ---------------------------------------------------------------------------

def _get_env(name: str, fallback: str | None = None) -> str:
    val = os.environ.get(name, "").strip()
    if val:
        return val
    if fallback:
        val = os.environ.get(fallback, "").strip()
        if val:
            return val
    log.error("Required environment variable %r (or %r) not set.", name, fallback)
    sys.exit(1)


def _headers(api_key: str, prefer: str | None = None) -> dict:
    h = {
        "apikey":        api_key,
        "Authorization": f"Bearer {api_key}",
        "Content-Type":  "application/json",
    }
    if prefer:
        h["Prefer"] = prefer
    return h


def look_up_scheme_ids(
    url: str, api_key: str, codes: list[int]
) -> dict[int, str]:
    """
    For each amfi_code in codes, return {amfi_code: scheme_id} if found in
    the schemes table. Codes not found are omitted from the result.
    """
    found: dict[int, str] = {}
    # Fetch in one request using in.() filter
    codes_str = ",".join(map(str, codes))
    try:
        resp = requests.get(
            f"{url}/rest/v1/schemes",
            params={
                "select":     "id,amfi_code",
                "amfi_code":  f"in.({codes_str})",
            },
            headers=_headers(api_key),
            timeout=SUPABASE_TIMEOUT,
        )
    except requests.RequestException as exc:
        log.error("Failed to look up scheme IDs: %s", exc)
        return {}

    if resp.status_code != 200:
        log.error(
            "Scheme lookup HTTP %d — %s", resp.status_code, resp.text[:200]
        )
        return {}

    for row in resp.json():
        code = row.get("amfi_code")
        if code is not None:
            try:
                found[int(code)] = row["id"]
            except (ValueError, TypeError):
                pass

    return found


def upsert_nav_rows(
    url: str,
    api_key: str,
    rows: list[dict],
    dry_run: bool,
) -> tuple[int, int]:
    """
    Upsert rows into nav_history in BATCH_SIZE chunks.
    Returns (rows_sent, rows_failed).
    """
    if dry_run:
        log.info("  [DRY RUN] would upsert %d nav_history rows.", len(rows))
        return len(rows), 0

    rows_ok = rows_failed = 0

    for i in range(0, len(rows), BATCH_SIZE):
        batch = rows[i : i + BATCH_SIZE]
        for attempt in range(1, UPSERT_MAX_RETRY + 1):
            try:
                resp = requests.post(
                    f"{url}/rest/v1/nav_history",
                    params={"on_conflict": "scheme_id,nav_date"},
                    json=batch,
                    headers=_headers(
                        api_key,
                        "resolution=ignore-duplicates,return=minimal",
                    ),
                    timeout=SUPABASE_TIMEOUT,
                )
                if resp.status_code in (200, 201, 204):
                    rows_ok += len(batch)
                    break
                if resp.status_code in RETRYABLE_STATUS and attempt < UPSERT_MAX_RETRY:
                    wait = UPSERT_RETRY_WAIT * (2 ** (attempt - 1))
                    log.warning("Upsert HTTP %d — retry in %ds", resp.status_code, wait)
                    time.sleep(wait)
                    continue
                log.error(
                    "Upsert batch (start=%d) HTTP %d — %s",
                    i, resp.status_code, resp.text[:200],
                )
                rows_failed += len(batch)
                break
            except requests.RequestException as exc:
                if attempt < UPSERT_MAX_RETRY:
                    wait = UPSERT_RETRY_WAIT * (2 ** (attempt - 1))
                    log.warning("Upsert error (attempt %d/%d): %s — retry in %ds", attempt, UPSERT_MAX_RETRY, exc, wait)
                    time.sleep(wait)
                else:
                    log.error("Upsert batch (start=%d) failed: %s", i, exc)
                    rows_failed += len(batch)

    return rows_ok, rows_failed

# ---------------------------------------------------------------------------
# AMFI fetch + parse
# ---------------------------------------------------------------------------

def _fmt_date(d: date) -> str:
    """Format date as DD-MMM-YYYY for AMFI API (e.g. '31-May-2026')."""
    return d.strftime("%d-%b-%Y")


def fetch_nav_history(from_date: date, to_date: date) -> str:
    """
    Fetch NAV history from AMFI DownloadNAVHistoryReport_Po.aspx.
    Returns raw response text.
    """
    params = {
        "frmdt": _fmt_date(from_date),
        "todt":  _fmt_date(to_date),
    }
    log.info(
        "Fetching AMFI NAV history: %s → %s ...",
        _fmt_date(from_date), _fmt_date(to_date),
    )
    for attempt in range(1, 4):
        try:
            resp = requests.get(
                AMFI_NAV_HISTORY_URL,
                params=params,
                timeout=AMFI_TIMEOUT_SEC,
            )
            if resp.status_code == 200:
                log.info("Fetched %d bytes.", len(resp.content))
                return resp.text
            log.warning(
                "AMFI history HTTP %d (attempt %d/3)", resp.status_code, attempt
            )
        except (requests.ConnectionError, requests.Timeout) as exc:
            log.warning("AMFI history error (attempt %d/3): %s", attempt, exc)
        if attempt < 3:
            time.sleep(10 * attempt)

    log.error("AMFI history fetch failed after 3 attempts.")
    sys.exit(1)


def parse_nav_history(text: str, keep_codes: set[int]) -> dict[int, list[dict]]:
    """
    Parse DownloadNAVHistoryReport_Po.aspx response.

    Format: 8 semicolon-separated fields per row:
        0  Scheme Code
        1  ISIN Div Payout / Growth
        2  ISIN Div Reinvestment
        3  Scheme Name
        4  NAV
        5  Repurchase Price
        6  Sale Price
        7  Date          ← DD-MMM-YYYY (e.g. "18-Jun-2026")

    Returns {amfi_code: [{nav_date, nav}, ...]} for codes in keep_codes only.
    Skips N.A. NAVs, parse errors, and codes not in keep_codes.
    """
    result: dict[int, list[dict]] = {c: [] for c in keep_codes}
    skipped_na = skipped_parse = skipped_other = 0

    for line in text.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        parts = stripped.split(";")
        if len(parts) < 8:
            skipped_other += 1
            continue

        nav_str  = parts[4].strip()
        date_str = parts[7].strip()

        if not nav_str or nav_str.upper() == "N.A." or not date_str:
            skipped_na += 1
            continue

        try:
            amfi_code = int(parts[0].strip())
            if amfi_code not in keep_codes:
                skipped_other += 1
                continue
            nav_val  = float(nav_str)
            nav_date = datetime.strptime(date_str, "%d-%b-%Y").date().isoformat()
        except (ValueError, IndexError):
            skipped_parse += 1
            continue

        result[amfi_code].append({"nav_date": nav_date, "nav": nav_val})

    log.info(
        "Parse complete: skipped_na=%d  skipped_parse=%d  skipped_other=%d",
        skipped_na, skipped_parse, skipped_other,
    )
    return result

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def run(dry_run: bool) -> None:
    supabase_url = (
        os.environ.get("SUPABASE_URL", "").strip()
        or _get_env("SUPABASE_URL")
    )
    api_key = (
        os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
        or os.environ.get("SUPABASE_KEY", "").strip()
    )
    if not supabase_url or not api_key:
        log.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_KEY) must be set.")
        sys.exit(1)

    backfill_end = date.today() - timedelta(days=1)

    log.info("backfill_24_missing_schemes.py  starting")
    log.info("  Codes to backfill   : %d", len(KNOWN_MISSING_CODES))
    log.info("  Date range          : %s → %s", BACKFILL_START, backfill_end)
    log.info("  Dry run             : %s", dry_run)

    if backfill_end < BACKFILL_START:
        log.error("backfill_end (%s) is before backfill_start (%s) — nothing to do.", backfill_end, BACKFILL_START)
        sys.exit(1)

    # Step 1: Look up scheme IDs for all known missing codes
    log.info("Looking up scheme IDs ...")
    code_to_scheme_id = look_up_scheme_ids(supabase_url, api_key, KNOWN_MISSING_CODES)

    codes_found   = sorted(code_to_scheme_id.keys())
    codes_missing = sorted(c for c in KNOWN_MISSING_CODES if c not in code_to_scheme_id)

    log.info(
        "Scheme lookup: %d found  |  %d not yet in schemes table",
        len(codes_found), len(codes_missing),
    )
    if codes_missing:
        log.warning(
            "The following codes are NOT in the schemes table — run "
            "daily_nav_sync.py v2.0 first so they get auto-inserted. "
            "These codes will be skipped in this backfill run:\n  %s",
            codes_missing,
        )

    if not codes_found:
        log.error("No codes found in schemes table — nothing to backfill.")
        sys.exit(1)

    # Step 2: Fetch full date range from AMFI
    raw_text = fetch_nav_history(BACKFILL_START, backfill_end)

    # Step 3: Parse, filtering to only our target codes
    keep_set      = set(codes_found)
    history_by_code = parse_nav_history(raw_text, keep_set)

    # Step 4: Build upsert rows per code and report per-code counts
    all_upsert_rows: list[dict] = []
    total_rows_by_code: dict[int, int] = {}

    for code in codes_found:
        scheme_id = code_to_scheme_id[code]
        nav_rows  = history_by_code.get(code, [])
        total_rows_by_code[code] = len(nav_rows)

        for r in nav_rows:
            all_upsert_rows.append({
                "scheme_id": scheme_id,
                "nav_date":  r["nav_date"],
                "nav":       r["nav"],
            })

    log.info("Per-code row counts:")
    for code in codes_found:
        log.info("  amfi_code=%-8d  nav_rows=%d", code, total_rows_by_code[code])

    codes_with_no_history = [c for c in codes_found if total_rows_by_code[c] == 0]
    if codes_with_no_history:
        log.warning(
            "Codes with 0 NAV rows in history response (may be new schemes "
            "with no history in this window): %s",
            codes_with_no_history,
        )

    log.info("Total nav_history rows to upsert: %d", len(all_upsert_rows))

    if not all_upsert_rows:
        log.info("No rows to upsert — exiting.")
        return

    # Step 5: Upsert
    rows_ok, rows_failed = upsert_nav_rows(
        supabase_url, api_key, all_upsert_rows, dry_run
    )

    # Summary
    log.info("=" * 64)
    log.info("backfill_24_missing_schemes complete.")
    log.info("  Codes processed        : %d / %d", len(codes_found), len(KNOWN_MISSING_CODES))
    log.info("  Codes skipped (not in DB): %d", len(codes_missing))
    log.info("  Total nav rows found   : %d", len(all_upsert_rows))
    if dry_run:
        log.info("  Rows upserted          : 0 (dry run)")
    else:
        log.info("  Rows upserted          : %d", rows_ok)
        log.info("  Rows failed            : %d", rows_failed)
    log.info("")
    log.info("Archive or delete this script after verifying the backfill was successful.")


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "One-time NAV backfill for 24 schemes skipped by daily_nav_sync.py v1.0."
        )
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Parse and log but do not write to Supabase.",
    )
    args = parser.parse_args()

    # Load .env if python-dotenv is available (optional — not required)
    try:
        from dotenv import load_dotenv  # type: ignore
        load_dotenv()
    except ImportError:
        pass

    run(dry_run=args.dry_run)


if __name__ == "__main__":
    main()
