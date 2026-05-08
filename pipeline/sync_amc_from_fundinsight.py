"""
sync_amc_from_fundinsight.py  —  v1.0.0

Syncs AMC master data from FundInsight's amc_directory.json into the
FundLens Supabase `amc` table.

Sources:
  - AMC list : https://raw.githubusercontent.com/anjaneyakg/FundInsight/main/data/masters/amc_directory.json
  - Config keys: https://raw.githubusercontent.com/anjaneyakg/FundInsight/main/pipeline/rebuild_amc_map.py

Usage:
    python sync_amc_from_fundinsight.py
    python sync_amc_from_fundinsight.py --dry-run

Requires env vars: SUPABASE_URL, SUPABASE_KEY
"""

import argparse
import ast
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

DIRECTORY_URL    = "https://raw.githubusercontent.com/anjaneyakg/FundInsight/main/data/masters/amc_directory.json"
REBUILD_MAP_URL  = "https://raw.githubusercontent.com/anjaneyakg/FundInsight/main/pipeline/rebuild_amc_map.py"
REQUEST_TIMEOUT  = 30
MAX_RETRIES      = 3
RETRY_BACKOFF    = 5   # seconds; doubles each retry

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger("sync_amc")

# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------

def fetch_url(url: str, label: str) -> str:
    """GET a URL with retry on network/5xx errors. Exits on permanent failure."""
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            resp = requests.get(url, timeout=REQUEST_TIMEOUT)
            resp.raise_for_status()
            log.info("Fetched %s (%d bytes).", label, len(resp.content))
            return resp.text
        except (requests.ConnectionError, requests.Timeout, requests.HTTPError) as exc:
            wait = RETRY_BACKOFF * (2 ** (attempt - 1))
            if attempt == MAX_RETRIES:
                log.error("Failed to fetch %s after %d attempts: %s", label, MAX_RETRIES, exc)
                sys.exit(1)
            log.warning("Fetch error (attempt %d/%d): %s — retry in %ds", attempt, MAX_RETRIES, exc, wait)
            time.sleep(wait)
    return ""  # unreachable

# ---------------------------------------------------------------------------
# Parsers
# ---------------------------------------------------------------------------

def parse_amc_directory(json_text: str) -> list[dict]:
    """
    Parse amc_directory.json and return list of raw AMC dicts.
    Each entry has at minimum: amc_id (slug) and amc_name (formal name).
    """
    import json
    data = json.loads(json_text)
    amcs = data.get("amcs", [])
    if not amcs:
        log.error("No 'amcs' array found in amc_directory.json.")
        sys.exit(1)
    log.info("Found %d AMCs in directory.", len(amcs))
    return amcs


def extract_config_key_map(py_source: str) -> dict[str, str]:
    """
    Parse rebuild_amc_map.py with ast.parse and extract the
    AMC_CONFIG_KEY_MAP dict literal without executing the file.

    Returns {formal_name: config_key}, e.g.:
        {"360 ONE Mutual Fund": "360 One", "Abakkus Mutual Fund": "Abakkus", ...}
    """
    try:
        tree = ast.parse(py_source)
    except SyntaxError as exc:
        log.warning("Could not parse rebuild_amc_map.py: %s — config_key will be null for all.", exc)
        return {}

    for node in ast.walk(tree):
        if not isinstance(node, ast.Assign):
            continue
        for target in node.targets:
            if isinstance(target, ast.Name) and target.id == "AMC_CONFIG_KEY_MAP":
                try:
                    mapping = ast.literal_eval(node.value)
                    if isinstance(mapping, dict):
                        log.info("Extracted AMC_CONFIG_KEY_MAP with %d entries.", len(mapping))
                        return mapping
                except (ValueError, TypeError) as exc:
                    log.warning("Could not evaluate AMC_CONFIG_KEY_MAP: %s", exc)
                    return {}

    log.warning("AMC_CONFIG_KEY_MAP not found in rebuild_amc_map.py — config_key will be null for all.")
    return {}

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


def upsert_amcs(client: Client, rows: list[dict]) -> list[dict]:
    """
    Upsert AMC rows with ON CONFLICT (name) DO UPDATE.
    Returns the list of upserted rows (includes auto-generated UUIDs).
    """
    result = (
        client.table("amc")
        .upsert(rows, on_conflict="name")
        .execute()
    )
    if result.data is None:
        log.error("Supabase upsert returned no data.")
        sys.exit(1)
    return result.data

# ---------------------------------------------------------------------------
# Build rows
# ---------------------------------------------------------------------------

def build_rows(amcs: list[dict], config_key_map: dict[str, str]) -> list[dict]:
    """Merge directory entries with config keys into Supabase row dicts."""
    now_iso = datetime.now(timezone.utc).isoformat()
    rows: list[dict] = []
    missing_keys: list[str] = []

    for amc in amcs:
        name = amc.get("amc_name", "").strip()
        slug = amc.get("amc_id", "").strip()

        if not name or not slug:
            log.warning("Skipping AMC with missing name or slug: %s", amc)
            continue

        config_key = config_key_map.get(name)
        if config_key is None:
            missing_keys.append(name)

        rows.append({
            "name":       name,
            "slug":       slug,
            "config_key": config_key,
            "is_active":  True,
            "updated_at": now_iso,
        })

    if missing_keys:
        log.info(
            "%d AMCs have no config_key in AMC_CONFIG_KEY_MAP: %s",
            len(missing_keys),
            missing_keys[:5],
        )

    return rows

# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Sync AMC master data from FundInsight into Supabase.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Fetch and build rows but do NOT write to Supabase.",
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

    # 1. Fetch sources
    directory_text  = fetch_url(DIRECTORY_URL,   "amc_directory.json")
    rebuild_py_text = fetch_url(REBUILD_MAP_URL, "rebuild_amc_map.py")

    # 2. Parse
    amcs           = parse_amc_directory(directory_text)
    config_key_map = extract_config_key_map(rebuild_py_text)

    # 3. Build rows
    rows = build_rows(amcs, config_key_map)
    if not rows:
        log.error("No rows to upsert — aborting.")
        sys.exit(1)

    if args.dry_run:
        log.info("DRY RUN — %d rows built, nothing written to Supabase.", len(rows))
        log.info("Sample rows:")
        for row in rows[:5]:
            log.info("  %s", row)
        return

    # 4. Upsert
    client        = get_supabase_client()
    upserted_rows = upsert_amcs(client, rows)

    log.info("✅ Synced %d AMCs from FundInsight", len(upserted_rows))

    log.info("Sample:")
    for row in upserted_rows[:3]:
        log.info(
            "  %s → %s  (UUID: %s)",
            row.get("slug", "?"),
            row.get("name", "?"),
            row.get("id", "?"),
        )


if __name__ == "__main__":
    main()
