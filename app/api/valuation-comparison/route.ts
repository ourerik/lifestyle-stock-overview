import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { ValuationComparisonService } from '@/lib/services/valuation-comparison'
import type { CompanyId } from '@/config/companies'
import type { Env } from '@/types'
import * as fs from 'fs'
import * as path from 'path'

const VALID_COMPANIES: Exclude<CompanyId, 'all'>[] = ['varg', 'sneaky-steve']

// CSV file path (in project root)
const CSV_FILE_MAP: Record<string, string> = {
  'varg': 'vargStockDecember.csv',
}

export async function GET(request: NextRequest) {
  // Check authentication
  const session = await auth0.getSession(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse query params
  const searchParams = request.nextUrl.searchParams
  const company = searchParams.get('company') as Exclude<CompanyId, 'all'>
  const date = searchParams.get('date') || '2025-01-01'

  // Validate params
  if (!company || !VALID_COMPANIES.includes(company)) {
    return NextResponse.json(
      { error: 'Invalid company parameter. Must be "varg" or "sneaky-steve"' },
      { status: 400 }
    )
  }

  // Check if we have a CSV file for this company
  const csvFileName = CSV_FILE_MAP[company]
  if (!csvFileName) {
    return NextResponse.json(
      { error: `No Centra CSV file configured for ${company}` },
      { status: 400 }
    )
  }

  try {
    const env: Env = process.env as unknown as Env
    const service = new ValuationComparisonService(env)

    // Read Centra CSV file from project root
    const projectRoot = process.cwd()
    const csvPath = path.join(projectRoot, csvFileName)

    if (!fs.existsSync(csvPath)) {
      return NextResponse.json(
        { error: `CSV file not found: ${csvFileName}` },
        { status: 404 }
      )
    }

    console.log(`[API] Reading Centra CSV from: ${csvPath}`)
    const csvContent = fs.readFileSync(csvPath, 'utf-8')

    // Parse CSV
    const centraData = service.parseCentraCSV(csvContent)
    console.log(`[API] Parsed ${centraData.length} rows from Centra CSV`)

    // Run comparison
    const { comparisons, summary } = await service.runComparison(company, centraData, date)
    console.log(`[API] Comparison complete: ${comparisons.length} items compared`)

    // Generate CSV content
    const csvOutput = service.generateCSV(comparisons, summary)

    // Return as CSV file download
    const fileName = `valuation-comparison-${company}-${date}.csv`

    return new NextResponse(csvOutput, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    })
  } catch (error) {
    console.error('Failed to generate valuation comparison:', error)
    return NextResponse.json(
      { error: 'Failed to generate valuation comparison', details: String(error) },
      { status: 500 }
    )
  }
}
