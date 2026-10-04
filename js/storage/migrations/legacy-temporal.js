import { validateUtterance } from "../../../data/schema.js";

// Convert only the temporal fields used by IndexedDB v1–v3. Never infer a day
// from createdAt, which is the recording time rather than the time of speaking.
export function migrateLegacyTemporal(record) {
  if (record.temporal) {
    validateUtterance(record);
    return record;
  }
  const value = structuredClone(record);
  const display = value.displayDate ?? null,
    precision = value.datePrecision || "unknown";
  let earliest = null,
    latest = null;
  if (display && precision === "month") {
    const match = String(display).match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})\b/i);
    if (match) {
      const month =
        ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(
          match[1].toLowerCase(),
        ) + 1;
      const year = Number(match[2]),
        mm = String(month).padStart(2, "0");
      earliest = `${year}-${mm}-01`;
      latest = `${year}-${mm}-${new Date(Date.UTC(year, month, 0)).getUTCDate()}`;
    }
  } else if (display && precision === "year") {
    const match = String(display).match(/\b(\d{4})\b/);
    if (match) {
      earliest = match[1] + "-01-01";
      latest = match[1] + "-12-31";
    }
  } else if (value.spokenAt && (precision === "day" || precision === "exact")) {
    earliest = precision === "exact" ? String(value.spokenAt) : String(value.spokenAt).slice(0, 10);
    latest = earliest;
  }
  value.temporal = { earliest, latest, precision, display };
  delete value.spokenAt;
  delete value.datePrecision;
  delete value.displayDate;
  validateUtterance(value);
  return value;
}
