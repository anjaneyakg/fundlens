# amfi_normalise.py
# Canonical AMC name normalisation.
# AMFI's scheme master gives clean names for most cases.
# This map handles legacy dirty values from old MFAPI data
# and any edge cases in AMFI's own text output.

AMC_ALIASES = {
    # Aditya Birla variants
    "ADITYA BIRLA":                     "Aditya Birla Sun Life",
    "Aditya Birla":                     "Aditya Birla Sun Life",
    "Aditya Birla Sun Life":            "Aditya Birla Sun Life",
    "Aditya Birla Sun Life AMC Limited":"Aditya Birla Sun Life",

    # HDFC
    "Hdfc":                             "HDFC",
    "HDFC Asset Management Company":    "HDFC",
    "HDFC Mutual Fund":                 "HDFC",

    # SBI
    "Sbi":                              "SBI",
    "SBI Funds Management":             "SBI",
    "SBI Mutual Fund":                  "SBI",

    # UTI
    "Uti":                              "UTI",
    "UTI Asset Management":             "UTI",
    "UTI Mutual Fund":                  "UTI",

    # DSP
    "Dsp":                              "DSP",
    "DSP Investment Managers":          "DSP",
    "DSP Mutual Fund":                  "DSP",

    # JM Financial
    "Jm":                               "JM Financial",
    "JM Financial Asset Management":    "JM Financial",
    "JM Financial Mutual Fund":         "JM Financial",

    # Motilal Oswal (includes typo from pipeline)
    "Motilal Owsal":                    "Motilal Oswal",
    "Motilal Oswal Asset Management":   "Motilal Oswal",
    "Motilal Oswal Mutual Fund":        "Motilal Oswal",

    # Trust MF variants
    "TRUSTMF BANKING":                  "Trust MF",
    "TRUSTMF CORPORATE":                "Trust MF",
    "TRUSTMF FIXED":                    "Trust MF",
    "TRUSTMF Flexi":                    "Trust MF",
    "TRUSTMF Liquid":                   "Trust MF",
    "TRUSTMF MONEY":                    "Trust MF",
    "TRUSTMF SMALL":                    "Trust MF",
    "TRUSTMF Short":                    "Trust MF",
    "Trust Mf":                         "Trust MF",
    "Trust Asset Management":           "Trust MF",

    # Shriram — scheme names leaking into AMC field in old data
    "Shriram Aggressive":               "Shriram",
    "Shriram Balanced":                 "Shriram",
    "Shriram ELSS":                     "Shriram",
    "Shriram Flexi":                    "Shriram",
    "Shriram Liquid":                   "Shriram",
    "Shriram Multi":                    "Shriram",
    "Shriram Nifty":                    "Shriram",
    "Shriram Overnight":                "Shriram",
    "Shriram Unclaimed":                "Shriram",
    "Shriram Asset Management":         "Shriram",

    # Taurus — same issue
    "Taurus Banking":                   "Taurus",
    "Taurus ELSS":                      "Taurus",
    "Taurus Ethical":                   "Taurus",
    "Taurus Flexi":                     "Taurus",
    "Taurus Infrastructure":            "Taurus",
    "Taurus Investor":                  "Taurus",
    "Taurus Large":                     "Taurus",
    "Taurus Mid":                       "Taurus",
    "Taurus Nifty":                     "Taurus",
    "Taurus Unclaimed":                 "Taurus",
    "Taurus Asset Management":          "Taurus",
    "Taurus Mutual Fund":               "Taurus",

    # BHARAT Bond / ETF baskets — AMC is actually Edelweiss
    "BHARAT Bond":                      "Edelweiss",
    "Bharat Bond":                      "Edelweiss",
    "BHARAT 22":                        "ICICI Prudential",  # BHARAT 22 ETF managed by ICICI Pru
    "CPSE ETF":                         "Nippon India",       # CPSE ETF managed by Nippon

    # ANGEL ONE
    "ANGEL ONE":                        "Angel One",
    "Angel One Asset Management":       "Angel One",

    # 360 One
    "360 One":                          "360 ONE",
    "360 ONE Asset Management":         "360 ONE",

    # Others with casing issues
    "Icici Prudential":                 "ICICI Prudential",
    "ICICI Prudential Asset Management":"ICICI Prudential",
    "Nippon India":                     "Nippon India",        # already clean
    "Kotak":                            "Kotak",               # already clean
    "Axis":                             "Axis",                # already clean
    "Franklin":                         "Franklin Templeton",
    "Templeton India":                  "Franklin Templeton",
    "Franklin Templeton Asset Management": "Franklin Templeton",
    "Nj":                               "NJ",
    "Iti":                              "ITI",
    "Pgim":                             "PGIM India",
    "PGIM India Asset Management":      "PGIM India",
    "Hsbc":                             "HSBC",
    "HSBC Asset Management":            "HSBC",
    "Lic":                              "LIC",
    "LIC Mutual Fund Asset Management": "LIC",
}


# Scheme-type normalisation from AMFI's verbose category strings
# e.g. "Open Ended Schemes(Debt Scheme - Banking and PSU Fund)" → type + category
SCHEME_TYPE_MAP = {
    "Equity Scheme":        "Equity",
    "Debt Scheme":          "Debt",
    "Hybrid Scheme":        "Hybrid",
    "Solution Oriented":    "Hybrid",
    "Index Funds":          "Passive",
    "ETFs":                 "Passive",
    "Fund of Funds":        "Passive",
    "Other Scheme":         "Other",
}

CATEGORY_MAP = {
    "Large Cap Fund":                   "Large Cap",
    "Mid Cap Fund":                     "Mid Cap",
    "Small Cap Fund":                   "Small Cap",
    "Multi Cap Fund":                   "Multi Cap",
    "Flexi Cap Fund":                   "Flexi Cap",
    "Large & Mid Cap Fund":             "Large & Mid Cap",
    "Focused Fund":                     "Focused",
    "ELSS":                             "ELSS",
    "Contra Fund":                      "Contra",
    "Dividend Yield Fund":              "Dividend Yield",
    "Value Fund":                       "Value",
    "Sectoral/ Thematic":               "Thematic",
    "Liquid Fund":                      "Liquid",
    "Overnight Fund":                   "Overnight",
    "Ultra Short Duration Fund":        "Ultra Short Duration",
    "Low Duration Fund":                "Low Duration",
    "Money Market Fund":                "Money Market",
    "Short Duration Fund":              "Short Duration",
    "Medium Duration Fund":             "Medium Duration",
    "Medium to Long Duration Fund":     "Medium to Long Duration",
    "Long Duration Fund":               "Long Duration",
    "Dynamic Bond Fund":                "Dynamic Bond",
    "Corporate Bond Fund":              "Corporate Bond",
    "Credit Risk Fund":                 "Credit Risk",
    "Banking and PSU Fund":             "Banking & PSU",
    "Gilt Fund":                        "Gilt",
    "Gilt Fund with 10 year constant duration": "Gilt",
    "Floater Fund":                     "Floater",
    "Aggressive Hybrid Fund":           "Aggressive Hybrid",
    "Conservative Hybrid Fund":         "Conservative Hybrid",
    "Balanced Hybrid Fund":             "Balanced Hybrid",
    "Multi Asset Allocation":           "Multi Asset",
    "Arbitrage Fund":                   "Arbitrage",
    "Equity Savings":                   "Equity Savings",
    "Dynamic Asset Allocation":         "Dynamic AA",
    "Index Funds":                      "Index",
    "Exchange Traded Fund":             "ETF",
    "Fund of Funds":                    "Fund of Funds",
    "Retirement Fund":                  "Retirement",
    "Children's Fund":                  "Children's",
}


def normalise_amc(raw_name: str) -> str:
    """Return canonical AMC name. Falls back to title-cased input if not in map."""
    if not raw_name:
        return "Unknown"
    cleaned = raw_name.strip()
    if cleaned in AMC_ALIASES:
        return AMC_ALIASES[cleaned]
    # Try prefix match for AMFI's long AMC names e.g. "Aditya Birla Sun Life AMC Limited"
    for alias, canonical in AMC_ALIASES.items():
        if cleaned.startswith(alias):
            return canonical
    return cleaned  # Return as-is — AMFI master names are mostly clean


def parse_scheme_type_category(amfi_scheme_type: str):
    """
    Parse AMFI's verbose scheme type string into (type, category).
    Input example: "Open Ended Schemes(Equity Scheme - Large Cap Fund)"
    Returns: ("Equity", "Large Cap")
    """
    s = amfi_scheme_type.strip() if amfi_scheme_type else ""

    scheme_type = "Other"
    category = "Other"

    for key, val in SCHEME_TYPE_MAP.items():
        if key.lower() in s.lower():
            scheme_type = val
            break

    for key, val in CATEGORY_MAP.items():
        if key.lower() in s.lower():
            category = val
            break

    return scheme_type, category


def is_growth_plan(scheme_name: str) -> bool:
    """Identify Growth / Direct Growth plans (not IDCW/Dividend)."""
    name_lower = scheme_name.lower()
    idcw_terms = ["idcw", "dividend", "payout", "reinvestment", "bonus"]
    return not any(term in name_lower for term in idcw_terms)


def is_direct_plan(scheme_name: str) -> bool:
    """Identify Direct plans."""
    return "direct" in scheme_name.lower()
