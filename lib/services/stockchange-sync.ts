import { CentraConnector, type CentraStockChangeLine } from '@/lib/connectors/centra'
import { ElasticsearchConnector, type ESStockChange } from '@/lib/connectors/elasticsearch'
import { RiksbankenConnector } from '@/lib/connectors/riksbanken'
import { COMPANIES, type CompanyId } from '@/config/companies'
import type { Env } from '@/types'

export interface StockChangeSyncResult {
  company: CompanyId
  newLines: number
  newDocuments: number
  errors: number
  maxChangeIdBefore: number | null
  maxChangeIdAfter: number | null
}

export class StockChangeSyncService {
  constructor(private env: Env) {}

  async syncStockChanges(companyId: Exclude<CompanyId, 'all'>): Promise<StockChangeSyncResult> {
    const esConnector = new ElasticsearchConnector(this.env)

    // Get max stock change ID in ES
    const maxChangeIdBefore = await esConnector.getMaxStockChangeId(companyId)
    console.log(`[StockSync] Company: ${companyId}, Max change ID in ES: ${maxChangeIdBefore}`)

    // Get Centra connector config
    const company = COMPANIES[companyId]
    const centraConfig = company.connectors?.find(c => c.type === 'centra-b2c' || c.type === 'centra-b2b')
    if (!centraConfig) {
      throw new Error(`No Centra connector configured for ${companyId}`)
    }

    // Fetch new stock change lines from Centra
    const centraConnector = new CentraConnector(this.env, centraConfig.envPrefix, false)
    const allLines = await centraConnector.fetchStockChangeLines(maxChangeIdBefore ?? undefined)

    console.log(`[StockSync] Fetched ${allLines.length} stock change lines from Centra`)

    if (allLines.length === 0) {
      return {
        company: companyId,
        newLines: 0,
        newDocuments: 0,
        errors: 0,
        maxChangeIdBefore,
        maxChangeIdAfter: maxChangeIdBefore,
      }
    }

    // Transform to ES format
    const riksbanken = new RiksbankenConnector()
    const esDocuments = await this.transformLines(allLines, riksbanken)
    console.log(`[StockSync] Transformed to ${esDocuments.length} ES documents`)

    // Save exchange rate cache
    riksbanken.saveCache()

    // Bulk index to ES
    const { indexed, errors } = await esConnector.saveStockChanges(companyId, esDocuments)
    console.log(`[StockSync] Indexed: ${indexed}, Errors: ${errors}`)

    // Get new max change ID
    const maxChangeIdAfter = allLines.reduce(
      (max, l) => Math.max(max, l.stockChange.id),
      maxChangeIdBefore ?? 0
    )

    return {
      company: companyId,
      newLines: allLines.length,
      newDocuments: indexed,
      errors,
      maxChangeIdBefore,
      maxChangeIdAfter,
    }
  }

  private async transformLines(
    lines: CentraStockChangeLine[],
    riksbanken: RiksbankenConnector
  ): Promise<ESStockChange[]> {
    const documents: ESStockChange[] = []

    // Group by date for efficient rate lookup
    const byDate = new Map<string, CentraStockChangeLine[]>()
    for (const line of lines) {
      const date = line.stockChange.createdAt.split('T')[0]
      if (!byDate.has(date)) {
        byDate.set(date, [])
      }
      byDate.get(date)!.push(line)
    }

    for (const [date, dateLines] of byDate) {
      // Get unique currencies for this date
      const currencies = [...new Set(
        dateLines
          .map(line => line.unitCost?.currency?.code)
          .filter(Boolean)
      )] as string[]

      // Pre-fetch exchange rates
      const rates = new Map<string, number>()
      for (const currency of currencies) {
        try {
          const rate = await riksbanken.getRate(currency, date)
          rates.set(currency, rate)
        } catch (error) {
          console.error(`[StockSync] Failed to get rate for ${currency} on ${date}:`, error)
          rates.set(currency, 1)
        }
      }

      for (const line of dateLines) {
        const doc = this.transformLine(line, rates)
        if (doc) {
          documents.push(doc)
        }
      }
    }

    return documents
  }

  private transformLine(
    line: CentraStockChangeLine,
    exchangeRates: Map<string, number>
  ): ESStockChange | null {
    // Skip lines without product size or with zero/negative quantity
    if (!line.productSize?.id || line.deliveredQuantity <= 0) {
      return null
    }

    // Skip lines without cost info (we need cost for valuation)
    if (!line.unitCost?.value) {
      return null
    }

    // Generate document ID
    const id = `${line.productSize.id}_${line.stockChange.id}_${line.id}`

    // Extract product number from SKU
    const productNumber = line.productSize.SKU?.replace(/[A-Z]{2}$/, '') || ''

    // Get currency and exchange rate
    const currency = line.unitCost.currency?.code || 'SEK'
    const exchangeRate = exchangeRates.get(currency) || line.currencyBaseRate || 1

    const round2 = (n: number) => Math.round(n * 100) / 100
    const unitCost = line.unitCost.value
    const quantity = line.deliveredQuantity
    const totalCost = round2(unitCost * quantity)

    // Calculate SEK values
    const unitCostSEK = round2(unitCost * exchangeRate)
    const totalCostSEK = round2(totalCost * exchangeRate)

    // Access product info through nested structure
    const productVariant = line.productSize.productVariant
    const product = productVariant?.product

    return {
      id,
      createdAt: line.stockChange.createdAt,
      EAN: line.productSize.EAN,
      productId: product?.id || 0,
      productName: product?.name || 'Unknown',
      productNumber,
      productVariantName: productVariant?.name || '',
      productVariantId: productVariant?.id || 0,
      productVariantNumber: productVariant?.variantNumber || '',
      productSizeId: line.productSize.id,
      sizeNumber: line.productSize.sizeNumber,
      quantity,
      stockChange: {
        id: String(line.stockChange.id),
        type: line.stockChange.type,
        comment: line.stockChange.comment,
        warehouse: line.stockChange.warehouse?.name || null,
      },
      currency,
      exchangeRate,
      unitCost,
      totalCost,
      unitCostSEK,
      totalCostSEK,
    }
  }

  async syncAll(): Promise<StockChangeSyncResult[]> {
    const results: StockChangeSyncResult[] = []

    for (const companyId of Object.keys(COMPANIES) as CompanyId[]) {
      if (companyId === 'all') continue

      try {
        const result = await this.syncStockChanges(companyId)
        results.push(result)
      } catch (error) {
        console.error(`[StockSync] Failed to sync ${companyId}:`, error)
        results.push({
          company: companyId,
          newLines: 0,
          newDocuments: 0,
          errors: 1,
          maxChangeIdBefore: null,
          maxChangeIdAfter: null,
        })
      }
    }

    return results
  }
}
