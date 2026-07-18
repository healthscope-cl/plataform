import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { parseSpreadsheet } from './parseFile'

function buildWorkbookBuffer(rows: (string | number)[][]): ArrayBuffer {
  const worksheet = XLSX.utils.aoa_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1')
  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
}

describe('parseSpreadsheet', () => {
  it('extracts headers from the first row and rows as header-keyed objects', () => {
    const buffer = buildWorkbookBuffer([
      ['RUT', 'Fecha inicio', 'Días'],
      ['12.345.678-9', '2026-01-05', 3],
      ['11.111.111-1', '2026-02-10', 10],
    ])

    const result = parseSpreadsheet(buffer)

    expect(result.headers).toEqual(['RUT', 'Fecha inicio', 'Días'])
    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toEqual({ RUT: '12.345.678-9', 'Fecha inicio': '2026-01-05', Días: 3 })
  })

  it('returns an empty rows array for a header-only file', () => {
    const buffer = buildWorkbookBuffer([['RUT', 'Fecha inicio', 'Días']])
    const result = parseSpreadsheet(buffer)
    expect(result.headers).toEqual(['RUT', 'Fecha inicio', 'Días'])
    expect(result.rows).toEqual([])
  })
})
