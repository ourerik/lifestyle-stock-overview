import { ElasticsearchConnector } from '@/lib/connectors/elasticsearch'
import { FifoCalculator } from '@/lib/services/fifo-calculator'
import type { CompanyId } from '@/config/companies'
import type { Env } from '@/types'
import type { FifoValuationData, FifoSizeValuation } from '@/types/fifo'

// Centra CSV row structure
export interface CentraStockRow {
  Brand: string
  SKU: string
  Collection: string
  Product: string
  Variant: string
  VariantSKU: string
  COG: number // Cost of Goods (total value)
  Size: string
  SizeSKU: string
  EAN: string
  UPC: string
  Quantity: number
  CostPrice: number // Unit cost
}

// Comparison result per EAN
export interface ValuationComparison {
  EAN: string
  SKU: string
  product: string
  variant: string
  size: string
  // Centra data
  centraQty: number
  centraCOG: number
  centraCostPrice: number
  // ES FIFO data
  esQty: number
  esFifoValue: number
  esAvgCost: number
  esCostSource: 'delivery' | 'stockChange' | 'unknown'
  // Differences
  qtyDiff: number
  valueDiff: number
  valueDiffPercent: number
  // Analysis
  possibleReason: string
}

export interface ComparisonSummary {
  // Full ES FIFO value (all items in ES)
  totalEsValueFull: number
  totalEsItemsFull: number
  // Centra values
  totalCentraValue: number
  // Matched comparison (items that exist in both systems by EAN)
  totalEsValueMatched: number
  totalDifference: number
  totalDifferencePercent: number
  // Statistics
  itemsCompared: number
  itemsOnlyInCentra: number
  itemsOnlyInEs: number
  itemsWithQtyDiff: number
  itemsWithValueDiff: number
}

export class ValuationComparisonService {
  constructor(private env: Env) {}

  /**
   * Parse Centra CSV file and return structured data
   */
  parseCentraCSV(csvContent: string): CentraStockRow[] {
    const lines = csvContent.split('\n')
    const rows: CentraStockRow[] = []

    // Skip header row (first line)
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      // Parse CSV (handle commas in quoted fields)
      const values = this.parseCSVLine(line)
      if (values.length < 13) continue

      const quantity = parseInt(values[11], 10) || 0
      const cog = parseFloat(values[6]) || 0
      let costPrice = parseFloat(values[12]) || 0

      // Handle #DIV/0! error for zero quantity items
      if (values[12].includes('DIV') || isNaN(costPrice)) {
        costPrice = 0
      }

      rows.push({
        Brand: values[0],
        SKU: values[1],
        Collection: values[2],
        Product: values[3],
        Variant: values[4],
        VariantSKU: values[5],
        COG: cog,
        Size: values[7],
        SizeSKU: values[8],
        EAN: values[9],
        UPC: values[10],
        Quantity: quantity,
        CostPrice: costPrice,
      })
    }

    return rows
  }

  /**
   * Parse a single CSV line, handling quoted fields
   */
  private parseCSVLine(line: string): string[] {
    const result: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]

      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }

    result.push(current.trim())
    return result
  }

  /**
   * Analyze the reason for valuation difference
   */
  private analyzeReason(
    comparison: Omit<ValuationComparison, 'possibleReason'>
  ): string {
    const reasons: string[] = []

    // Quantity difference
    if (comparison.qtyDiff !== 0) {
      reasons.push(`Antal skiljer: ${comparison.qtyDiff > 0 ? '+' : ''}${comparison.qtyDiff}`)
    }

    // No ES data
    if (comparison.esCostSource === 'unknown' || comparison.esQty === 0) {
      reasons.push('Saknar leveransdata i ES')
      return reasons.join('; ')
    }

    // Only in Centra
    if (comparison.esQty === 0 && comparison.centraQty > 0) {
      reasons.push('Finns endast i Centra')
      return reasons.join('; ')
    }

    // Only in ES
    if (comparison.centraQty === 0 && comparison.esQty > 0) {
      reasons.push('Finns endast i ES')
      return reasons.join('; ')
    }

    // Cost per unit difference analysis
    if (comparison.centraQty > 0 && comparison.esQty > 0 && comparison.centraCostPrice > 0) {
      const costDiff = comparison.esAvgCost - comparison.centraCostPrice
      const costDiffPercent = (costDiff / comparison.centraCostPrice) * 100

      if (Math.abs(costDiffPercent) > 1) {
        if (costDiffPercent > 5 && costDiffPercent < 20) {
          reasons.push('Frakt/tull ingår troligen i ES')
        } else if (costDiffPercent > 20) {
          reasons.push('Stor kostnadsskillnad - kontrollera')
        } else if (costDiffPercent < -5) {
          reasons.push('ES-kostnad lägre - växelkurs/tidpunkt')
        } else {
          reasons.push(`Enhetskostnad: ${costDiffPercent > 0 ? '+' : ''}${costDiffPercent.toFixed(1)}%`)
        }
      }
    }

    // Stock change source (less reliable)
    if (comparison.esCostSource === 'stockChange') {
      reasons.push('ES använder stockChange (ej leverans)')
    }

    if (reasons.length === 0) {
      if (Math.abs(comparison.valueDiffPercent) < 1) {
        return 'Minimal avvikelse'
      }
      return 'FIFO vs genomsnittskostnad'
    }

    return reasons.join('; ')
  }

  /**
   * Run the full comparison between Centra and ES using the real FifoCalculator
   */
  async runComparison(
    companyId: Exclude<CompanyId, 'all'>,
    centraData: CentraStockRow[],
    esDate: string
  ): Promise<{ comparisons: ValuationComparison[]; summary: ComparisonSummary }> {
    // Use the real FifoCalculator (same as inventory page)
    const fifoCalculator = new FifoCalculator(this.env)

    console.log(`[Comparison] Running FIFO calculation for ${companyId} on ${esDate}`)
    const fifoData = await fifoCalculator.calculateValuation(companyId, undefined, esDate)
    console.log(`[Comparison] FIFO calculation complete: ${fifoData.products.length} products`)

    // Build a map of EAN -> FIFO size valuation
    const fifoByEan = new Map<string, {
      sizeValuation: FifoSizeValuation
      productNumber: string
      productName: string
      variantName: string
    }>()

    for (const product of fifoData.products) {
      for (const variant of product.variants) {
        for (const size of variant.sizes) {
          fifoByEan.set(size.EAN, {
            sizeValuation: size,
            productNumber: product.productNumber,
            productName: product.productName,
            variantName: variant.variantName,
          })
        }
      }
    }

    // Create Centra map by EAN
    const centraByEan = new Map<string, CentraStockRow>()
    for (const row of centraData) {
      if (row.EAN) {
        centraByEan.set(row.EAN, row)
      }
    }

    // Get all unique EANs
    const allEans = new Set([...fifoByEan.keys(), ...centraByEan.keys()])

    const comparisons: ValuationComparison[] = []
    let itemsOnlyInCentra = 0
    let itemsOnlyInEs = 0
    let itemsWithQtyDiff = 0
    let itemsWithValueDiff = 0

    for (const ean of allEans) {
      const centra = centraByEan.get(ean)
      const esFifo = fifoByEan.get(ean)

      if (!centra && !esFifo) continue

      // Get Centra values
      const centraQty = centra?.Quantity ?? 0
      const centraCOG = centra?.COG ?? 0
      const centraCostPrice = centra?.CostPrice ?? 0

      // Get ES FIFO values (from real calculator)
      const esQty = esFifo?.sizeValuation.currentStock ?? 0
      const esFifoValue = esFifo?.sizeValuation.totalValue ?? 0
      const esAvgCost = esFifo?.sizeValuation.weightedAverageCost ?? 0
      const esCostSource = esFifo?.sizeValuation.primarySource ?? 'unknown'

      // Calculate differences
      const qtyDiff = esQty - centraQty
      const valueDiff = esFifoValue - centraCOG
      const valueDiffPercent = centraCOG > 0
        ? ((valueDiff / centraCOG) * 100)
        : (esFifoValue > 0 ? 100 : 0)

      // Track statistics
      // "Only in Centra" = Centra has stock but ES has none (or no EAN match)
      if (centraQty > 0 && esQty === 0) itemsOnlyInCentra++
      // "Only in ES" = ES has stock but Centra has none (or no EAN match)
      if (esQty > 0 && centraQty === 0) itemsOnlyInEs++
      if (qtyDiff !== 0) itemsWithQtyDiff++
      if (Math.abs(valueDiffPercent) > 1) itemsWithValueDiff++

      const comparison: Omit<ValuationComparison, 'possibleReason'> = {
        EAN: ean,
        SKU: centra?.SKU ?? esFifo?.productNumber ?? '',
        product: centra?.Product ?? esFifo?.productName ?? '',
        variant: centra?.Variant ?? esFifo?.variantName ?? '',
        size: centra?.Size ?? esFifo?.sizeValuation.size ?? '',
        centraQty,
        centraCOG: Math.round(centraCOG * 100) / 100,
        centraCostPrice: Math.round(centraCostPrice * 100) / 100,
        esQty,
        esFifoValue: Math.round(esFifoValue * 100) / 100,
        esAvgCost: Math.round(esAvgCost * 100) / 100,
        esCostSource,
        qtyDiff,
        valueDiff: Math.round(valueDiff * 100) / 100,
        valueDiffPercent: Math.round(valueDiffPercent * 100) / 100,
      }

      comparisons.push({
        ...comparison,
        possibleReason: this.analyzeReason(comparison),
      })
    }

    // Sort by absolute value difference (largest first)
    comparisons.sort((a, b) => Math.abs(b.valueDiff) - Math.abs(a.valueDiff))

    // Calculate summary
    const totalCentraValue = comparisons.reduce((sum, c) => sum + c.centraCOG, 0)
    const totalEsValueMatched = comparisons.reduce((sum, c) => sum + c.esFifoValue, 0)
    const totalDifference = totalEsValueMatched - totalCentraValue
    const totalDifferencePercent = totalCentraValue > 0
      ? (totalDifference / totalCentraValue) * 100
      : 0

    // Full ES value from FIFO data (all items, not just matched)
    const totalEsValueFull = fifoData.summary.totalValue
    const totalEsItemsFull = fifoData.summary.totalItems

    const summary: ComparisonSummary = {
      totalEsValueFull: Math.round(totalEsValueFull),
      totalEsItemsFull,
      totalCentraValue: Math.round(totalCentraValue),
      totalEsValueMatched: Math.round(totalEsValueMatched),
      totalDifference: Math.round(totalDifference),
      totalDifferencePercent: Math.round(totalDifferencePercent * 100) / 100,
      itemsCompared: comparisons.length,
      itemsOnlyInCentra,
      itemsOnlyInEs,
      itemsWithQtyDiff,
      itemsWithValueDiff,
    }

    return { comparisons, summary }
  }

  /**
   * Generate CSV content from comparisons
   */
  generateCSV(comparisons: ValuationComparison[], summary: ComparisonSummary): string {
    const headers = [
      'EAN',
      'SKU',
      'Produkt',
      'Variant',
      'Storlek',
      'Centra Antal',
      'Centra COG (SEK)',
      'Centra Enhetskostnad',
      'ES Antal',
      'ES FIFO-värde (SEK)',
      'ES Snittkostnad',
      'ES Källa',
      'Antal Diff',
      'Värde Diff (SEK)',
      'Värde Diff %',
      'Möjlig Orsak',
    ]

    const rows = comparisons.map(c => [
      c.EAN,
      c.SKU,
      `"${c.product}"`,
      `"${c.variant}"`,
      c.size,
      c.centraQty,
      c.centraCOG,
      c.centraCostPrice,
      c.esQty,
      c.esFifoValue,
      c.esAvgCost,
      c.esCostSource,
      c.qtyDiff,
      c.valueDiff,
      c.valueDiffPercent,
      `"${c.possibleReason}"`,
    ])

    // Add summary rows at the end
    const summaryRows = [
      [],
      ['SAMMANFATTNING'],
      [],
      ['ES FIFO TOTALT (alla produkter)'],
      ['ES Total FIFO-värde (SEK)', summary.totalEsValueFull],
      ['ES Totalt antal enheter', summary.totalEsItemsFull],
      [],
      ['JÄMFÖRELSE (matchade EAN)'],
      ['Centra-värde (SEK)', summary.totalCentraValue],
      ['ES FIFO-värde matchat (SEK)', summary.totalEsValueMatched],
      ['Skillnad matchat (SEK)', summary.totalDifference],
      ['Skillnad matchat (%)', summary.totalDifferencePercent],
      [],
      ['EAN som ej kunde matchas'],
      ['ES-värde ej i Centra (SEK)', summary.totalEsValueFull - summary.totalEsValueMatched],
      [],
      ['STATISTIK'],
      ['Antal EAN jämförda', summary.itemsCompared],
      ['Endast i Centra (saknar EAN)', summary.itemsOnlyInCentra],
      ['Endast i ES', summary.itemsOnlyInEs],
      ['Med kvantitetsskillnad', summary.itemsWithQtyDiff],
      ['Med värdeskillnad (>1%)', summary.itemsWithValueDiff],
    ]

    const csvLines = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
      ...summaryRows.map(row => row.join(',')),
    ]

    return csvLines.join('\n')
  }
}
