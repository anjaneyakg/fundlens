"""
sync_amc_master.py  —  v1.3.0

Populates the Supabase `amcs` table with AMC master data and alternate name
variations to handle AMFI scheme master name mismatches.

Usage:
    python sync_amc_master.py
    python sync_amc_master.py --dry-run

Requires env vars: SUPABASE_URL, SUPABASE_KEY
"""

import argparse
import os
import sys
import logging
from datetime import datetime, timezone

from supabase import create_client, Client

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger("sync_amc_master")

# ---------------------------------------------------------------------------
# AMC directory (embedded from data/masters/amc_directory.json)
# amc_id  → short_name column
# amc_name → name column
# ---------------------------------------------------------------------------

AMC_DIRECTORY = [
    {"amc_id": "360one",       "amc_name": "360 ONE Mutual Fund"},
    {"amc_id": "abakkus",      "amc_name": "Abakkus Mutual Fund"},
    {"amc_id": "adityabirla",  "amc_name": "Aditya Birla Sun Life Mutual Fund"},
    {"amc_id": "angelone",     "amc_name": "Angel One Mutual Fund"},
    {"amc_id": "axis",         "amc_name": "Axis Mutual Fund"},
    {"amc_id": "bajaj",        "amc_name": "Bajaj Finserv Mutual Fund"},
    {"amc_id": "bandhan",      "amc_name": "Bandhan Mutual Fund"},
    {"amc_id": "bankofindia",  "amc_name": "Bank of India Mutual Fund"},
    {"amc_id": "barodabnp",    "amc_name": "Baroda BNP Paribas Mutual Fund"},
    {"amc_id": "canararobeco", "amc_name": "Canara Robeco Mutual Fund"},
    {"amc_id": "capitalmind",  "amc_name": "Capitalmind Mutual Fund"},
    {"amc_id": "choice",       "amc_name": "Choice Mutual Fund"},
    {"amc_id": "dsp",          "amc_name": "DSP Mutual Fund"},
    {"amc_id": "edelweiss",    "amc_name": "Edelweiss Mutual Fund"},
    {"amc_id": "franklin",     "amc_name": "Franklin Templeton Mutual Fund"},
    {"amc_id": "groww",        "amc_name": "Groww Mutual Fund"},
    {"amc_id": "hdfc",         "amc_name": "HDFC Mutual Fund"},
    {"amc_id": "helios",       "amc_name": "Helios Mutual Fund"},
    {"amc_id": "hsbc",         "amc_name": "HSBC Mutual Fund"},
    {"amc_id": "icici",        "amc_name": "ICICI Prudential Mutual Fund"},
    {"amc_id": "invesco",      "amc_name": "Invesco Mutual Fund"},
    {"amc_id": "iti",          "amc_name": "ITI Mutual Fund"},
    {"amc_id": "jioblackrock", "amc_name": "Jio BlackRock Mutual Fund"},
    {"amc_id": "jm",           "amc_name": "JM Financial Mutual Fund"},
    {"amc_id": "kotak",        "amc_name": "Kotak Mahindra Mutual Fund"},
    {"amc_id": "lic",          "amc_name": "LIC Mutual Fund"},
    {"amc_id": "mahindra",     "amc_name": "Mahindra Manulife Mutual Fund"},
    {"amc_id": "mirae",        "amc_name": "Mirae Asset Mutual Fund"},
    {"amc_id": "motilal",      "amc_name": "Motilal Oswal Mutual Fund"},
    {"amc_id": "navi",         "amc_name": "Navi Mutual Fund"},
    {"amc_id": "nippon",       "amc_name": "Nippon India Mutual Fund"},
    {"amc_id": "nj",           "amc_name": "NJ Mutual Fund"},
    {"amc_id": "oldbridge",    "amc_name": "Old Bridge Mutual Fund"},
    {"amc_id": "pgim",         "amc_name": "PGIM India Mutual Fund"},
    {"amc_id": "ppfas",        "amc_name": "PPFAS Mutual Fund"},
    {"amc_id": "quant",        "amc_name": "quant Mutual Fund"},
    {"amc_id": "quantum",      "amc_name": "Quantum Mutual Fund"},
    {"amc_id": "samco",        "amc_name": "Samco Mutual Fund"},
    {"amc_id": "sbi",          "amc_name": "SBI Mutual Fund"},
    {"amc_id": "shriram",      "amc_name": "Shriram Mutual Fund"},
    {"amc_id": "sundaram",     "amc_name": "Sundaram Mutual Fund"},
    {"amc_id": "tata",         "amc_name": "Tata Mutual Fund"},
    {"amc_id": "taurus",       "amc_name": "Taurus Mutual Fund"},
    {"amc_id": "trust",        "amc_name": "Trust Mutual Fund"},
    {"amc_id": "unifi",        "amc_name": "Unifi Mutual Fund"},
    {"amc_id": "union",        "amc_name": "Union Mutual Fund"},
    {"amc_id": "uti",          "amc_name": "UTI Mutual Fund"},
    {"amc_id": "wealthcompany","amc_name": "The Wealth Company Mutual Fund"},
    {"amc_id": "whiteoak",     "amc_name": "WhiteOak Capital Mutual Fund"},
]

# AMCs not in amc_directory.json — added manually
# Includes closed/wound-up funds still present in AMFI historical data.
AMC_MANUAL = [
    {"amc_id": "zerodha", "amc_name": "Zerodha Mutual Fund"},
    {"amc_id": "sahara",  "amc_name": "Sahara Mutual Fund"},
    {"amc_id": "ilfs",    "amc_name": "IL&FS Mutual Fund"},
    {"amc_id": "iifcl",   "amc_name": "IIFCL Mutual Fund"},
]

# Known AMFI scheme master name variations.
# Key = canonical name (must match amc_name in AMC_DIRECTORY/AMC_MANUAL above).
# Values = legal entity names and alternate spellings used in AMFI scheme master field[0].
# Covers: current legal names, abbreviation variants (Ltd./Pvt.), historical renames.
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
# Build insert rows
# ---------------------------------------------------------------------------

def build_rows() -> list[dict]:
    now_iso = datetime.now(timezone.utc).isoformat()
    rows: list[dict] = []
    for amc in AMC_DIRECTORY + AMC_MANUAL:
        rows.append({
            "name":            amc["amc_name"],
            "short_name":      amc["amc_id"],
            "amfi_amc_code":   None,
            "rta_name":        None,
            "sebi_registered": True,
            "updated_at":      now_iso,
        })
    return rows

# ---------------------------------------------------------------------------
# Name → UUID lookup (canonical + alternates)
# ---------------------------------------------------------------------------

def build_name_lookup(amcs_rows: list[dict]) -> tuple[dict[str, str], dict[str, str]]:
    """
    Build two dicts from rows returned by Supabase after upsert:
        canonical_map  — {name: uuid}
        alternate_map  — {alternate_name: uuid}

    Together they let populate_schemes_table.py resolve any AMFI AMC name
    (canonical or variant) to the correct UUID.
    """
    canonical_map: dict[str, str] = {}
    alternate_map: dict[str, str] = {}

    for row in amcs_rows:
        uid  = row["id"]
        name = row["name"]
        canonical_map[name] = uid
        for alt in ALTERNATE_NAMES.get(name, []):
            if alt:
                alternate_map[alt] = uid

    return canonical_map, alternate_map

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


def upsert_amcs(client: Client, rows: list[dict]) -> None:
    """Upsert rows. ON CONFLICT (name) DO UPDATE short_name, sebi_registered, updated_at."""
    result = (
        client.table("amcs")
        .upsert(rows, on_conflict="name")
        .execute()
    )
    if result.data is None:
        log.error("Supabase upsert returned no data.")
        sys.exit(1)
    log.info("Upserted %d rows into amcs.", len(result.data))


def fetch_amcs(client: Client) -> list[dict]:
    """Fetch id, name, short_name for all sebi_registered AMCs."""
    result = (
        client.table("amcs")
        .select("id, name, short_name")
        .eq("sebi_registered", True)
        .execute()
    )
    if result.data is None:
        log.error("Failed to fetch amcs after upsert.")
        sys.exit(1)
    return result.data

# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Sync AMC master data into Supabase amcs table.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Build rows but do NOT write to Supabase.",
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

    rows            = build_rows()
    directory_count = len(AMC_DIRECTORY)
    manual_count    = len(AMC_MANUAL)

    log.info(
        "Built %d AMC rows (%d from directory + %d manual).",
        len(rows), directory_count, manual_count,
    )

    if args.dry_run:
        log.info("DRY RUN — nothing written to Supabase.")
        log.info("Sample rows:")
        for row in rows[:5]:
            log.info("  short_name=%-15s  name=%s", row["short_name"], row["name"])
        canonical_map, alternate_map = build_name_lookup(
            [{**r, "id": "<dry-run-uuid>"} for r in rows]
        )
        log.info(
            "Lookup would cover %d canonical + %d alternate names (%d total).",
            len(canonical_map), len(alternate_map), len(canonical_map) + len(alternate_map),
        )
        return

    client = get_supabase_client()
    upsert_amcs(client, rows)

    amcs_rows                    = fetch_amcs(client)
    canonical_map, alternate_map = build_name_lookup(amcs_rows)
    total_variants               = len(canonical_map) + len(alternate_map)

    log.info(
        "✅ Synced %d AMCs (%d from directory + %d manual)",
        len(amcs_rows), directory_count, manual_count,
    )
    log.info(
        "✅ Created name→UUID lookup with %d total name variations "
        "(%d canonical + %d alternates)",
        total_variants, len(canonical_map), len(alternate_map),
    )

    log.info("Sample canonical entries:")
    for name, uid in list(canonical_map.items())[:4]:
        log.info("  %-48s → %s", name, uid)

    if alternate_map:
        log.info("Sample alternate entries:")
        for name, uid in list(alternate_map.items())[:4]:
            log.info("  %-48s → %s  (alternate)", name, uid)


if __name__ == "__main__":
    main()
