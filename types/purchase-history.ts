/**
 * Purchase History Types
 *
 * Used for displaying historical purchase data per product/variant/size,
 * including all deliveries (not just remaining stock like FIFO).
 */

// Complete purchase history for a product
export interface ProductPurchaseHistory {
  productNumber: string
  productName: string
  currentStock: number
  totalQuantityPurchased: number
  firstPurchaseDate: string | null
  variants: VariantPurchaseHistory[]
}

// Purchase history for a specific variant
export interface VariantPurchaseHistory {
  variantId: number
  variantNumber: string
  variantName: string
  currentStock: number
  totalQuantityPurchased: number
  firstPurchaseDate: string | null
  sizes: SizePurchaseHistory[]
}

// Purchase history for a specific size
export interface SizePurchaseHistory {
  sizeNumber: string
  currentStock: number
  totalQuantityPurchased: number
  firstPurchaseDate: string | null
  deliveries: DeliveryRecord[]
}

// Individual delivery record
export interface DeliveryRecord {
  date: string
  quantity: number
  supplierName: string
  unitCostSEK: number
  purchaseOrderId: number
}
