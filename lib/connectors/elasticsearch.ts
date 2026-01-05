import type { Env } from '@/types'
import type { StockItem } from '@/types/inventory'

// Exchange rate document stored in Elasticsearch
export interface ESExchangeRate {
  currency: string
  date: string
  rate: number
}

export interface StockHistoryItem {
  date: string
  variantId: number
  variantName: string
  size: string
  physicalQuantity: number
}

// Purchase delivery document stored in Elasticsearch
export interface ESPurchaseDelivery {
  id: string  // {productSizeId}_{deliveryId}
  createdAt: string
  EAN: string | null
  productId: number
  productName: string
  productNumber: string
  productVariantName: string
  productVariantId: number
  productVariantNumber: string
  productSizeId: number
  sizeNumber: string | null
  quantity: number
  purchaseOrderDelivery: {
    id: string
    status: string
    createdAt: string
    purchaseOrderId: number
    purchaseOrderCreatedAt: string
    supplier: string
  }
  // Original currency values
  currency: string             // Original currency code (USD, EUR, SEK)
  exchangeRate: number         // Exchange rate to SEK at delivery date
  unitCost: number
  unitCustomsCost: number
  unitShippingCost: number
  unitTotalCost: number
  totalProductCost: number
  totalCustomsCost: number
  totalShippingCost: number
  totalCost: number
  // SEK converted values
  unitCostSEK: number
  unitCustomsCostSEK: number
  unitShippingCostSEK: number
  unitTotalCostSEK: number
  totalProductCostSEK: number
  totalCustomsCostSEK: number
  totalShippingCostSEK: number
  totalCostSEK: number
  error: boolean
}

type CompanyId = 'varg' | 'sneaky-steve'

const COMPANY_INDEX_PREFIX: Record<CompanyId, string> = {
  'varg': 'varg_stock',
  'sneaky-steve': 'sneaky_stock',
}

const COMPANY_PO_DELIVERY_INDEX: Record<CompanyId, string> = {
  'varg': 'varg_purchasing_order_deliveries_v2',
  'sneaky-steve': 'sneaky_purchasing_order_deliveries_v2',
}

const COMPANY_STOCK_CHANGES_INDEX: Record<CompanyId, string> = {
  'varg': 'varg_stock_changes_v1',
  'sneaky-steve': 'sneaky_stock_changes_v1',
}

// Stock change document stored in Elasticsearch
export interface ESStockChange {
  id: string  // {productSizeId}_{stockChangeId}
  createdAt: string
  EAN: string | null
  productId: number
  productName: string
  productNumber: string
  productVariantName: string
  productVariantId: number
  productVariantNumber: string
  productSizeId: number
  sizeNumber: string | null
  quantity: number
  stockChange: {
    id: string
    type: string
    comment: string
    warehouse: string | null
  }
  // Original currency values
  currency: string
  exchangeRate: number
  unitCost: number
  totalCost: number
  // SEK converted values
  unitCostSEK: number
  totalCostSEK: number
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

  /**
   * Get the maximum delivery ID currently indexed for a company
   * Used for incremental sync from Centra
   */
  async getMaxDeliveryId(company: CompanyId): Promise<number | null> {
    const index = COMPANY_PO_DELIVERY_INDEX[company]

    try {
      // Sort by delivery ID descending, get the first one
      const result = await this.request<{
        hits: {
          hits: Array<{
            _source: { purchaseOrderDelivery: { id: string } }
          }>
        }
      }>(`/${index}/_search`, {
        size: 1,
        sort: [{ createdAt: 'desc' }],
        _source: ['purchaseOrderDelivery.id'],
      })

      const hits = result.hits.hits
      if (hits.length === 0) return null

      const deliveryId = hits[0]._source.purchaseOrderDelivery.id
      return parseInt(deliveryId, 10)
    } catch (error) {
      // Index might not exist yet
      console.log(`[ES] No delivery index found for ${company}:`, error)
      return null
    }
  }

  /**
   * Save purchase deliveries to Elasticsearch using bulk indexing
   */
  async savePurchaseDeliveries(company: CompanyId, deliveries: ESPurchaseDelivery[]): Promise<{ indexed: number; errors: number }> {
    if (deliveries.length === 0) {
      return { indexed: 0, errors: 0 }
    }

    const index = COMPANY_PO_DELIVERY_INDEX[company]

    // Build bulk request body
    // Format: action\ndocument\naction\ndocument\n...
    const bulkBody = deliveries.flatMap(doc => [
      JSON.stringify({ index: { _index: index, _id: doc.id } }),
      JSON.stringify(doc),
    ]).join('\n') + '\n'

    const response = await fetch(`${this.baseUrl}/_bulk`, {
      method: 'POST',
      headers: {
        'Authorization': `ApiKey ${this.apiKey}`,
        'Content-Type': 'application/x-ndjson',
      },
      body: bulkBody,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Elasticsearch bulk request failed: ${response.status} - ${errorText}`)
    }

    const result = await response.json() as {
      errors: boolean
      items: Array<{ index: { status: number; error?: object } }>
    }

    const errorCount = result.items.filter(item => item.index.error).length
    const indexedCount = result.items.filter(item => !item.index.error).length

    if (result.errors) {
      console.log(`[ES] Bulk indexing completed with ${errorCount} errors`)
    }

    return { indexed: indexedCount, errors: errorCount }
  }

  /**
   * Fetch all purchase deliveries for FIFO calculation
   */
  async fetchPurchaseDeliveries(company: CompanyId): Promise<ESPurchaseDelivery[]> {
    const index = COMPANY_PO_DELIVERY_INDEX[company]
    const allDeliveries: ESPurchaseDelivery[] = []
    let searchAfter: unknown[] | undefined

    do {
      const body: Record<string, unknown> = {
        size: 10000,
        sort: [{ createdAt: 'asc' }, '_doc'],  // Oldest first for FIFO
        _source: true,
      }

      if (searchAfter) {
        body.search_after = searchAfter
      }

      const result = await this.request<{
        hits: {
          hits: Array<{
            _source: ESPurchaseDelivery
            sort: unknown[]
          }>
        }
      }>(`/${index}/_search`, body)

      const hits = result.hits.hits
      if (hits.length === 0) break

      allDeliveries.push(...hits.map(h => h._source))
      searchAfter = hits[hits.length - 1].sort

      if (hits.length < 10000) break
    } while (true)

    return allDeliveries
  }

  /**
   * Fetch purchase deliveries with pagination and sorting for list view
   */
  async fetchPurchaseDeliveriesPaginated(
    company: CompanyId,
    options: {
      page: number
      pageSize: number
      sortBy: string
      sortOrder: 'asc' | 'desc'
    }
  ): Promise<{ deliveries: ESPurchaseDelivery[]; total: number }> {
    const index = COMPANY_PO_DELIVERY_INDEX[company]
    const { page, pageSize, sortBy, sortOrder } = options

    // Map sortBy to ES field names
    const sortFieldMap: Record<string, string> = {
      createdAt: 'createdAt',
      supplier: 'purchaseOrderDelivery.supplier.keyword',
      productNumber: 'productNumber.keyword',
      productName: 'productName.keyword',
      quantity: 'quantity',
      unitCostSEK: 'unitTotalCostSEK',
      totalCostSEK: 'totalCostSEK',
    }

    const sortField = sortFieldMap[sortBy] || 'createdAt'

    try {
      const result = await this.request<{
        hits: {
          total: { value: number }
          hits: Array<{
            _source: ESPurchaseDelivery
          }>
        }
      }>(`/${index}/_search`, {
        from: page * pageSize,
        size: pageSize,
        sort: [{ [sortField]: sortOrder }],
        _source: true,
      })

      return {
        deliveries: result.hits.hits.map(h => h._source),
        total: result.hits.total.value,
      }
    } catch (error) {
      // Index might not exist yet
      console.log(`[ES] Failed to fetch deliveries for ${company}:`, error)
      return { deliveries: [], total: 0 }
    }
  }

  /**
   * Fetch all purchase deliveries for a specific product
   * Used for purchase history display (includes all deliveries, not just remaining stock)
   */
  async fetchPurchaseDeliveriesByProduct(
    company: CompanyId,
    productNumber: string
  ): Promise<ESPurchaseDelivery[]> {
    const index = COMPANY_PO_DELIVERY_INDEX[company]
    console.log(`[ES] fetchPurchaseDeliveriesByProduct: index=${index}, productNumber=${productNumber}`)

    try {
      const allDeliveries: ESPurchaseDelivery[] = []
      let searchAfter: unknown[] | undefined

      do {
        const body: Record<string, unknown> = {
          size: 1000,
          query: {
            // Use prefix match because delivery productNumber format is {productNumber}{variantNumber}
            // e.g., stock has "1000597" but deliveries have "10005970005"
            prefix: { 'productNumber.keyword': productNumber }
          },
          sort: [{ createdAt: 'desc' }, '_doc'],  // Newest first for history display
          _source: true,
        }
        console.log(`[ES] Query body:`, JSON.stringify(body.query))

        if (searchAfter) {
          body.search_after = searchAfter
        }

        const result = await this.request<{
          hits: {
            hits: Array<{
              _source: ESPurchaseDelivery
              sort: unknown[]
            }>
          }
        }>(`/${index}/_search`, body)

        const hits = result.hits.hits
        if (hits.length === 0) break

        allDeliveries.push(...hits.map(h => h._source))
        searchAfter = hits[hits.length - 1].sort

        if (hits.length < 1000) break
      } while (true)

      return allDeliveries
    } catch (error) {
      console.log(`[ES] Failed to fetch deliveries for product ${productNumber}:`, error)
      return []
    }
  }

  /**
   * Get the max stock change ID in ES for incremental sync
   */
  async getMaxStockChangeId(company: CompanyId): Promise<number | null> {
    const index = COMPANY_STOCK_CHANGES_INDEX[company]

    try {
      const result = await this.request<{
        aggregations?: {
          max_id: { value: number | null }
        }
      }>(`/${index}/_search`, {
        size: 0,
        aggs: {
          max_id: {
            max: {
              field: 'stockChange.id',
            },
          },
        },
      })

      const maxId = result.aggregations?.max_id?.value
      return maxId ? Math.floor(maxId) : null
    } catch {
      return null
    }
  }

  /**
   * Bulk index stock changes to Elasticsearch
   */
  async saveStockChanges(
    company: CompanyId,
    stockChanges: ESStockChange[]
  ): Promise<{ indexed: number; errors: number }> {
    if (stockChanges.length === 0) {
      return { indexed: 0, errors: 0 }
    }

    const index = COMPANY_STOCK_CHANGES_INDEX[company]

    // Build bulk request body
    const bulkBody = stockChanges.flatMap(doc => [
      { index: { _index: index, _id: doc.id } },
      doc,
    ])

    const response = await fetch(`${this.baseUrl}/_bulk`, {
      method: 'POST',
      headers: {
        'Authorization': `ApiKey ${this.apiKey}`,
        'Content-Type': 'application/x-ndjson',
      },
      body: bulkBody.map(line => JSON.stringify(line)).join('\n') + '\n',
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Elasticsearch bulk indexing failed: ${response.status} - ${errorText}`)
    }

    const result = await response.json() as {
      errors: boolean
      items: Array<{ index: { status: number; error?: object } }>
    }

    const errorCount = result.items.filter(item => item.index.error).length
    const indexedCount = result.items.filter(item => !item.index.error).length

    if (result.errors) {
      console.log(`[ES] Stock changes bulk indexing completed with ${errorCount} errors`)
    }

    return { indexed: indexedCount, errors: errorCount }
  }

  /**
   * Fetch all stock changes for FIFO calculation
   */
  async fetchStockChanges(company: CompanyId): Promise<ESStockChange[]> {
    const index = COMPANY_STOCK_CHANGES_INDEX[company]
    const allChanges: ESStockChange[] = []
    let searchAfter: unknown[] | undefined

    try {
      do {
        const body: Record<string, unknown> = {
          size: 10000,
          sort: [{ createdAt: 'asc' }, '_doc'],
          _source: true,
        }

        if (searchAfter) {
          body.search_after = searchAfter
        }

        const result = await this.request<{
          hits: {
            hits: Array<{
              _source: ESStockChange
              sort: unknown[]
            }>
          }
        }>(`/${index}/_search`, body)

        const hits = result.hits.hits
        if (hits.length === 0) break

        allChanges.push(...hits.map(h => h._source))
        searchAfter = hits[hits.length - 1].sort

        if (hits.length < 10000) break
      } while (true)
    } catch {
      // Index might not exist yet
      console.log(`[ES] Stock changes index not found for ${company}`)
    }

    return allChanges
  }

  // ==================== Exchange Rates ====================

  private readonly EXCHANGE_RATE_INDEX = 'exchange_rates'

  /**
   * Fetch all cached exchange rates for a currency
   */
  async fetchExchangeRates(currency: string): Promise<Map<string, number>> {
    const rates = new Map<string, number>()

    try {
      let searchAfter: unknown[] | undefined

      do {
        const body: Record<string, unknown> = {
          size: 10000,
          query: {
            term: { 'currency.keyword': currency }
          },
          sort: [{ date: 'asc' }],
          _source: ['date', 'rate'],
        }

        if (searchAfter) {
          body.search_after = searchAfter
        }

        const result = await this.request<{
          hits: {
            hits: Array<{
              _source: { date: string; rate: number }
              sort: unknown[]
            }>
          }
        }>(`/${this.EXCHANGE_RATE_INDEX}/_search`, body)

        const hits = result.hits.hits
        if (hits.length === 0) break

        for (const hit of hits) {
          rates.set(hit._source.date, hit._source.rate)
        }

        searchAfter = hits[hits.length - 1].sort
        if (hits.length < 10000) break
      } while (true)
    } catch (error) {
      // Index might not exist yet
      console.log(`[ES] Exchange rates index not found:`, error)
    }

    return rates
  }

  /**
   * Save exchange rates to Elasticsearch using bulk indexing
   */
  async saveExchangeRates(rates: ESExchangeRate[]): Promise<{ indexed: number; errors: number }> {
    if (rates.length === 0) {
      return { indexed: 0, errors: 0 }
    }

    // Build bulk request body
    const bulkBody = rates.flatMap(doc => [
      JSON.stringify({ index: { _index: this.EXCHANGE_RATE_INDEX, _id: `${doc.currency}_${doc.date}` } }),
      JSON.stringify(doc),
    ]).join('\n') + '\n'

    const response = await fetch(`${this.baseUrl}/_bulk`, {
      method: 'POST',
      headers: {
        'Authorization': `ApiKey ${this.apiKey}`,
        'Content-Type': 'application/x-ndjson',
      },
      body: bulkBody,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Elasticsearch bulk request failed: ${response.status} - ${errorText}`)
    }

    const result = await response.json() as {
      errors: boolean
      items: Array<{ index: { status: number; error?: object } }>
    }

    const errorCount = result.items.filter(item => item.index.error).length
    const indexedCount = result.items.filter(item => !item.index.error).length

    if (result.errors) {
      console.log(`[ES] Exchange rates bulk indexing completed with ${errorCount} errors`)
    }

    return { indexed: indexedCount, errors: errorCount }
  }
}
