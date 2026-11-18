import ExcelJS from "exceljs";

// Turns any Excel cell value (number, text, rich text, formula, link) into trimmed text.
function cellText(v) {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join("").trim();
    if ("result" in v) return cellText(v.result);
    if ("text" in v) return String(v.text).trim();
    return "";
  }
  return String(v).trim();
}

// Student numbers that are plain digits become 4 digits: 1 -> 0001.
export function normalizeNo(no) {
  return /^\d+$/.test(no) ? no.padStart(4, "0") : no;
}

// Reads column A (student no) and column B (name) from the first sheet.
export async function readStudentSheet(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error("The workbook has no sheets.");

  const rows = [];
  ws.eachRow({ includeEmpty: false }, (row, line) => {
    const no = cellText(row.getCell(1).value);
    const name = cellText(row.getCell(2).value).replace(/\s+/g, " ");
    if (!no && !name) return;
    rows.push({ line, no, name });
  });

  // Skip a header row such as "Student No | Student Name".
  if (rows.length && !/^\d+$/.test(rows[0].no) && /name/i.test(rows[0].name)) rows.shift();

  return { sheet: ws.name, otherSheets: wb.worksheets.length - 1, rows };
}
