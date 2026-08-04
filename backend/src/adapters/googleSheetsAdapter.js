const { parse } = require("csv-parse/sync");

// Fetches the published roster CSV and returns an array of row objects.
// Each row looks like: { "Staff ID": "S001", "Staff Name": "Andrea Chua", "Date": "2026-07-01", "Clock In": "08:00", "Clock Out": "17:00" }
async function fetchRosterRows() {
  const url = process.env.ROSTER_SHEET_CSV_URL;

  if (!url) {
    throw new Error("ROSTER_SHEET_CSV_URL is not set in .env");
  }

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch roster sheet: ${response.status} ${response.statusText}`);
  }

  const csvText = await response.text();

  const rows = parse(csvText, {
    columns: true,       // use first row as headers
    skip_empty_lines: true,
    trim: true,
  });

  return rows;
}

module.exports = { fetchRosterRows };