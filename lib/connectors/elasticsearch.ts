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

const COMPANY_SALES_ECOM_INDEX: Record<CompanyId, string> = {
  'varg': 'varg_sales_ecom',
  'sneaky-steve': 'sneaky_sales_ecom',
}

const COMPANY_AD_COSTS_INDEX: Record<CompanyId, string> = {
  'varg': 'varg_ad_costs',
  'sneaky-steve': 'sneaky_ad_costs',
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

  // ==================== Product Performance (Sales) ====================

  /**
   * Fetch aggregated product performance data from ecom sales index
   */
  async fetchProductPerformance(
    company: CompanyId,
    startDate: string,
    endDate: string
  ): Promise<{
    products: Array<{
      productNumber: string
      productName: string
      salesQuantity: number
      returnQuantity: number
      turnover: number
      turnoverBeforeReturns: number
      costs: number
      avgDiscountPercent: number
      orderCount: number
      customerAges: number[]
    }>
    totalOrderCount: number
  }> {
    const index = COMPANY_SALES_ECOM_INDEX[company]

    console.log(`[ES Performance] Fetching from ${index}, date range: ${startDate} to ${endDate}`)

    const result = await this.request<{
      aggregations?: {
        total_orders: { value: number }
        by_product: {
          buckets: Array<{
            key: string
            doc_count: number
            product_name: { buckets: Array<{ key: string }> }
            total_quantity: { value: number }
            total_returned: { value: number }
            total_turnover: { value: number }
            total_turnover_before_returns: { value: number }
            total_costs: { value: number }
            avg_discount: { value: number }
            unique_orders: { value: number }
            customer_ages_filtered: {
              doc_count: number
              median: { values: { '50.0': number | null } }
            }
          }>
        }
      }
    }>(`/${index}/_search`, {
      size: 0,
      query: {
        bool: {
          filter: [
            {
              range: {
                orderDate: {
                  gte: startDate,
                  lte: endDate,
                },
              },
            },
          ],
        },
      },
      aggs: {
        total_orders: {
          cardinality: {
            field: 'orderId.keyword',
          },
        },
        by_product: {
          terms: {
            field: 'productNumber.keyword',
            size: 10000,
          },
          aggs: {
            product_name: {
              terms: {
                field: 'productName.keyword',
                size: 1,
              },
            },
            total_quantity: {
              sum: { field: 'quantity' },
            },
            total_returned: {
              sum: { field: 'returnedQuantity' },
            },
            total_turnover: {
              sum: { field: 'totalPriceReturnsAdjusted' },
            },
            total_turnover_before_returns: {
              sum: { field: 'totalPrice' },
            },
            total_costs: {
              sum: { field: 'orderLineTotalCost' },
            },
            avg_discount: {
              avg: { field: 'discountPercent' },
            },
            unique_orders: {
              cardinality: {
                field: 'orderId.keyword',
              },
            },
            // Get customer ages for median calculation (filter out 0 values = unknown)
            customer_ages_filtered: {
              filter: {
                range: { customerAge: { gt: 0 } },
              },
              aggs: {
                median: {
                  percentiles: {
                    field: 'customerAge',
                    percents: [50],
                  },
                },
              },
            },
          },
        },
      },
    })

    const buckets = result.aggregations?.by_product.buckets || []
    const totalOrderCount = result.aggregations?.total_orders.value || 0

    console.log(`[ES Performance] Found ${buckets.length} products, ${totalOrderCount} total orders`)

    const products = buckets.map(bucket => ({
      productNumber: bucket.key,
      productName: bucket.product_name.buckets[0]?.key || bucket.key,
      salesQuantity: bucket.total_quantity.value || 0,
      returnQuantity: bucket.total_returned.value || 0,
      turnover: bucket.total_turnover.value || 0,
      turnoverBeforeReturns: bucket.total_turnover_before_returns.value || 0,
      costs: bucket.total_costs.value || 0,
      avgDiscountPercent: bucket.avg_discount.value || 0,
      orderCount: bucket.unique_orders.value || 0,
      customerAges: [], // We'll use percentile instead
      medianAge: bucket.customer_ages_filtered?.median?.values?.['50.0'] || null,
    }))

    return { products, totalOrderCount }
  }

  /**
   * Get total order count for a period (used for ad cost calculation)
   */
  async getOrderCountForPeriod(
    company: CompanyId,
    startDate: string,
    endDate: string
  ): Promise<number> {
    const index = COMPANY_SALES_ECOM_INDEX[company]

    const result = await this.request<{
      aggregations?: {
        unique_orders: { value: number }
      }
    }>(`/${index}/_search`, {
      size: 0,
      query: {
        bool: {
          filter: [
            {
              range: {
                orderDate: {
                  gte: startDate,
                  lte: endDate,
                },
              },
            },
          ],
        },
      },
      aggs: {
        unique_orders: {
          cardinality: {
            field: 'orderId.keyword',
          },
        },
      },
    })

    return result.aggregations?.unique_orders.value || 0
  }

  // ==================== Ad Costs ====================

  /**
   * Fetch all ad costs for a company
   */
  async fetchAdCosts(company: CompanyId): Promise<Array<{
    id: string
    year: number
    month: number
    metaCost: number
    googleCost: number
    totalCost: number
    createdAt: string
    updatedAt: string
  }>> {
    const index = COMPANY_AD_COSTS_INDEX[company]

    try {
      const result = await this.request<{
        hits: {
          hits: Array<{
            _source: {
              id: string
              year: number
              month: number
              metaCost: number
              googleCost: number
              totalCost: number
              createdAt: string
              updatedAt: string
            }
          }>
        }
      }>(`/${index}/_search`, {
        size: 1000,
        sort: [{ year: 'desc' }, { month: 'desc' }],
      })

      return result.hits.hits.map(h => h._source)
    } catch {
      // Index might not exist yet
      console.log(`[ES] Ad costs index not found for ${company}`)
      return []
    }
  }

  /**
   * Save or update an ad cost entry
   */
  async saveAdCost(
    company: CompanyId,
    adCost: {
      year: number
      month: number
      metaCost: number
      googleCost: number
    }
  ): Promise<void> {
    const index = COMPANY_AD_COSTS_INDEX[company]
    const id = `${adCost.year}-${String(adCost.month).padStart(2, '0')}`
    const now = new Date().toISOString()

    const doc = {
      id,
      year: adCost.year,
      month: adCost.month,
      metaCost: adCost.metaCost,
      googleCost: adCost.googleCost,
      totalCost: adCost.metaCost + adCost.googleCost,
      createdAt: now,
      updatedAt: now,
    }

    await this.request(`/${index}/_doc/${id}`, doc)
    console.log(`[ES] Saved ad cost for ${company}: ${id}`)
  }

  /**
   * Delete an ad cost entry
   */
  async deleteAdCost(company: CompanyId, year: number, month: number): Promise<void> {
    const index = COMPANY_AD_COSTS_INDEX[company]
    const id = `${year}-${String(month).padStart(2, '0')}`

    const response = await fetch(`${this.baseUrl}/${index}/_doc/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `ApiKey ${this.apiKey}`,
      },
    })

    if (!response.ok && response.status !== 404) {
      const errorText = await response.text()
      throw new Error(`Failed to delete ad cost: ${response.status} - ${errorText}`)
    }

    console.log(`[ES] Deleted ad cost for ${company}: ${id}`)
  }

  // ==================== Product Performance Detail ====================

  /**
   * Fetch detailed performance data for a single product with variant and period breakdown
   * @param yearOffset - 0 for current year, 1 for same period last year (for YoY comparison)
   */
  async fetchProductPerformanceDetail(
    company: CompanyId,
    productNumber: string,
    yearOffset = 0
  ): Promise<{
    variants: Array<{
      variantNumber: string
      variantName: string
      periods: Array<{
        periodKey: string
        salesQuantity: number
        returnQuantity: number
        turnover: number
        costs: number
        avgDiscountPercent: number
        medianCustomerAge: number | null
      }>
    }>
  }> {
    const index = COMPANY_SALES_ECOM_INDEX[company]

    // Always use 12-month rolling periods with 14-day offset
    // yearOffset shifts all dates back by 1 year for YoY comparison
    const yearSuffix = yearOffset > 0 ? `-${yearOffset}y` : ''
    console.log(`[ES Performance Detail] Fetching ${productNumber} from ${index} (rolling 12M with 14d offset${yearOffset > 0 ? `, yearOffset=${yearOffset}` : ''})`)

    // Always filter to last 12 months with 14-day offset (to allow returns to settle)
    // If yearOffset > 0, shift back by that many years
    const dateFilter = {
      range: {
        orderDate: {
          gte: `now-12M-14d${yearSuffix}`,
          lte: `now-14d${yearSuffix}`,
        },
      },
    }

    // Always use rolling 12-month periods with 14-day offset
    // If yearOffset > 0, shift all periods back by that many years
    const periodRanges = [
      { key: '0-3m', from: `now-3M-14d${yearSuffix}`, to: `now-14d${yearSuffix}` },
      { key: '3-6m', from: `now-6M-14d${yearSuffix}`, to: `now-3M-14d${yearSuffix}` },
      { key: '6-9m', from: `now-9M-14d${yearSuffix}`, to: `now-6M-14d${yearSuffix}` },
      { key: '9-12m', from: `now-12M-14d${yearSuffix}`, to: `now-9M-14d${yearSuffix}` },
    ]

    // Use date_range aggregation for period breakdown
    const result = await this.request<{
      aggregations?: {
        by_variant: {
          buckets: Array<{
            key: string
            doc_count: number
            variant_name: { buckets: Array<{ key: string }> }
            by_period: {
              buckets: Array<{
                key: string
                from_as_string?: string
                to_as_string?: string
                doc_count: number
                sales: { value: number }
                returns: { value: number }
                turnover: { value: number }
                costs: { value: number }
                avg_discount: { value: number | null }
                customer_ages_filtered: {
                  doc_count: number
                  median: { values: { '50.0': number | null } }
                }
              }>
            }
          }>
        }
      }
    }>(`/${index}/_search`, {
      size: 0,
      query: {
        bool: {
          filter: [
            { term: { 'productNumber.keyword': productNumber } },
            dateFilter,
          ],
        },
      },
      aggs: {
        by_variant: {
          terms: {
            field: 'variantNumber.keyword',
            size: 100,
          },
          aggs: {
            variant_name: {
              terms: {
                field: 'variantName.keyword',
                size: 1,
              },
            },
            by_period: {
              date_range: {
                field: 'orderDate',
                ranges: periodRanges,
              },
              aggs: {
                sales: { sum: { field: 'quantity' } },
                returns: { sum: { field: 'returnedQuantity' } },
                turnover: { sum: { field: 'totalPriceReturnsAdjusted' } },
                costs: { sum: { field: 'orderLineTotalCost' } },
                avg_discount: { avg: { field: 'discountPercent' } },
                customer_ages_filtered: {
                  filter: {
                    range: { customerAge: { gt: 0 } },
                  },
                  aggs: {
                    median: {
                      percentiles: {
                        field: 'customerAge',
                        percents: [50],
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    })

    const variantBuckets = result.aggregations?.by_variant.buckets || []

    console.log(`[ES Performance Detail] Found ${variantBuckets.length} variants`)

    const variants = variantBuckets.map(variantBucket => ({
      variantNumber: variantBucket.key,
      variantName: variantBucket.variant_name.buckets[0]?.key || variantBucket.key,
      periods: variantBucket.by_period.buckets.map(periodBucket => ({
        periodKey: periodBucket.key,
        salesQuantity: periodBucket.sales.value || 0,
        returnQuantity: periodBucket.returns.value || 0,
        turnover: periodBucket.turnover.value || 0,
        costs: periodBucket.costs.value || 0,
        avgDiscountPercent: periodBucket.avg_discount.value || 0,
        medianCustomerAge: periodBucket.customer_ages_filtered?.median?.values?.['50.0'] || null,
      })),
    }))

    return { variants }
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
