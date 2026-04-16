// src/data/amcList.js
// Master list of all 50 SEBI-registered AMCs — used by Admin Portfolio Upload page
//
// Groups mirror the pipeline architecture in cell_a_fetcher.py:
//   Group A — API / fully automated   (cell_a_fetcher handles download)
//   Group B — Direct URL / semi-auto  (cell_a_fetcher handles download, URLs need monthly update)
//   Group C — Manual download needed  (download from AMC site, upload here)
//   Group D — Admin portal only       (declaration popups / JS-gated downloads)
//
// Last updated: 16 Apr 2026 — Zerodha added, groups redefined to match pipeline

export const AMC_LIST = [

  // ── Group A — Fully automated via API (cell_a_fetcher handles these) ────────
  // No manual upload needed unless pipeline fails
  { id: "uti",          name: "UTI Mutual Fund",                    category: 1 },
  { id: "invesco",      name: "Invesco India Mutual Fund",          category: 1 },
  { id: "wealthcompany",name: "The Wealth Company Mutual Fund",     category: 1 },

  // ── Group B — Semi-automated via direct URLs (cell_a_fetcher handles these) ─
  // URLs need monthly update in cell_a_fetcher.py. Upload here only if pipeline fails.
  { id: "canararobeco", name: "Canara Robeco Mutual Fund",          category: 2 },
  { id: "mirae",        name: "Mirae Asset Mutual Fund",            category: 2 },
  { id: "unifi",        name: "Unifi Mutual Fund",                  category: 2 },
  { id: "hdfc",         name: "HDFC Mutual Fund",                   category: 2 },

  // ── Group C — Manual download, upload here ───────────────────────────────────
  // Download from AMC website each month and upload using this page
  { id: "360one",       name: "360 ONE Mutual Fund",                category: 3 },
  { id: "adityabirla",  name: "Aditya Birla Sun Life Mutual Fund",  category: 3 },
  { id: "axis",         name: "Axis Mutual Fund",                   category: 3 },
  { id: "bajaj",        name: "Bajaj Finserv Mutual Fund",          category: 3 },
  { id: "bankofindia",  name: "Bank of India Mutual Fund",          category: 3 },
  { id: "barodabnp",    name: "Baroda BNP Paribas Mutual Fund",     category: 3 },
  { id: "dsp",          name: "DSP Mutual Fund",                    category: 3 },
  { id: "edelweiss",    name: "Edelweiss Mutual Fund",              category: 3 },
  { id: "franklin",     name: "Franklin Templeton Mutual Fund",     category: 3 },
  { id: "groww",        name: "Groww Mutual Fund",                  category: 3 },
  { id: "helios",       name: "Helios Mutual Fund",                 category: 3 },
  { id: "hsbc",         name: "HSBC Mutual Fund",                   category: 3 },
  { id: "icici",        name: "ICICI Prudential Mutual Fund",       category: 3 },
  { id: "jioblackrock", name: "Jio BlackRock Mutual Fund",          category: 3 },
  { id: "jm",           name: "JM Financial Mutual Fund",           category: 3 },
  { id: "kotak",        name: "Kotak Mahindra Mutual Fund",         category: 3 },
  { id: "lic",          name: "LIC Mutual Fund",                    category: 3 },
  { id: "mahindramanulife", name: "Mahindra Manulife Mutual Fund",  category: 3 },
  { id: "motilal",      name: "Motilal Oswal Mutual Fund",          category: 3 },
  { id: "navi",         name: "Navi Mutual Fund",                   category: 3 },
  { id: "nippon",       name: "Nippon India Mutual Fund",           category: 3 },
  { id: "nj",           name: "NJ Mutual Fund",                     category: 3 },
  { id: "pgim",         name: "PGIM India Mutual Fund",             category: 3 },
  { id: "ppfas",        name: "PPFAS Mutual Fund",                  category: 3 },
  { id: "quantum",      name: "Quantum Mutual Fund",                category: 3 },
  { id: "quant",        name: "quant Mutual Fund",                  category: 3 },
  { id: "samco",        name: "Samco Mutual Fund",                  category: 3 },
  { id: "sbi",          name: "SBI Mutual Fund",                    category: 3 },
  { id: "shriram",      name: "Shriram Mutual Fund",                category: 3 },
  { id: "sundaram",     name: "Sundaram Mutual Fund",               category: 3 },
  { id: "tata",         name: "Tata Mutual Fund",                   category: 3 },
  { id: "taurus",       name: "Taurus Mutual Fund",                 category: 3 },
  { id: "trust",        name: "Trust Mutual Fund",                  category: 3 },
  { id: "union",        name: "Union Mutual Fund",                  category: 3 },
  { id: "whiteoak",     name: "WhiteOak Capital Mutual Fund",       category: 3 },
  { id: "zerodha",      name: "Zerodha Mutual Fund",                category: 3 },

  // ── Group D — Admin portal / declaration gate ────────────────────────────────
  // These AMCs have JS-rendered downloads or require clicking through a declaration.
  // Download manually from the AMC website, then upload here.
  { id: "abakkus",      name: "Abakkus Mutual Fund",                category: 4, note: "US person declaration popup — download manually from abakkusmf.com" },
  { id: "angelone",     name: "Angel One Mutual Fund",              category: 4, note: "JS-rendered links — download manually from angelonemf.com" },
  { id: "bandhan",      name: "Bandhan Mutual Fund",                category: 4, note: "URL not visible on hover — download manually from bandhanmutual.com" },
  { id: "capitalmind",  name: "Capitalmind Mutual Fund",            category: 4, note: "US person declaration popup — download manually from capitalmindmf.com" },
  { id: "choice",       name: "Choice Mutual Fund",                 category: 4, note: "JS-rendered links — download manually from choicemf.com" },
  { id: "iti",          name: "ITI Mutual Fund",                    category: 4, note: "JS-triggered download — download manually from itimf.com" },
  { id: "oldbridge",    name: "Old Bridge Mutual Fund",             category: 4, note: "US person declaration popup — download manually from oldbridgemf.com" },

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
