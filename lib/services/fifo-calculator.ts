import { ElasticsearchConnector, type ESPurchaseDelivery, type ESStockChange } from '@/lib/connectors/elasticsearch'
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
  ItemsBySource,
  InventoryLayerSource,
  StockByLocation,
  ValueByLocation,
} from '@/types/fifo'
import { getAgeClassification } from '@/types/fifo'

export class FifoCalculator {
  constructor(private env: Env) {}

  /**
   * Calculate FIFO valuation for all inventory
   * Priority: 1) Purchase deliveries (most trusted), 2) Stock changes (less trusted), 3) Unknown
   * @param companyId - Company to calculate for
   * @param zettleInventory - Optional map of EAN -> store quantity (for companies with Zettle)
   */
  async calculateValuation(
    companyId: Exclude<CompanyId, 'all'>,
    zettleInventory?: Map<string, number>
  ): Promise<FifoValuationData> {
    const esConnector = new ElasticsearchConnector(this.env)

    // Fetch current stock
    const { items: stockItems } = await esConnector.fetchStock(companyId)
    console.log(`[FIFO] Loaded ${stockItems.length} stock items`)

    // Fetch all purchase deliveries (sorted oldest first) - PRIMARY SOURCE
    const deliveries = await esConnector.fetchPurchaseDeliveries(companyId)
    console.log(`[FIFO] Loaded ${deliveries.length} purchase deliveries`)

    // Fetch all stock changes (sorted oldest first) - FALLBACK SOURCE
    const stockChanges = await esConnector.fetchStockChanges(companyId)
    console.log(`[FIFO] Loaded ${stockChanges.length} stock changes`)

    if (zettleInventory) {
      console.log(`[FIFO] Zettle inventory provided with ${zettleInventory.size} items`)
    }

    // Group both sources by EAN for quick lookup
    const deliveriesByEAN = this.groupDeliveriesByEAN(deliveries)
    const stockChangesByEAN = this.groupStockChangesByEAN(stockChanges)

    // Calculate FIFO for each stock item
    const sizeValuations = new Map<string, FifoSizeValuation>()

    // Also process items that only exist in Zettle (not in Centra warehouse)
    const processedEANs = new Set<string>()

    for (const stockItem of stockItems) {
      const warehouseQty = stockItem.physicalQuantity
      const storeQty = zettleInventory?.get(stockItem.EAN) || 0
      const totalQty = warehouseQty + storeQty

      if (totalQty <= 0) continue

      const sizeValuation = this.calculateSizeValuation(
        stockItem,
        warehouseQty,
        storeQty,
        deliveriesByEAN.get(stockItem.EAN) || [],
        stockChangesByEAN.get(stockItem.EAN) || []
      )

      sizeValuations.set(stockItem.EAN, sizeValuation)
      processedEANs.add(stockItem.EAN)
    }

    // Process Zettle-only items (not in Centra warehouse)
    if (zettleInventory) {
      for (const [ean, storeQty] of zettleInventory) {
        if (processedEANs.has(ean) || storeQty <= 0) continue

        // Create a minimal stock item for Zettle-only products
        // These won't have full product info but will have valuation
        const sizeValuation = this.calculateSizeValuationForZettleOnly(
          ean,
          storeQty,
          deliveriesByEAN.get(ean) || [],
          stockChangesByEAN.get(ean) || []
        )

        if (sizeValuation) {
          sizeValuations.set(ean, sizeValuation)
        }
      }
    }

    // Aggregate to product level
    const products = this.aggregateToProducts(stockItems, sizeValuations)

    // Calculate summary
    const summary = this.calculateSummary(products)

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
    for (const [, group] of map) {
      group.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    }

    return map
  }

  /**
   * Group stock changes by EAN, sorted oldest first
   */
  private groupStockChangesByEAN(stockChanges: ESStockChange[]): Map<string, ESStockChange[]> {
    const map = new Map<string, ESStockChange[]>()

    for (const change of stockChanges) {
      if (!change.EAN) continue

      if (!map.has(change.EAN)) {
        map.set(change.EAN, [])
      }
      map.get(change.EAN)!.push(change)
    }

    // Sort each group by createdAt (oldest first for FIFO)
    for (const [, group] of map) {
      group.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    }

    return map
  }

  /**
   * Calculate FIFO valuation for a single size (EAN)
   * Uses purchase deliveries first, then falls back to stock changes
   * @param stockItem - The stock item from Elasticsearch
   * @param warehouseQty - Quantity in Centra warehouse
   * @param storeQty - Quantity in Zettle store
   * @param deliveries - Purchase deliveries for this EAN
   * @param stockChanges - Stock changes for this EAN
   */
  private calculateSizeValuation(
    stockItem: StockItem,
    warehouseQty: number,
    storeQty: number,
    deliveries: ESPurchaseDelivery[],
    stockChanges: ESStockChange[]
  ): FifoSizeValuation {
    const now = new Date()
    const layers: InventoryLayer[] = []
    const totalStock = warehouseQty + storeQty
    let remainingStock = totalStock

    // Track quantity by source
    const quantityBySource = { delivery: 0, stockChange: 0, unknown: 0 }

    // STEP 1: Apply FIFO using purchase deliveries (most trusted)
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
          stockChangeId: null,
          deliveryDate: delivery.createdAt,
          unitCost: unitCostSEK, // Use landed cost in SEK
          quantity: delivery.quantity,
          remainingQuantity: remainingFromDelivery,
          layerValue: remainingFromDelivery * unitCostSEK,
          ageInDays,
          supplierName: delivery.purchaseOrderDelivery.supplier,
          source: 'delivery',
        })

        quantityBySource.delivery += remainingFromDelivery
        remainingStock -= remainingFromDelivery
      }
    }

    // STEP 2: If still remaining stock, use stock changes (less trusted)
    for (const change of stockChanges) {
      if (remainingStock <= 0) break

      const changeDate = new Date(change.createdAt)
      const ageInDays = Math.floor((now.getTime() - changeDate.getTime()) / (1000 * 60 * 60 * 24))

      // How much of this stock change is still in stock?
      const remainingFromChange = Math.min(remainingStock, change.quantity)

      if (remainingFromChange > 0) {
        // Use SEK-converted cost
        const unitCostSEK = change.unitCostSEK ?? change.unitCost

        layers.push({
          purchaseOrderId: null,
          purchaseOrderDeliveryId: null,
          stockChangeId: change.stockChange.id,
          deliveryDate: change.createdAt,
          unitCost: unitCostSEK,
          quantity: change.quantity,
          remainingQuantity: remainingFromChange,
          layerValue: remainingFromChange * unitCostSEK,
          ageInDays,
          supplierName: null, // Stock changes don't have supplier info
          source: 'stockChange',
        })

        quantityBySource.stockChange += remainingFromChange
        remainingStock -= remainingFromChange
      }
    }

    // STEP 3: Any remaining stock has unknown cost
    if (remainingStock > 0) {
      quantityBySource.unknown += remainingStock
      // Note: We don't create a layer for unknown items since we have no cost data
    }

    // Calculate aggregates from layers
    const totalValue = layers.reduce((sum, l) => sum + l.layerValue, 0)
    const totalQuantity = layers.reduce((sum, l) => sum + l.remainingQuantity, 0)
    const weightedAgeSum = layers.reduce((sum, l) => sum + l.ageInDays * l.remainingQuantity, 0)

    // Determine primary source (the source that covers the most quantity)
    let primarySource: InventoryLayerSource = 'unknown'
    if (quantityBySource.delivery > 0) {
      primarySource = 'delivery'
    } else if (quantityBySource.stockChange > 0) {
      primarySource = 'stockChange'
    }

    // Calculate value distribution by location (proportional)
    const stockByLocation: StockByLocation = { warehouse: warehouseQty, store: storeQty }
    const valueByLocation: ValueByLocation = this.calculateValueByLocation(
      totalValue,
      warehouseQty,
      storeQty
    )

    return {
      EAN: stockItem.EAN,
      size: stockItem.size,
      sizeNumber: stockItem.sizeNumber,
      currentStock: totalStock,
      totalValue: Math.round(totalValue * 100) / 100,
      weightedAverageCost: totalQuantity > 0 ? Math.round((totalValue / totalQuantity) * 100) / 100 : 0,
      inventoryLayers: layers,
      oldestPurchaseDate: layers.length > 0 ? layers[0].deliveryDate : null,
      newestPurchaseDate: layers.length > 0 ? layers[layers.length - 1].deliveryDate : null,
      averageAgeInDays: totalQuantity > 0 ? Math.round(weightedAgeSum / totalQuantity) : 0,
      maxAgeInDays: layers.length > 0 ? layers[0].ageInDays : 0,
      primarySource,
      quantityBySource,
      stockByLocation,
      valueByLocation,
    }
  }

  /**
   * Calculate FIFO valuation for items that only exist in Zettle (not in Centra warehouse)
   */
  private calculateSizeValuationForZettleOnly(
    ean: string,
    storeQty: number,
    deliveries: ESPurchaseDelivery[],
    stockChanges: ESStockChange[]
  ): FifoSizeValuation | null {
    // We need delivery data to have any valuation info
    if (deliveries.length === 0 && stockChanges.length === 0) {
      return null
    }

    const now = new Date()
    const layers: InventoryLayer[] = []
    let remainingStock = storeQty

    const quantityBySource = { delivery: 0, stockChange: 0, unknown: 0 }

    // Apply same FIFO logic
    for (const delivery of deliveries) {
      if (remainingStock <= 0) break

      const deliveryDate = new Date(delivery.createdAt)
      const ageInDays = Math.floor((now.getTime() - deliveryDate.getTime()) / (1000 * 60 * 60 * 24))
      const remainingFromDelivery = Math.min(remainingStock, delivery.quantity)

      if (remainingFromDelivery > 0) {
        const unitCostSEK = delivery.unitTotalCostSEK ?? delivery.unitTotalCost

        layers.push({
          purchaseOrderId: String(delivery.purchaseOrderDelivery.purchaseOrderId),
          purchaseOrderDeliveryId: delivery.purchaseOrderDelivery.id,
          stockChangeId: null,
          deliveryDate: delivery.createdAt,
          unitCost: unitCostSEK,
          quantity: delivery.quantity,
          remainingQuantity: remainingFromDelivery,
          layerValue: remainingFromDelivery * unitCostSEK,
          ageInDays,
          supplierName: delivery.purchaseOrderDelivery.supplier,
          source: 'delivery',
        })

        quantityBySource.delivery += remainingFromDelivery
        remainingStock -= remainingFromDelivery
      }
    }

    for (const change of stockChanges) {
      if (remainingStock <= 0) break

      const changeDate = new Date(change.createdAt)
      const ageInDays = Math.floor((now.getTime() - changeDate.getTime()) / (1000 * 60 * 60 * 24))
      const remainingFromChange = Math.min(remainingStock, change.quantity)

      if (remainingFromChange > 0) {
        const unitCostSEK = change.unitCostSEK ?? change.unitCost

        layers.push({
          purchaseOrderId: null,
          purchaseOrderDeliveryId: null,
          stockChangeId: change.stockChange.id,
          deliveryDate: change.createdAt,
          unitCost: unitCostSEK,
          quantity: change.quantity,
          remainingQuantity: remainingFromChange,
          layerValue: remainingFromChange * unitCostSEK,
          ageInDays,
          supplierName: null,
          source: 'stockChange',
        })

        quantityBySource.stockChange += remainingFromChange
        remainingStock -= remainingFromChange
      }
    }

    if (remainingStock > 0) {
      quantityBySource.unknown += remainingStock
    }

    const totalValue = layers.reduce((sum, l) => sum + l.layerValue, 0)
    const totalQuantity = layers.reduce((sum, l) => sum + l.remainingQuantity, 0)
    const weightedAgeSum = layers.reduce((sum, l) => sum + l.ageInDays * l.remainingQuantity, 0)

    let primarySource: InventoryLayerSource = 'unknown'
    if (quantityBySource.delivery > 0) {
      primarySource = 'delivery'
    } else if (quantityBySource.stockChange > 0) {
      primarySource = 'stockChange'
    }

    return {
      EAN: ean,
      size: '',  // Unknown from Zettle
      sizeNumber: '',
      currentStock: storeQty,
      totalValue: Math.round(totalValue * 100) / 100,
      weightedAverageCost: totalQuantity > 0 ? Math.round((totalValue / totalQuantity) * 100) / 100 : 0,
      inventoryLayers: layers,
      oldestPurchaseDate: layers.length > 0 ? layers[0].deliveryDate : null,
      newestPurchaseDate: layers.length > 0 ? layers[layers.length - 1].deliveryDate : null,
      averageAgeInDays: totalQuantity > 0 ? Math.round(weightedAgeSum / totalQuantity) : 0,
      maxAgeInDays: layers.length > 0 ? layers[0].ageInDays : 0,
      primarySource,
      quantityBySource,
      stockByLocation: { warehouse: 0, store: storeQty },
      valueByLocation: { warehouse: 0, store: Math.round(totalValue * 100) / 100 },
    }
  }

  /**
   * Calculate value distribution by location (proportional to stock)
   */
  private calculateValueByLocation(
    totalValue: number,
    warehouseQty: number,
    storeQty: number
  ): ValueByLocation {
    const totalStock = warehouseQty + storeQty

    if (totalStock <= 0) {
      return { warehouse: 0, store: 0 }
    }

    const warehouseValue = (warehouseQty / totalStock) * totalValue
    const storeValue = (storeQty / totalStock) * totalValue

    return {
      warehouse: Math.round(warehouseValue * 100) / 100,
      store: Math.round(storeValue * 100) / 100,
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
   * Calculate summary statistics including source distribution and location distribution
   */
  private calculateSummary(products: FifoProductValuation[]): FifoSummary {
    const totalValue = products.reduce((sum, p) => sum + p.totalValue, 0)
    const totalItems = products.reduce((sum, p) => sum + p.totalStock, 0)

    // Calculate age distribution
    const valueByAgeGroup: ValueByAgeGroup = { fresh: 0, aging: 0, old: 0, veryOld: 0 }
    const itemsByAgeGroup: ValueByAgeGroup = { fresh: 0, aging: 0, old: 0, veryOld: 0 }

    // Calculate source distribution
    const itemsBySource: ItemsBySource = { delivery: 0, stockChange: 0, unknown: 0 }
    const valueBySource: ItemsBySource = { delivery: 0, stockChange: 0, unknown: 0 }

    // Calculate location distribution
    const totalStockByLocation: StockByLocation = { warehouse: 0, store: 0 }
    const totalValueByLocation: ValueByLocation = { warehouse: 0, store: 0 }

    for (const product of products) {
      for (const variant of product.variants) {
        for (const size of variant.sizes) {
          // Age distribution from layers
          for (const layer of size.inventoryLayers) {
            const group = getAgeClassification(layer.ageInDays)
            valueByAgeGroup[group] += layer.layerValue
            itemsByAgeGroup[group] += layer.remainingQuantity

            // Source distribution
            itemsBySource[layer.source] += layer.remainingQuantity
            valueBySource[layer.source] += layer.layerValue
          }

          // Track unknown items (stock without any cost data)
          itemsBySource.unknown += size.quantityBySource.unknown

          // Location distribution
          totalStockByLocation.warehouse += size.stockByLocation.warehouse
          totalStockByLocation.store += size.stockByLocation.store
          totalValueByLocation.warehouse += size.valueByLocation.warehouse
          totalValueByLocation.store += size.valueByLocation.store
        }
      }
    }

    // Round values
    valueByAgeGroup.fresh = Math.round(valueByAgeGroup.fresh)
    valueByAgeGroup.aging = Math.round(valueByAgeGroup.aging)
    valueByAgeGroup.old = Math.round(valueByAgeGroup.old)
    valueByAgeGroup.veryOld = Math.round(valueByAgeGroup.veryOld)

    valueBySource.delivery = Math.round(valueBySource.delivery)
    valueBySource.stockChange = Math.round(valueBySource.stockChange)
    valueBySource.unknown = Math.round(valueBySource.unknown)

    totalValueByLocation.warehouse = Math.round(totalValueByLocation.warehouse)
    totalValueByLocation.store = Math.round(totalValueByLocation.store)

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
      unknownCostItems: itemsBySource.unknown, // Legacy field
      itemsBySource,
      valueBySource,
      totalValueByLocation,
      totalStockByLocation,
      calculatedAt: new Date().toISOString(),
    }
  }
}
