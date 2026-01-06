import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { ElasticsearchConnector } from '@/lib/connectors/elasticsearch'
import type { CompanyId } from '@/config/companies'
import type { Env } from '@/types'
import type {
  ProductPurchaseHistory,
  VariantPurchaseHistory,
  SizePurchaseHistory,
  DeliveryRecord,
} from '@/types/purchase-history'

const VALID_COMPANIES: Exclude<CompanyId, 'all'>[] = ['varg', 'sneaky-steve']

/**
 * GET /api/inventory/purchase-history
 *
 * Returns complete purchase history for a product, including:
 * - All deliveries per variant/size (not just remaining stock)
 * - Current stock per size
 * - First purchase date and total quantity purchased
 */
export async function GET(request: NextRequest) {
  // Check authentication
  const session = await auth0.getSession(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse query params
  const searchParams = request.nextUrl.searchParams
  const company = searchParams.get('company') as Exclude<CompanyId, 'all'>
  const productNumber = searchParams.get('productNumber')

  // Validate params
  if (!company || !VALID_COMPANIES.includes(company)) {
    return NextResponse.json(
      { error: 'Invalid company parameter. Must be "varg" or "sneaky-steve"' },
      { status: 400 }
    )
  }

  if (!productNumber) {
    return NextResponse.json(
      { error: 'productNumber parameter is required' },
      { status: 400 }
    )
  }

  try {
    const env: Env = process.env as unknown as Env
    const esConnector = new ElasticsearchConnector(env)

    console.log(`[Purchase History] Fetching for company=${company}, productNumber=${productNumber}`)

    // Fetch all purchase deliveries for this product
    const deliveries = await esConnector.fetchPurchaseDeliveriesByProduct(company, productNumber)
    console.log(`[Purchase History] Found ${deliveries.length} deliveries`)

    // Fetch current stock for this product
    const { items: stockItems } = await esConnector.fetchStock(company)
    const productStockItems = stockItems.filter(item => item.productNumber === productNumber)

    // Build stock lookup by variantId + sizeNumber
    const stockByKey = new Map<string, number>()
    // Build size name lookup (sizeNumber -> size) from stock items
    const sizeNameByKey = new Map<string, string>()
    for (const item of productStockItems) {
      const key = `${item.variantId}-${item.sizeNumber || 'null'}`
      stockByKey.set(key, (stockByKey.get(key) || 0) + item.physicalQuantity)
      // Store the human-readable size name
      if (item.size) {
        sizeNameByKey.set(key, item.size)
      }
    }

    // Aggregate deliveries by variant and size
    const variantMap = new Map<number, {
      variantId: number
      variantNumber: string
      variantName: string
      sizes: Map<string, {
        sizeNumber: string
        deliveries: DeliveryRecord[]
        totalQty: number
        firstDate: string | null
      }>
    }>()

    let productName = ''
    let productFirstDate: string | null = null
    let productTotalQty = 0

    for (const delivery of deliveries) {
      productName = delivery.productName

      // Track product-level stats
      productTotalQty += delivery.quantity
      if (!productFirstDate || delivery.createdAt < productFirstDate) {
        productFirstDate = delivery.createdAt
      }

      // Get or create variant entry
      if (!variantMap.has(delivery.productVariantId)) {
        variantMap.set(delivery.productVariantId, {
          variantId: delivery.productVariantId,
          variantNumber: delivery.productVariantNumber,
          variantName: delivery.productVariantName,
          sizes: new Map(),
        })
      }
      const variant = variantMap.get(delivery.productVariantId)!

      // Get or create size entry
      const sizeKey = delivery.sizeNumber || 'null'
      if (!variant.sizes.has(sizeKey)) {
        variant.sizes.set(sizeKey, {
          sizeNumber: delivery.sizeNumber || '',
          deliveries: [],
          totalQty: 0,
          firstDate: null,
        })
      }
      const size = variant.sizes.get(sizeKey)!

      // Add delivery record
      size.deliveries.push({
        date: delivery.createdAt,
        quantity: delivery.quantity,
        supplierName: delivery.purchaseOrderDelivery.supplier,
        unitCostSEK: delivery.unitTotalCostSEK ?? delivery.unitTotalCost,
        purchaseOrderId: delivery.purchaseOrderDelivery.purchaseOrderId,
      })

      // Update size stats
      size.totalQty += delivery.quantity
      if (!size.firstDate || delivery.createdAt < size.firstDate) {
        size.firstDate = delivery.createdAt
      }
    }

    // Convert to final structure
    const variants: VariantPurchaseHistory[] = []

    for (const [, variant] of variantMap) {
      const sizes: SizePurchaseHistory[] = []
      let variantTotalQty = 0
      let variantFirstDate: string | null = null
      let variantCurrentStock = 0

      for (const [sizeNumber, size] of variant.sizes) {
        const stockKey = `${variant.variantId}-${sizeNumber === '' ? 'null' : sizeNumber}`
        const currentStock = stockByKey.get(stockKey) || 0
        // Get the human-readable size name from stock data
        const sizeName = sizeNameByKey.get(stockKey) || size.sizeNumber || ''

        sizes.push({
          size: sizeName,
          sizeNumber: size.sizeNumber,
          currentStock,
          totalQuantityPurchased: size.totalQty,
          firstPurchaseDate: size.firstDate,
          deliveries: size.deliveries, // Already sorted newest first from ES query
        })

        variantTotalQty += size.totalQty
        variantCurrentStock += currentStock
        if (!variantFirstDate || (size.firstDate && size.firstDate < variantFirstDate)) {
          variantFirstDate = size.firstDate
        }
      }

      // Sort sizes by size name (human-readable)
      sizes.sort((a, b) => (a.size || '').localeCompare(b.size || '', undefined, { numeric: true }))

      variants.push({
        variantId: variant.variantId,
        variantNumber: variant.variantNumber,
        variantName: variant.variantName,
        currentStock: variantCurrentStock,
        totalQuantityPurchased: variantTotalQty,
        firstPurchaseDate: variantFirstDate,
        sizes,
      })
    }

    // Sort variants by variantNumber
    variants.sort((a, b) => a.variantNumber.localeCompare(b.variantNumber))

    // Calculate product-level current stock
    const productCurrentStock = productStockItems.reduce((sum, item) => sum + item.physicalQuantity, 0)

    const result: ProductPurchaseHistory = {
      productNumber,
      productName,
      currentStock: productCurrentStock,
      totalQuantityPurchased: productTotalQty,
      firstPurchaseDate: productFirstDate,
      variants,
    }

    return NextResponse.json({ data: result })
  } catch (error) {
    console.error('Failed to fetch purchase history:', error)
    return NextResponse.json(
      { error: 'Failed to fetch purchase history', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
