#!/usr/bin/env bash
# gap_repair.sh — NAV gap repair: re-run all years 2006-2026 to fill any missing rows.
# Upsert uses ON CONFLICT DO NOTHING — existing rows are never overwritten.
# Run from fundlens root:  bash pipeline/gap_repair.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$ROOT_DIR"

# Load env vars (SUPABASE_URL, SUPABASE_KEY)
set -a && source .env && set +a

echo "============================================================"
echo "NAV Gap Repair — starting $(date)"
echo "============================================================"

run_year() {
    local from="$1"
    local to="$2"
    local label="$3"
    local logfile="pipeline/gap_${label}.log"

    echo ""
    echo "------------------------------------------------------------"
    echo "Starting $label  ($from -> $to)  [$(date +%H:%M:%S)]"
    echo "------------------------------------------------------------"

    python pipeline/backfill_nav_history.py --from "$from" --to "$to" 2>&1 | tee "$logfile"

    local inserted
    inserted=$(grep "Rows inserted" "$logfile" | tail -1 | grep -oP '\d+(?=\s+\(new)' || echo "?")
    echo ">>> $label done — inserted: $inserted new rows  [$(date +%H:%M:%S)]"
}

# ---- 2006-2025: full calendar years ----
run_year 2006-01-01 2006-12-31 2006
run_year 2007-01-01 2007-12-31 2007
run_year 2008-01-01 2008-12-31 2008
run_year 2009-01-01 2009-12-31 2009
run_year 2010-01-01 2010-12-31 2010
run_year 2011-01-01 2011-12-31 2011
run_year 2012-01-01 2012-12-31 2012
run_year 2013-01-01 2013-12-31 2013
run_year 2014-01-01 2014-12-31 2014
run_year 2015-01-01 2015-12-31 2015
run_year 2016-01-01 2016-12-31 2016
run_year 2017-01-01 2017-12-31 2017
run_year 2018-01-01 2018-12-31 2018
run_year 2019-01-01 2019-12-31 2019
run_year 2020-01-01 2020-12-31 2020
run_year 2021-01-01 2021-12-31 2021
run_year 2022-01-01 2022-12-31 2022
run_year 2023-01-01 2023-12-31 2023
run_year 2024-01-01 2024-12-31 2024
run_year 2025-01-01 2025-12-31 2025

# ---- 2026: Jan 1 through May 22 ----
run_year 2026-01-01 2026-05-22 2026

# ---- Pre-2006 availability test (dry-run only) ----
echo ""
echo "------------------------------------------------------------"
echo "Pre-2006 dry-run test (2000-01-01 -> 2000-03-31)  [$(date +%H:%M:%S)]"
echo "------------------------------------------------------------"
python pipeline/backfill_nav_history.py --from 2000-01-01 --to 2000-03-31 --dry-run \
    2>&1 | tee pipeline/gap_pre2006_test.log
echo ">>> Pre-2006 test done  [$(date +%H:%M:%S)]"

# ---- Summary ----
echo ""
echo "============================================================"
echo "Gap repair complete — $(date)"
echo "============================================================"
echo ""
echo "Inserted rows per year:"
for year in 2006 2007 2008 2009 2010 2011 2012 2013 2014 2015 \
            2016 2017 2018 2019 2020 2021 2022 2023 2024 2025 2026; do
    logfile="pipeline/gap_${year}.log"
    if [[ -f "$logfile" ]]; then
        ins=$(grep "Rows inserted" "$logfile" | tail -1 | grep -oP '\d+(?=\s+\(new)' || echo "?")
        echo "  $year : $ins new rows"
    fi
done
echo ""
echo "Pre-2006 test:"
grep "AMFI rows fetched" pipeline/gap_pre2006_test.log | tail -1 || echo "  (check pipeline/gap_pre2006_test.log)"
