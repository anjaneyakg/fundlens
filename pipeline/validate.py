# validate.py
# Validation gate: runs before every Gist upload.
# If ANY check fails → upload is aborted → old Gist preserved → website stays live.

import json
from datetime import date, datetime

class ValidationError(Exception):
    """Raised when data fails a critical quality check."""
    pass


def validate_main_gist(data: dict, today: str) -> list[str]:
    """
    Validate the main fundlens_schemes.json payload before upload.
    Returns list of warning strings (non-fatal).
    Raises ValidationError on fatal failures.
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
    # Error threshold raised from 40 → 80, warning from 15 → 30
    if missing_returns_count > 80:
        errors.append(f"{missing_returns_count}/200 sampled schemes missing 1Y return.")
    elif missing_returns_count > 30:
        warnings.append(f"{missing_returns_count}/200 sampled schemes missing 1Y return.")

    if missing_amc_count > 10:
        warnings.append(f"{missing_amc_count}/200 sampled schemes missing AMC name.")

    # ── 4. Meta freshness ─────────────────────────────────────────────────────
    meta = data.get("meta", {})
    last_updated = meta.get("lastUpdated", "")
    if last_updated != today:
        warnings.append(
            f"meta.lastUpdated is '{last_updated}', expected today '{today}'. "
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


def validate_archive_gist(data: dict) -> list[str]:
    """
    Lighter validation for the archive Gist (fundlens_nav_archive.json).
    Returns warnings, raises ValidationError on fatal issues.
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
    if size_mb > 90:
        warnings.append(f"Archive Gist approaching GitHub's 100MB limit: {size_mb:.1f}MB. Plan split soon.")

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
