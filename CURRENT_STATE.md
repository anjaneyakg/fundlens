# FundInsight — Current State
_Last updated: 25 Apr 2026 · v20.0_

## Pipeline Scripts — Live Versions
| Script | Version | Status |
|---|---|---|
| cell_a_fetcher.py | v1.0 | ✅ Live |
| cell_4d_v2.py | v2.1 | ✅ Live |
| uti_fetch.py | v1.0 | ⛔ Retired |

## Last Run Results
- **March 2026:** 378 files in GitHub data/raw/2026-03/
- **cell_4d_v2.py March run:** ⚠️ Pending — 0 rows for Mahindra, Shriram, Nippon
- **February 2026:** 311 files, amc_map.json pushed cleanly

## Open Issues (Priority Order)
- [ ] P0 — Fix 0-row AMCs: Mahindra, Shriram, Nippon
- [ ] P0 — Run cell_4d_v2.py --month 2026-03 --source github
- [ ] P1 — Build merge_holdings.py
- [ ] P1 — Build Cell C — Scheme Reconciler
- [ ] P2 — Build Cell E — Quality Gate
- [ ] P3 — Phase B: instrument_type normaliser
- [ ] P4 — Phase C: migrate to Supabase scheme_portfolios
- [ ] P5 — GIST_PAT (FundInsight-Pipeline) expires Jul 6 2026
- [ ] P5 — Node.js 24 upgrade — deadline June 2026

## Key Technical Facts
- UTI ISIN: col 7 (0-based), NOT col 2
- UTI scheme name: strip leading whitespace
- Kotak col_override: Name=3,ISIN=4,Industry=5,Qty=7,MktVal=8,%NAV=9
- SBI R1C1: R3C4 (corrected)
- GitHub source mode: AMC name always from commit message
- ZIP files: extracted in-memory, identity from commit message

## Session Protocol
- Reference doc: FundLens_Master_Reference_v20.docx (in project knowledge)
- At session start: paste this URL in chat
- Raw URL: https://raw.githubusercontent.com/anjaneyakg/fundlens/main/CURRENT_STATE.md
- At session end: update this file + git commit + push
