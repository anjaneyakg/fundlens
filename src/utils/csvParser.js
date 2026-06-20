// RFC 4180-aware CSV column parser.
// Handles quoted fields with embedded commas (e.g. '"CMFCF_March 31, 2026"').
// Does not handle embedded newlines — row-splitting still uses split('\n'),
// which is safe because merge_holdings.py v1.1 strips all embedded newlines.
export function parseCsvLine(line) {
  const result = []
  let current  = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++ // skip escaped quote
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  result.push(current)
  return result
}
