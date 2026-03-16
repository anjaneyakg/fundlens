// src/data/amcList.js
// Master list of all AMCs — used by the Admin upload page

export const AMC_LIST = [
  // Cat 4 — manual download always required
  { id: "bajaj",        name: "Bajaj Finserv Mutual Fund",          category: 4, note: "S3 blocked — download from bajajamc.com" },

  // Cat 1 — URL pattern (auto in pipeline, manual here as backup)
  { id: "360one",       name: "360 ONE Mutual Fund",                category: 1 },
  { id: "adityabirla",  name: "Aditya Birla Sun Life Mutual Fund",  category: 1 },
  { id: "axis",         name: "Axis Mutual Fund",                   category: 1 },
  { id: "bankofindia",  name: "Bank of India Mutual Fund",          category: 1 },
  { id: "canararobeco", name: "Canara Robeco Mutual Fund",          category: 1 },
  { id: "dsp",          name: "DSP Mutual Fund",                    category: 1 },
  { id: "edelweiss",    name: "Edelweiss Mutual Fund",              category: 1 },
  { id: "franklin",     name: "Franklin Templeton Mutual Fund",     category: 1 },
  { id: "groww",        name: "Groww Mutual Fund",                  category: 1 },
  { id: "hdfc",         name: "HDFC Mutual Fund",                   category: 1 },
  { id: "icici",        name: "ICICI Prudential Mutual Fund",       category: 1 },
  { id: "kotak",        name: "Kotak Mahindra Mutual Fund",         category: 1 },
  { id: "lic",          name: "LIC Mutual Fund",                    category: 1 },
  { id: "mirae",        name: "Mirae Asset Mutual Fund",            category: 1 },
  { id: "nippon",       name: "Nippon India Mutual Fund",           category: 1 },
  { id: "sbi",          name: "SBI Mutual Fund",                    category: 1 },
  { id: "tata",         name: "Tata Mutual Fund",                   category: 1 },
  { id: "uti",          name: "UTI Mutual Fund",                    category: 1 },
  { id: "whiteoak",     name: "WhiteOak Capital Mutual Fund",       category: 1 },

  // Cat 3 — needs special handling (Phase 2)
  { id: "iti",          name: "ITI Mutual Fund",                    category: 3, note: "JS-triggered download — manual file required" },
  { id: "abakkus",      name: "Abakkus Asset Manager",              category: 3, note: "Pop-up declaration before page loads" },
  { id: "capitalmind",  name: "Capitalmind Mutual Fund",            category: 3, note: "Pop-up declaration before page loads" },
];

export const CAT_LABELS = {
  4: "Cat 4 — Manual always",
  1: "Cat 1 — URL pattern",
  3: "Cat 3 — JS / Playwright",
};
