/**
 * Real binary Excel (.xlsx) workbook generator using lazy-loaded SheetJS (`xlsx`).
 * - 0 KB impact on initial app bundle (loaded on demand when user clicks Export Excel)
 * - Typed numeric cells (Excel formulas / SUM / sorting work natively)
 * - Safe string sanitization (neutralizes leading `=` formula injection while preserving `+40...` phones as literal strings)
 * - Auto-fit column widths (`!cols`) so columns open cleanly without `###`
 */

function sanitizeCellValue(val) {
  if (val === null || val === undefined) return ''
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0
  if (typeof val === 'boolean') return val
  const str = String(val)
  if (/^[=\t\r]/.test(str)) return `'${str}`
  return str
}

export async function exportSheetsToExcel(sheets, filename) {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()

  for (const sheetDef of sheets) {
    const rawRows = Array.isArray(sheetDef?.rows) ? sheetDef.rows : []
    const headers = Array.isArray(sheetDef?.headers) ? sheetDef.headers : null
    const safeRows = rawRows.map((row) => {
      const clean = {}
      for (const [k, v] of Object.entries(row)) {
        clean[k] = sanitizeCellValue(v)
      }
      return clean
    })

    const ws = safeRows.length > 0
      ? XLSX.utils.json_to_sheet(safeRows, headers ? { header: headers } : undefined)
      : XLSX.utils.aoa_to_sheet(headers ? [headers] : [['Date indisponibile']])

    const keys = headers || (safeRows.length > 0 ? Object.keys(safeRows[0]) : [])
    if (keys.length > 0) {
      ws['!cols'] = keys.map((k) => {
        let maxLen = String(k).length
        const sampleCount = Math.min(safeRows.length, 500)
        for (let i = 0; i < sampleCount; i++) {
          const len = String(safeRows[i][k] ?? '').length
          if (len > maxLen) maxLen = len
        }
        return { wch: Math.min(48, Math.max(10, maxLen + 3)) }
      })
    }

    // Excel sheet names max 31 chars and forbid \ / ? * [ ] :
    const safeSheetName = String(sheetDef?.name || 'Raport')
      .replace(/[\\/?*[\]:]/g, ' ')
      .trim()
      .slice(0, 31) || 'Raport'

    XLSX.utils.book_append_sheet(wb, ws, safeSheetName)
  }

  const finalName = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`
  XLSX.writeFile(wb, finalName, { bookType: 'xlsx' })
}
