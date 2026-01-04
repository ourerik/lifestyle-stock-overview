/**
 * FIFO (First-In, First-Out) Inventory Valuation Types
 *
 * Used for calculating inventory value based on actual purchase costs,
 * where oldest inventory is assumed to be sold first.
 */

// A single inventory layer representing stock from one purchase
export interface InventoryLayer {
  purchaseOrderId: string
  purchaseOrderDeliveryId: string
  deliveryDate: string      // ISO date string
  unitCost: number          // Cost per unit at purchase time
  quantity: number          // Original quantity delivered
  remainingQuantity: number // Quantity still in stock after FIFO allocation
  layerValue: number        // remainingQuantity * unitCost
  ageInDays: number         // Days since delivery
  supplierName: string
}

// FIFO valuation for a single size (EAN level)
export interface FifoSizeValuation {
  EAN: string
  size: string
  sizeNumber: string
  currentStock: number           // Current physical quantity
  totalValue: number             // Sum of all layer values
  weightedAverageCost: number    // totalValue / currentStock
  inventoryLayers: InventoryLayer[]
  oldestPurchaseDate: string | null
  newestPurchaseDate: string | null
  averageAgeInDays: number       // Weighted by quantity
  maxAgeInDays: number           // Age of oldest layer
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
  fresh: number      // 0-90 days
  aging: number      // 91-180 days
  old: number        // 181-365 days
  veryOld: number    // >365 days
}

// Summary of FIFO valuation across all inventory
export interface FifoSummary {
  totalValue: number
  totalItems: number
  averageCost: number
  averageAgeInDays: number
  valueByAgeGroup: ValueByAgeGroup
  itemsByAgeGroup: ValueByAgeGroup
  unknownCostItems: number  // Items without purchase data
  calculatedAt: string
}

// Complete FIFO valuation response
export interface FifoValuationData {
  products: FifoProductValuation[]
  summary: FifoSummary
}

// Age classification thresholds (in days)
export const AGE_THRESHOLDS = {
  FRESH: 90,
  AGING: 180,
  OLD: 365,
} as const

// Helper to get age classification
export function getAgeClassification(ageInDays: number): keyof ValueByAgeGroup {
  if (ageInDays <= AGE_THRESHOLDS.FRESH) return 'fresh'
  if (ageInDays <= AGE_THRESHOLDS.AGING) return 'aging'
  if (ageInDays <= AGE_THRESHOLDS.OLD) return 'old'
  return 'veryOld'
}

// Helper to get Tailwind color class for age
export function getAgeColorClass(ageInDays: number): string {
  const classification = getAgeClassification(ageInDays)
  switch (classification) {
    case 'fresh': return 'text-green-600'
    case 'aging': return 'text-yellow-600'
    case 'old': return 'text-orange-600'
    case 'veryOld': return 'text-red-600'
  }
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
