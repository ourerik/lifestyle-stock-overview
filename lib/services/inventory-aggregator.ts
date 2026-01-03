import { ElasticsearchConnector } from '@/lib/connectors/elasticsearch'
import { ZettleConnector } from '@/lib/connectors/zettle'
import { COMPANIES, type CompanyId } from '@/config/companies'
import type { Env } from '@/types'
import type {
  StockItem,
  ZettleInventoryItem,
  AggregatedProduct,
  AggregatedVariant,
  SizeStock,
  InventoryData,
  InventorySummary,
  ProductStatus,
} from '@/types/inventory'

const LOW_STOCK_THRESHOLD = 5

export class InventoryAggregator {
  constructor(private env: Env) {}

  async fetchInventory(companyId: Exclude<CompanyId, 'all'>): Promise<InventoryData> {
    // Fetch stock from Elasticsearch
    const esConnector = new ElasticsearchConnector(this.env)
    const { items: stockItems, lastUpdated } = await esConnector.fetchStock(companyId)

    // Fetch Zettle inventory for Sneaky Steve
    let zettleInventory: Map<string, number> = new Map()
    if (companyId === 'sneaky-steve') {
      try {
        const zettleItems = await this.fetchZettleInventory()
        zettleInventory = new Map(zettleItems.map(item => [item.barcode, item.balance]))
      } catch (error) {
        console.error('Failed to fetch Zettle inventory:', error)
        // Continue without Zettle data
      }
    }

    // Aggregate data
    const products = this.aggregateProducts(stockItems, zettleInventory)

    // Extract unique folders
    const folders = [...new Set(stockItems.map(item => item.folder).filter(Boolean))].sort()

    // Calculate summary
    const summary = this.calculateSummary(products, lastUpdated)

    return { products, folders, summary }
  }

  private async fetchZettleInventory(): Promise<ZettleInventoryItem[]> {
    const config = COMPANIES['sneaky-steve']
    const zettleConfig = config.connectors?.find(c => c.type === 'zettle')
    if (!zettleConfig) {
      return []
    }

    const zettle = new ZettleConnector(this.env, zettleConfig.envPrefix)
    return zettle.fetchInventory()
  }

  private aggregateProducts(
    items: StockItem[],
    zettleInventory: Map<string, number>
  ): AggregatedProduct[] {
    // Group by productNumber
    const productMap = new Map<string, StockItem[]>()
    for (const item of items) {
      const key = item.productNumber
      if (!productMap.has(key)) {
        productMap.set(key, [])
      }
      productMap.get(key)!.push(item)
    }

    // Build aggregated products
    const products: AggregatedProduct[] = []

    for (const [productNumber, productItems] of productMap) {
      const firstItem = productItems[0]
      const variants = this.aggregateVariants(productItems, zettleInventory)

      // Calculate totals
      const totalQuantity = variants.reduce((sum, v) => sum + v.totalQuantity, 0)
      const totalZettleQuantity = variants.reduce((sum, v) => sum + v.zettleQuantity, 0)
      const totalIncoming = variants.reduce((sum, v) => sum + v.totalIncoming, 0)

      // Determine status
      const status: ProductStatus[] = []
      const hasLowStock = variants.some(v =>
        v.sizes.some(s => s.quantity > 0 && s.quantity < LOW_STOCK_THRESHOLD)
      )
      if (hasLowStock) status.push('low')
      if (totalIncoming > 0) status.push('incoming')

      products.push({
        productNumber,
        productName: firstItem.productName,
        productId: firstItem.productId,
        folder: firstItem.folder,
        image: firstItem.image,
        totalQuantity,
        totalZettleQuantity,
        totalIncoming,
        status,
        variants,
      })
    }

    // Sort by productNumber
    return products.sort((a, b) => a.productNumber.localeCompare(b.productNumber))
  }

  private aggregateVariants(
    items: StockItem[],
    zettleInventory: Map<string, number>
  ): AggregatedVariant[] {
    // Group by variantId
    const variantMap = new Map<number, StockItem[]>()
    for (const item of items) {
      const key = item.variantId
      if (!variantMap.has(key)) {
        variantMap.set(key, [])
      }
      variantMap.get(key)!.push(item)
    }

    const variants: AggregatedVariant[] = []

    for (const [variantId, variantItems] of variantMap) {
      const firstItem = variantItems[0]

      // Build sizes
      const sizes: SizeStock[] = variantItems.map(item => ({
        size: item.size,
        sizeNumber: item.sizeNumber,
        quantity: item.physicalQuantity,
        zettleQuantity: zettleInventory.get(item.EAN) || 0,
        incoming: item.incomingQuantity,
        EAN: item.EAN,
      }))

      // Sort sizes by sizeNumber (handle nulls)
      sizes.sort((a, b) => (a.sizeNumber || '').localeCompare(b.sizeNumber || ''))

      const totalQuantity = sizes.reduce((sum, s) => sum + s.quantity, 0)
      const zettleQuantity = sizes.reduce((sum, s) => sum + s.zettleQuantity, 0)
      const totalIncoming = sizes.reduce((sum, s) => sum + s.incoming, 0)

      variants.push({
        variantId,
        variantName: firstItem.variantName,
        variantNumber: firstItem.variantNumber,
        image: firstItem.image,
        totalQuantity,
        zettleQuantity,
        totalIncoming,
        sizes,
      })
    }

    // Sort variants by variantNumber (handle nulls)
    return variants.sort((a, b) => (a.variantNumber || '').localeCompare(b.variantNumber || ''))
  }

  private calculateSummary(products: AggregatedProduct[], lastUpdated: string): InventorySummary {
    let totalVariants = 0
    let totalQuantity = 0
    let totalZettleQuantity = 0
    let lowStockCount = 0
    let incomingCount = 0

    for (const product of products) {
      totalVariants += product.variants.length
      totalQuantity += product.totalQuantity
      totalZettleQuantity += product.totalZettleQuantity

      if (product.status.includes('low')) lowStockCount++
      if (product.status.includes('incoming')) incomingCount++
    }

    return {
      totalProducts: products.length,
      totalVariants,
      totalQuantity,
      totalZettleQuantity,
      lowStockCount,
      incomingCount,
      lastUpdated,
    }
  }
}
