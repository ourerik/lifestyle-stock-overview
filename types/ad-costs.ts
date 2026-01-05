// Ad Costs Types

export interface AdCostDocument {
  id: string              // "{year}-{month}" e.g. "2026-01"
  year: number
  month: number
  metaCost: number        // SEK
  googleCost: number      // SEK
  totalCost: number       // metaCost + googleCost
  createdAt: string
  updatedAt: string
}

export interface AdCostInput {
  year: number
  month: number
  metaCost: number
  googleCost: number
}

export interface AdCostWithOrderCount extends AdCostDocument {
  orderCount: number      // orders in this month
  costPerOrder: number    // totalCost / orderCount
}

export interface AdCostsResponse {
  costs: AdCostDocument[]
  cachedAt: string
  fromCache: boolean
}

// Default cost per order when no ad costs are entered
export const DEFAULT_AD_COST_PER_ORDER = 100  // SEK
