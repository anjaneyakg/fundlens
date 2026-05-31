"""
daily_nav_sync.py  —  v1.0

Fetches today's NAV from AMFI NAVAll.txt and writes to Supabase nav_history.
Updates schemes.last_nav_date and is_active on every run.

AMFI publishes NAVAll.txt every evening after 8PM IST:
    https://www.amfiindia.com/spages/NAVAll.txt

NAVAll.txt column layout (semicolon-separated, 6 fields):
    0  Scheme Code
    1  ISIN Div Payout / ISIN Growth
    2  ISIN Div Reinvestment
    3  Scheme Name
    4  Net Asset Value
    5  Date                     ← DD-MMM-YYYY  e.g. 31-May-2026

Usage:
    python pipeline/daily_nav_sync.py
    python pipeline/daily_nav_sync.py --dry-run
    python pipeline/daily_nav_sync.py --date 2026-05-30

Environment variables:
    SUPABASE_URL               — Supabase project URL
    SUPABASE_SERVICE_ROLE_KEY  — Supabase service role key
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

AMFI_NAV_ALL_URL    = "https://www.amfiindia.com/spages/NAVAll.txt"
AMFI_TIMEOUT_SEC    = 60
AMFI_MAX_RETRIES    = 3
AMFI_RETRY_BACKOFF  = 10        # seconds; doubles each retry

RETRYABLE_STATUS    = {429, 500, 502, 503, 504}
NAV_BATCH_SIZE      = 500       # rows per Supabase upsert call
SCHEME_BATCH_SIZE   = 500       # amfi_codes per schemes PATCH call
SUPABASE_TIMEOUT    = 60        # seconds per Supabase HTTP request
UPSERT_MAX_RETRIES  = 3
UPSERT_RETRY_BACKOFF = 10       # seconds; doubles each retry

INACTIVE_AFTER_DAYS = 30        # mark is_active=False if absent > this many days

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger("daily_nav_sync")

# ---------------------------------------------------------------------------
# Supabase REST helpers
# ---------------------------------------------------------------------------

def _env(name: str) -> str:
    val = os.environ.get(name, "").strip()
    if not val:
        log.error("Environment variable %s is required but not set.", name)
        sys.exit(1)
    return val


def _headers(api_key: str, prefer: str | None = None) -> dict:
    h = {
        "apikey":        api_key,
        "Authorization": f"Bearer {api_key}",
        "Content-Type":  "application/json",
    }
    if prefer:
        h["Prefer"] = prefer
    return h


def load_scheme_map(url: str, api_key: str) -> dict[int, str]:
    """Return {amfi_code: scheme_id} for all schemes (active and inactive)."""
    log.info("Loading scheme map from Supabase ...")
    try:
        resp = requests.get(
            f"{url}/rest/v1/schemes",
            params={"select": "id,amfi_code"},
            headers=_headers(api_key),
            timeout=SUPABASE_TIMEOUT,
        )
    except requests.RequestException as exc:
        log.error("Failed to fetch scheme map: %s", exc)
        sys.exit(1)

    if resp.status_code != 200:
        log.error("Failed to load scheme map: HTTP %d — %s", resp.status_code, resp.text[:200])
        sys.exit(1)

    mapping: dict[int, str] = {}
    for row in resp.json():
        code = row.get("amfi_code")
        if code is not None:
            try:
                mapping[int(code)] = row["id"]
            except (ValueError, TypeError):
                pass

    log.info("Loaded %d schemes.", len(mapping))
    return mapping


def upsert_nav_batches(
    url: str, api_key: str, rows: list[dict]
) -> tuple[int, int]:
    """
    Upsert rows into nav_history in batches of NAV_BATCH_SIZE.
    Returns (batches_ok, batches_failed).
    Batch errors are logged but do not abort the run.
    """
    batches_ok = batches_failed = 0

    for i in range(0, len(rows), NAV_BATCH_SIZE):
        batch = rows[i : i + NAV_BATCH_SIZE]
        batch_num = i // NAV_BATCH_SIZE + 1

        for attempt in range(1, UPSERT_MAX_RETRIES + 1):
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
                    batches_ok += 1
                    break
                if resp.status_code in RETRYABLE_STATUS and attempt < UPSERT_MAX_RETRIES:
                    wait = UPSERT_RETRY_BACKOFF * (2 ** (attempt - 1))
                    log.warning(
                        "nav_history upsert batch %d: HTTP %d (attempt %d/%d) — retry in %ds",
                        batch_num, resp.status_code, attempt, UPSERT_MAX_RETRIES, wait,
                    )
                    time.sleep(wait)
                    continue
                log.error(
                    "nav_history upsert batch %d failed: HTTP %d — %s",
                    batch_num, resp.status_code, resp.text[:200],
                )
                batches_failed += 1
                break
            except requests.RequestException as exc:
                if attempt < UPSERT_MAX_RETRIES:
                    wait = UPSERT_RETRY_BACKOFF * (2 ** (attempt - 1))
                    log.warning(
                        "nav_history upsert batch %d error (attempt %d/%d): %s — retry in %ds",
                        batch_num, attempt, UPSERT_MAX_RETRIES, exc, wait,
                    )
                    time.sleep(wait)
                else:
                    log.error(
                        "nav_history upsert batch %d failed after %d attempts: %s",
                        batch_num, UPSERT_MAX_RETRIES, exc,
                    )
                    batches_failed += 1

    return batches_ok, batches_failed


def update_scheme_activity(
    url: str,
    api_key: str,
    amfi_codes_seen: set[int],
    today_str: str,
) -> int:
    """
    Step 1: Mark schemes present in today's file as active + set last_nav_date.
    Step 2: Mark as inactive any scheme that has been absent for 30+ consecutive
            days (last_nav_date < today minus INACTIVE_AFTER_DAYS).

    Returns approximate count of schemes updated in step 1.
    Errors are logged but do not abort the run.
    """
    codes = sorted(amfi_codes_seen)
    total_updated = 0
    step1_failed  = 0

    for i in range(0, len(codes), SCHEME_BATCH_SIZE):
        batch = codes[i : i + SCHEME_BATCH_SIZE]
        in_filter = f"in.({','.join(map(str, batch))})"
        try:
            resp = requests.patch(
                f"{url}/rest/v1/schemes",
                params={"amfi_code": in_filter},
                json={"last_nav_date": today_str, "is_active": True},
                headers=_headers(api_key, "return=minimal"),
                timeout=SUPABASE_TIMEOUT,
            )
            if resp.status_code in (200, 204):
                total_updated += len(batch)
            else:
                log.error(
                    "schemes active update HTTP %d (batch amfi_code starts %d) — %s",
                    resp.status_code, batch[0], resp.text[:200],
                )
                step1_failed += 1
        except requests.RequestException as exc:
            log.error(
                "schemes active update request error (batch amfi_code starts %d): %s",
                batch[0], exc,
            )
            step1_failed += 1

    if step1_failed:
        log.warning("schemes active update: %d batches failed", step1_failed)
    else:
        log.info(
            "schemes updated: ~%d set active + last_nav_date=%s",
            total_updated, today_str,
        )

    # Step 2: mark long-absent schemes inactive
    cutoff = (date.fromisoformat(today_str) - timedelta(days=INACTIVE_AFTER_DAYS)).isoformat()
    try:
        resp = requests.patch(
            f"{url}/rest/v1/schemes",
            params={
                "is_active":     "eq.true",
                "last_nav_date": f"lt.{cutoff}",
            },
            json={"is_active": False},
            headers=_headers(api_key, "return=minimal"),
            timeout=SUPABASE_TIMEOUT,
        )
        if resp.status_code in (200, 204):
            log.info(
                "Stale schemes marked inactive (is_active=true, last_nav_date < %s).", cutoff
            )
        else:
            log.error(
                "schemes inactive update HTTP %d — %s",
                resp.status_code, resp.text[:200],
            )
    except requests.RequestException as exc:
        log.error("schemes inactive update request error: %s", exc)

    return total_updated


# ---------------------------------------------------------------------------
# AMFI fetch and parse
# ---------------------------------------------------------------------------

def fetch_nav_all() -> str:
    """Fetch NAVAll.txt from AMFI. Exits with code 1 on failure."""
    log.info("Fetching NAVAll.txt from AMFI ...")
    for attempt in range(1, AMFI_MAX_RETRIES + 1):
        try:
            resp = requests.get(AMFI_NAV_ALL_URL, timeout=AMFI_TIMEOUT_SEC)
            if resp.status_code == 200:
                log.info("NAVAll.txt fetched successfully: %d bytes", len(resp.content))
                return resp.text
            if resp.status_code not in RETRYABLE_STATUS:
                log.error(
                    "AMFI fetch failed: HTTP %d (non-retryable). Exiting.",
                    resp.status_code,
                )
                sys.exit(1)
            log.warning(
                "AMFI fetch HTTP %d (attempt %d/%d)",
                resp.status_code, attempt, AMFI_MAX_RETRIES,
            )
        except (requests.ConnectionError, requests.Timeout) as exc:
            log.warning(
                "AMFI fetch error (attempt %d/%d): %s",
                attempt, AMFI_MAX_RETRIES, exc,
            )

        if attempt < AMFI_MAX_RETRIES:
            wait = AMFI_RETRY_BACKOFF * (2 ** (attempt - 1))
            log.info("Retrying in %ds ...", wait)
            time.sleep(wait)

    log.error("AMFI fetch failed after %d attempts. Exiting with code 1.", AMFI_MAX_RETRIES)
    sys.exit(1)


def parse_nav_all(text: str) -> tuple[list[dict], int, int]:
    """
    Parse AMFI NAVAll.txt.

    Skips:
      - Blank lines
      - Header lines (fewer than 5 semicolons = fewer than 6 fields)
      - Lines where nav is 'N.A.' or date is empty  → counted in skipped_na
      - Lines with non-numeric amfi_code, nav, or unparseable date → skipped_parse

    Returns:
        rows          — list of {amfi_code, nav, nav_date (ISO 8601)}
        skipped_na    — rows skipped for N.A. nav or empty date
        skipped_parse — rows skipped for parse errors
    """
    rows: list[dict] = []
    skipped_na    = 0
    skipped_parse = 0

    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        parts = line.split(";")
        if len(parts) < 6:  # need 5 semicolons (6 fields) for a valid data row
            continue

        nav_str  = parts[4].strip()
        date_str = parts[5].strip()

        if not nav_str or nav_str.upper() == "N.A." or not date_str:
            skipped_na += 1
            continue

        try:
            amfi_code = int(parts[0].strip())
            nav_val   = float(nav_str)
            nav_date  = datetime.strptime(date_str, "%d-%b-%Y").date().isoformat()
        except (ValueError, IndexError):
            skipped_parse += 1
            continue

        rows.append({
            "amfi_code": amfi_code,
            "nav":       nav_val,
            "nav_date":  nav_date,
        })

    return rows, skipped_na, skipped_parse


# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

def _print_summary(stats: dict, elapsed: float, dry_run: bool) -> None:
    log.info("=" * 64)
    log.info("daily_nav_sync complete.")
    log.info("  Total rows in NAVAll.txt   : %d", stats["total_in_file"])
    log.info("  Rows parsed successfully   : %d", stats["parsed"])
    log.info("  Rows skipped (N.A./empty)  : %d", stats["skipped_na"])
    log.info("  Rows skipped (parse error) : %d", stats["skipped_parse"])
    log.info("  Schemes not found          : %d", stats["unmatched"])
    log.info(
        "  Rows upserted to nav_hist  : %s",
        str(stats["upserted"]) if not dry_run else "0 (dry run)",
    )
    log.info(
        "  Schemes updated            : %s",
        str(stats["schemes_updated"]) if not dry_run else "0 (dry run)",
    )
    log.info("  Runtime                    : %.1fs", elapsed)


# ---------------------------------------------------------------------------
# Main sync
# ---------------------------------------------------------------------------

def run_sync(dry_run: bool, target_date: str | None) -> None:
    t_start   = time.monotonic()
    today_str = target_date or date.today().isoformat()

    log.info("daily_nav_sync.py  v1.0  starting")
    log.info("  Target date : %s", today_str)
    log.info("  Dry run     : %s", dry_run)

    # 1. Fetch NAVAll.txt
    raw_text = fetch_nav_all()

    # 2. Parse
    parsed_rows, skipped_na, skipped_parse = parse_nav_all(raw_text)

    stats: dict = {
        "total_in_file":   len(parsed_rows) + skipped_na + skipped_parse,
        "parsed":          len(parsed_rows),
        "skipped_na":      skipped_na,
        "skipped_parse":   skipped_parse,
        "matched":         0,
        "unmatched":       0,
        "upserted":        0,
        "schemes_updated": 0,
    }

    log.info(
        "Parsed %d rows  |  skipped_na=%d  |  skipped_parse=%d",
        len(parsed_rows), skipped_na, skipped_parse,
    )

    if not parsed_rows:
        log.error("No rows parsed from NAVAll.txt — nothing to insert.")
        sys.exit(1)

    dates_in_file = sorted({r["nav_date"] for r in parsed_rows})
    log.info(
        "Dates in NAVAll.txt: %d unique  |  range %s → %s",
        len(dates_in_file), dates_in_file[0], dates_in_file[-1],
    )
    if target_date and target_date not in dates_in_file:
        log.warning(
            "--date %s not found in NAVAll.txt (file contains: %s). "
            "nav_history will use dates from the file; "
            "schemes.last_nav_date will be set to %s.",
            target_date, dates_in_file, today_str,
        )

    # 3. Dry run — attempt scheme map if credentials available, then stop
    if dry_run:
        supabase_url = os.environ.get("SUPABASE_URL", "").strip()
        api_key = (
            os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
            or os.environ.get("SUPABASE_KEY", "").strip()
        )
        if supabase_url and api_key:
            scheme_map = load_scheme_map(supabase_url, api_key)
            matched   = sum(1 for r in parsed_rows if r["amfi_code"] in scheme_map)
            unmatched = len(parsed_rows) - matched
            stats["matched"]   = matched
            stats["unmatched"] = unmatched
            log.info("Scheme lookup: %d matched  |  %d unmatched", matched, unmatched)
        else:
            log.info("Scheme lookup: skipped (no Supabase credentials in dry-run mode)")
        log.info("Dry run — no writes to Supabase.")
        _print_summary(stats, time.monotonic() - t_start, dry_run=True)
        return

    # 4. Load credentials
    supabase_url = _env("SUPABASE_URL")
    api_key      = _env("SUPABASE_SERVICE_ROLE_KEY")

    # 5. Resolve scheme_ids
    scheme_map = load_scheme_map(supabase_url, api_key)

    upsert_rows: list[dict]  = []
    amfi_codes_seen: set[int] = set()
    unmatched_codes: set[int] = set()

    for row in parsed_rows:
        scheme_id = scheme_map.get(row["amfi_code"])
        if scheme_id is None:
            unmatched_codes.add(row["amfi_code"])
            continue
        amfi_codes_seen.add(row["amfi_code"])
        upsert_rows.append({
            "scheme_id": scheme_id,
            "nav_date":  row["nav_date"],
            "nav":       row["nav"],
        })

    stats["matched"]   = len(upsert_rows)
    stats["unmatched"] = len(unmatched_codes)
    log.info(
        "Scheme lookup: %d matched  |  %d unmatched (not in schemes table)",
        stats["matched"], stats["unmatched"],
    )
    if unmatched_codes:
        log.info("  Unmatched sample: %s", sorted(unmatched_codes)[:5])

    # 6. Upsert nav_history
    batches_ok, batches_failed = upsert_nav_batches(supabase_url, api_key, upsert_rows)
    stats["upserted"] = len(upsert_rows)
    log.info(
        "nav_history upsert: %d rows  |  %d batches ok  |  %d batches failed",
        len(upsert_rows), batches_ok, batches_failed,
    )

    # 7. Update schemes
    updated = update_scheme_activity(supabase_url, api_key, amfi_codes_seen, today_str)
    stats["schemes_updated"] = updated

    _print_summary(stats, time.monotonic() - t_start, dry_run=False)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Daily NAV sync: AMFI NAVAll.txt → Supabase nav_history.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python pipeline/daily_nav_sync.py
  python pipeline/daily_nav_sync.py --dry-run
  python pipeline/daily_nav_sync.py --date 2026-05-30
        """,
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Parse and log but do not write to Supabase.",
    )
    parser.add_argument(
        "--date",
        metavar="YYYY-MM-DD",
        help="Target date for schemes.last_nav_date update (defaults to today).",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    target_date = None
    if args.date:
        try:
            date.fromisoformat(args.date)
            target_date = args.date
        except ValueError:
            log.error("Invalid --date value '%s': use YYYY-MM-DD format.", args.date)
            sys.exit(1)
    run_sync(dry_run=args.dry_run, target_date=target_date)


if __name__ == "__main__":
    main()
