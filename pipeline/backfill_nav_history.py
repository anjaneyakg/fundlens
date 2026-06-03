"""
backfill_nav_history.py  —  v1.5.0

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
    python backfill_nav_history.py --from 2006-01-01 --to 2006-12-31
    python backfill_nav_history.py --start-date 2015-01-01 --end-date 2020-12-31
    python backfill_nav_history.py --full --dry-run
    python backfill_nav_history.py --auto-resume
    python backfill_nav_history.py --auto-resume --dry-run

Changelog:
  v1.5.0  Custom --from/--to range: no T-1 cap applied (exact user dates used).
          Warning emitted when --to is today or in the future (AMFI may not have
          published NAV yet), but fetch is still attempted — do NOT skip.
          T-1 cap remains only for --full and --auto-resume (where no explicit
          end date is supplied).
  v1.4.1  get_supabase_client: key fallback chain SUPABASE_SERVICE_ROLE_KEY
          → SUPABASE_KEY → SUPABASE_SERVICE_KEY.
  v1.4.0  Add --from / --to as aliases for --start-date / --end-date.
          Supports year-by-year gap repair runs:
            python backfill_nav_history.py --from 2006-01-01 --to 2006-12-31
  v1.3.0  Fix: end date is always T-1 (yesterday) for --auto-resume and --full.
          Previously FULL_END_DATE (hardcoded) caused start > end once the DB
          caught up to that date, producing 0 windows and immediate exit.
          FULL_END_DATE constant removed. All auto end-dates use date.today()-1.
  v1.2.0  --auto-resume flag, 300s timeout, 3-attempt retry on load_scheme_map,
          BATCH_UPSERT_SIZE=400, INTER_BATCH_SLEEP=0.0
  v1.1.0  Retry logic on AMFI fetch, BATCH_UPSERT_SIZE, INTER_BATCH_SLEEP
  v1.0.0  Initial release

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
REQUEST_DELAY_SEC    = 8.0     # seconds between AMFI requests
NAV_HISTORY_TIMEOUT  = 60      # seconds per HTTP request
MAX_RETRIES          = 5
RETRY_BACKOFF_BASE   = 10      # seconds; doubles each retry
LOG_EVERY_N_WINDOWS  = 5
BATCH_UPSERT_SIZE    = 400     # rows per Supabase upsert call (keep under statement timeout)
INTER_BATCH_SLEEP    = 0.0     # seconds between batches within a window

FULL_START_DATE      = date(1994, 1, 1)
# No FULL_END_DATE constant — end is always date.today() - timedelta(days=1) (T-1)
# so the script stays current without code changes.

RETRYABLE_STATUS     = {429, 500, 502, 503, 504}
UPSERT_RETRY_LIMIT   = 4
UPSERT_RETRY_BACKOFF = 5   # seconds; doubles each attempt

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
    key = (
        os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
        or os.environ.get("SUPABASE_KEY", "").strip()
        or os.environ.get("SUPABASE_SERVICE_KEY", "").strip()
    )
    if not url or not key:
        raise SystemExit(
            "ERROR: No Supabase service key found. "
            "Set SUPABASE_SERVICE_ROLE_KEY in .env"
        )
    client = create_client(url, key)
    client.postgrest.timeout = 300
    return client


def load_scheme_map(client: Client) -> dict[int, str]:
    """Return {amfi_code: scheme_id_uuid} for all active schemes."""
    log.info("Loading scheme map from Supabase ...")
    result = None
    for attempt in range(1, 4):
        try:
            result = (
                client.table("schemes")
                .select("id, amfi_code")
                .eq("is_active", True)
                .execute()
            )
            break
        except Exception as exc:
            if attempt == 3:
                log.error("load_scheme_map failed after 3 attempts: %s", exc)
                sys.exit(1)
            log.warning("load_scheme_map attempt %d/3 failed: %s -- retry in 30s", attempt, exc)
            time.sleep(30)
    if result is None or result.data is None:
        log.error("Failed to load schemes table.")
        sys.exit(1)

    mapping: dict[int, str] = {}
    for row in result.data:
        if row.get("amfi_code") is not None:
            mapping[int(row["amfi_code"])] = row["id"]

    log.info("Loaded %d active schemes.", len(mapping))
    return mapping


def fetch_max_nav_date(client: Client) -> date | None:
    """Return the latest nav_date already in nav_history, or None if the table is empty."""
    result = (
        client.table("nav_history")
        .select("nav_date")
        .order("nav_date", desc=True)
        .limit(1)
        .execute()
    )
    if result.data:
        return date.fromisoformat(result.data[0]["nav_date"])
    return None


def upsert_nav_rows(client: Client, rows: list[dict]) -> int:
    """
    Upsert rows into nav_history in batches with retry on connection errors.
    Returns the number of rows submitted (duplicates silently skipped by DB).
    """
    for i in range(0, len(rows), BATCH_UPSERT_SIZE):
        batch = rows[i : i + BATCH_UPSERT_SIZE]

        for attempt in range(1, UPSERT_RETRY_LIMIT + 1):
            try:
                client.table("nav_history").upsert(
                    batch,
                    on_conflict="scheme_id,nav_date",
                    ignore_duplicates=True,
                ).execute()
                break  # success
            except Exception as exc:
                exc_str = str(exc)
                wait = UPSERT_RETRY_BACKOFF * (2 ** (attempt - 1))
                if attempt == UPSERT_RETRY_LIMIT:
                    raise RuntimeError(
                        f"Supabase upsert failed after {UPSERT_RETRY_LIMIT} attempts: {exc}"
                    ) from exc
                log.warning("Supabase upsert error (attempt %d/%d): %s -- retry in %ds",
                            attempt, UPSERT_RETRY_LIMIT, exc_str[:120], wait)
                time.sleep(wait)

        if i + BATCH_UPSERT_SIZE < len(rows):
            time.sleep(INTER_BATCH_SLEEP)

    return len(rows)

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
                    f"for window {from_date} -> {to_date}: {exc}"
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

def run_backfill(start: date | None, end: date | None, dry_run: bool = False,
                 auto_resume: bool = False) -> None:
    client = get_supabase_client()

    if auto_resume:
        yesterday = date.today() - timedelta(days=1)
        max_date  = fetch_max_nav_date(client)
        if max_date is None:
            start = FULL_START_DATE
            log.info("nav_history is empty — auto-resuming from full start %s", FULL_START_DATE)
        else:
            start = max_date + timedelta(days=1)
            log.info(
                "Auto-resuming from %s  (last loaded date was %s)",
                start, max_date,
            )
        end = yesterday   # T-1: always yesterday, never a hardcoded constant
        log.info("Auto-resume end date set to yesterday: %s", end)

        if start > end:
            log.info(
                "Nothing to do — nav_history is already current through %s (yesterday is %s).",
                max_date, end,
            )
            return

    scheme_map = load_scheme_map(client)

    windows = date_windows(start, end)
    total   = len(windows)
    log.info(
        "Backfill range: %s -> %s  |  %d windows × %d days",
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
            log.error("[Window %d/%d] %s -> %s  FAILED: %s", idx, total, w_start, w_end, exc)
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
                "[Window %d/%d] %s -> %s  fetched %d / matched %d / inserted %d",
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
  python backfill_nav_history.py --from 2006-01-01 --to 2006-12-31
  python backfill_nav_history.py --start-date 2015-01-01 --end-date 2020-12-31
  python backfill_nav_history.py --full --dry-run
  python backfill_nav_history.py --auto-resume
  python backfill_nav_history.py --auto-resume --dry-run
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
        help=f"Full backfill from {FULL_START_DATE} to yesterday (T-1, computed at runtime).",
    )
    mode.add_argument(
        "--start-date", "--from",
        dest="start_date",
        metavar="YYYY-MM-DD",
        help="Custom start date. Aliases: --from. Pair with --end-date/--to, or defaults to yesterday.",
    )
    mode.add_argument(
        "--auto-resume",
        action="store_true",
        help="Query MAX(nav_date) from nav_history, resume from next day through yesterday (T-1). "
             f"Falls back to {FULL_START_DATE} if the table is empty.",
    )

    parser.add_argument(
        "--end-date", "--to",
        dest="end_date",
        metavar="YYYY-MM-DD",
        help="Custom end date. Aliases: --to. Used with --start-date/--from.",
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
    today     = date.today()
    yesterday = today - timedelta(days=1)

    if args.full:
        # End is always T-1 so --full stays current without code changes.
        return FULL_START_DATE, yesterday

    if args.test_mode:
        start = today - relativedelta(months=args.months)
        return start, yesterday

    # --start-date / --from mode: user controls end; default to yesterday if not supplied.
    # T-1 cap is NOT applied here — the user supplies exact dates and we honour them.
    # This allows gap-repair runs for any past date, including the last 30 days.
    try:
        start = date.fromisoformat(args.start_date)
    except ValueError:
        log.error("Invalid --start-date/--from: use YYYY-MM-DD.")
        sys.exit(1)

    if args.end_date:
        try:
            end = date.fromisoformat(args.end_date)
        except ValueError:
            log.error("Invalid --end-date/--to: use YYYY-MM-DD.")
            sys.exit(1)
    else:
        end = yesterday

    if start > end:
        log.error("--start-date must be before --end-date.")
        sys.exit(1)

    if end >= today:
        log.warning(
            "--to date %s is today or in the future — AMFI may not have published "
            "NAV for these dates yet. Fetch will be attempted; expect 0 rows for "
            "future dates.",
            end,
        )

    return start, end


def main() -> None:
    args = parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    if args.auto_resume:
        start, end = None, None   # resolved inside run_backfill after DB query
    else:
        start, end = resolve_date_range(args)

    log.info("backfill_nav_history.py  v1.5.0  starting")
    log.info(
        "  Mode     : %s",
        "auto-resume" if args.auto_resume
        else "full" if args.full
        else f"test ({args.months}m)" if args.test_mode
        else "custom range",
    )
    if not args.auto_resume:
        log.info("  Range    : %s -> %s", start, end)
    log.info("  Dry run  : %s", args.dry_run)
    log.info("  Window   : %d days  |  delay: %.1fs between requests", WINDOW_DAYS, REQUEST_DELAY_SEC)

    run_backfill(start, end, dry_run=args.dry_run, auto_resume=args.auto_resume)


if __name__ == "__main__":
    main()
