"""
identify_missing_schemes.py  —  v1.0

Identifies AMFI scheme codes present in today's NAVAll.txt but missing
from the Supabase schemes table.  Categorises each missing code as:

  - Non-investable pool  (Unclaimed / Segregated / Education Pool / etc.)
  - Genuine missing scheme  (candidate to add to the DB)

Output (written to data/nav_local/ relative to CWD):
  missing_schemes_non_investable.csv
  missing_schemes_to_add.csv

Usage:
    cd ~/Documents/FundInsight
    set -a && source .env && set +a
    source .venv/Scripts/activate
    python ../fundlens/pipeline/identify_missing_schemes.py
"""

import csv
import os
import sys
from datetime import date, timedelta

import requests
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

NAVALL_URL       = "https://www.amfiindia.com/spages/NAVAll.txt"
AMFI_HISTORY_URL = "https://portal.amfiindia.com/DownloadNAVHistoryReport_Po.aspx"

# Case-insensitive substrings that mark a scheme as non-investable
NON_INVESTABLE_KEYWORDS = [
    "unclaimed",
    "segregated",
    "education pool",
    "pledge",
    "escrow",
    "winding up",
    "wound up",
    "rolled over",
]

OUTPUT_DIR = os.path.join(os.getcwd(), "data", "nav_local")

FIELDNAMES = [
    "amfi_code",
    "scheme_name",
    "isin_div_payout",
    "isin_div_reinvest",
    "flagged_keyword",
]

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
        raise SystemExit("ERROR: SUPABASE_URL / SUPABASE_KEY not set in .env")
    client = create_client(url, key)
    client.postgrest.timeout = 120
    return client


def load_supabase_codes(client: Client) -> set[int]:
    """Load all non-null amfi_codes from the schemes table (all pages)."""
    print("Loading amfi_codes from Supabase schemes table ...")
    all_codes: set[int] = set()
    page, page_size = 0, 1000
    while True:
        result = (
            client.table("schemes")
            .select("amfi_code")
            .not_.is_("amfi_code", "null")
            .range(page * page_size, (page + 1) * page_size - 1)
            .execute()
        )
        if not result.data:
            break
        for row in result.data:
            if row.get("amfi_code") is not None:
                all_codes.add(int(row["amfi_code"]))
        if len(result.data) < page_size:
            break
        page += 1
    print(f"  Loaded {len(all_codes):,} codes from Supabase.")
    return all_codes

# ---------------------------------------------------------------------------
# AMFI fetchers
# ---------------------------------------------------------------------------

def fetch_navall() -> dict[int, dict]:
    """
    Fetch NAVAll.txt and return {amfi_code: {scheme_name, isin1, isin2}}.

    NAVAll.txt column layout (semicolon-delimited, 6 columns):
      0  Scheme Code
      1  ISIN Div Payout / ISIN Growth
      2  ISIN Div Reinvestment
      3  Scheme Name
      4  Net Asset Value
      5  Date
    NOTE: different from DownloadNAVHistoryReport (8 cols, name at col 1).
    AMC header lines and blank lines are skipped (col-0 not parseable as int).
    """
    print(f"Fetching NAVAll.txt ...")
    r = requests.get(NAVALL_URL, timeout=60)
    r.raise_for_status()
    lines = r.text.strip().split("\n")
    print(f"  {len(lines):,} lines received.")

    schemes: dict[int, dict] = {}
    for line in lines:
        line = line.strip()
        if not line:
            continue
        parts = line.split(";")
        if len(parts) < 5:
            continue
        try:
            code = int(parts[0].strip())
        except ValueError:
            continue  # header / AMC name line
        schemes[code] = {
            "amfi_code":   code,
            "scheme_name": parts[3].strip() if len(parts) > 3 else "",
            "isin1":       parts[1].strip() if len(parts) > 1 else "",
            "isin2":       parts[2].strip() if len(parts) > 2 else "",
        }
    print(f"  {len(schemes):,} scheme codes parsed from NAVAll.txt.")
    return schemes


def fetch_amfi_history_detail(codes: set[int]) -> dict[int, dict]:
    """
    Fetch a 2-day AMFI history window to get ISINs for codes that might
    not appear in today's NAVAll.txt (e.g. weekend / no-NAV day).

    Column layout (DownloadNAVHistoryReport_Po.aspx, confirmed from test):
      0  Scheme Code
      1  Scheme Name
      2  ISIN Div Payout / ISIN Growth
      3  ISIN Div Reinvestment
      4  Net Asset Value  ...
    """
    yesterday = date.today() - timedelta(days=1)
    two_ago   = date.today() - timedelta(days=3)
    frmdt = two_ago.strftime("%d-%b-%Y")
    todt  = yesterday.strftime("%d-%b-%Y")
    url = f"{AMFI_HISTORY_URL}?frmdt={frmdt}&todt={todt}"
    print(f"Fetching AMFI history detail: {url}")
    try:
        r = requests.get(url, timeout=90)
        r.raise_for_status()
    except Exception as exc:
        print(f"  WARNING: history fetch failed: {exc}")
        return {}

    result: dict[int, dict] = {}
    for line in r.text.strip().split("\n"):
        line = line.strip()
        if not line:
            continue
        parts = line.split(";")
        if len(parts) < 5:
            continue
        try:
            code = int(parts[0].strip())
        except ValueError:
            continue
        if code in codes and code not in result:
            result[code] = {
                "amfi_code":   code,
                "scheme_name": parts[1].strip() if len(parts) > 1 else "",
                "isin1":       parts[2].strip() if len(parts) > 2 else "",
                "isin2":       parts[3].strip() if len(parts) > 3 else "",
            }
    print(f"  Found {len(result):,} of {len(codes):,} missing codes in history report.")
    return result

# ---------------------------------------------------------------------------
# Categorisation
# ---------------------------------------------------------------------------

def _flag(name: str) -> str:
    """Return the first matching non-investable keyword, or empty string."""
    name_lower = name.lower()
    return next((kw for kw in NON_INVESTABLE_KEYWORDS if kw in name_lower), "")


def categorise(
    missing_codes: set[int],
    navall:        dict[int, dict],
    history:       dict[int, dict],
) -> tuple[list[dict], list[dict]]:
    non_investable: list[dict] = []
    to_add:         list[dict] = []

    for code in sorted(missing_codes):
        info = navall.get(code) or history.get(code) or {
            "amfi_code":   code,
            "scheme_name": "(not found in NAVAll or recent history)",
            "isin1": "",
            "isin2": "",
        }
        name    = info.get("scheme_name", "")
        keyword = _flag(name)
        row = {
            "amfi_code":        code,
            "scheme_name":      name,
            "isin_div_payout":  info.get("isin1", ""),
            "isin_div_reinvest": info.get("isin2", ""),
            "flagged_keyword":  keyword,
        }
        if keyword:
            non_investable.append(row)
        else:
            to_add.append(row)

    return non_investable, to_add

# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------

def write_csv(path: str, rows: list[dict]) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
        writer.writeheader()
        writer.writerows(rows)
    print(f"  Written : {path}  ({len(rows)} rows)")

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    # Steps 1+2: fetch NAVAll.txt
    navall_schemes = fetch_navall()
    amfi_codes     = set(navall_schemes.keys())

    # Step 3: load Supabase codes
    client         = get_supabase_client()
    supabase_codes = load_supabase_codes(client)

    # Step 4: diff
    missing = amfi_codes - supabase_codes
    print(f"\nRaw missing count: {len(missing):,}")

    # Step 6: enrich with history report ISINs
    history_detail = fetch_amfi_history_detail(missing)

    # Steps 5+7: categorise + write
    non_investable, to_add = categorise(missing, navall_schemes, history_detail)

    print()
    non_inv_path = os.path.join(OUTPUT_DIR, "missing_schemes_non_investable.csv")
    to_add_path  = os.path.join(OUTPUT_DIR, "missing_schemes_to_add.csv")
    write_csv(non_inv_path, non_investable)
    write_csv(to_add_path,  to_add)

    # Step 8: summary
    print()
    print("=" * 60)
    print(f"Total AMFI codes in NAVAll.txt : {len(amfi_codes):,}")
    print(f"Codes in schemes table          : {len(supabase_codes):,}")
    print(f"Missing total                   : {len(missing):,}")
    print(f"  Non-investable pools          : {len(non_investable):,}")
    print(f"  Genuine missing schemes       : {len(to_add):,}")
    print("=" * 60)

    if non_investable:
        print(f"\nNon-investable sample (first 15):")
        for row in non_investable[:15]:
            print(f"  {row['amfi_code']:>7}  [{row['flagged_keyword']:<15}]  {row['scheme_name']}")

    if to_add:
        print(f"\nGenuine missing sample (first 15):")
        for row in to_add[:15]:
            print(f"  {row['amfi_code']:>7}  {row['scheme_name']}")


if __name__ == "__main__":
    main()
