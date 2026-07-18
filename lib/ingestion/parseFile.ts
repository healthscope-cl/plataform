import * as XLSX from 'xlsx'

export type ParsedSpreadsheet = {
  headers: string[]
  rows: Record<string, unknown>[]
}

export function parseSpreadsheet(file: ArrayBuffer): ParsedSpreadsheet {
  const workbook = XLSX.read(file, { type: 'array' })
  const firstSheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[firstSheetName]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: null })
  const headers = rows.length > 0 ? Object.keys(rows[0]) : (XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0] as string[] | undefined) ?? []

  return { headers, rows }
}
