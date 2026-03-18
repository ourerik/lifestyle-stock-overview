export interface ProductSalesItem {
  productNumber: string
  productName: string
  quantity: number
  image?: string
}

export interface TopProductItem {
  productNumber: string
  productName: string
  image?: string
  channels: {
    ecom: number
    store: number
    b2b: number
  }
  totalQuantity: number
}

export interface TopProductsData {
  companyId: string
  companyName: string
  products: TopProductItem[]
  hasStore: boolean
}
