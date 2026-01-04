import { CentraConnector, type CentraPODelivery, type CentraPODeliveryLine } from '@/lib/connectors/centra'
import { ElasticsearchConnector, type ESPurchaseDelivery } from '@/lib/connectors/elasticsearch'
import { RiksbankenConnector } from '@/lib/connectors/riksbanken'
import { COMPANIES, type CompanyId } from '@/config/companies'
import type { Env } from '@/types'

export interface SyncResult {
  company: CompanyId
  newDeliveries: number
  newDocuments: number
  errors: number
  maxDeliveryIdBefore: number | null
  maxDeliveryIdAfter: number | null
}

export class DeliverySyncService {
  constructor(private env: Env) {}

  /**
   * Sync purchase order deliveries from Centra to Elasticsearch
   * Only syncs new deliveries (with ID > max existing ID in ES)
   */
  async syncDeliveries(companyId: Exclude<CompanyId, 'all'>): Promise<SyncResult> {
    const esConnector = new ElasticsearchConnector(this.env)

    // Get max delivery ID in ES
    const maxDeliveryIdBefore = await esConnector.getMaxDeliveryId(companyId)
    console.log(`[Sync] Company: ${companyId}, Max delivery ID in ES: ${maxDeliveryIdBefore}`)

    // Get Centra connector config (use b2c or b2b, same API key)
    const company = COMPANIES[companyId]
    const centraConfig = company.connectors?.find(c => c.type === 'centra-b2c' || c.type === 'centra-b2b')
    if (!centraConfig) {
      throw new Error(`No Centra connector configured for ${companyId}`)
    }

    // Fetch new deliveries from Centra
    const centraConnector = new CentraConnector(this.env, centraConfig.envPrefix, false)
    const allDeliveries = await centraConnector.fetchPurchaseOrderDeliveries(maxDeliveryIdBefore ?? undefined)

    console.log(`[Sync] Fetched ${allDeliveries.length} new deliveries from Centra`)

    if (allDeliveries.length === 0) {
      return {
        company: companyId,
        newDeliveries: 0,
        newDocuments: 0,
        errors: 0,
        maxDeliveryIdBefore,
        maxDeliveryIdAfter: maxDeliveryIdBefore,
      }
    }

    // Transform Centra deliveries to ES format (one document per line)
    const riksbanken = new RiksbankenConnector()
    const esDocuments = await this.transformDeliveries(allDeliveries, riksbanken)
    console.log(`[Sync] Transformed to ${esDocuments.length} ES documents`)

    // Save exchange rate cache to disk for future runs
    riksbanken.saveCache()

    // Bulk index to ES
    const { indexed, errors } = await esConnector.savePurchaseDeliveries(companyId, esDocuments)
    console.log(`[Sync] Indexed: ${indexed}, Errors: ${errors}`)

    // Get new max delivery ID
    const maxDeliveryIdAfter = allDeliveries.reduce((max, d) => Math.max(max, d.id), maxDeliveryIdBefore ?? 0)

    return {
      company: companyId,
      newDeliveries: allDeliveries.length,
      newDocuments: indexed,
      errors,
      maxDeliveryIdBefore,
      maxDeliveryIdAfter,
    }
  }

  /**
   * Transform Centra deliveries to ES format
   * One Centra delivery with N lines becomes N ES documents
   */
  private async transformDeliveries(
    deliveries: CentraPODelivery[],
    riksbanken: RiksbankenConnector
  ): Promise<ESPurchaseDelivery[]> {
    const documents: ESPurchaseDelivery[] = []

    for (const delivery of deliveries) {
      // Get the delivery date for exchange rate lookup
      const deliveryDate = delivery.createdAt.split('T')[0]

      // Get unique currencies for this delivery
      const currencies = [...new Set(
        delivery.lines.map(line => line.landedCost?.currency?.code).filter(Boolean)
      )] as string[]

      // Pre-fetch exchange rates for all currencies in this delivery
      const rates = new Map<string, number>()
      for (const currency of currencies) {
        try {
          const rate = await riksbanken.getRate(currency, deliveryDate)
          rates.set(currency, rate)
        } catch (error) {
          console.error(`[Sync] Failed to get rate for ${currency} on ${deliveryDate}:`, error)
          rates.set(currency, 1) // Fallback to 1 if rate lookup fails
        }
      }

      for (const line of delivery.lines) {
        const doc = this.transformLine(delivery, line, rates)
        if (doc) {
          documents.push(doc)
        }
      }
    }

    return documents
  }

  private transformLine(
    delivery: CentraPODelivery,
    line: CentraPODeliveryLine,
    exchangeRates: Map<string, number>
  ): ESPurchaseDelivery | null {
    // Skip lines without product size (shouldn't happen, but be safe)
    if (!line.productSize?.id) {
      console.warn(`[Sync] Skipping line without productSize in delivery ${delivery.id}`)
      return null
    }

    // Generate document ID: {productSizeId}_{deliveryId}
    const id = `${line.productSize.id}_${delivery.id}`

    // Extract product number from SKU (remove size suffix like "AJ", "AK", etc.)
    const productNumber = line.productSize.SKU?.replace(/[A-Z]{2}$/, '') || ''

    // Get currency and exchange rate
    const currency = line.landedCost?.currency?.code || 'SEK'
    const exchangeRate = exchangeRates.get(currency) || 1

    // Calculate costs in original currency
    const unitCost = line.unitCost.value
    const unitCustomsCost = line.customsValue?.value || 0
    // Shipping cost is the difference: landedCost - unitCost - customsCost
    const unitShippingCost = Math.max(0, line.landedCost.value - unitCost - unitCustomsCost)
    const unitTotalCost = line.landedCost.value

    // Total costs = unit × quantity (round to 2 decimals to avoid floating point issues)
    const quantity = line.quantity
    const round2 = (n: number) => Math.round(n * 100) / 100
    const totalProductCost = round2(unitCost * quantity)
    const totalCustomsCost = round2(unitCustomsCost * quantity)
    const totalShippingCost = round2(unitShippingCost * quantity)
    const totalCost = round2(unitTotalCost * quantity)

    // Calculate SEK values
    const unitCostSEK = round2(unitCost * exchangeRate)
    const unitCustomsCostSEK = round2(unitCustomsCost * exchangeRate)
    const unitShippingCostSEK = round2(unitShippingCost * exchangeRate)
    const unitTotalCostSEK = round2(unitTotalCost * exchangeRate)
    const totalProductCostSEK = round2(totalProductCost * exchangeRate)
    const totalCustomsCostSEK = round2(totalCustomsCost * exchangeRate)
    const totalShippingCostSEK = round2(totalShippingCost * exchangeRate)
    const totalCostSEK = round2(totalCost * exchangeRate)

    return {
      id,
      createdAt: delivery.createdAt,
      EAN: line.productSize.EAN,
      productId: line.product.id,
      productName: line.product.name,
      productNumber,
      productVariantName: line.productVariant.name,
      productVariantId: line.productVariant.id,
      productVariantNumber: line.productVariant.variantNumber || '',
      productSizeId: line.productSize.id,
      sizeNumber: line.productSize.sizeNumber,
      quantity,
      purchaseOrderDelivery: {
        id: String(delivery.id),
        status: delivery.status,
        createdAt: delivery.createdAt,
        purchaseOrderId: delivery.purchaseOrder.id,
        purchaseOrderCreatedAt: delivery.purchaseOrder.createdAt,
        supplier: delivery.supplier.name,
      },
      currency,
      exchangeRate,
      unitCost,
      unitCustomsCost,
      unitShippingCost,
      unitTotalCost,
      totalProductCost,
      totalCustomsCost,
      totalShippingCost,
      totalCost,
      unitCostSEK,
      unitCustomsCostSEK,
      unitShippingCostSEK,
      unitTotalCostSEK,
      totalProductCostSEK,
      totalCustomsCostSEK,
      totalShippingCostSEK,
      totalCostSEK,
      error: false,
    }
  }

  /**
   * Sync all configured companies
   */
  async syncAll(): Promise<SyncResult[]> {
    const results: SyncResult[] = []

    for (const companyId of Object.keys(COMPANIES) as CompanyId[]) {
      if (companyId === 'all') continue

      try {
        const result = await this.syncDeliveries(companyId)
        results.push(result)
      } catch (error) {
        console.error(`[Sync] Failed to sync ${companyId}:`, error)
        results.push({
          company: companyId,
          newDeliveries: 0,
          newDocuments: 0,
          errors: 1,
          maxDeliveryIdBefore: null,
          maxDeliveryIdAfter: null,
        })
      }
    }

    return results
  }
}
