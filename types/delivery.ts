// Delivery list item for the deliveries page
export interface DeliveryListItem {
  id: string
  createdAt: string
  supplier: string
  purchaseOrderId: number
  productNumber: string
  productName: string
  variantName: string
  sizeNumber: string | null
  quantity: number
  currency: string
  unitCostSEK: number
  totalCostSEK: number
}

// API response for deliveries list
export interface DeliveriesResponse {
  deliveries: DeliveryListItem[]
  total: number
  page: number
  pageSize: number
}

// Sort options for deliveries
export type DeliverySortField =
  | 'createdAt'
  | 'supplier'
  | 'productNumber'
  | 'productName'
  | 'quantity'
  | 'unitCostSEK'
  | 'totalCostSEK'
