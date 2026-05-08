"""
populate_schemes_table.py  —  v1.0.0

Fetches the AMFI scheme master and upserts into the Supabase schemes table.

Usage:
    python populate_schemes_table.py
    python populate_schemes_table.py --dry-run

Requires env vars: SUPABASE_URL, SUPABASE_KEY
"""

import argparse
import csv
import io
import os
import sys
import time
import logging
from datetime import datetime, timezone

import requests
from supabase import create_client, Client

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

AMFI_SCHEME_MASTER_URL = "https://portal.amfiindia.com/DownloadSchemeData_Po.aspx?mf=0"
REQUEST_TIMEOUT        = 60     # seconds
MAX_RETRIES            = 3
RETRY_BACKOFF_BASE     = 5      # seconds; doubles each retry
BATCH_SIZE             = 1000

# Alternate names: legal entity names AMFI uses in scheme master field[0].
# Key = canonical name in amcs.name; values = AMFI variants that map to same UUID.
# Keep in sync with sync_amc_master.py ALTERNATE_NAMES (v1.3.0).
ALTERNATE_NAMES: dict[str, list[str]] = {
    "360 ONE Mutual Fund":               ["360 ONE Asset Management Limited"],
    "Abakkus Mutual Fund":               ["Abakkus Asset Manager LLP",
                                          "Abakkus Investment Managers Private Limited"],
    "Aditya Birla Sun Life Mutual Fund": ["Aditya Birla Sun Life AMC Limited"],
    "Angel One Mutual Fund":             ["Angel One Asset Management Limited",
                                          "Angel One Asset Management Company Limited"],
    "Axis Mutual Fund":                  ["Axis Asset Management Company Limited",
                                          "Axis Asset Management Co. Ltd."],
    "Bajaj Finserv Mutual Fund":         ["Bajaj Finserv Asset Management Limited"],
    "Bandhan Mutual Fund":               ["Bandhan AMC Limited",
                                          "IDFC Asset Management Company Limited",
                                          "IDFC Asset Management Company Ltd."],
    "Bank of India Mutual Fund":         ["Bank of India Investment Managers Private Limited",
                                          "Bank of India Investment Managers Pvt. Ltd."],
    "Baroda BNP Paribas Mutual Fund":    ["Baroda BNP Paribas Asset Management India Private Limited",
                                          "Baroda BNP Paribas Asset Management India Pvt. Ltd."],
    "Canara Robeco Mutual Fund":         ["Canara Robeco Asset Management Company Limited",
                                          "Canara Robeco Asset Management Company Ltd."],
    "Capitalmind Mutual Fund":           ["Capitalmind Financial Services Private Limited",
                                          "Capitalmind Financial Services Pvt. Ltd.",
                                          "Capitalmind Asset Management Private Limited"],
    "Choice Mutual Fund":                ["Choice Equity Broking Private Limited",
                                          "Choice AMC Private Limited"],
    "DSP Mutual Fund":                   ["DSP Asset Managers Private Limited",
                                          "DSP Asset Managers Pvt. Ltd.",
                                          "DSP BlackRock Investment Managers Private Limited"],
    "Edelweiss Mutual Fund":             ["Edelweiss Asset Management Limited"],
    "Franklin Templeton Mutual Fund":    ["Franklin Templeton Asset Management (India) Private Limited",
                                          "Franklin Templeton Asset Management (India) Pvt. Ltd."],
    "Groww Mutual Fund":                 ["Groww Asset Management Limited"],
    "HDFC Mutual Fund":                  ["HDFC Asset Management Company Limited",
                                          "HDFC Asset Management Company Ltd."],
    "Helios Mutual Fund":                ["Helios Asset Management Company Private Limited",
                                          "Helios Asset Management Company Pvt. Ltd.",
                                          "Helios Capital Asset Management (India) Pvt. Ltd."],
    "HSBC Mutual Fund":                  ["HSBC Asset Management (India) Private Limited",
                                          "HSBC Asset Management (India) Private Ltd.",
                                          "HSBC Asset Management (India) Pvt. Ltd."],
    "ICICI Prudential Mutual Fund":      ["ICICI Prudential Asset Management Company Limited",
                                          "ICICI Prudential Asset Management Company Ltd."],
    "IIFCL Mutual Fund":                 ["IIFCL Asset Management Co. Ltd."],
    "IL&FS Mutual Fund":                 ["IL&FS Infra Asset Management Limited"],
    "Invesco Mutual Fund":               ["Invesco Asset Management (India) Private Limited",
                                          "Invesco Asset Management (India) Pvt. Ltd.",
                                          "Invesco India Mutual Fund",
                                          "Religare Invesco Asset Management Company Pvt. Ltd.",
                                          "Religare Invesco Asset Management Company Private Limited"],
    "ITI Mutual Fund":                   ["ITI Asset Management Limited",
                                          "ITI Asset Management Ltd."],
    "Jio BlackRock Mutual Fund":         ["Jio BlackRock Asset Management Private Limited",
                                          "Jio BlackRock Asset Management Pvt. Ltd."],
    "JM Financial Mutual Fund":          ["JM Financial Asset Management Limited",
                                          "JM Financial Asset Management Ltd."],
    "Kotak Mahindra Mutual Fund":        ["Kotak Mahindra Asset Management Company Limited",
                                          "Kotak Mahindra Asset Management Company Limited.",
                                          "Kotak Mahindra Asset Management Company Ltd."],
    "LIC Mutual Fund":                   ["LIC Mutual Fund Asset Management Limited",
                                          "LIC Mutual Fund Asset Management Ltd.",
                                          "LIC Nomura Mutual Fund Asset Management Company Ltd.",
                                          "LIC Nomura Mutual Fund Asset Management Company Limited"],
    "Mahindra Manulife Mutual Fund":     ["Mahindra Manulife Investment Management Private Limited",
                                          "Mahindra Manulife Investment Management Pvt. Ltd.",
                                          "Mahindra Manulife Investment Management Pvt Ltd"],
    "Mirae Asset Mutual Fund":           ["Mirae Asset Investment Managers (India) Private Limited",
                                          "Mirae Asset Investment Managers (India) Pvt. Ltd.",
                                          "Mirae Asset Investment Managers (India) Pvt. Ltd"],
    "Motilal Oswal Mutual Fund":         ["Motilal Oswal Asset Management Company Limited",
                                          "Motilal Oswal Asset Management Company Ltd."],
    "Navi Mutual Fund":                  ["Navi AMC Limited",
                                          "Navi AMC Ltd."],
    "Nippon India Mutual Fund":          ["Nippon Life India Asset Management Limited",
                                          "Nippon Life India Asset Management Ltd.",
                                          "Reliance Nippon Life Asset Management Limited",
                                          "Reliance Capital Asset Management Limited",
                                          "Reliance Capital Asset Management Ltd."],
    "NJ Mutual Fund":                    ["NJ Asset Management Private Limited",
                                          "NJ Asset Management Pvt. Ltd."],
    "Old Bridge Mutual Fund":            ["Old Bridge Asset Management Private Limited",
                                          "Old Bridge Asset Management Pvt. Ltd."],
    "PGIM India Mutual Fund":            ["PGIM India Asset Management Private Limited",
                                          "PGIM India Asset Management Pvt. Ltd.",
                                          "PGIM India Asset Management Private Limite",
                                          "Deutsche Asset Management (India) Pvt. Ltd."],
    "PPFAS Mutual Fund":                 ["PPFAS Asset Management Private Limited",
                                          "PPFAS Asset Management Pvt. Ltd."],
    "quant Mutual Fund":                 ["quant Money Managers Limited",
                                          "quant Money Managers Ltd.",
                                          "quant"],
    "Quantum Mutual Fund":               ["Quantum Asset Management Company Private Limited",
                                          "Quantum Asset Management Company Pvt. Ltd."],
    "Sahara Mutual Fund":                ["Sahara Asset Management Company Private Limited",
                                          "Sahara Asset Management Company Pvt. Ltd."],
    "Samco Mutual Fund":                 ["Samco Asset Management Private Limited",
                                          "Samco Asset Management Pvt. Ltd.",
                                          "Samco"],
    "SBI Mutual Fund":                   ["SBI Funds Management Limited",
                                          "SBI Funds Management Ltd.",
                                          "SBI Funds Management Private Limited",
                                          "SBI Funds Management Pvt. Ltd."],
    "Shriram Mutual Fund":               ["Shriram Asset Management Company Limited",
                                          "Shriram Asset Management Company Ltd.",
                                          "Shriram Asset Management Co. Ltd."],
    "Sundaram Mutual Fund":              ["Sundaram Asset Management Company Limited",
                                          "Sundaram Asset Management Company Ltd",
                                          "Sundaram Asset Management Company Ltd."],
    "Tata Mutual Fund":                  ["Tata Asset Management Limited",
                                          "Tata Asset Management Ltd.",
                                          "Tata Asset Management Private Limited",
                                          "Tata Asset Management Pvt. Ltd."],
    "Taurus Mutual Fund":                ["Taurus Asset Management Company Limited",
                                          "Taurus Asset Management Company Ltd."],
    "The Wealth Company Mutual Fund":    ["Wealth Company Asset Management Holdings Private Limited"],
    "Trust Mutual Fund":                 ["Trust Asset Management Private Limited",
                                          "Trust Asset Management Pvt. Ltd.",
                                          "TrustMF", "TRUSTMF"],
    "Unifi Mutual Fund":                 ["Unifi Asset Management Private Limited"],
    "Union Mutual Fund":                 ["Union Asset Management Company Private Limited",
                                          "Union Asset Management Company Pvt. Ltd."],
    "UTI Mutual Fund":                   ["UTI Asset Management Company Limited",
                                          "UTI Asset Management Company Ltd.",
                                          "UTI Asset Mgmt. Co. Ltd."],
    "WhiteOak Capital Mutual Fund":      ["WhiteOak Capital Asset Management Limited",
                                          "WhiteOak Capital Asset Management Ltd."],
    "Zerodha Mutual Fund":               ["Zerodha Fund House",
                                          "Zerodha Asset Management Private Limited"],
}

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger("populate_schemes")

# ---------------------------------------------------------------------------
# AMFI fetch
# ---------------------------------------------------------------------------

def _debug_response(text: str) -> None:
    """Print raw response diagnostics to help diagnose CSV parsing issues."""
    all_lines = text.splitlines()
    log.info("── RESPONSE DEBUG ──────────────────────────────────────")
    log.info("Total lines in response: %d", len(all_lines))
    log.info("First 20 lines (raw):")
    for i, line in enumerate(all_lines[:20], start=1):
        log.info("  [%02d] %r", i, line)

    # Format: AMC,Code,Scheme Name,Scheme Type,Scheme Category,Scheme NAV Name,...
    log.info("First 10 parseable lines (≥6 fields via csv.reader, integer field[1]):")
    shown = 0
    reader = csv.reader(io.StringIO(text))
    next(reader, None)  # skip header
    for row in reader:
        if shown >= 10:
            break
        if len(row) < 6:
            continue
        try:
            int(row[1].strip())
        except ValueError:
            continue
        log.info("  RAW       : %r", ",".join(row))
        log.info("  [0] amc=%r", row[0].strip())
        log.info("  [1] code=%r  [2] scheme_name=%r", row[1].strip(), row[2].strip())
        log.info("  [3] type=%r  [4] category=%r", row[3].strip(), row[4].strip())
        log.info("  [5] nav_name=%r  (→ used as display name)", row[5].strip())
        shown += 1

    log.info("────────────────────────────────────────────────────────")


def fetch_scheme_master() -> str:
    """Fetch raw CSV text from AMFI. Retries on network errors."""
    log.info("Fetching scheme master from AMFI…")
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            resp = requests.get(AMFI_SCHEME_MASTER_URL, timeout=REQUEST_TIMEOUT)
            resp.raise_for_status()
            log.info("Fetched %d bytes from AMFI.", len(resp.content))
            _debug_response(resp.text)
            return resp.text
        except (requests.ConnectionError, requests.Timeout, requests.HTTPError) as exc:
            wait = RETRY_BACKOFF_BASE * (2 ** (attempt - 1))
            if attempt == MAX_RETRIES:
                log.error("AMFI fetch failed after %d attempts: %s", MAX_RETRIES, exc)
                sys.exit(1)
            log.warning("AMFI error (attempt %d/%d): %s — retry in %ds", attempt, MAX_RETRIES, exc, wait)
            time.sleep(wait)
    return ""  # unreachable

# ---------------------------------------------------------------------------
# Parsing
# ---------------------------------------------------------------------------

def parse_schemes(text: str, amc_map: dict[str, str]) -> list[dict]:
    """
    Parse AMFI scheme master CSV using csv.reader (handles quoted commas).

    Column layout:
        0  AMC             ← looked up in amc_map → amc_id (UUID)
        1  Code            ← amfi_code (integer)
        2  Scheme Name
        3  Scheme Type
        4  Scheme Category
        5  Scheme NAV Name ← used as display name
        6  Scheme Minimum Amount
        7  Launch Date
        8  Closure Date
        9  ISIN …
    """
    schemes: list[dict] = []
    skipped = 0                          # rows with no valid code or empty name
    unmatched_amc: dict[str, int] = {}   # amc_name → scheme count (amc_id will be NULL)
    now_iso = datetime.now(timezone.utc).isoformat()

    reader = csv.reader(io.StringIO(text))
    next(reader, None)  # skip header row

    for row_num, row in enumerate(reader, start=2):
        if len(row) < 6:
            continue

        # Field 1 must be an integer scheme code
        try:
            amfi_code = int(row[1].strip())
        except ValueError:
            continue

        nav_name = row[5].strip()
        if not nav_name:
            log.debug("Row %d: empty Scheme NAV Name — skipping (code=%s)", row_num, row[1].strip())
            skipped += 1
            continue

        amc_name = row[0].strip()
        amc_id   = resolve_amc_id(amc_name, amc_map)
        if amc_id is None:
            unmatched_amc[amc_name] = unmatched_amc.get(amc_name, 0) + 1

        plan = "Direct" if "direct" in nav_name.lower() else "Regular"

        schemes.append({
            "amfi_code":  amfi_code,
            "name":       nav_name,
            "plan":       plan,
            "amc_id":     amc_id,   # None → NULL in Supabase; fixed later via SQL UPDATE
            "is_active":  True,
            "updated_at": now_iso,
        })

    matched   = len(schemes) - sum(unmatched_amc.values())
    unmatched = sum(unmatched_amc.values())

    log.info(
        "Parsed %d schemes: %d with AMC match, %d without  (%d rows skipped).",
        len(schemes), matched, unmatched, skipped,
    )
    if unmatched_amc:
        log.warning(
            "⚠  %d schemes will have amc_id=NULL (%d distinct unmatched AMC names).",
            unmatched, len(unmatched_amc),
        )
        log.warning("Missing AMC names:")
        for name, count in sorted(unmatched_amc.items(), key=lambda x: -x[1]):
            log.warning("  %5d schemes — %r", count, name)

    return schemes

# ---------------------------------------------------------------------------
# Supabase
# ---------------------------------------------------------------------------

def get_supabase_client() -> Client:
    url = os.environ.get("SUPABASE_URL", "").strip()
    key = os.environ.get("SUPABASE_KEY", "").strip()
    if not url or not key:
        log.error("SUPABASE_URL and SUPABASE_KEY must be set as environment variables.")
        sys.exit(1)
    return create_client(url, key)


def load_amc_map(client: Client) -> dict[str, str]:
    """
    Return a combined {name: uuid} map covering both canonical AMC names and
    all alternate/legal-entity names from ALTERNATE_NAMES.

    Example: both "Invesco Mutual Fund" and "Invesco Asset Management (India)
    Private Limited" resolve to the same UUID.
    """
    log.info("Loading AMC map from Supabase…")
    result = (
        client.table("amcs")
        .select("id, name")
        .eq("sebi_registered", True)
        .execute()
    )
    if result.data is None:
        log.error("Failed to load amcs table.")
        sys.exit(1)

    canonical_map: dict[str, str] = {row["name"]: row["id"] for row in result.data}

    alternate_map: dict[str, str] = {}
    for canonical_name, uuid in canonical_map.items():
        for alt in ALTERNATE_NAMES.get(canonical_name, []):
            if alt:
                alternate_map[alt] = uuid

    combined = {**canonical_map, **alternate_map}
    log.info(
        "Loaded %d AMCs — %d canonical + %d alternate name variants.",
        len(canonical_map), len(canonical_map), len(alternate_map),
    )
    return combined


def resolve_amc_id(amc_name: str, amc_map: dict[str, str]) -> str | None:
    """Return UUID for an AMC name (canonical or alternate), or None if unknown."""
    return amc_map.get(amc_name)


def upsert_schemes(client: Client, schemes: list[dict]) -> int:
    """
    Upsert schemes in batches of BATCH_SIZE.
    ON CONFLICT (amfi_code) DO UPDATE — overwrites all columns including amc_id,
    so a second run with an expanded AMC map fills in previously-NULL amc_ids.
    returning="minimal" skips fetching updated rows (faster, avoids large payloads).
    Returns the number of rows submitted (all rows are upserted; count is exact).
    """
    total   = len(schemes)
    batches = (total + BATCH_SIZE - 1) // BATCH_SIZE

    for i in range(batches):
        batch = schemes[i * BATCH_SIZE : (i + 1) * BATCH_SIZE]
        log.info("Inserting batch %d/%d  (%d rows)…", i + 1, batches, len(batch))
        client.table("schemes").upsert(
            batch,
            on_conflict="amfi_code",
            returning="minimal",
        ).execute()

    return total

# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Populate Supabase schemes table from AMFI scheme master.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Fetch and parse AMFI data but do NOT write to Supabase.",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Enable DEBUG logging.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    client   = get_supabase_client()
    amc_map  = load_amc_map(client)

    raw_text = fetch_scheme_master()
    schemes  = parse_schemes(raw_text, amc_map)

    if not schemes:
        log.error("No schemes parsed — aborting.")
        sys.exit(1)

    if args.dry_run:
        log.info("DRY RUN — no data written to Supabase.")
        log.info("Sample rows:")
        for row in schemes[:5]:
            log.info("  %s", row)
        return

    upserted        = upsert_schemes(client, schemes)
    matched_count   = sum(1 for s in schemes if s["amc_id"] is not None)
    unmatched_count = sum(1 for s in schemes if s["amc_id"] is None)

    log.info("✅ Inserted %d schemes (%d with AMC match, %d without)", upserted, matched_count, unmatched_count)
    if unmatched_count:
        log.warning("⚠  %d schemes have amc_id=NULL — add missing names to sync_amc_master.py and re-run", unmatched_count)


if __name__ == "__main__":
    main()
