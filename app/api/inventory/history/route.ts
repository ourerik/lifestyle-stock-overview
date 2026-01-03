import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { ElasticsearchConnector, StockHistoryItem } from '@/lib/connectors/elasticsearch'
import type { CompanyId } from '@/config/companies'
import type { Env } from '@/types'
import type { StockHistorySeries, StockHistoryData } from '@/types/inventory'

const VALID_COMPANIES: Exclude<CompanyId, 'all'>[] = ['varg', 'sneaky-steve']
const VALID_DAYS = [7, 30, 90, 'all'] as const

export async function GET(request: NextRequest) {
  // Check authentication
  const session = await auth0.getSession(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse query params
  const searchParams = request.nextUrl.searchParams
  const company = searchParams.get('company') as Exclude<CompanyId, 'all'>
  const productNumber = searchParams.get('productNumber')
  const daysParam = searchParams.get('days') || '30'
  const variantIdParam = searchParams.get('variantId')

  // Validate params
  if (!company || !VALID_COMPANIES.includes(company)) {
    return NextResponse.json(
      { error: 'Invalid company parameter' },
      { status: 400 }
    )
  }

  if (!productNumber) {
    return NextResponse.json(
      { error: 'Missing productNumber parameter' },
      { status: 400 }
    )
  }

  // Parse days param
  const days: number | 'all' = daysParam === 'all' ? 'all' : parseInt(daysParam, 10)
  if (days !== 'all' && (isNaN(days) || ![7, 30, 90].includes(days))) {
    return NextResponse.json(
      { error: 'Invalid days parameter. Must be 7, 30, 90, or "all"' },
      { status: 400 }
    )
  }

  try {
    const env: Env = process.env as unknown as Env
    const esConnector = new ElasticsearchConnector(env)
    const rawItems = await esConnector.fetchStockHistory(company, productNumber, days)

    // Parse variantId if provided
    const variantId = variantIdParam ? parseInt(variantIdParam, 10) : undefined

    // Aggregate the data into series
    const data = aggregateHistoryData(rawItems, variantId)

    return NextResponse.json(data)
  } catch (error) {
    console.error('Failed to fetch stock history:', error)
    return NextResponse.json(
      { error: 'Failed to fetch stock history' },
      { status: 500 }
    )
  }
}

function aggregateHistoryData(items: StockHistoryItem[], variantId?: number): StockHistoryData {
  // If variantId is provided, aggregate per-size for that variant
  if (variantId !== undefined) {
    return aggregateBySize(items.filter(item => item.variantId === variantId))
  }

  // Otherwise, aggregate per-variant with all sizes summed
  return aggregateByVariant(items)
}

function aggregateBySize(items: StockHistoryItem[]): StockHistoryData {
  // Group by size, then by date
  const sizeMap = new Map<string, Map<string, number>>()

  for (const item of items) {
    if (!sizeMap.has(item.size)) {
      sizeMap.set(item.size, new Map())
    }

    const dateMap = sizeMap.get(item.size)!
    dateMap.set(item.date, item.physicalQuantity)
  }

  // Build series - one per size
  const series: StockHistorySeries[] = []

  for (const [size, dateMap] of sizeMap) {
    const dataPoints: { date: string; quantity: number }[] = []

    // Get all dates sorted
    const dates = Array.from(dateMap.keys()).sort()

    for (const date of dates) {
      dataPoints.push({ date, quantity: dateMap.get(date) || 0 })
    }

    series.push({
      name: size,
      data: dataPoints,
    })
  }

  // Filter out series where all data points have quantity = 0
  const filteredSeries = series.filter(s =>
    s.data.some(point => point.quantity > 0)
  )

  // Sort series by size (try numeric first, then alphabetic)
  filteredSeries.sort((a, b) => {
    const numA = parseFloat(a.name)
    const numB = parseFloat(b.name)
    if (!isNaN(numA) && !isNaN(numB)) {
      return numA - numB
    }
    return a.name.localeCompare(b.name)
  })

  return { series: filteredSeries }
}

function aggregateByVariant(items: StockHistoryItem[]): StockHistoryData {
  // Group by variantId, then by date
  const variantMap = new Map<number, {
    name: string
    dateMap: Map<string, { sizes: Map<string, number> }>
  }>()

  for (const item of items) {
    if (!variantMap.has(item.variantId)) {
      variantMap.set(item.variantId, {
        name: item.variantName,
        dateMap: new Map(),
      })
    }

    const variant = variantMap.get(item.variantId)!
    if (!variant.dateMap.has(item.date)) {
      variant.dateMap.set(item.date, { sizes: new Map() })
    }

    const dateData = variant.dateMap.get(item.date)!
    dateData.sizes.set(item.size, item.physicalQuantity)
  }

  // Build series - one per variant with all sizes summed
  const series: StockHistorySeries[] = []

  for (const [variantId, variant] of variantMap) {
    const dataPoints: { date: string; quantity: number }[] = []

    // Get all dates sorted
    const dates = Array.from(variant.dateMap.keys()).sort()

    for (const date of dates) {
      const dateData = variant.dateMap.get(date)!
      // Sum all sizes for this variant on this date
      const totalQuantity = Array.from(dateData.sizes.values()).reduce((sum, q) => sum + q, 0)
      dataPoints.push({ date, quantity: totalQuantity })
    }

    series.push({
      name: variant.name,
      variantId,
      data: dataPoints,
    })
  }

  // Filter out series where all data points have quantity = 0
  const filteredSeries = series.filter(s =>
    s.data.some(point => point.quantity > 0)
  )

  // Sort series by variant name
  filteredSeries.sort((a, b) => a.name.localeCompare(b.name))

  return { series: filteredSeries }
}
