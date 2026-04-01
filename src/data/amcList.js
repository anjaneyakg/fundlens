// src/data/amcList.js
// Master list of all 49 SEBI-registered AMCs — used by the Admin upload page
// Categories mirror amc_directory.json download_type:
//   Cat 4 — Manual always (S3 blocked or no direct URL)
//   Cat 1 — URL pattern known (auto in pipeline, manual here as backup)
//   Cat 3 — JS / Playwright / popup required (manual file always needed)
// Last updated: 02 Apr 2026 — all 49 AMCs added

export const AMC_LIST = [

  // ── Cat 4 — Manual always ──────────────────────────────────────────────────
  { id: "bajaj",        name: "Bajaj Finserv Mutual Fund",          category: 4, note: "S3 blocked — download manually from bajajamc.com" },

  // ── Cat 1 — URL pattern (consolidated file per AMC) ───────────────────────
  { id: "360one",       name: "360 ONE Mutual Fund",                category: 1 },
  { id: "adityabirla",  name: "Aditya Birla Sun Life Mutual Fund",  category: 1 },
  { id: "axis",         name: "Axis Mutual Fund",                   category: 1 },
  { id: "bankofindia",  name: "Bank of India Mutual Fund",          category: 1 },
  { id: "barodabnp",    name: "Baroda BNP Paribas Mutual Fund",     category: 1 },
  { id: "canararobeco", name: "Canara Robeco Mutual Fund",          category: 1 },
  { id: "dsp",          name: "DSP Mutual Fund",                    category: 1 },
  { id: "edelweiss",    name: "Edelweiss Mutual Fund",              category: 1 },
  { id: "franklin",     name: "Franklin Templeton Mutual Fund",     category: 1 },
  { id: "groww",        name: "Groww Mutual Fund",                  category: 1 },
  { id: "hdfc",         name: "HDFC Mutual Fund",                   category: 1 },
  { id: "helios",       name: "Helios Mutual Fund",                 category: 1 },
  { id: "hsbc",         name: "HSBC Mutual Fund",                   category: 1 },
  { id: "icici",        name: "ICICI Prudential Mutual Fund",       category: 1 },
  { id: "invesco",      name: "Invesco India Mutual Fund",          category: 1 },
  { id: "jioblackrock", name: "Jio BlackRock Mutual Fund",          category: 1 },
  { id: "jm",           name: "JM Financial Mutual Fund",           category: 1 },
  { id: "kotak",        name: "Kotak Mahindra Mutual Fund",         category: 1 },
  { id: "lic",          name: "LIC Mutual Fund",                    category: 1 },
  { id: "mahindramanulife", name: "Mahindra Manulife Mutual Fund",  category: 1 },
  { id: "mirae",        name: "Mirae Asset Mutual Fund",            category: 1 },
  { id: "motilal",      name: "Motilal Oswal Mutual Fund",          category: 1 },
  { id: "navi",         name: "Navi Mutual Fund",                   category: 1 },
  { id: "nippon",       name: "Nippon India Mutual Fund",           category: 1 },
  { id: "nj",           name: "NJ Mutual Fund",                     category: 1 },
  { id: "pgim",         name: "PGIM India Mutual Fund",             category: 1 },
  { id: "ppfas",        name: "PPFAS Mutual Fund",                  category: 1 },
  { id: "quantum",      name: "Quantum Mutual Fund",                category: 1 },
  { id: "quant",        name: "quant Mutual Fund",                  category: 1 },
  { id: "samco",        name: "Samco Mutual Fund",                  category: 1 },
  { id: "sbi",          name: "SBI Mutual Fund",                    category: 1 },
  { id: "shriram",      name: "Shriram Mutual Fund",                category: 1 },
  { id: "sundaram",     name: "Sundaram Mutual Fund",               category: 1 },
  { id: "tata",         name: "Tata Mutual Fund",                   category: 1 },
  { id: "taurus",       name: "Taurus Mutual Fund",                 category: 1 },
  { id: "trust",        name: "Trust Mutual Fund",                  category: 1 },
  { id: "unifi",        name: "Unifi Mutual Fund",                  category: 1 },
  { id: "union",        name: "Union Mutual Fund",                  category: 1 },
  { id: "uti",          name: "UTI Mutual Fund",                    category: 1 },
  { id: "wealthcompany",name: "The Wealth Company Mutual Fund",     category: 1 },
  { id: "whiteoak",     name: "WhiteOak Capital Mutual Fund",       category: 1 },

  // ── Cat 3 — JS / Playwright / popup required ───────────────────────────────
  { id: "angelone",     name: "Angel One Mutual Fund",              category: 3, note: "JS-rendered links — download file manually from angelonemf.com" },
  { id: "bandhan",      name: "Bandhan Mutual Fund",                category: 3, note: "URL not visible on hover — download file manually from bandhanmutual.com" },
  { id: "choice",       name: "Choice Mutual Fund",                 category: 3, note: "JS-rendered links — download file manually from choicemf.com" },
  { id: "iti",          name: "ITI Mutual Fund",                    category: 3, note: "JS-triggered download — download file manually from itimf.com" },
  { id: "abakkus",      name: "Abakkus Mutual Fund",                category: 3, note: "US person declaration popup — download file manually from abakkusmf.com" },
  { id: "capitalmind",  name: "Capitalmind Mutual Fund",            category: 3, note: "US person declaration popup — download file manually from capitalmindmf.com" },
  { id: "oldbridge",    name: "Old Bridge Mutual Fund",             category: 3, note: "US person declaration popup — download file manually from oldbridgemf.com" },

];

export const CAT_LABELS = {
  4: "Cat 4 — Manual always",
  1: "Cat 1 — URL pattern",
  3: "Cat 3 — JS / Playwright",
};
