"""
backfill_nav_history.py  —  v1.1.0

Fetches NAV history from AMFI and inserts into Supabase nav_history table.

AMFI response columns (semicolon-delimited):
  0: Scheme Code
  1: ISIN Div Payout
  2: ISIN Div Reinvestment
  3: Scheme Name
  4: Net Asset Value
  5: Repurchase Price
  6: Sale Price
  7: Date

Usage:
    python backfill_nav_history.py --test-mode --months 12
    python backfill_nav_history.py --full
    python backfill_nav_history.py --start-date 2015-01-01 --end-date 2020-12-31
    python backfill_nav_history.py --full --dry-run

Requires env vars: SUPABASE_URL, SUPABASE_KEY
"""

import argparse
import os
import sys
import time
import logging
from datetime import date, timedelta, datetime

import requests
from dateutil.relativedelta import relativedelta
from supabase import create_client, Client

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

AMFI_NAV_HISTORY_URL = "https://portal.amfiindia.com/DownloadNAVHistoryReport_Po.aspx"
WINDOW_DAYS          = 89      # safe AMFI window to avoid WAF/timeout
REQUEST_DELAY_SEC    = 5.0     # seconds between AMFI requests
NAV_HISTORY_TIMEOUT  = 60      # seconds per HTTP request
MAX_RETRIES          = 5
RETRY_BACKOFF_BASE   = 10      # seconds; doubles each retry
LOG_EVERY_N_WINDOWS  = 5
BATCH_UPSERT_SIZE    = 1000    # rows per Supabase upsert call

FULL_START_DATE      = date(1994, 1, 1)
FULL_END_DATE        = date(2026, 4, 30)

RETRYABLE_STATUS     = {429, 500, 502, 503, 504}

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger("backfill")

# ---------------------------------------------------------------------------
# Supabase helpers
# ---------------------------------------------------------------------------

def get_supabase_client() -> Client:
    url = os.environ.get("SUPABASE_URL", "").strip()
    key = os.environ.get("SUPABASE_KEY", "").strip()
    if not url or not key:
        log.error("SUPABASE_URL and SUPABASE_KEY must be set as environment variables.")
        sys.exit(1)
    return create_client(url, key)


def load_scheme_map(client: Client) -> dict[int, str]:
    """Return {amfi_code: scheme_id_uuid} for all active schemes."""
    log.info("Loading scheme map from Supabase …")
    result = (
        client.table("schemes")
        .select("id, amfi_code")
        .eq("is_active", True)
        .execute()
    )
    if result.data is None:
        log.error("Failed to load schemes table.")
        sys.exit(1)

    mapping: dict[int, str] = {}
    for row in result.data:
        if row.get("amfi_code") is not None:
            mapping[int(row["amfi_code"])] = row["id"]

    log.info("Loaded %d active schemes.", len(mapping))
    return mapping


def upsert_nav_rows(client: Client, rows: list[dict]) -> int:
    """
    Upsert rows into nav_history with ON CONFLICT DO NOTHING.
    Returns the count of rows accepted (not duplicates).
    """
    inserted = 0
    for i in range(0, len(rows), BATCH_UPSERT_SIZE):
        batch = rows[i : i + BATCH_UPSERT_SIZE]
        result = (
            client.table("nav_history")
            .upsert(batch, on_conflict="scheme_id,nav_date", ignore_duplicates=True)
            .execute()
        )
        if result.data is not None:
            inserted += len(result.data)
    return inserted

# ---------------------------------------------------------------------------
# Date window helpers
# ---------------------------------------------------------------------------

def date_windows(start: date, end: date) -> list[tuple[date, date]]:
    """Split [start, end] into consecutive WINDOW_DAYS-day chunks."""
    windows: list[tuple[date, date]] = []
    cursor = start
    while cursor <= end:
        window_end = min(cursor + timedelta(days=WINDOW_DAYS - 1), end)
        windows.append((cursor, window_end))
        cursor = window_end + timedelta(days=1)
    return windows

# ---------------------------------------------------------------------------
# AMFI fetch
# ---------------------------------------------------------------------------

def fetch_window(from_date: date, to_date: date) -> list[dict]:
    """
    Fetch all-scheme NAV history from AMFI for [from_date, to_date].

    Retries on 5xx / 429 and connection errors with exponential backoff.
    Raises RuntimeError after MAX_RETRIES exhausted.
    """
    params = {
        "frmdt": from_date.strftime("%d-%b-%Y"),
        "todt":  to_date.strftime("%d-%b-%Y"),
    }

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            resp = requests.get(
                AMFI_NAV_HISTORY_URL,
                params=params,
                timeout=NAV_HISTORY_TIMEOUT,
            )
            if resp.status_code in RETRYABLE_STATUS:
                raise requests.HTTPError(
                    f"HTTP {resp.status_code}", response=resp
                )
            resp.raise_for_status()
            return _parse_amfi_response(resp.text)

        except (requests.ConnectionError, requests.Timeout, requests.HTTPError) as exc:
            wait = RETRY_BACKOFF_BASE * (2 ** (attempt - 1))
            if attempt == MAX_RETRIES:
                raise RuntimeError(
                    f"AMFI fetch failed after {MAX_RETRIES} attempts "
                    f"for window {from_date} → {to_date}: {exc}"
                ) from exc
            log.warning(
                "AMFI error (attempt %d/%d): %s — retry in %ds",
                attempt, MAX_RETRIES, exc, wait,
            )
            time.sleep(wait)

    return []  # unreachable


def _parse_amfi_response(text: str) -> list[dict]:
    """
    Parse AMFI semicolon-delimited NAV history.

    Column layout (8 fields):
        0  Scheme Code
        1  ISIN Div Payout
        2  ISIN Div Reinvestment
        3  Scheme Name
        4  Net Asset Value
        5  Repurchase Price
        6  Sale Price
        7  Date                  ← DD-Mon-YYYY
    """
    records: list[dict] = []
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        parts = line.split(";")
        if len(parts) < 8:
            continue
        try:
            amfi_code = int(parts[0].strip())
            nav_val   = float(parts[4].strip())            # skip N.A. / non-numeric
            nav_date  = (
                datetime.strptime(parts[7].strip(), "%d-%b-%Y")
                .date()
                .isoformat()
            )
        except (ValueError, IndexError):
            continue

        records.append({
            "amfi_code": amfi_code,
            "nav_date":  nav_date,
            "nav":       nav_val,
        })

    return records

# ---------------------------------------------------------------------------
# Main backfill loop
# ---------------------------------------------------------------------------

def run_backfill(start: date, end: date, dry_run: bool = False) -> None:
    client     = get_supabase_client()
    scheme_map = load_scheme_map(client)

    windows = date_windows(start, end)
    total   = len(windows)
    log.info(
        "Backfill range: %s → %s  |  %d windows × %d days",
        start, end, total, WINDOW_DAYS,
    )
    if dry_run:
        log.info("DRY RUN — fetching and resolving only, no writes to Supabase.")

    total_fetched  = 0
    total_matched  = 0
    total_inserted = 0
    failed_windows = 0
    skipped_codes: set[int] = set()

    for idx, (w_start, w_end) in enumerate(windows, start=1):
        try:
            raw_rows = fetch_window(w_start, w_end)
        except RuntimeError as exc:
            log.error("[Window %d/%d] %s → %s  FAILED: %s", idx, total, w_start, w_end, exc)
            failed_windows += 1
            time.sleep(REQUEST_DELAY_SEC)
            continue

        fetched = len(raw_rows)
        total_fetched += fetched

        upsert_rows: list[dict] = []
        for row in raw_rows:
            scheme_id = scheme_map.get(row["amfi_code"])
            if scheme_id is None:
                skipped_codes.add(row["amfi_code"])
                continue
            upsert_rows.append({
                "scheme_id": scheme_id,
                "nav_date":  row["nav_date"],
                "nav":       row["nav"],
            })

        matched = len(upsert_rows)
        total_matched += matched

        inserted = 0
        if not dry_run and upsert_rows:
            inserted = upsert_nav_rows(client, upsert_rows)
            total_inserted += inserted

        if idx % LOG_EVERY_N_WINDOWS == 0 or idx == total:
            log.info(
                "[Window %d/%d] %s → %s  fetched %d / matched %d / inserted %d",
                idx, total, w_start, w_end,
                total_fetched, total_matched,
                total_inserted if not dry_run else 0,
            )

        if idx < total:
            time.sleep(REQUEST_DELAY_SEC)

    # Final summary
    log.info("=" * 64)
    log.info("Backfill complete.")
    log.info("  Windows total     : %d", total)
    log.info("  Windows failed    : %d", failed_windows)
    log.info("  AMFI rows fetched : %d", total_fetched)
    log.info("  Rows matched      : %d  (scheme_id resolved)", total_matched)
    if not dry_run:
        log.info("  Rows inserted     : %d  (new, duplicates skipped)", total_inserted)
    else:
        log.info("  Rows inserted     : 0  (dry run)")
    if skipped_codes:
        log.info(
            "  Skipped AMFI codes: %d  (not in schemes table, e.g. %s…)",
            len(skipped_codes),
            sorted(skipped_codes)[:5],
        )

# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Backfill NAV history from AMFI into Supabase nav_history table.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python backfill_nav_history.py --test-mode --months 12
  python backfill_nav_history.py --full
  python backfill_nav_history.py --start-date 2015-01-01 --end-date 2020-12-31
  python backfill_nav_history.py --full --dry-run
        """,
    )

    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument(
        "--test-mode",
        action="store_true",
        help="Fetch recent history (default last 12 months; use --months to override).",
    )
    mode.add_argument(
        "--full",
        action="store_true",
        help=f"Full 30-year backfill: {FULL_START_DATE} → {FULL_END_DATE}.",
    )
    mode.add_argument(
        "--start-date",
        metavar="YYYY-MM-DD",
        help="Custom start date (requires --end-date or defaults to today).",
    )

    parser.add_argument(
        "--end-date",
        metavar="YYYY-MM-DD",
        help="Custom end date (used with --start-date).",
    )
    parser.add_argument(
        "--months",
        type=int,
        default=12,
        metavar="N",
        help="Months of history for --test-mode (default: 12).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Fetch and resolve scheme IDs but do NOT write to Supabase.",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Enable DEBUG logging.",
    )

    return parser.parse_args()


def resolve_date_range(args: argparse.Namespace) -> tuple[date, date]:
    today = date.today()

    if args.full:
        return FULL_START_DATE, FULL_END_DATE

    if args.test_mode:
        start = today - relativedelta(months=args.months)
        return start, today

    # --start-date mode
    try:
        start = date.fromisoformat(args.start_date)
    except ValueError:
        log.error("Invalid --start-date: use YYYY-MM-DD.")
        sys.exit(1)

    if args.end_date:
        try:
            end = date.fromisoformat(args.end_date)
        except ValueError:
            log.error("Invalid --end-date: use YYYY-MM-DD.")
            sys.exit(1)
    else:
        end = today

    if start > end:
        log.error("--start-date must be before --end-date.")
        sys.exit(1)

    return start, end


def main() -> None:
    args = parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    start, end = resolve_date_range(args)

    log.info("backfill_nav_history.py  v1.1.0  starting")
    log.info(
        "  Mode     : %s",
        "full" if args.full else f"test ({args.months}m)" if args.test_mode else "custom",
    )
    log.info("  Range    : %s → %s", start, end)
    log.info("  Dry run  : %s", args.dry_run)
    log.info("  Window   : %d days  |  delay: %.1fs between requests", WINDOW_DAYS, REQUEST_DELAY_SEC)

    run_backfill(start, end, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
