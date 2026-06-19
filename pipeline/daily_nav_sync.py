"""
daily_nav_sync.py  —  v2.0

Fetches today's NAV from AMFI NAVAll.txt and writes to Supabase nav_history.
Updates schemes.last_nav_date and is_active on every run.

New in v2.0:
  - Tracks the 4-level AMFI header hierarchy (Nature / Type / Category / AMC).
  - Auto-inserts previously-unmatched schemes instead of skipping them.
  - Strips "Formerly Known As" rename tags universally from all scheme names.
  - Populates schemes.category_id as a side effect of new-scheme insertion.
  - Logs the FULL list of newly-inserted amfi_codes (no truncation).

AMFI NAVAll.txt structure:

  Open Ended Schemes(Debt Scheme - Banking and PSU Fund)   ← Nature/Type/Category header
  Aditya Birla Sun Life Mutual Fund                         ← AMC header
  108272;INF209K01LX6;...;Aditya Birla...;148.26;18-Jun-2026  ← data row

NAVAll.txt column layout (semicolon-separated, 6 fields):
    0  Scheme Code
    1  ISIN Div Payout / ISIN Growth
    2  ISIN Div Reinvestment
    3  Scheme Name
    4  Net Asset Value
    5  Date                     ← DD-MMM-YYYY  e.g. 18-Jun-2026

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
import re
import sys
import time
from datetime import date, datetime, timedelta

import requests

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

AMFI_NAV_ALL_URL     = "https://www.amfiindia.com/spages/NAVAll.txt"
AMFI_TIMEOUT_SEC     = 60
AMFI_MAX_RETRIES     = 3
AMFI_RETRY_BACKOFF   = 10        # seconds; doubles each retry

RETRYABLE_STATUS     = {429, 500, 502, 503, 504}
NAV_BATCH_SIZE       = 500       # rows per nav_history upsert call
SCHEME_BATCH_SIZE    = 500       # amfi_codes per schemes PATCH call
SUPABASE_TIMEOUT     = 60        # seconds per Supabase HTTP request
UPSERT_MAX_RETRIES   = 3
UPSERT_RETRY_BACKOFF = 10        # seconds; doubles each retry

INACTIVE_AFTER_DAYS  = 30        # mark is_active=False if absent > this many days

# ---------------------------------------------------------------------------
# Regex patterns
# ---------------------------------------------------------------------------

# Detects Nature/Type/Category header lines in NAVAll.txt.
# Handles:
#   "Open Ended Schemes(Debt Scheme - Banking and PSU Fund)"
#   "Close Ended Schemes(ELSS)"
#   "Interval Fund Schemes(Income)"
NATURE_HEADER_RE = re.compile(
    r"^(Open\s+Ended|Close\s+Ended|Interval\s+Fund)\s+Schemes?\s*\((.+)\)\s*$",
    re.IGNORECASE,
)

# Strips "(formerly known as ...)" tags from scheme names.
# Run universally on every row — not conditionally on AMC.
FORMERLY_RE = re.compile(r"\s*\(formerly known as[^)]*\)", re.IGNORECASE)

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
# Name cleaning
# ---------------------------------------------------------------------------

def clean_scheme_name(raw: str) -> tuple[str, str | None]:
    """
    Strip any "(formerly known as ...)" tag from a scheme name.
    Returns (cleaned_name, former_name) where former_name is None when absent.
    Applied to every row regardless of AMC.
    """
    m = FORMERLY_RE.search(raw)
    former_name: str | None = None
    if m:
        inner = m.group(0)
        former_text = re.sub(r"^\s*\(formerly known as\s*", "", inner, flags=re.IGNORECASE)
        former_text = re.sub(r"\)\s*$", "", former_text).strip()
        former_name = former_text or None
    cleaned = FORMERLY_RE.sub("", raw).strip()
    return cleaned, former_name

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


def load_category_map(url: str, api_key: str) -> dict[str, str]:
    """Return {category_name_lower: category_id} from scheme_categories."""
    log.info("Loading category map from Supabase ...")
    try:
        resp = requests.get(
            f"{url}/rest/v1/scheme_categories",
            params={"select": "id,name"},
            headers=_headers(api_key),
            timeout=SUPABASE_TIMEOUT,
        )
    except requests.RequestException as exc:
        log.error("Failed to fetch scheme_categories: %s", exc)
        return {}

    if resp.status_code != 200:
        log.error(
            "Failed to load scheme_categories: HTTP %d — %s",
            resp.status_code, resp.text[:200],
        )
        return {}

    cat_map: dict[str, str] = {}
    for row in resp.json():
        name = row.get("name", "")
        if name:
            cat_map[name.lower().strip()] = row["id"]

    log.info("Loaded %d categories.", len(cat_map))
    return cat_map


def resolve_category_id(category_str: str, cat_map: dict[str, str]) -> str | None:
    """
    Attempt to match a category string (extracted from NAVAll.txt header) against
    scheme_categories.

    1. Exact match (case-insensitive).
    2. Single fallback: append " Fund" if not already ending with it.

    Returns the category UUID, or None if unresolved.
    """
    if not category_str or not cat_map:
        return None
    lower = category_str.lower().strip()
    if lower in cat_map:
        return cat_map[lower]
    if not lower.endswith(" fund"):
        with_fund = lower + " fund"
        if with_fund in cat_map:
            return cat_map[with_fund]
    return None


def upsert_nav_batches(
    url: str, api_key: str, rows: list[dict]
) -> tuple[int, int]:
    """
    Upsert rows into nav_history in batches of NAV_BATCH_SIZE.
    Returns (batches_ok, batches_failed).
    """
    batches_ok = batches_failed = 0

    for i in range(0, len(rows), NAV_BATCH_SIZE):
        batch     = rows[i : i + NAV_BATCH_SIZE]
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
    Step 2: Mark as inactive any scheme absent for 30+ consecutive days.
    Returns approximate count of schemes updated in step 1.
    """
    codes          = sorted(amfi_codes_seen)
    total_updated  = 0
    step1_failed   = 0

    for i in range(0, len(codes), SCHEME_BATCH_SIZE):
        batch     = codes[i : i + SCHEME_BATCH_SIZE]
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
                    "schemes active update HTTP %d (batch starts %d) — %s",
                    resp.status_code, batch[0], resp.text[:200],
                )
                step1_failed += 1
        except requests.RequestException as exc:
            log.error(
                "schemes active update request error (batch starts %d): %s",
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
                "Stale schemes marked inactive (last_nav_date < %s).", cutoff
            )
        else:
            log.error(
                "schemes inactive update HTTP %d — %s",
                resp.status_code, resp.text[:200],
            )
    except requests.RequestException as exc:
        log.error("schemes inactive update request error: %s", exc)

    return total_updated


def insert_new_scheme(
    url: str,
    api_key: str,
    amfi_code: int,
    name: str,
    category_id: str | None,
    amc_name: str,
    dry_run: bool,
) -> str | None:
    """
    Insert a new row into schemes for a previously-unknown amfi_code.
    Returns the new scheme_id UUID on success, None on failure.
    In dry_run mode, logs what would be inserted and returns a placeholder ID.

    amc_id is intentionally omitted — the amc_aliases table is not yet built.
    The raw amc_name is logged so it can be resolved in a future pass.
    """
    if dry_run:
        log.info(
            "  [DRY RUN] would insert: amfi_code=%d  category_id=%s"
            "  amc=%r  name=%r",
            amfi_code,
            category_id or "null",
            amc_name[:50],
            name[:80],
        )
        return f"dry-run-{amfi_code}"

    try:
        resp = requests.post(
            f"{url}/rest/v1/schemes",
            json={
                "amfi_code":   amfi_code,
                "name":        name,
                "is_active":   True,
                "category_id": category_id,
                # amc_id intentionally omitted — amc_aliases table not yet built
            },
            headers=_headers(api_key, "return=representation"),
            timeout=SUPABASE_TIMEOUT,
        )
        if resp.status_code in (200, 201):
            data   = resp.json()
            new_id = data[0]["id"] if isinstance(data, list) else data.get("id")
            log.info(
                "  Inserted new scheme: amfi_code=%d  id=%s  amc=%r",
                amfi_code, new_id, amc_name[:60],
            )
            return new_id
        log.error(
            "Failed to insert scheme amfi_code=%d: HTTP %d — %s",
            amfi_code, resp.status_code, resp.text[:300],
        )
        return None
    except requests.RequestException as exc:
        log.error("Exception inserting scheme amfi_code=%d: %s", amfi_code, exc)
        return None

# ---------------------------------------------------------------------------
# AMFI fetch
# ---------------------------------------------------------------------------

def fetch_nav_all() -> str:
    """Fetch NAVAll.txt from AMFI. Exits with code 1 on failure."""
    log.info("Fetching NAVAll.txt from AMFI ...")
    for attempt in range(1, AMFI_MAX_RETRIES + 1):
        try:
            resp = requests.get(AMFI_NAV_ALL_URL, timeout=AMFI_TIMEOUT_SEC)
            if resp.status_code == 200:
                log.info("NAVAll.txt fetched: %d bytes", len(resp.content))
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

    log.error("AMFI fetch failed after %d attempts. Exiting.", AMFI_MAX_RETRIES)
    sys.exit(1)

# ---------------------------------------------------------------------------
# Parse — v2.0 (tracks 4-level hierarchy + universal name cleaning)
# ---------------------------------------------------------------------------

def parse_nav_all(text: str) -> tuple[list[dict], int, int]:
    """
    Parse AMFI NAVAll.txt, tracking the 4-level header hierarchy.

    Header lines (fewer than 6 semicolon-separated fields):
      - Lines matching NATURE_HEADER_RE → update current_nature / current_type /
        current_category. Inner content split on first " - " to separate Type
        from Category; if no " - " present, Type and Category are set to the
        same value.
      - All other non-empty lines → treated as AMC name headers → update
        current_amc.

    Data rows (>= 6 semicolon-separated fields, first field numeric):
      - Parsed for amfi_code, scheme_name_raw, nav, nav_date.
      - scheme_name_raw is cleaned by clean_scheme_name() to strip any
        "(formerly known as ...)" tag.
      - The current nature / type / category / amc context is attached.

    Returns:
        rows          — list of dicts with keys:
                        amfi_code, scheme_name_raw, scheme_name_clean,
                        former_name, nav, nav_date,
                        nature, scheme_type, category, amc_name
        skipped_na    — rows skipped for N.A. nav or empty date
        skipped_parse — rows skipped for parse errors
    """
    rows: list[dict] = []
    skipped_na    = 0
    skipped_parse = 0

    current_nature   = ""
    current_type     = ""
    current_category = ""
    current_amc      = ""

    for line in text.splitlines():
        stripped = line.strip()
        if not stripped:
            continue

        parts = stripped.split(";")

        if len(parts) < 6:
            # Header line — update hierarchy state
            m = NATURE_HEADER_RE.match(stripped)
            if m:
                current_nature = m.group(1).strip()
                inner          = m.group(2).strip()
                if " - " in inner:
                    current_type, current_category = inner.split(" - ", 1)
                    current_type     = current_type.strip()
                    current_category = current_category.strip()
                else:
                    current_type = current_category = inner
            else:
                # AMC name header (includes the CSV column-header line which
                # has semicolons and won't reach here, and edge cases like
                # "IL&FS Mutual Fund (IDF)" which don't match NATURE_HEADER_RE)
                current_amc = stripped
            continue

        # Data row
        nav_str  = parts[4].strip()
        date_str = parts[5].strip()

        if not nav_str or nav_str.upper() == "N.A." or not date_str:
            skipped_na += 1
            continue

        try:
            amfi_code       = int(parts[0].strip())
            scheme_name_raw = parts[3].strip()
            nav_val         = float(nav_str)
            nav_date        = datetime.strptime(date_str, "%d-%b-%Y").date().isoformat()
        except (ValueError, IndexError):
            skipped_parse += 1
            continue

        scheme_name_clean, former_name = clean_scheme_name(scheme_name_raw)

        rows.append({
            "amfi_code":         amfi_code,
            "scheme_name_raw":   scheme_name_raw,
            "scheme_name_clean": scheme_name_clean,
            "former_name":       former_name,
            "nav":               nav_val,
            "nav_date":          nav_date,
            "nature":            current_nature,
            "scheme_type":       current_type,
            "category":          current_category,
            "amc_name":          current_amc,
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
    log.info("  Schemes matched (existing) : %d", stats["matched"])
    log.info("  New schemes auto-inserted  : %d", stats["new_schemes"])
    log.info("  Category resolved          : %d", stats["cat_resolved"])
    log.info("  Category unresolved (null) : %d", stats["cat_unresolved"])
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

    log.info("daily_nav_sync.py  v2.0  starting")
    log.info("  Target date : %s", today_str)
    log.info("  Dry run     : %s", dry_run)

    # 1. Fetch NAVAll.txt
    raw_text = fetch_nav_all()

    # 2. Parse with hierarchy tracking and name cleaning
    parsed_rows, skipped_na, skipped_parse = parse_nav_all(raw_text)

    stats: dict = {
        "total_in_file":   len(parsed_rows) + skipped_na + skipped_parse,
        "parsed":          len(parsed_rows),
        "skipped_na":      skipped_na,
        "skipped_parse":   skipped_parse,
        "matched":         0,
        "new_schemes":     0,
        "cat_resolved":    0,
        "cat_unresolved":  0,
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

    # Print 5 sample rows to confirm hierarchy is attached correctly
    log.info("Sample parsed rows (first 5 unique amfi_codes with hierarchy):")
    seen_sample: set[int] = set()
    for row in parsed_rows:
        if row["amfi_code"] in seen_sample:
            continue
        seen_sample.add(row["amfi_code"])
        formerly_tag = f"  [formerly: {row['former_name']!r}]" if row["former_name"] else ""
        log.info(
            "  amfi=%d  nature=%r  type=%r  cat=%r  amc=%r  name=%r%s",
            row["amfi_code"],
            row["nature"],
            row["scheme_type"],
            row["category"],
            row["amc_name"][:35],
            row["scheme_name_clean"][:55],
            formerly_tag,
        )
        if len(seen_sample) >= 5:
            break

    # Report any "formerly known as" renames found
    formerly_rows = [r for r in parsed_rows if r["former_name"]]
    if formerly_rows:
        log.info("Formerly-Known-As renames found: %d total. Sample (up to 3):", len(formerly_rows))
        for ex in formerly_rows[:3]:
            log.info(
                "  amfi=%d  clean=%r  former=%r",
                ex["amfi_code"],
                ex["scheme_name_clean"][:60],
                ex["former_name"][:60],
            )
    else:
        log.info("No Formerly-Known-As renames found in today's file.")

    dates_in_file = sorted({r["nav_date"] for r in parsed_rows})
    log.info(
        "Dates in NAVAll.txt: %d unique  |  range %s to %s",
        len(dates_in_file), dates_in_file[0], dates_in_file[-1],
    )
    if target_date and target_date not in dates_in_file:
        log.warning(
            "--date %s not found in NAVAll.txt (file contains: %s). "
            "schemes.last_nav_date will be set to %s.",
            target_date, dates_in_file, today_str,
        )

    # 3. Credentials
    if dry_run:
        supabase_url = os.environ.get("SUPABASE_URL", "").strip()
        api_key = (
            os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
            or os.environ.get("SUPABASE_KEY", "").strip()
        )
        if not (supabase_url and api_key):
            log.info("No Supabase credentials in env — skipping lookup in dry-run.")
            log.info("Dry run — no writes to Supabase.")
            _print_summary(stats, time.monotonic() - t_start, dry_run=True)
            return
    else:
        supabase_url = _env("SUPABASE_URL")
        api_key = (
            os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
            or os.environ.get("SUPABASE_KEY", "").strip()
        )
        if not api_key:
            log.error(
                "SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_KEY) is required but not set."
            )
            sys.exit(1)

    # 4. Load scheme map (all schemes, active and inactive)
    scheme_map = load_scheme_map(supabase_url, api_key)

    # 5. Load category map
    cat_map = load_category_map(supabase_url, api_key)

    # 6. Resolve, match, and auto-insert unmatched schemes
    upsert_rows:        list[dict] = []
    amfi_codes_seen:    set[int]   = set()
    newly_inserted:     set[int]   = set()
    new_amc_names:      list[str]  = []
    unresolved_cats:    set[str]   = set()

    for row in parsed_rows:
        amfi_code = row["amfi_code"]
        cat_str   = row["category"]

        # Category resolution (per row, but only unique strings are logged)
        cat_id = resolve_category_id(cat_str, cat_map)
        if cat_id:
            stats["cat_resolved"] += 1
        else:
            stats["cat_unresolved"] += 1
            if cat_str:
                unresolved_cats.add(cat_str)

        scheme_id = scheme_map.get(amfi_code)

        if scheme_id is None and amfi_code not in newly_inserted:
            # First encounter of an unknown amfi_code — auto-insert
            new_id = insert_new_scheme(
                supabase_url, api_key,
                amfi_code=amfi_code,
                name=row["scheme_name_clean"],
                category_id=cat_id,
                amc_name=row["amc_name"],
                dry_run=dry_run,
            )
            if new_id:
                scheme_map[amfi_code] = new_id   # register for remainder of this run
                newly_inserted.add(amfi_code)
                stats["new_schemes"] += 1
                amc = row["amc_name"]
                if amc and amc not in new_amc_names:
                    new_amc_names.append(amc)
                scheme_id = new_id
            else:
                # Insert failed — skip NAV row
                continue

        elif scheme_id is None:
            # Same amfi_code appeared again in this file after a failed insert — skip
            continue

        amfi_codes_seen.add(amfi_code)
        upsert_rows.append({
            "scheme_id": scheme_map[amfi_code],
            "nav_date":  row["nav_date"],
            "nav":       row["nav"],
        })

    stats["matched"] = len(amfi_codes_seen) - len(newly_inserted)

    # Log unresolved category strings (once per unique value)
    if unresolved_cats:
        log.warning(
            "Unresolved category strings (%d unique) — logged for visibility "
            "(category_id will be null for these schemes):",
            len(unresolved_cats),
        )
        for cat in sorted(unresolved_cats):
            log.warning("  %r", cat)

    # Log newly inserted schemes — FULL list, no truncation
    if newly_inserted:
        log.info(
            "New schemes auto-inserted this run: %d",
            len(newly_inserted),
        )
        log.info(
            "  Full amfi_code list: %s",
            sorted(newly_inserted),
        )
        log.info(
            "  AMC names (amc_id=null until amc_aliases table is built): %s",
            new_amc_names,
        )
    else:
        log.info("No new schemes to insert — all amfi_codes already in schemes table.")

    # 7. Upsert nav_history
    if not dry_run:
        batches_ok, batches_failed = upsert_nav_batches(supabase_url, api_key, upsert_rows)
        stats["upserted"] = len(upsert_rows)
        log.info(
            "nav_history upsert: %d rows  |  %d batches ok  |  %d batches failed",
            len(upsert_rows), batches_ok, batches_failed,
        )
    else:
        log.info("Dry run — no writes to Supabase.")
        stats["upserted"] = 0

    # 8. Update scheme activity
    if not dry_run:
        updated = update_scheme_activity(
            supabase_url, api_key, amfi_codes_seen, today_str,
        )
        stats["schemes_updated"] = updated

    _print_summary(stats, time.monotonic() - t_start, dry_run)

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
            log.error("Invalid --date value %r: use YYYY-MM-DD format.", args.date)
            sys.exit(1)
    run_sync(dry_run=args.dry_run, target_date=target_date)


if __name__ == "__main__":
    main()
