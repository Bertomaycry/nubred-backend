/**
 * One DocumentPage per worksheet.
 * @param {Buffer} buffer
 * @returns {Promise<string[]>}
 */
export async function extractSpreadsheetPages(buffer) {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();

  try {
    await workbook.xlsx.load(buffer);
  } catch {
    throw new Error(
      "Could not parse spreadsheet. Convert .xls files to .xlsx and retry."
    );
  }

  const pages = [];
  workbook.eachSheet((sheet) => {
    const lines = [`# ${sheet.name}`];
    sheet.eachRow((row) => {
      const values = row.values
        .slice(1)
        .map((cell) => (cell == null ? "" : String(cell)));
      lines.push(values.join("\t"));
    });
    pages.push(lines.join("\n").trimEnd());
  });

  return pages.length > 0 ? pages : [""];
}
