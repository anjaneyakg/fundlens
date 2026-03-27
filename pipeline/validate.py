# validate.py
# Validation gate: runs before every Gist upload.
# If ANY check fails → upload is aborted → old Gist preserved → website stays live.

import json
from datetime import date, datetime, timedelta, timezone

class ValidationError(Exception):
    """Raised when data fails a critical quality check."""
    pass


def _today_ist() -> str:
    """Return today's date in IST (UTC+5:30) as YYYY-MM-DD string.
    
    The pipeline runs at 10PM IST (16:30 UTC). Using UTC date here caused
    a false freshness warning on days where IST and UTC fall on different
    calendar dates (i.e. every day before 00:30 IST = 18:30 UTC previous day).
    Always use IST for date comparisons — that's where AMFI operates.
    """
    ist = timezone(timedelta(hours=5, minutes=30))
    return datetime.now(ist).strftime("%Y-%m-%d")


def validate_main_gist(data: dict) -> list[str]:
    """
    Validate the main fundlens_schemes.json payload before upload.
    Returns list of warning strings (non-fatal).
    Raises ValidationError on fatal failures.

    Note: 'today' parameter removed in v4.1 — date is now computed
    internally in IST to avoid UTC/IST boundary false warnings.
    """
    warnings = []
    errors = []

    # ── 1. Top-level structure ────────────────────────────────────────────────
    # Note: 'leaderboard' removed from v4 — now lives in fundlens_category_index.json
    required_keys = {"meta", "amcs", "categories", "schemes"}
    missing = required_keys - set(data.keys())
    if missing:
        errors.append(f"Missing top-level keys: {missing}")

    # ── 2. Scheme count ───────────────────────────────────────────────────────
    schemes = data.get("schemes", [])
    scheme_count = len(schemes)
    if scheme_count < 3000:
        errors.append(
            f"Scheme count too low: {scheme_count} (expected ≥ 3000). "
            f"Possible truncated fetch. Aborting to protect live data."
        )
    elif scheme_count < 3400:
        warnings.append(f"Scheme count lower than usual: {scheme_count}")

    # ── 3. Per-scheme field checks (sample 200 schemes) ──────────────────────
    sample = schemes[:200]
    nav_zero_count = 0
    missing_returns_count = 0
    missing_amc_count = 0

    for s in sample:
        sid = s.get("id", "?")

        if not s.get("amc"):
            missing_amc_count += 1

        nav = s.get("nav", 0)
        if nav is None or nav <= 0:
            nav_zero_count += 1

        # navHistory check removed in v4 — history is now in separate nav_*.json files
        # (stripped from slim schemes JSON in pipeline Step 8)

        returns = s.get("returns", {})
        if not returns or returns.get("1Y") is None:
            missing_returns_count += 1

    if nav_zero_count > 20:
        errors.append(f"{nav_zero_count}/200 sampled schemes have NAV ≤ 0.")
    elif nav_zero_count > 5:
        warnings.append(f"{nav_zero_count}/200 sampled schemes have NAV ≤ 0.")

    # missing_history_count check removed in v4 — see navHistory note above

    # Threshold relaxed in v4: 47/200 failures were acceptable (schemes < 24 months old)
    # Error threshold: 80. Warning threshold raised from 30 → 50 in v4.1
    # (first 200 schemes alphabetically skew toward newer AMCs with shorter histories)
    if missing_returns_count > 80:
        errors.append(f"{missing_returns_count}/200 sampled schemes missing 1Y return.")
    elif missing_returns_count > 50:
        warnings.append(f"{missing_returns_count}/200 sampled schemes missing 1Y return.")

    if missing_amc_count > 10:
        warnings.append(f"{missing_amc_count}/200 sampled schemes missing AMC name.")

    # ── 4. Meta freshness (IST-aware) ─────────────────────────────────────────
    # Compares against IST date, not UTC. Pipeline runs at 10PM IST (16:30 UTC).
    # UTC date comparison caused false warnings whenever IST and UTC were on
    # different calendar dates — i.e. every day before 00:30 IST next day.
    today_ist = _today_ist()
    meta = data.get("meta", {})
    last_updated = meta.get("lastUpdated", "")
    if last_updated != today_ist:
        warnings.append(
            f"meta.lastUpdated is '{last_updated}', expected IST date '{today_ist}'. "
            f"Pipeline may be using cached data."
        )

    # ── 5. JSON size sanity ───────────────────────────────────────────────────
    json_str = json.dumps(data, separators=(",", ":"))
    size_mb = len(json_str.encode("utf-8")) / (1024 * 1024)
    if size_mb > 15:
        errors.append(f"JSON too large: {size_mb:.1f}MB (limit 15MB). Check navHistory depth.")
    elif size_mb > 10:
        warnings.append(f"JSON size approaching limit: {size_mb:.1f}MB.")
    print(f"  [validate] JSON size: {size_mb:.2f}MB")

    # ── 6. AMC list present ───────────────────────────────────────────────────
    amcs = data.get("amcs", [])
    if len(amcs) < 30:
        errors.append(f"AMC list too short: {len(amcs)} entries.")

    # ── 7. Leaderboard check removed in v4 ───────────────────────────────────
    # Leaderboard now lives in fundlens_category_index.json (validated separately)

    # ── 8. Final decision ─────────────────────────────────────────────────────
    if errors:
        error_msg = "\n".join(f"  ✗ {e}" for e in errors)
        raise ValidationError(
            f"\n{'='*60}\n"
            f"VALIDATION FAILED — Gist upload aborted.\n"
            f"Existing live data preserved. Website unaffected.\n"
            f"Errors:\n{error_msg}\n"
            f"{'='*60}"
        )

    return warnings


def validate_archive_gist(data: dict, prev_size_mb: float = 0.0) -> list[str]:
    """
    Lighter validation for the archive Gist (fundlens_nav_archive.json).
    Returns warnings, raises ValidationError on fatal issues.

    Args:
        data:          The archive Gist payload to validate.
        prev_size_mb:  Size of the archive at the previous pipeline run (MB).
                       Pass 0.0 if unknown — no false trigger since the archive
                       is already well above 5MB. Used to detect runaway growth.
    """
    warnings = []
    errors = []

    if "meta" not in data or "archive" not in data:
        errors.append("Archive Gist missing 'meta' or 'archive' keys.")

    archive = data.get("archive", {})
    if len(archive) < 100:
        errors.append(f"Archive has only {len(archive)} schemes — expected > 100.")

    meta = data.get("meta", {})
    oldest = meta.get("oldestDate", "")
    if not oldest:
        warnings.append("Archive meta.oldestDate not set.")

    json_str = json.dumps(data, separators=(",", ":"))
    size_mb = len(json_str.encode("utf-8")) / (1024 * 1024)
    print(f"  [validate_archive] JSON size: {size_mb:.2f}MB")

    # ── Size ceiling ──────────────────────────────────────────────────────────
    if size_mb > 90:
        warnings.append(
            f"Archive Gist approaching GitHub's 100MB limit: {size_mb:.1f}MB. Plan split soon."
        )

    # ── Size trend: flag runaway growth ──────────────────────────────────────
    # prev_size_mb=0.0 means unknown — skip trend check to avoid false positives.
    # Normal daily backfill adds ~0.1–0.5MB. A >5MB single-run jump is abnormal
    # and likely means duplicate entries or an accidental history re-append.
    if prev_size_mb > 0.0:
        growth_mb = size_mb - prev_size_mb
        if growth_mb > 5.0:
            warnings.append(
                f"Archive grew by {growth_mb:.1f}MB in one run "
                f"({prev_size_mb:.1f}MB → {size_mb:.1f}MB). "
                f"Expected ≤ 0.5MB/day. Check for duplicate entries."
            )

    if errors:
        raise ValidationError("\n".join(errors))

    return warnings


def print_validation_summary(warnings: list[str], label: str = "Main Gist"):
    if not warnings:
        print(f"  [validate] ✅ {label} passed all checks — no warnings.")
    else:
        print(f"  [validate] ✅ {label} passed (with {len(warnings)} warning(s)):")
        for w in warnings:
            print(f"    ⚠ {w}")
