import type { Env } from '@/types'
import type { StockItem } from '@/types/inventory'

export interface StockHistoryItem {
  date: string
  variantId: number
  variantName: string
  size: string
  physicalQuantity: number
}

type CompanyId = 'varg' | 'sneaky-steve'

const COMPANY_INDEX_PREFIX: Record<CompanyId, string> = {
  'varg': 'varg_stock',
  'sneaky-steve': 'sneaky_stock',
}

export class ElasticsearchConnector {
  private baseUrl: string
  private apiKey: string

  constructor(env: Env) {
    this.baseUrl = env.ELASTICSEARCH_URL as string
    this.apiKey = env.ELASTICSEARCH_API_KEY as string

    if (!this.baseUrl || !this.apiKey) {
      throw new Error('Missing Elasticsearch credentials')
    }
  }

  private async request<T>(path: string, body?: object): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        'Authorization': `ApiKey ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Elasticsearch request failed: ${response.status} - ${errorText}`)
    }

    return response.json()
  }

  async fetchStock(company: CompanyId): Promise<{ items: StockItem[], lastUpdated: string }> {
    const indexPrefix = COMPANY_INDEX_PREFIX[company]

    // First, find the latest index and date
    const latestInfo = await this.findLatestStockDate(indexPrefix)
    if (!latestInfo) {
      return { items: [], lastUpdated: 'N/A' }
    }

    // Fetch all stock items for the latest date
    const items = await this.fetchStockForDate(indexPrefix, latestInfo.date)

    return { items, lastUpdated: latestInfo.date }
  }

  private async findLatestStockDate(indexPrefix: string): Promise<{ index: string, date: string } | null> {
    // Search across all stock indices, get the max date
    const result = await this.request<{
      aggregations?: {
        max_date: { value_as_string: string }
      }
    }>(`/${indexPrefix}-*/_search`, {
      size: 0,
      aggs: {
        max_date: {
          max: { field: 'date' }
        }
      }
    })

    const maxDate = result.aggregations?.max_date?.value_as_string
    if (!maxDate) {
      return null
    }

    // Extract just the date part (YYYY-MM-DD)
    const date = maxDate.split('T')[0]
    const [year, month] = date.split('-')
    const index = `${indexPrefix}-${year}-${month}`

    return { index, date }
  }

  private async fetchStockForDate(indexPrefix: string, date: string): Promise<StockItem[]> {
    // Determine the specific index for this date
    const [year, month] = date.split('-')
    const specificIndex = `${indexPrefix}-${year}-${month}`

    const allItems: StockItem[] = []
    let searchAfter: number[] | undefined

    do {
      const body: Record<string, unknown> = {
        size: 10000,
        query: {
          term: { date }
        },
        sort: ['_doc'],
        _source: [
          'productNumber',
          'productName',
          'productId',
          'variantId',
          'variantName',
          'variantNumber',
          'size',
          'sizeNumber',
          'EAN',
          'folder',
          'image',
          'physicalQuantity',
          'incomingQuantity',
          'date',
        ],
      }

      if (searchAfter) {
        body.search_after = searchAfter
      }

      const result = await this.request<{
        hits: {
          hits: Array<{
            _source: StockItem
            sort: number[]
          }>
        }
      }>(`/${specificIndex}/_search`, body)

      const hits = result.hits.hits
      if (hits.length === 0) break

      allItems.push(...hits.map(h => h._source))
      searchAfter = hits[hits.length - 1].sort
    } while (true)

    return allItems
  }

  async fetchStockHistory(
    company: CompanyId,
    productNumber: string,
    days: number | 'all'
  ): Promise<StockHistoryItem[]> {
    const indexPrefix = COMPANY_INDEX_PREFIX[company]

    // Build date range query
    const now = new Date()
    let dateQuery: object

    if (days === 'all') {
      // No date filter - get all historical data
      dateQuery = { match_all: {} }
    } else {
      const startDate = new Date(now)
      startDate.setDate(startDate.getDate() - days)
      dateQuery = {
        range: {
          date: {
            gte: startDate.toISOString().split('T')[0],
            lte: now.toISOString().split('T')[0],
          }
        }
      }
    }

    console.log(`[ES History] Fetching history for ${productNumber}, days: ${days}, index: ${indexPrefix}-*`)

    const allItems: StockHistoryItem[] = []
    let searchAfter: unknown[] | undefined

    do {
      const body: Record<string, unknown> = {
        size: 10000,
        query: {
          bool: {
            must: [
              { term: { 'productNumber.keyword': productNumber } }, // Use keyword for exact match
              dateQuery,
            ]
          }
        },
        sort: [{ date: 'asc' }, '_doc'],
        _source: [
          'date',
          'variantId',
          'variantName',
          'size',
          'physicalQuantity',
        ],
      }

      if (searchAfter) {
        body.search_after = searchAfter
      }

      console.log(`[ES History] Query:`, JSON.stringify(body.query, null, 2))

      const result = await this.request<{
        hits: {
          hits: Array<{
            _source: StockHistoryItem
            sort: unknown[]
          }>
        }
      }>(`/${indexPrefix}-*/_search`, body)

      const hits = result.hits.hits
      console.log(`[ES History] Got ${hits.length} hits`)

      if (hits.length === 0) break

      allItems.push(...hits.map(h => h._source))
      searchAfter = hits[hits.length - 1].sort

      // Safety check to avoid infinite loops
      if (hits.length < 10000) break
    } while (true)

    console.log(`[ES History] Total items: ${allItems.length}`)
    return allItems
  }
}
