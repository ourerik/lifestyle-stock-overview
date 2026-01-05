// Product Performance Types

export type SalesChannel = 'ecom' | 'retail' | 'wholesale' | 'all'

export interface ProductPerformance {
  productNumber: string
  productName: string

  // Sales
  salesQuantity: number
  returnQuantity: number
  returnRate: number              // %
  orderCount: number              // unique orders

  // Turnover (SEK)
  turnover: number                // totalPriceReturnsAdjusted
  turnoverBeforeReturns: number   // totalPrice

  // Gross margin (TB)
  costs: number                   // orderLineTotalCost
  tb: number                      // turnover - costs
  tbPercent: number               // tb / turnover * 100

  // TB with ad costs
  tbWithAds: number               // tb - (adCostPerOrder * orderCount)
  tbPercentWithAds: number        // tbWithAds / turnover * 100

  // Customer demographics
  medianCustomerAge: number | null  // null if insufficient data points

  // Discount
  avgDiscountPercent: number
}

export interface PerformanceSummary {
  totalSalesQuantity: number
  totalReturnQuantity: number
  totalReturnRate: number
  totalTurnover: number
  totalCosts: number
  totalTb: number
  totalTbPercent: number
  totalTbWithAds: number
  totalTbPercentWithAds: number
  totalAvgDiscountPercent: number
  productCount: number
  orderCount: number
}

export interface PerformanceData {
  products: ProductPerformance[]
  summary: PerformanceSummary
  dateRange: {
    start: string
    end: string
  }
  adCostPerOrder: number  // SEK per order used for TB calculation
}

export interface PerformanceResponse {
  data: PerformanceData
  cachedAt: string
  fromCache: boolean
}

// ES document structure for ecom sales
export interface ESSalesDocument {
  id: string
  orderLineId: number
  orderId: string
  orderNumber: number
  orderDate: string
  createdAt: string
  updatedAt: string
  status: string
  saleChannel: string

  // Product info
  productId: string
  productNumber: string
  productName: string
  variantNumber: string
  variantName: string
  size: string
  sku: string

  // Quantities
  quantity: number
  returnedQuantity: number
  quantityReturnAdjusted: number
  cancelledQuantity: number

  // Pricing (SEK)
  unitPrice: number
  unitOriginalPrice: number
  totalPrice: number
  totalOriginalPrice: number
  totalPriceReturnsAdjusted: number
  totalOriginalPriceReturnsAdjusted: number

  // Costs (SEK)
  variantUnitCost: number
  orderLineInboundCost: number
  orderLineOutboundCost: number
  orderLineReturnCost: number
  orderLineTotalCost: number

  // Discount
  discountPercent: number
  hasAnyDiscount: boolean

  // Customer
  customerId: string
  customerAge: number
  customerGender: string

  // Other
  currency: string
  countryCode: string
  isEU: boolean
  campaignName: string
  voucherName: string
  isOutlet: boolean
}

// Aggregation bucket from ES
export interface ProductAggregationBucket {
  key: string  // productNumber
  doc_count: number
  product_name: {
    buckets: Array<{ key: string }>
  }
  total_quantity: { value: number }
  total_returned: { value: number }
  total_turnover: { value: number }
  total_turnover_before_returns: { value: number }
  total_costs: { value: number }
  avg_discount: { value: number }
  unique_orders: { value: number }
  customer_ages: { values: number[] }
}

// ==================== Drill-down Types ====================

// Rolling 3-month period
export interface RollingPeriod {
  label: string              // "Okt-Dec", "Jul-Sep"
  startDate: string          // "2025-10-01"
  endDate: string            // "2025-12-31"
  periodIndex: number        // 0 = most recent, 1 = next oldest, etc
}

// Metrics for a period
export interface PeriodMetrics {
  period: RollingPeriod
  salesQuantity: number
  returnQuantity: number
  returnRate: number         // %
  medianCustomerAge: number | null
  avgDiscountPercent: number
  turnover: number
  costs: number
  tb: number
  tbPercent: number
}

// Variant with period data
export interface VariantPerformance {
  variantNumber: string
  variantName: string
  image: string | null

  // Total for the whole year
  totalSalesQuantity: number
  totalReturnQuantity: number
  totalReturnRate: number
  totalTurnover: number
  totalCosts: number
  totalTb: number
  totalTbPercent: number
  totalAvgDiscountPercent: number
  medianCustomerAge: number | null

  // Per 3-month period (4 periods)
  periods: PeriodMetrics[]
}

// Detail data for a product
export interface ProductPerformanceDetail {
  productNumber: string
  productName: string
  image: string | null

  // Total for the whole year (same as in main table)
  summary: ProductPerformance

  // Per variant with period data
  variants: VariantPerformance[]

  // Period definitions (for column headers)
  periodDefinitions: RollingPeriod[]
}

export interface ProductPerformanceDetailResponse {
  data: ProductPerformanceDetail
  cachedAt: string
  fromCache: boolean
}
