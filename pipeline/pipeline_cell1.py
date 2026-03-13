# pipeline_cell1.py
# FundLens Data Pipeline — Cell 1
# Source: AMFI Direct (amfiindia.com + portal.amfiindia.com)
# Replaces: MFAPI.in dependency entirely
#
# What this does:
#   Step 1 — Fetch scheme master (all schemes: open + close + interval ended)
#   Step 2 — Fetch today's NAVs
#   Step 3 — Fetch 36-month NAV history (12 × 90-day windows)
#   Step 4 — Compute returns (1W, 1M, 3M, 6M, 1Y, 3Y) from NAV history
#   Step 5 — Compute risk ratios (Std Dev, Sharpe, Sortino)
#   Step 6 — Build leaderboard, rolling returns, AMC list, categories
#   Step 7 — Validate (never push bad data)
#   Step 8 — Save locally for Cell 2 to upload

import json
import math
import time
import requests
from datetime import date, datetime, timedelta
from dateutil.relativedelta import relativedelta
from collections import defaultdict
from io import StringIO

# Local modules (same folder)
from amfi_normalise import normalise_amc, parse_scheme_type_category, is_direct_plan
from validate import validate_main_gist, print_validation_summary, ValidationError

# ─── Config ──────────────────────────────────────────────────────────────────

AMFI_SCHEME_MASTER_URL = "https://portal.amfiindia.com/DownloadSchemeData_Po.aspx?mf=0"
AMFI_NAV_ALL_URL       = "https://www.amfiindia.com/spages/NAVAll.txt"
AMFI_NAV_HISTORY_URL   = "https://portal.amfiindia.com/DownloadNAVHistoryReport_Po.aspx"

HISTORY_MONTHS         = 36        # months of NAV history to fetch
RISK_FREE_RATE_ANNUAL  = 0.065     # 6.5% — used for Sharpe/Sortino
REQUEST_DELAY_SEC      = 1.5       # polite delay between AMFI calls
MAX_RETRIES            = 3         # retry count per HTTP call
OUTPUT_FILE            = "fundlens_schemes.json"

TODAY                  = date.today()
TODAY_STR              = TODAY.strftime("%Y-%m-%d")

# ─── Utility ─────────────────────────────────────────────────────────────────

def safe_get(url: str, params: dict = None, label: str = "") -> str:
    """HTTP GET with retry + polite delay. Returns text content."""
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


def date_windows(months_back: int):
    """
    Generate (from_date, to_date) pairs covering the last N months,
    in 90-day chunks, oldest first.
    AMFI max window = 90 days per call.
    """
    end = TODAY
    start = (TODAY - relativedelta(months=months_back)).replace(day=1)
    windows = []
    cursor = start
    while cursor < end:
        window_end = min(cursor + timedelta(days=89), end)
        windows.append((cursor, window_end))
        cursor = window_end + timedelta(days=1)
    return windows


def parse_date(date_str: str):
    """Parse AMFI date strings: '01-Jan-2024' or '2024-01-01'."""
    for fmt in ("%d-%b-%Y", "%Y-%m-%d", "%d/%m/%Y"):
        try:
            return datetime.strptime(date_str.strip(), fmt).date()
        except ValueError:
            continue
    return None


def cagr(nav_then: float, nav_now: float, years: float) -> float | None:
    """CAGR from two NAV points over N years. Returns percentage."""
    if not nav_then or not nav_now or years <= 0:
        return None
    try:
        return round(((nav_now / nav_then) ** (1 / years) - 1) * 100, 2)
    except Exception:
        return None


def absolute_return(nav_then: float, nav_now: float) -> float | None:
    """Absolute return % for short periods (< 1 year)."""
    if not nav_then or not nav_now:
        return None
    return round((nav_now / nav_then - 1) * 100, 2)


# ─── Step 1: Fetch Scheme Master ─────────────────────────────────────────────

def fetch_scheme_master() -> dict:
    """
    Fetch AMFI scheme master. Returns dict keyed by scheme_code (str).
    Each entry: { id, name, amcFull, amc, type, category, plan, isin, inceptionDate }
    Includes ALL scheme types: Open Ended, Close Ended, Interval.
    """
    print("\n[Step 1] Fetching scheme master from AMFI...")
    raw = safe_get(AMFI_SCHEME_MASTER_URL, label="scheme master")
    schemes = {}
    current_amc_full = ""

    for line in raw.splitlines():
        line = line.strip()
        if not line:
            continue

        # AMC header lines: "Aditya Birla Sun Life AMC Limited,100033,..."
        # Regular data lines have 9+ comma-separated fields
        parts = [p.strip() for p in line.split(",")]

        # Detect AMC header line (first field doesn't look like a scheme code)
        if len(parts) >= 2 and not parts[1].isdigit():
            current_amc_full = parts[0]
            continue

        # Data line: AMC, Code, Scheme Name, Scheme Type, Scheme Category,
        #            Scheme NAV Name, Min Amount, Launch Date, Closure Date, ISIN, ISIN2
        if len(parts) < 9:
            continue

        try:
            amc_raw      = parts[0]
            code         = parts[1].strip()
            scheme_name  = parts[2].strip()
            scheme_type_raw = parts[3].strip()  # e.g. "Open Ended"
            scheme_cat_raw  = parts[4].strip()  # e.g. "Equity Scheme - Large Cap Fund"
            nav_name     = parts[5].strip()
            launch_raw   = parts[7].strip() if len(parts) > 7 else ""
            isin         = parts[9].strip() if len(parts) > 9 else ""

            if not code or not code.isdigit():
                continue

            # Use AMC from data line first, fall back to header
            amc_source = amc_raw if amc_raw else current_amc_full
            amc_full = amc_source.strip()
            amc_short = normalise_amc(amc_full)

            # Parse type and category from AMFI's verbose string
            combined_type_str = f"{scheme_type_raw} {scheme_cat_raw}"
            scheme_type, category = parse_scheme_type_category(combined_type_str)

            # Plan detection from NAV name (more reliable than scheme name)
            plan_source = nav_name or scheme_name
            plan = "Direct" if is_direct_plan(plan_source) else "Regular"

            # Inception date
            inception_date = ""
            if launch_raw:
                d = parse_date(launch_raw)
                inception_date = d.strftime("%Y-%m-%d") if d else ""

            # Open/Close/Interval ended
            structure = "Open Ended"
            if "close" in scheme_type_raw.lower():
                structure = "Close Ended"
            elif "interval" in scheme_type_raw.lower():
                structure = "Interval"

            schemes[code] = {
                "id":            code,
                "name":          scheme_name,
                "navName":       nav_name,
                "amcFull":       amc_full,
                "amc":           amc_short,
                "type":          scheme_type,
                "category":      category,
                "plan":          plan,
                "structure":     structure,
                "isin":          isin,
                "inceptionDate": inception_date,
            }

        except Exception as e:
            continue  # skip malformed lines silently

    print(f"  [Step 1] ✅ {len(schemes)} schemes loaded from master.")
    return schemes


# ─── Step 2: Fetch Today's NAVs ──────────────────────────────────────────────

def fetch_current_navs() -> dict:
    """
    Fetch NAVAll.txt — all current NAVs.
    Returns dict: { scheme_code: { nav, navDate, aum, expenseRatio } }
    NAVAll.txt format (semicolon delimited):
    Scheme Code;ISIN Div Payout;ISIN Growth;Scheme Name;Net Asset Value;Date
    """
    print("\n[Step 2] Fetching current NAVs from AMFI NAVAll.txt...")
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
            code    = parts[0].strip()
            nav_str = parts[4].strip()
            date_str= parts[5].strip()

            if not code.isdigit():
                continue
            nav_val = float(nav_str)
            nav_date = parse_date(date_str)

            navs[code] = {
                "nav":     round(nav_val, 4),
                "navDate": nav_date.strftime("%Y-%m-%d") if nav_date else TODAY_STR,
            }
        except Exception:
            skipped += 1
            continue

    print(f"  [Step 2] ✅ {len(navs)} current NAVs loaded. ({skipped} lines skipped)")
    return navs


# ─── Step 3: Fetch NAV History ───────────────────────────────────────────────

def fetch_nav_history(months_back: int = HISTORY_MONTHS) -> dict:
    """
    Fetch historical NAVs for all schemes over the last N months.
    Makes multiple 90-day window calls to AMFI.
    Returns dict: { scheme_code: [ {date: 'YYYY-MM-DD', nav: float}, ... ] }
    Sorted oldest → newest.
    """
    print(f"\n[Step 3] Fetching {months_back}-month NAV history from AMFI...")
    windows = date_windows(months_back)
    print(f"  Will make {len(windows)} AMFI calls (90-day windows)...")

    # Raw collection: { code: { 'YYYY-MM-DD': nav_float } }
    raw_history = defaultdict(dict)

    for i, (from_dt, to_dt) in enumerate(windows, 1):
        from_str = from_dt.strftime("%d-%b-%Y")
        to_str   = to_dt.strftime("%d-%b-%Y")
        print(f"  Window {i}/{len(windows)}: {from_str} → {to_str}", end=" ")

        try:
            params = {"frmdt": from_str, "todt": to_str}
            text = safe_get(AMFI_NAV_HISTORY_URL, params=params,
                           label=f"history window {i}")
            line_count = 0
            for line in text.splitlines():
                parts = line.strip().split(";")
                if len(parts) < 8:
                    continue
                try:
                    code     = parts[0].strip()
                    nav_str  = parts[4].strip()
                    date_str = parts[7].strip()
                    if not code.isdigit() or not nav_str:
                        continue
                    nav_val  = float(nav_str)
                    nav_date = parse_date(date_str)
                    if nav_date and nav_val > 0:
                        date_key = nav_date.strftime("%Y-%m-%d")
                        raw_history[code][date_key] = nav_val
                        line_count += 1
                except Exception:
                    continue
            print(f"→ {line_count:,} NAV points")
        except Exception as e:
            print(f"→ ❌ FAILED: {e} (skipping window, continuing)")
            continue

    # Convert to sorted arrays, keeping end-of-month NAVs only
    history = {}
    for code, date_nav_map in raw_history.items():
        if not date_nav_map:
            continue
        # Sort all dates
        sorted_dates = sorted(date_nav_map.keys())
        # Keep last trading day of each month
        monthly = {}
        for d_str in sorted_dates:
            month_key = d_str[:7]  # 'YYYY-MM'
            monthly[month_key] = {"date": d_str, "nav": date_nav_map[d_str]}
        # Convert to array sorted by month
        history[code] = [v for k, v in sorted(monthly.items())]

    scheme_count = len(history)
    avg_points = sum(len(v) for v in history.values()) / max(scheme_count, 1)
    print(f"\n  [Step 3] ✅ History fetched: {scheme_count} schemes, "
          f"avg {avg_points:.1f} monthly points each.")
    return history


# ─── Step 4: Compute Returns ─────────────────────────────────────────────────

def compute_returns(nav_history: list[dict], current_nav: float) -> dict:
    """
    Compute returns from monthly NAV history.
    nav_history: [ {date: 'YYYY-MM-DD', nav: float}, ... ] oldest→newest
    current_nav: today's NAV (may be more recent than last history entry)
    Returns: { '1W': %, '1M': %, '3M': %, '6M': %, '1Y': %, '3Y': % }
    """
    if not nav_history:
        return {}

    now_nav = current_nav
    history = nav_history  # already sorted oldest → newest

    def nav_n_months_ago(n: int) -> float | None:
        """Get NAV approximately n months ago from history."""
        if len(history) < n:
            return None
        # Count back n entries from end
        idx = max(0, len(history) - n)
        return history[idx]["nav"]

    returns = {}

    # 1M, 3M, 6M, 1Y, 3Y — from monthly snapshots
    for months, key in [(1, "1M"), (3, "3M"), (6, "6M"), (12, "1Y"), (36, "3Y")]:
        nav_then = nav_n_months_ago(months)
        if nav_then and now_nav:
            if months < 12:
                returns[key] = absolute_return(nav_then, now_nav)
            else:
                years = months / 12
                returns[key] = cagr(nav_then, now_nav, years)

    # 1W — approximate from current NAV vs last history entry
    # (Weekly precision needs daily data; use last monthly as proxy)
    last_nav = history[-1]["nav"] if history else None
    if last_nav and now_nav:
        returns["1W"] = absolute_return(last_nav, now_nav)

    return returns


# ─── Step 5: Compute Risk Ratios ─────────────────────────────────────────────

def compute_risk_ratios(nav_history: list[dict]) -> dict:
    """
    Compute annualised risk metrics from monthly NAV series.
    Returns: { stdDev, sharpe, sortino, maxDrawdown }
    """
    if len(nav_history) < 12:
        return {}

    navs = [entry["nav"] for entry in nav_history]
    # Monthly returns
    monthly_returns = [
        (navs[i] - navs[i-1]) / navs[i-1]
        for i in range(1, len(navs))
    ]

    if len(monthly_returns) < 6:
        return {}

    n = len(monthly_returns)
    mean_r = sum(monthly_returns) / n

    # Standard deviation (annualised)
    variance = sum((r - mean_r) ** 2 for r in monthly_returns) / (n - 1)
    std_monthly = math.sqrt(variance)
    std_annual = std_monthly * math.sqrt(12)

    # Risk-free rate monthly
    rf_monthly = RISK_FREE_RATE_ANNUAL / 12

    # Sharpe ratio (annualised)
    if std_annual > 0:
        sharpe = ((mean_r - rf_monthly) * 12) / std_annual
    else:
        sharpe = None

    # Sortino ratio — only downside deviation
    downside_returns = [r for r in monthly_returns if r < rf_monthly]
    if downside_returns:
        downside_var = sum((r - rf_monthly) ** 2 for r in downside_returns) / len(downside_returns)
        downside_std = math.sqrt(downside_var) * math.sqrt(12)
        sortino = ((mean_r - rf_monthly) * 12) / downside_std if downside_std > 0 else None
    else:
        sortino = None  # no negative months — can't compute

    # Max Drawdown
    peak = navs[0]
    max_dd = 0.0
    for nav in navs:
        if nav > peak:
            peak = nav
        dd = (peak - nav) / peak
        if dd > max_dd:
            max_dd = dd

    def r2(x):
        return round(x, 4) if x is not None else None

    return {
        "stdDev":      r2(std_annual * 100),   # annualised std dev %
        "sharpe":      r2(sharpe),
        "sortino":     r2(sortino),
        "maxDrawdown": r2(max_dd * 100),        # %
    }


# ─── Step 6: Build Leaderboard & Rolling Returns ─────────────────────────────

def build_leaderboard(schemes: list[dict]) -> dict:
    """
    Build category-level leaderboard: top 5 schemes per category by 1Y return.
    Only includes Direct + Growth plans for clean comparison.
    """
    print("\n[Step 6a] Building leaderboard...")
    by_category = defaultdict(list)

    for s in schemes:
        if s.get("plan") != "Direct":
            continue
        r1y = s.get("returns", {}).get("1Y")
        if r1y is None:
            continue
        by_category[s["category"]].append({
            "id":       s["id"],
            "name":     s["name"],
            "amc":      s["amc"],
            "return1Y": r1y,
            "risk":     s.get("risk", {}),
        })

    leaderboard = {}
    for cat, entries in by_category.items():
        sorted_entries = sorted(entries, key=lambda x: x["return1Y"], reverse=True)
        leaderboard[cat] = sorted_entries[:10]  # top 10 per category

    print(f"  [Step 6a] ✅ Leaderboard built: {len(leaderboard)} categories.")
    return leaderboard


def build_rolling_returns(schemes: list[dict]) -> dict:
    """
    Build rolling 1Y return series per scheme (keyed by scheme id).
    For each month in history, compute trailing 12M return.
    Format: { schemeId: [ {date: 'YYYY-MM', return: float}, ... ] }
    Only for schemes with ≥ 13 monthly NAV points.
    """
    print("\n[Step 6b] Building rolling returns...")
    rolling = {}

    for s in schemes:
        history = s.get("navHistory", [])
        if len(history) < 13:
            continue
        navs = history  # sorted oldest → newest
        series = []
        for i in range(12, len(navs)):
            nav_now  = navs[i]["nav"]
            nav_then = navs[i - 12]["nav"]
            if nav_then > 0:
                r = cagr(nav_then, nav_now, 1.0)
                month_label = navs[i]["date"][:7]  # 'YYYY-MM'
                series.append({"date": month_label, "return": r})
        if series:
            rolling[s["id"]] = series

    print(f"  [Step 6b] ✅ Rolling returns built: {len(rolling)} schemes.")
    return rolling


# ─── Step 7: Assemble Final JSON ─────────────────────────────────────────────

def assemble_output(
    master: dict,
    current_navs: dict,
    nav_history: dict,
) -> dict:
    """Combine all data into final fundlens_schemes.json structure."""
    print("\n[Step 7] Assembling final JSON...")

    schemes_out = []
    amc_set = {}
    category_set = set()
    no_nav_count = 0
    no_history_count = 0

    for code, info in master.items():
        nav_data    = current_navs.get(code, {})
        history     = nav_history.get(code, [])

        current_nav = nav_data.get("nav")
        nav_date    = nav_data.get("navDate", "")

        if not current_nav:
            no_nav_count += 1
            # Still include scheme — may be closed-end with no daily NAV
            current_nav = None

        if not history:
            no_history_count += 1

        # Compute returns and risk
        returns = compute_returns(history, current_nav) if history and current_nav else {}
        risk    = compute_risk_ratios(history) if history else {}

        scheme_obj = {
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
            "navDate":       nav_date,
            "inceptionDate": info["inceptionDate"],
            "returns":       returns,
            "risk":          risk,
            "navHistory":    history,
            # Placeholders — AUM and expense ratio not available from AMFI
            # Will be added when we find a reliable secondary source
            "aum":           None,
            "expenseRatio":  None,
        }

        schemes_out.append(scheme_obj)
        category_set.add(info["category"])
        amc_key = info["amc"]
        if amc_key not in amc_set:
            amc_set[amc_key] = info["amcFull"]

    # Sort schemes: by AMC then scheme name
    schemes_out.sort(key=lambda x: (x["amc"], x["name"]))

    # Build AMC list
    amcs_list = sorted([
        {"name": short, "fullName": full}
        for short, full in amc_set.items()
    ], key=lambda x: x["name"])

    # Build categories list
    categories_list = sorted(list(category_set))

    # Build leaderboard and rolling
    leaderboard = build_leaderboard(schemes_out)
    rolling     = build_rolling_returns(schemes_out)

    output = {
        "meta": {
            "lastUpdated":   TODAY_STR,
            "navDate":       TODAY_STR,
            "schemeCount":   len(schemes_out),
            "historyMonths": HISTORY_MONTHS,
            "source":        "AMFI Direct (amfiindia.com)",
            "pipelineVersion": "2.0",
        },
        "amcs":       amcs_list,
        "categories": categories_list,
        "leaderboard": leaderboard,
        "schemes":    schemes_out,
        "rolling":    rolling,
    }

    print(f"  [Step 7] ✅ Assembled: {len(schemes_out)} schemes, "
          f"{len(amcs_list)} AMCs, {len(categories_list)} categories.")
    print(f"  [Step 7]    {no_nav_count} schemes had no current NAV (closed/wound-up).")
    print(f"  [Step 7]    {no_history_count} schemes had no NAV history.")

    # ── Slim schemes for Gist size — strip heavy fields before upload
   KEEP_FIELDS = {
    'id', 'name', 'navName', 'amc', 'category', 'type', 'plan',
    'structure', 'nav', 'navDate', 'returns'
}
    }
    for s in schemes_out:
      # Keep all return periods
    slim['returns'] = s.get('returns', {})

        # Remove heavy/null fields
        for key in list(s.keys()):
            if key not in KEEP_FIELDS:
                del s[key]

    # Save extras (leaderboard + rolling) separately
    import json as _json
    extras = {
        'meta':        output['meta'],
        'leaderboard': leaderboard,
        'rolling':     rolling,
    }
    with open('fundlens_extras.json', 'w', encoding='utf-8') as f:
        _json.dump(extras, f, separators=(',', ':'))
    extras_mb = len(_json.dumps(extras, separators=(',',':')).encode()) / (1024*1024)
    print(f"  [Step 7] Extras saved: fundlens_extras.json ({extras_mb:.2f}MB)")
    
    return output


# ─── Main Entry Point ─────────────────────────────────────────────────────────

def run_pipeline():
    print("=" * 60)
    print("FundLens Pipeline v2.0 — AMFI Direct")
    print(f"Run date: {TODAY_STR}")
    print("=" * 60)

    # Step 1: Scheme master
    master = fetch_scheme_master()

    # Step 2: Current NAVs
    current_navs = fetch_current_navs()

    # Step 3: NAV history (36 months)
    nav_history = fetch_nav_history(months_back=HISTORY_MONTHS)

    # Steps 4–6 happen inside assemble_output
    output = assemble_output(master, current_navs, nav_history)

    # Step 7: Validate before saving
    print(f"\n[Step 8] Validating output...")
    try:
        warnings = validate_main_gist(output, TODAY_STR)
        print_validation_summary(warnings)
    except ValidationError as e:
        print(str(e))
        print("\n⛔ Pipeline aborted. Output NOT saved. Existing Gist preserved.")
        return None

    # Step 8: Save locally
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, separators=(",", ":"), ensure_ascii=False)

    size_mb = len(json.dumps(output, separators=(",", ":")).encode()) / (1024 * 1024)
    print(f"\n✅ Pipeline complete. Saved: {OUTPUT_FILE} ({size_mb:.2f}MB)")
    print("   Run Cell 2 to upload to Gist.")
    return output


# ─── Run ─────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    run_pipeline()
