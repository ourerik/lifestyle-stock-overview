/**
 * FIFO (First-In, First-Out) Inventory Valuation Types
 *
 * Used for calculating inventory value based on actual purchase costs,
 * where oldest inventory is assumed to be sold first.
 */

// Source of inventory valuation data - indicates trustworthiness
// 'delivery' = from purchase order delivery (most trusted, has full landed cost)
// 'stockChange' = from stock change (less trusted, only has unit cost)
// 'unknown' = no valuation data found (not trusted)
export type InventoryLayerSource = 'delivery' | 'stockChange' | 'unknown'

// A single inventory layer representing stock from one purchase or stock change
export interface InventoryLayer {
  purchaseOrderId: string | null
  purchaseOrderDeliveryId: string | null
  stockChangeId: string | null  // For stock change source
  deliveryDate: string      // ISO date string
  unitCost: number          // Cost per unit at purchase time
  quantity: number          // Original quantity delivered
  remainingQuantity: number // Quantity still in stock after FIFO allocation
  layerValue: number        // remainingQuantity * unitCost
  ageInDays: number         // Days since delivery
  supplierName: string | null
  source: InventoryLayerSource  // Indicates data trustworthiness
}

// Stock quantity by physical location
export interface StockByLocation {
  warehouse: number   // Centra warehouse stock
  store: number       // Zettle store stock (only for companies with Zettle)
}

// Inventory value by physical location
export interface ValueByLocation {
  warehouse: number   // Value of warehouse stock
  store: number       // Value of store stock
}

// FIFO valuation for a single size (EAN level)
export interface FifoSizeValuation {
  EAN: string
  size: string
  sizeNumber: string
  currentStock: number           // Total stock (warehouse + store)
  totalValue: number             // Sum of all layer values
  weightedAverageCost: number    // totalValue / currentStock
  inventoryLayers: InventoryLayer[]
  oldestPurchaseDate: string | null
  newestPurchaseDate: string | null
  averageAgeInDays: number       // Weighted by quantity
  maxAgeInDays: number           // Age of oldest layer
  // Source distribution for this size
  primarySource: InventoryLayerSource  // The main source for this size's valuation
  quantityBySource: {
    delivery: number     // Items with purchase order delivery data
    stockChange: number  // Items with only stock change data
    unknown: number      // Items with no valuation data
  }
  // Location distribution for this size
  stockByLocation: StockByLocation
  valueByLocation: ValueByLocation
}

// FIFO valuation for a variant (color/style)
export interface FifoVariantValuation {
  variantId: number
  variantNumber: string
  variantName: string
  totalStock: number
  totalValue: number
  averageCost: number
  averageAgeInDays: number
  maxAgeInDays: number
  sizes: FifoSizeValuation[]
}

// FIFO valuation for a product
export interface FifoProductValuation {
  productNumber: string
  productName: string
  productId: number
  totalStock: number
  totalValue: number
  averageCost: number
  averageAgeInDays: number
  maxAgeInDays: number
  variants: FifoVariantValuation[]
}

// Age group classification for inventory
export interface ValueByAgeGroup {
  fresh: number      // < 6 months (< 183 days)
  aging: number      // 6-18 months (183-547 days)
  old: number        // > 18 months (> 547 days)
}

// Distribution of items by valuation source
export interface ItemsBySource {
  delivery: number      // Items valued from purchase order deliveries (most trusted)
  stockChange: number   // Items valued from stock changes (less trusted)
  unknown: number       // Items with no valuation data (not trusted)
}

// Summary of FIFO valuation across all inventory
export interface FifoSummary {
  totalValue: number
  totalItems: number
  averageCost: number
  averageAgeInDays: number
  valueByAgeGroup: ValueByAgeGroup
  itemsByAgeGroup: ValueByAgeGroup
  unknownCostItems: number  // Items without purchase data (legacy, use itemsBySource.unknown)
  itemsBySource: ItemsBySource  // Distribution by valuation source
  valueBySource: ItemsBySource  // Value distribution by source
  // Location-based totals (for companies with multiple locations like Zettle)
  totalValueByLocation: ValueByLocation
  totalStockByLocation: StockByLocation
  calculatedAt: string
}

// Complete FIFO valuation response
export interface FifoValuationData {
  products: FifoProductValuation[]
  summary: FifoSummary
}

// Age classification thresholds (in days)
export const AGE_THRESHOLDS = {
  FRESH: 183,        // < 6 months (~6 * 30.4)
  AGING: 547,        // 6-18 months (~18 * 30.4)
} as const

// Helper to get age classification
export function getAgeClassification(ageInDays: number): keyof ValueByAgeGroup {
  if (ageInDays < AGE_THRESHOLDS.FRESH) return 'fresh'
  if (ageInDays <= AGE_THRESHOLDS.AGING) return 'aging'
  return 'old'
}

// Helper to get Tailwind color class for age (for UI display)
// Green: < 6 months, Gray/default: 6-18 months, Red: > 18 months
export function getAgeColorClass(ageInDays: number): string {
  if (ageInDays < AGE_THRESHOLDS.FRESH) {
    return 'text-green-600 dark:text-green-500'
  }
  if (ageInDays <= AGE_THRESHOLDS.AGING) {
    return ''  // Default text color (black/white depending on theme)
  }
  return 'text-red-600 dark:text-red-500'
}

// Helper to format age in human-readable form
export function formatAge(ageInDays: number): string {
  if (ageInDays < 30) return `${ageInDays} dagar`
  if (ageInDays < 365) return `${Math.floor(ageInDays / 30)} mån`
  const years = ageInDays / 365
  return years >= 2 ? `${Math.floor(years)} år` : `${years.toFixed(1)} år`
}

// Helper to format currency (SEK)
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

// Helper to format date as Swedish period (e.g., "okt 24")
export function formatPeriod(dateString: string | null): string {
  if (!dateString) return '-'

  const date = new Date(dateString)
  const month = date.toLocaleDateString('sv-SE', { month: 'short' })
  const year = date.getFullYear().toString().slice(-2)

  return `${month} ${year}`
}

// Helper to get display text for source
export function getSourceLabel(source: InventoryLayerSource): string {
  switch (source) {
    case 'delivery': return 'Inleverans'
    case 'stockChange': return 'Lagerändring'
    case 'unknown': return 'Okänt'
  }
}

// Helper to get Tailwind color class for source (indicates trustworthiness)
export function getSourceColorClass(source: InventoryLayerSource): string {
  switch (source) {
    case 'delivery': return 'text-green-600'      // Most trusted
    case 'stockChange': return 'text-amber-600'   // Less trusted
    case 'unknown': return 'text-red-600'         // Not trusted
  }
}

// Helper to get background color class for source badge
export function getSourceBadgeClass(source: InventoryLayerSource): string {
  switch (source) {
    case 'delivery': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
    case 'stockChange': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
    case 'unknown': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
  }
}
