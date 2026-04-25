// src/data/amcList.js
// Master list of all 50 SEBI-registered AMCs — used by Admin Portfolio Upload page
//
// Groups mirror the pipeline architecture in cell_a_fetcher.py:
//   Group A — API / fully automated   (cell_a_fetcher handles download)
//   Group B — Direct URL / semi-auto  (cell_a_fetcher handles download, URLs need monthly update)
//   Group C — Manual download needed  (download from AMC site, upload here)
//   Group D — Admin portal only       (declaration popups / JS-gated downloads)
//
// amc_config_key: exact key used in AMC_CONFIG dict in cell_4d_v2.py
//
// Last updated: 25 Apr 2026 — amc_config_key added to all entries

export const AMC_LIST = [

  // ── Group A — Fully automated via API (cell_a_fetcher handles these) ────────
  { id: "uti",          name: "UTI Mutual Fund",                    category: 1, amc_config_key: "UTI" },
  { id: "invesco",      name: "Invesco India Mutual Fund",          category: 1, amc_config_key: "Invesco" },
  { id: "wealthcompany",name: "The Wealth Company Mutual Fund",     category: 1, amc_config_key: "The Wealth Company" },

  // ── Group B — Semi-automated via direct URLs (cell_a_fetcher handles these) ─
  { id: "canararobeco", name: "Canara Robeco Mutual Fund",          category: 2, amc_config_key: "Canara Robeco" },
  { id: "mirae",        name: "Mirae Asset Mutual Fund",            category: 2, amc_config_key: "Mirae" },
  { id: "unifi",        name: "Unifi Mutual Fund",                  category: 2, amc_config_key: "Unifi" },
  { id: "hdfc",         name: "HDFC Mutual Fund",                   category: 2, amc_config_key: "HDFC" },

  // ── Group C — Manual download, upload here ───────────────────────────────────
  { id: "360one",       name: "360 ONE Mutual Fund",                category: 3, amc_config_key: "360 One" },
  { id: "adityabirla",  name: "Aditya Birla Sun Life Mutual Fund",  category: 3, amc_config_key: "Aditya Birla" },
  { id: "axis",         name: "Axis Mutual Fund",                   category: 3, amc_config_key: "Axis" },
  { id: "bajaj",        name: "Bajaj Finserv Mutual Fund",          category: 3, amc_config_key: "Bajaj Finserv" },
  { id: "bankofindia",  name: "Bank of India Mutual Fund",          category: 3, amc_config_key: "Bank of India" },
  { id: "barodabnp",    name: "Baroda BNP Paribas Mutual Fund",     category: 3, amc_config_key: "Baroda BNP" },
  { id: "dsp",          name: "DSP Mutual Fund",                    category: 3, amc_config_key: "DSP" },
  { id: "edelweiss",    name: "Edelweiss Mutual Fund",              category: 3, amc_config_key: "Edelweiss" },
  { id: "franklin",     name: "Franklin Templeton Mutual Fund",     category: 3, amc_config_key: "Franklin Templeton" },
  { id: "groww",        name: "Groww Mutual Fund",                  category: 3, amc_config_key: "Groww" },
  { id: "helios",       name: "Helios Mutual Fund",                 category: 3, amc_config_key: "Helios" },
  { id: "hsbc",         name: "HSBC Mutual Fund",                   category: 3, amc_config_key: "HSBC" },
  { id: "icici",        name: "ICICI Prudential Mutual Fund",       category: 3, amc_config_key: "ICICI Prudential" },
  { id: "jioblackrock", name: "Jio BlackRock Mutual Fund",          category: 3, amc_config_key: "jioblackrock" },
  { id: "jm",           name: "JM Financial Mutual Fund",           category: 3, amc_config_key: "JM" },
  { id: "kotak",        name: "Kotak Mahindra Mutual Fund",         category: 3, amc_config_key: "Kotak" },
  { id: "lic",          name: "LIC Mutual Fund",                    category: 3, amc_config_key: "LIC" },
  { id: "mahindramanulife", name: "Mahindra Manulife Mutual Fund",  category: 3, amc_config_key: "Mahindra" },
  { id: "motilal",      name: "Motilal Oswal Mutual Fund",          category: 3, amc_config_key: "Motilal Oswal" },
  { id: "navi",         name: "Navi Mutual Fund",                   category: 3, amc_config_key: "Navi" },
  { id: "nippon",       name: "Nippon India Mutual Fund",           category: 3, amc_config_key: "Nippon" },
  { id: "nj",           name: "NJ Mutual Fund",                     category: 3, amc_config_key: "NJ" },
  { id: "pgim",         name: "PGIM India Mutual Fund",             category: 3, amc_config_key: "PGIM" },
  { id: "ppfas",        name: "PPFAS Mutual Fund",                  category: 3, amc_config_key: "PPFAS" },
  { id: "quantum",      name: "Quantum Mutual Fund",                category: 3, amc_config_key: "Quantum" },
  { id: "quant",        name: "quant Mutual Fund",                  category: 3, amc_config_key: "quant" },
  { id: "samco",        name: "Samco Mutual Fund",                  category: 3, amc_config_key: "Samco" },
  { id: "sbi",          name: "SBI Mutual Fund",                    category: 3, amc_config_key: "SBI" },
  { id: "shriram",      name: "Shriram Mutual Fund",                category: 3, amc_config_key: "Shriram" },
  { id: "sundaram",     name: "Sundaram Mutual Fund",               category: 3, amc_config_key: "Sundaram" },
  { id: "tata",         name: "Tata Mutual Fund",                   category: 3, amc_config_key: "Tata" },
  { id: "taurus",       name: "Taurus Mutual Fund",                 category: 3, amc_config_key: "Taurus" },
  { id: "trust",        name: "Trust Mutual Fund",                  category: 3, amc_config_key: "TrustMF" },
  { id: "union",        name: "Union Mutual Fund",                  category: 3, amc_config_key: "Union" },
  { id: "whiteoak",     name: "WhiteOak Capital Mutual Fund",       category: 3, amc_config_key: "WhiteOak" },
  { id: "zerodha",      name: "Zerodha Mutual Fund",                category: 3, amc_config_key: "Zerodha" },

  // ── Group D — Admin portal / declaration gate ────────────────────────────────
  { id: "abakkus",      name: "Abakkus Mutual Fund",                category: 4, amc_config_key: "Abakkus",      note: "US person declaration popup — download manually from abakkusmf.com" },
  { id: "angelone",     name: "Angel One Mutual Fund",              category: 4, amc_config_key: "Angel One",    note: "JS-rendered links — download manually from angelonemf.com" },
  { id: "bandhan",      name: "Bandhan Mutual Fund",                category: 4, amc_config_key: "Bandhan",      note: "URL not visible on hover — download manually from bandhanmutual.com" },
  { id: "capitalmind",  name: "Capitalmind Mutual Fund",            category: 4, amc_config_key: "Capitalmind",  note: "US person declaration popup — download manually from capitalmindmf.com" },
  { id: "choice",       name: "Choice Mutual Fund",                 category: 4, amc_config_key: "Choice",       note: "JS-rendered links — download manually from choicemf.com" },
  { id: "iti",          name: "ITI Mutual Fund",                    category: 4, amc_config_key: "ITI",          note: "JS-triggered download — download manually from itimf.com" },
  { id: "oldbridge",    name: "Old Bridge Mutual Fund",             category: 4, amc_config_key: "Old Bridge",   note: "US person declaration popup — download manually from oldbridgemf.com" },

];

export const CAT_LABELS = {
  1: "Group A — API automated (cell_a_fetcher)",
  2: "Group B — Direct URL semi-auto (cell_a_fetcher)",
  3: "Group C — Manual download required",
  4: "Group D — Declaration gate / JS download",
};

export const CAT_DESCRIPTIONS = {
  1: "cell_a_fetcher.py downloads these automatically. Upload here only if the pipeline fails.",
  2: "cell_a_fetcher.py downloads these with monthly URL updates. Upload here only if the pipeline fails.",
  3: "Download the portfolio file from the AMC website each month, then upload using this page.",
  4: "Download requires clicking through a declaration or JS-rendered page. Download manually, then upload here.",
};
