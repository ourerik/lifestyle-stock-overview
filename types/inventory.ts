// Elasticsearch stock item (raw from ES)
export interface StockItem {
  productNumber: string
  productName: string
  productId: number
  variantId: number
  variantName: string
  variantNumber: string
  size: string
  sizeNumber: string
  EAN: string
  folder: string
  image: string
  physicalQuantity: number
  incomingQuantity: number
  date: string // YYYY-MM-DD
}

// Zettle inventory item
export interface ZettleInventoryItem {
  productUuid: string
  variantUuid: string
  barcode: string // EAN för matchning
  balance: number
}

// Size with quantities
export interface SizeStock {
  size: string
  sizeNumber: string
  quantity: number
  zettleQuantity: number
  incoming: number
  EAN: string
}

// Aggregated variant
export interface AggregatedVariant {
  variantId: number
  variantName: string
  variantNumber: string
  image: string
  totalQuantity: number
  zettleQuantity: number
  totalIncoming: number
  sizes: SizeStock[]
}

// Status types
export type ProductStatus = 'low' | 'incoming' | 'discontinued'

// Aggregated product
export interface AggregatedProduct {
  productNumber: string
  productName: string
  productId: number
  folder: string
  image: string
  totalQuantity: number
  totalZettleQuantity: number
  totalIncoming: number
  status: ProductStatus[]
  variants: AggregatedVariant[]
  // FIFO valuation data (optional, populated when available)
  fifoValue?: number      // Total inventory value (SEK)
  fifoCost?: number       // Weighted average cost per unit (SEK)
}

// Inventory summary
export interface InventorySummary {
  totalProducts: number
  totalVariants: number
  totalQuantity: number
  totalZettleQuantity: number
  lowStockCount: number
  incomingCount: number
  lastUpdated: string // Senaste datum från data
}

// Full inventory response
export interface InventoryData {
  products: AggregatedProduct[]
  folders: string[]
  summary: InventorySummary
  fifoSummary?: import('@/types/fifo').FifoSummary  // Optional FIFO summary with location breakdown
}

// Internal result type including Zettle map (not serialized to API response)
export interface InventoryFetchResult extends InventoryData {
  zettleInventory: Map<string, number>  // EAN -> quantity (for FIFO calculator)
}

// API request params
export interface InventoryParams {
  company: 'varg' | 'sneaky-steve'
  folder?: string
}

// Stock history types
export interface StockHistoryPoint {
  date: string // YYYY-MM-DD
  quantity: number
}

export interface StockHistorySeries {
  name: string
  variantId?: number
  size?: string
  data: StockHistoryPoint[]
}

export interface StockHistoryData {
  series: StockHistorySeries[]
}
