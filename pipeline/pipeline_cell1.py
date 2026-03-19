# pipeline_cell1.py
# FundLens Data Pipeline — Cell 1 — v4.0
# Source: AMFI Direct (amfiindia.com + portal.amfiindia.com)
#
# What this does:
#   Step 1 — Fetch scheme master (all schemes)
#   Step 2 — Fetch today's NAVs (NAVAll.txt)
#   Step 3 — Fetch 24-month NAV history (daily, no month-end collapse)
#   Step 4 — Compute returns anchored to navDate (not date.today())
#   Step 5 — Compute risk ratios (Std Dev, Sharpe, Sortino, MaxDrawdown)
#   Step 6 — Build category index (top 10 per category x plan)
#   Step 7 — Split NAV history into files (category x plan)
#   Step 8 — Validate and save all output files locally
#
# Output files (picked up by Cell 2 for Gist upload):
#   fundlens_schemes.json        — slim scheme list (id, name, nav, meta)
#   fundlens_returns.json        — all returns keyed by schemeId
#   fundlens_ratios.json         — all risk ratios keyed by schemeId
#   fundlens_category_index.json — top 10 per category x plan
#   nav_history/                 — ~74 files: nav_{category_slug}_{plan}.json

import bisect
import json
import math
import os
import re
import time
import requests
from datetime import date, datetime, timedelta
from dateutil.relativedelta import relativedelta
from collections import defaultdict

from amfi_normalise import normalise_amc, parse_scheme_type_category, is_direct_plan
from validate import validate_main_gist, print_validation_summary, ValidationError

# ─── Config ──────────────────────────────────────────────────────────────────

AMFI_SCHEME_MASTER_URL = "https://portal.amfiindia.com/DownloadSchemeData_Po.aspx?mf=0"
AMFI_NAV_ALL_URL       = "https://www.amfiindia.com/spages/NAVAll.txt"
AMFI_NAV_HISTORY_URL   = "https://portal.amfiindia.com/DownloadNAVHistoryReport_Po.aspx"

HISTORY_MONTHS         = 60   # 5 years — needed for 3Y/5Y return computation
RISK_FREE_RATE_ANNUAL  = 0.065
REQUEST_DELAY_SEC      = 1.5
MAX_RETRIES            = 3
NAV_HISTORY_DIR        = "nav_history"

TODAY     = date.today()
TODAY_STR = TODAY.strftime("%Y-%m-%d")

# ─── Utility ─────────────────────────────────────────────────────────────────

def safe_get(url, params=None, label=""):
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            resp = requests.get(url, params=params, timeout=30)
            resp.raise_for_status()
            time.sleep(REQUEST_DELAY_SEC)
            return resp.text
        except Exception as e:
            print(f"  [fetch] {label} attempt {attempt}/{MAX_RETRIES} failed: {e}")
            if attempt < MAX_RETRIES:
                time.sleep(REQUEST_DELAY_SEC * attempt)
    raise RuntimeError(f"Failed to fetch {label} after {MAX_RETRIES} attempts.")


def parse_date(date_str):
    """
    Parse AMFI date strings correctly.
    AMFI returns DD-Mon-YYYY (e.g. 13-Mar-2026), not YYYY-MM-DD.
    Previous pipeline used d_str[:7] for month key — gave garbage like
    '13-Mar-' instead of '2026-03'. Always parse fully before formatting.
    """
    for fmt in ("%d-%b-%Y", "%Y-%m-%d", "%d/%m/%Y"):
        try:
            return datetime.strptime(date_str.strip(), fmt).date()
        except ValueError:
            continue
    return None


def to_iso(d):
    return d.strftime("%Y-%m-%d")


def category_slug(category, plan):
    """
    Generate stable filename slug: category + plan.
    e.g. "Large Cap" + "Direct" -> "largecap_direct"
    File: nav_largecap_direct.json
    """
    slug = re.sub(r'[^a-z0-9]+', '_', category.lower()).strip('_')
    return f"{slug}_{plan.lower()}"


def date_windows(months_back):
    end = TODAY
    start = (TODAY - relativedelta(months=months_back)).replace(day=1)
    windows = []
    cursor = start
    while cursor < end:
        window_end = min(cursor + timedelta(days=89), end)
        windows.append((cursor, window_end))
        cursor = window_end + timedelta(days=1)
    return windows


def cagr(nav_then, nav_now, years):
    if not nav_then or not nav_now or years <= 0 or nav_then == 0:
        return None
    try:
        return round(((nav_now / nav_then) ** (1 / years) - 1) * 100, 2)
    except Exception:
        return None


def absolute_return(nav_then, nav_now):
    if not nav_then or not nav_now or nav_then == 0:
        return None
    return round((nav_now / nav_then - 1) * 100, 2)


# ─── Step 1: Fetch Scheme Master ─────────────────────────────────────────────

def fetch_scheme_master():
    print("\n[Step 1] Fetching scheme master...")
    raw = safe_get(AMFI_SCHEME_MASTER_URL, label="scheme master")
    schemes = {}
    current_amc_full = ""

    for line in raw.splitlines():
        line = line.strip()
        if not line:
            continue
        parts = [p.strip() for p in line.split(",")]
        if len(parts) >= 2 and not parts[1].isdigit():
            current_amc_full = parts[0]
            continue
        if len(parts) < 9:
            continue
        try:
            amc_raw         = parts[0]
            code            = parts[1].strip()
            scheme_name     = parts[2].strip()
            scheme_type_raw = parts[3].strip()
            scheme_cat_raw  = parts[4].strip()
            nav_name        = parts[5].strip()
            launch_raw      = parts[7].strip() if len(parts) > 7 else ""
            isin            = parts[9].strip() if len(parts) > 9 else ""

            if not code or not code.isdigit():
                continue

            amc_full  = (amc_raw or current_amc_full).strip()
            amc_short = normalise_amc(amc_full)

            scheme_type, category = parse_scheme_type_category(
                f"{scheme_type_raw} {scheme_cat_raw}"
            )
            plan = "Direct" if is_direct_plan(nav_name or scheme_name) else "Regular"

            inception_date = ""
            if launch_raw:
                d = parse_date(launch_raw)
                inception_date = to_iso(d) if d else ""

            structure = "Open Ended"
            if "close" in scheme_type_raw.lower():
                structure = "Close Ended"
            elif "interval" in scheme_type_raw.lower():
                structure = "Interval"

            # Sub-classify Index into ETF vs Index Fund
            display_category = category
            if category == "Index":
                name_lower = (nav_name or scheme_name).lower()
                if "etf" in name_lower or "exchange traded" in name_lower:
                    display_category = "Index - ETF"
                else:
                    display_category = "Index - Index Fund"

            # Close Ended and Interval get explicit labels
            if structure == "Close Ended":
                display_category = "Close Ended"
            elif structure == "Interval":
                display_category = "Interval"

            schemes[code] = {
                "id":            code,
                "name":          scheme_name,
                "navName":       nav_name,
                "amcFull":       amc_full,
                "amc":           amc_short,
                "type":          scheme_type,
                "category":      display_category,
                "plan":          plan,
                "structure":     structure,
                "isin":          isin,
                "inceptionDate": inception_date,
            }
        except Exception:
            continue

    print(f"  [Step 1] ✅ {len(schemes)} schemes loaded.")
    return schemes


# ─── Step 2: Fetch Current NAVs ──────────────────────────────────────────────

def fetch_current_navs():
    print("\n[Step 2] Fetching current NAVs...")
    raw = safe_get(AMFI_NAV_ALL_URL, label="NAVAll.txt")
    navs = {}
    skipped = 0
    for line in raw.splitlines():
        line = line.strip()
        if not line or line.startswith(";"):
            continue
        parts = line.split(";")
        if len(parts) < 6:
            continue
        try:
            code     = parts[0].strip()
            nav_str  = parts[4].strip()
            date_str = parts[5].strip()
            if not code.isdigit():
                continue
            nav_date = parse_date(date_str)
            navs[code] = {
                "nav":     round(float(nav_str), 4),
                "navDate": to_iso(nav_date) if nav_date else TODAY_STR,
            }
        except Exception:
            skipped += 1
    print(f"  [Step 2] ✅ {len(navs)} NAVs loaded. ({skipped} skipped)")
    return navs


# ─── Step 3: Fetch NAV History (daily) ───────────────────────────────────────

def fetch_nav_history(months_back=HISTORY_MONTHS):
    """
    Fetch daily NAV history — ALL daily entries, no month-end collapse.
    Key fix v4: parse_date() now handles DD-Mon-YYYY correctly.
    Previous collapse code used d_str[:7] which was broken for AMFI format.
    """
    print(f"\n[Step 3] Fetching {months_back}M daily NAV history...")
    windows = date_windows(months_back)
    print(f"  {len(windows)} windows...")

    raw_history = defaultdict(dict)

    for i, (from_dt, to_dt) in enumerate(windows, 1):
        from_str = from_dt.strftime("%d-%b-%Y")
        to_str   = to_dt.strftime("%d-%b-%Y")
        print(f"  Window {i}/{len(windows)}: {from_str} -> {to_str}", end=" ")
        try:
            text = safe_get(AMFI_NAV_HISTORY_URL,
                            params={"frmdt": from_str, "todt": to_str},
                            label=f"history {i}")
            count = 0
            for line in text.splitlines():
                parts = line.strip().split(";")
                if len(parts) < 8:
                    continue
                try:
                    code    = parts[0].strip()
                    nav_str = parts[4].strip()
                    d_str   = parts[7].strip()
                    if not code.isdigit() or not nav_str:
                        continue
                    nav_val  = float(nav_str)
                    nav_date = parse_date(d_str)
                    if nav_date and nav_val > 0:
                        raw_history[code][to_iso(nav_date)] = nav_val
                        count += 1
                except Exception:
                    continue
            print(f"-> {count:,} entries")
        except Exception as e:
            print(f"-> FAILED: {e}")
            continue

    history = {}
    for code, date_nav_map in raw_history.items():
        if date_nav_map:
            history[code] = [
                {"date": d, "nav": v}
                for d, v in sorted(date_nav_map.items())
            ]

    avg = sum(len(v) for v in history.values()) / max(len(history), 1)
    print(f"\n  [Step 3] ✅ {len(history)} schemes, avg {avg:.0f} daily entries.")
    return history


# ─── Step 4: Compute Returns ─────────────────────────────────────────────────

def compute_returns(nav_history, current_nav, nav_date):
    """
    Calendar-based return computation anchored to nav_date.

    nav_date is the actual NAV publication date (from NAVAll.txt).
    Using date.today() as anchor is wrong on weekends and holidays
    because no NAV is published — lookbacks shift by 1-2 days silently.

    Returns methodology matches SEBI / industry standard:
      < 1Y  ->  Absolute return %
      >= 1Y ->  CAGR (compound annualised)
    """
    if not nav_history or not current_nav:
        return {}

    anchor    = nav_date
    dates     = []
    navs_list = []
    for entry in nav_history:
        d = parse_date(entry["date"])
        if d:
            dates.append(d)
            navs_list.append(entry["nav"])

    if not dates:
        return {}

    def nav_on_or_before(target):
        idx = bisect.bisect_right(dates, target) - 1
        return navs_list[idx] if idx >= 0 else None

    r = {}

    for days, key in [(30, "1M"), (91, "3M"), (182, "6M")]:
        nav_then = nav_on_or_before(anchor - timedelta(days=days))
        if nav_then:
            r[key] = absolute_return(nav_then, current_nav)

    for days, years, key in [(365, 1.0, "1Y"), (1095, 3.0, "3Y"), (1825, 5.0, "5Y")]:
        nav_then = nav_on_or_before(anchor - timedelta(days=days))
        if nav_then:
            r[key] = cagr(nav_then, current_nav, years)

    nav_1w = nav_on_or_before(anchor - timedelta(days=7))
    if nav_1w and nav_1w != current_nav:
        r["1W"] = absolute_return(nav_1w, current_nav)

    return r


# ─── Step 5: Compute Risk Ratios ─────────────────────────────────────────────

def compute_risk_ratios(nav_history):
    """Annualised risk metrics from daily NAV series (252 trading days)."""
    if len(nav_history) < 60:
        return {}

    navs = [e["nav"] for e in nav_history]
    dr   = [(navs[i] - navs[i-1]) / navs[i-1] for i in range(1, len(navs))]
    if len(dr) < 30:
        return {}

    n      = len(dr)
    mean_r = sum(dr) / n
    var    = sum((r - mean_r) ** 2 for r in dr) / (n - 1)
    std_a  = math.sqrt(var) * math.sqrt(252)

    rf_d   = RISK_FREE_RATE_ANNUAL / 252
    sharpe = ((mean_r - rf_d) * 252) / std_a if std_a > 0 else None

    down   = [r for r in dr if r < rf_d]
    if down:
        dstd    = math.sqrt(sum((r - rf_d)**2 for r in down) / len(down)) * math.sqrt(252)
        sortino = ((mean_r - rf_d) * 252) / dstd if dstd > 0 else None
    else:
        sortino = None

    peak   = navs[0]
    max_dd = 0.0
    for nav in navs:
        if nav > peak:
            peak = nav
        dd = (peak - nav) / peak
        if dd > max_dd:
            max_dd = dd

    def r4(x):
        return round(x, 4) if x is not None else None

    return {
        "stdDev":      r4(std_a * 100),
        "sharpe":      r4(sharpe),
        "sortino":     r4(sortino),
        "maxDrawdown": r4(max_dd * 100),
    }


# ─── Step 6: Build Category Index ────────────────────────────────────────────

def build_category_index(schemes_out):
    """
    Top-10 leaderboard per category x plan combination.
    Key: "Large Cap|Direct"
    Only schemes with a 1Y return. Sorted by 1Y descending.
    Growth option only — IDCW, Dividend, Bonus variants excluded to
    prevent duplicate scheme names flooding the leaderboard.
    Frontend uses this for instant peer display without joining other files.
    """
    print("\n[Step 6] Building category index...")

    def is_growth(s):
        """
        Return True if scheme is Growth option (not IDCW/Dividend/Bonus).
        Uses navName for precision — option suffix appears at end of navName.
        Deliberately avoids bare 'dividend' match to preserve Dividend Yield
        category schemes (e.g. 'HDFC Dividend Yield Fund - Growth').
        """
        n = ((s.get("navName") or s.get("name")) or "").lower()
        return not any(kw in n for kw in (
            "idcw",
            "dividend payout",
            "dividend reinvestment",
            "payout",
            "reinvestment",
            "bonus",
        ))

    by_key = defaultdict(list)

    for s in schemes_out:
        r1y = s.get("returns", {}).get("1Y")
        if r1y is None:
            continue
        if not is_growth(s):
            continue
        key = f"{s['category']}|{s['plan']}"
        by_key[key].append({
            "id":       s["id"],
            "name":     s["name"],
            "amc":      s["amc"],
            "plan":     s["plan"],
            "return1Y": r1y,
            "returns":  s.get("returns", {}),
            "risk":     s.get("risk", {}),
        })

    index = {}
    for k, v in by_key.items():
        # Deduplicate by scheme name — same fund can have multiple AMFI codes.
        # Keep the entry with the best 1Y return per unique name.
        best_by_name = {}
        for entry in v:
            name = entry["name"].strip().lower()
            if name not in best_by_name or entry["return1Y"] > best_by_name[name]["return1Y"]:
                best_by_name[name] = entry
        deduped = sorted(best_by_name.values(), key=lambda x: x["return1Y"], reverse=True)
        index[k] = deduped[:10]

    print(f"  [Step 6] ✅ {len(index)} category x plan combinations.")
    return index


# ─── Step 7: Split NAV History ───────────────────────────────────────────────

def split_nav_history(schemes_out, nav_history):
    """
    Write one NAV history file per category x plan combination.
    Filename: nav_{category_slug}_{plan}.json
    e.g. nav_largecap_direct.json, nav_thematic_regular.json

    ~74 files total (35 categories x 2 plans, some categories
    have only one plan type so actual count may be slightly less).

    Frontend fetch logic:
      - User sets plan universe (Direct or Regular) at session start
      - On scheme detail click: fetch nav_{category}_{plan}.json
      - File is browser-cached — second click in same category is instant
    """
    print("\n[Step 7] Splitting NAV history...")
    os.makedirs(NAV_HISTORY_DIR, exist_ok=True)

    split = defaultdict(dict)
    for s in schemes_out:
        sid     = s["id"]
        history = nav_history.get(sid, [])
        if not history:
            continue
        filename = f"nav_{category_slug(s['category'], s['plan'])}.json"
        split[filename][sid] = history

    sizes = []
    for filename, content in sorted(split.items()):
        path = os.path.join(NAV_HISTORY_DIR, filename)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(content, f, separators=(",", ":"))
        mb = os.path.getsize(path) / (1024 * 1024)
        sizes.append(mb)
        flag = " WARNING" if mb > 15 else ""
        print(f"  {filename:<55} {len(content):>5} schemes  {mb:.2f}MB{flag}")

    print(f"\n  [Step 7] ✅ {len(split)} files | "
          f"largest {max(sizes):.1f}MB | total {sum(sizes):.1f}MB")
    return split


# ─── Step 8: Assemble & Save ─────────────────────────────────────────────────

def assemble_and_save(master, current_navs, nav_history):
    print("\n[Step 8] Assembling...")

    schemes_out = []
    returns_out = {}
    ratios_out  = {}
    amc_set     = {}
    cat_set     = set()

    for code, info in master.items():
        nav_data     = current_navs.get(code, {})
        history      = nav_history.get(code, [])
        current_nav  = nav_data.get("nav")
        nav_date_str = nav_data.get("navDate", "")
        nav_date_obj = parse_date(nav_date_str) if nav_date_str else TODAY

        returns = compute_returns(history, current_nav, nav_date_obj) \
                  if history and current_nav else {}
        risk    = compute_risk_ratios(history) if history else {}

        obj = {
            "id":            code,
            "name":          info["name"],
            "navName":       info.get("navName", ""),
            "amc":           info["amc"],
            "amcFull":       info["amcFull"],
            "category":      info["category"],
            "type":          info["type"],
            "plan":          info["plan"],
            "structure":     info["structure"],
            "isin":          info["isin"],
            "nav":           current_nav,
            "navDate":       nav_date_str,
            "inceptionDate": info["inceptionDate"],
            "returns":       returns,
            "risk":          risk,
        }
        schemes_out.append(obj)
        cat_set.add(info["category"])
        if info["amc"] not in amc_set:
            amc_set[info["amc"]] = info["amcFull"]

        if returns:
            returns_out[code] = {
                **returns,
                "amc":       info["amc"],
                "category":  info["category"],
                "type":      info["type"],
                "plan":      info["plan"],
                "structure": info["structure"],
            }
        if risk:
            ratios_out[code] = risk

    schemes_out.sort(key=lambda x: (x["amc"], x["name"]))
    amcs_list = sorted([{"name": k, "fullName": v} for k, v in amc_set.items()],
                       key=lambda x: x["name"])
    cats_list = sorted(cat_set)

    cat_index = build_category_index(schemes_out)
    split_nav_history(schemes_out, nav_history)

    # Slim schemes — strip heavy fields before saving
    KEEP = {"id", "name", "navName", "amc", "category", "type",
            "plan", "structure", "nav", "navDate", "inceptionDate", "returns"}
    for s in schemes_out:
        for k in list(s.keys()):
            if k not in KEEP:
                del s[k]

    meta = {
        "lastUpdated":     TODAY_STR,
        "schemeCount":     len(schemes_out),
        "historyMonths":   HISTORY_MONTHS,
        "source":          "AMFI Direct",
        "pipelineVersion": "4.1",
    }

    files = {
        "fundlens_schemes.json": {
            "meta": meta, "amcs": amcs_list,
            "categories": cats_list, "schemes": schemes_out,
        },
        "fundlens_returns.json": {
            "meta": meta, "returns": returns_out,
        },
        "fundlens_ratios.json": {
            "meta": meta, "ratios": ratios_out,
        },
        "fundlens_category_index.json": {
            "meta": meta, "index": cat_index,
        },
    }

    print("\n  Saving output files:")
    for fname, content in files.items():
        with open(fname, "w", encoding="utf-8") as f:
            json.dump(content, f, separators=(",", ":"), ensure_ascii=False)
        mb = os.path.getsize(fname) / (1024 * 1024)
        print(f"    {fname:<40} {mb:.2f}MB")

    with_returns = sum(1 for s in schemes_out if s.get("returns"))
    print(f"\n  [Step 8] ✅ {len(schemes_out)} schemes | "
          f"{len(amcs_list)} AMCs | {len(cats_list)} categories | "
          f"{with_returns} with returns | {len(ratios_out)} with ratios")

    return files["fundlens_schemes.json"]


# ─── Main ─────────────────────────────────────────────────────────────────────

def run_pipeline():
    print("=" * 60)
    print("FundLens Pipeline v4.1")
    print(f"Run date: {TODAY_STR}")
    print("=" * 60)

    master       = fetch_scheme_master()
    current_navs = fetch_current_navs()
    nav_history  = fetch_nav_history(months_back=HISTORY_MONTHS)
    output       = assemble_and_save(master, current_navs, nav_history)

    print(f"\n[Step 9] Validating...")
    try:
        warnings = validate_main_gist(output, TODAY_STR)
        print_validation_summary(warnings)
    except ValidationError as e:
        print(str(e))
        print("\nAborted. Existing Gists preserved.")
        return None

    print("\n✅ Pipeline complete. Run Cell 2 to upload all files.")
    return output


if __name__ == "__main__":
    run_pipeline()
