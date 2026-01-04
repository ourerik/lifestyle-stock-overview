import { ElasticsearchConnector, type ESPurchaseDelivery } from '@/lib/connectors/elasticsearch'
import type { CompanyId } from '@/config/companies'
import type { Env } from '@/types'
import type { StockItem } from '@/types/inventory'
import type {
  FifoValuationData,
  FifoProductValuation,
  FifoVariantValuation,
  FifoSizeValuation,
  FifoSummary,
  InventoryLayer,
  ValueByAgeGroup,
} from '@/types/fifo'
import { getAgeClassification } from '@/types/fifo'

export class FifoCalculator {
  constructor(private env: Env) {}

  /**
   * Calculate FIFO valuation for all inventory
   */
  async calculateValuation(companyId: Exclude<CompanyId, 'all'>): Promise<FifoValuationData> {
    const esConnector = new ElasticsearchConnector(this.env)

    // Fetch current stock
    const { items: stockItems } = await esConnector.fetchStock(companyId)
    console.log(`[FIFO] Loaded ${stockItems.length} stock items`)

    // Fetch all purchase deliveries (sorted oldest first)
    const deliveries = await esConnector.fetchPurchaseDeliveries(companyId)
    console.log(`[FIFO] Loaded ${deliveries.length} purchase deliveries`)

    // Group deliveries by EAN for quick lookup
    const deliveriesByEAN = this.groupDeliveriesByEAN(deliveries)

    // Calculate FIFO for each stock item
    const sizeValuations = new Map<string, FifoSizeValuation>()
    let unknownCostItems = 0

    for (const stockItem of stockItems) {
      if (stockItem.physicalQuantity <= 0) continue

      const sizeValuation = this.calculateSizeValuation(
        stockItem,
        deliveriesByEAN.get(stockItem.EAN) || []
      )

      if (sizeValuation.inventoryLayers.length === 0 && sizeValuation.currentStock > 0) {
        unknownCostItems++
      }

      sizeValuations.set(stockItem.EAN, sizeValuation)
    }

    // Aggregate to product level
    const products = this.aggregateToProducts(stockItems, sizeValuations)

    // Calculate summary
    const summary = this.calculateSummary(products, unknownCostItems)

    return { products, summary }
  }

  /**
   * Group deliveries by EAN, sorted oldest first
   */
  private groupDeliveriesByEAN(deliveries: ESPurchaseDelivery[]): Map<string, ESPurchaseDelivery[]> {
    const map = new Map<string, ESPurchaseDelivery[]>()

    for (const delivery of deliveries) {
      if (!delivery.EAN) continue

      if (!map.has(delivery.EAN)) {
        map.set(delivery.EAN, [])
      }
      map.get(delivery.EAN)!.push(delivery)
    }

    // Sort each group by createdAt (oldest first for FIFO)
    for (const [_, group] of map) {
      group.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    }

    return map
  }

  /**
   * Calculate FIFO valuation for a single size (EAN)
   */
  private calculateSizeValuation(
    stockItem: StockItem,
    deliveries: ESPurchaseDelivery[]
  ): FifoSizeValuation {
    const now = new Date()
    const layers: InventoryLayer[] = []
    let remainingStock = stockItem.physicalQuantity

    // Apply FIFO: consume from oldest deliveries first
    for (const delivery of deliveries) {
      if (remainingStock <= 0) break

      const deliveryDate = new Date(delivery.createdAt)
      const ageInDays = Math.floor((now.getTime() - deliveryDate.getTime()) / (1000 * 60 * 60 * 24))

      // How much of this delivery is still in stock?
      const remainingFromDelivery = Math.min(remainingStock, delivery.quantity)

      if (remainingFromDelivery > 0) {
        // Use SEK-converted cost if available, otherwise fall back to original
        const unitCostSEK = delivery.unitTotalCostSEK ?? delivery.unitTotalCost

        layers.push({
          purchaseOrderId: String(delivery.purchaseOrderDelivery.purchaseOrderId),
          purchaseOrderDeliveryId: delivery.purchaseOrderDelivery.id,
          deliveryDate: delivery.createdAt,
          unitCost: unitCostSEK, // Use landed cost in SEK
          quantity: delivery.quantity,
          remainingQuantity: remainingFromDelivery,
          layerValue: remainingFromDelivery * unitCostSEK,
          ageInDays,
          supplierName: delivery.purchaseOrderDelivery.supplier,
        })

        remainingStock -= remainingFromDelivery
      }
    }

    // Calculate aggregates
    const totalValue = layers.reduce((sum, l) => sum + l.layerValue, 0)
    const totalQuantity = layers.reduce((sum, l) => sum + l.remainingQuantity, 0)
    const weightedAgeSum = layers.reduce((sum, l) => sum + l.ageInDays * l.remainingQuantity, 0)

    return {
      EAN: stockItem.EAN,
      size: stockItem.size,
      sizeNumber: stockItem.sizeNumber,
      currentStock: stockItem.physicalQuantity,
      totalValue: Math.round(totalValue * 100) / 100,
      weightedAverageCost: totalQuantity > 0 ? Math.round((totalValue / totalQuantity) * 100) / 100 : 0,
      inventoryLayers: layers,
      oldestPurchaseDate: layers.length > 0 ? layers[0].deliveryDate : null,
      newestPurchaseDate: layers.length > 0 ? layers[layers.length - 1].deliveryDate : null,
      averageAgeInDays: totalQuantity > 0 ? Math.round(weightedAgeSum / totalQuantity) : 0,
      maxAgeInDays: layers.length > 0 ? layers[0].ageInDays : 0,
    }
  }

  /**
   * Aggregate size valuations to product level
   */
  private aggregateToProducts(
    stockItems: StockItem[],
    sizeValuations: Map<string, FifoSizeValuation>
  ): FifoProductValuation[] {
    // Group stock items by product
    const productMap = new Map<string, StockItem[]>()
    for (const item of stockItems) {
      if (!productMap.has(item.productNumber)) {
        productMap.set(item.productNumber, [])
      }
      productMap.get(item.productNumber)!.push(item)
    }

    const products: FifoProductValuation[] = []

    for (const [productNumber, items] of productMap) {
      const firstItem = items[0]

      // Group by variant
      const variantMap = new Map<number, StockItem[]>()
      for (const item of items) {
        if (!variantMap.has(item.variantId)) {
          variantMap.set(item.variantId, [])
        }
        variantMap.get(item.variantId)!.push(item)
      }

      const variants: FifoVariantValuation[] = []

      for (const [variantId, variantItems] of variantMap) {
        const firstVariantItem = variantItems[0]
        const sizes: FifoSizeValuation[] = []

        for (const item of variantItems) {
          const sizeValuation = sizeValuations.get(item.EAN)
          if (sizeValuation) {
            sizes.push(sizeValuation)
          }
        }

        // Sort sizes by sizeNumber
        sizes.sort((a, b) => (a.sizeNumber || '').localeCompare(b.sizeNumber || ''))

        const variantTotalStock = sizes.reduce((sum, s) => sum + s.currentStock, 0)
        const variantTotalValue = sizes.reduce((sum, s) => sum + s.totalValue, 0)
        const variantWeightedAgeSum = sizes.reduce(
          (sum, s) => sum + s.averageAgeInDays * s.currentStock,
          0
        )

        variants.push({
          variantId,
          variantNumber: firstVariantItem.variantNumber,
          variantName: firstVariantItem.variantName,
          totalStock: variantTotalStock,
          totalValue: Math.round(variantTotalValue * 100) / 100,
          averageCost: variantTotalStock > 0 ? Math.round((variantTotalValue / variantTotalStock) * 100) / 100 : 0,
          averageAgeInDays: variantTotalStock > 0 ? Math.round(variantWeightedAgeSum / variantTotalStock) : 0,
          maxAgeInDays: Math.max(...sizes.map(s => s.maxAgeInDays), 0),
          sizes,
        })
      }

      // Sort variants by variantNumber
      variants.sort((a, b) => (a.variantNumber || '').localeCompare(b.variantNumber || ''))

      const productTotalStock = variants.reduce((sum, v) => sum + v.totalStock, 0)
      const productTotalValue = variants.reduce((sum, v) => sum + v.totalValue, 0)
      const productWeightedAgeSum = variants.reduce(
        (sum, v) => sum + v.averageAgeInDays * v.totalStock,
        0
      )

      products.push({
        productNumber,
        productName: firstItem.productName,
        productId: firstItem.productId,
        totalStock: productTotalStock,
        totalValue: Math.round(productTotalValue * 100) / 100,
        averageCost: productTotalStock > 0 ? Math.round((productTotalValue / productTotalStock) * 100) / 100 : 0,
        averageAgeInDays: productTotalStock > 0 ? Math.round(productWeightedAgeSum / productTotalStock) : 0,
        maxAgeInDays: Math.max(...variants.map(v => v.maxAgeInDays), 0),
        variants,
      })
    }

    // Sort products by productNumber
    return products.sort((a, b) => a.productNumber.localeCompare(b.productNumber))
  }

  /**
   * Calculate summary statistics
   */
  private calculateSummary(products: FifoProductValuation[], unknownCostItems: number): FifoSummary {
    const totalValue = products.reduce((sum, p) => sum + p.totalValue, 0)
    const totalItems = products.reduce((sum, p) => sum + p.totalStock, 0)

    // Calculate age distribution
    const valueByAgeGroup: ValueByAgeGroup = { fresh: 0, aging: 0, old: 0, veryOld: 0 }
    const itemsByAgeGroup: ValueByAgeGroup = { fresh: 0, aging: 0, old: 0, veryOld: 0 }

    for (const product of products) {
      for (const variant of product.variants) {
        for (const size of variant.sizes) {
          for (const layer of size.inventoryLayers) {
            const group = getAgeClassification(layer.ageInDays)
            valueByAgeGroup[group] += layer.layerValue
            itemsByAgeGroup[group] += layer.remainingQuantity
          }
        }
      }
    }

    // Round values
    valueByAgeGroup.fresh = Math.round(valueByAgeGroup.fresh)
    valueByAgeGroup.aging = Math.round(valueByAgeGroup.aging)
    valueByAgeGroup.old = Math.round(valueByAgeGroup.old)
    valueByAgeGroup.veryOld = Math.round(valueByAgeGroup.veryOld)

    const totalWeightedAge = products.reduce(
      (sum, p) => sum + p.averageAgeInDays * p.totalStock,
      0
    )

    return {
      totalValue: Math.round(totalValue),
      totalItems,
      averageCost: totalItems > 0 ? Math.round((totalValue / totalItems) * 100) / 100 : 0,
      averageAgeInDays: totalItems > 0 ? Math.round(totalWeightedAge / totalItems) : 0,
      valueByAgeGroup,
      itemsByAgeGroup,
      unknownCostItems,
      calculatedAt: new Date().toISOString(),
    }
  }
}
