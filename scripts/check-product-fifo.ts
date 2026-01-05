/**
 * Script to check FIFO data for a specific product
 * Usage: npx tsx scripts/check-product-fifo.ts
 */

import 'dotenv/config'

const ELASTICSEARCH_URL = process.env.ELASTICSEARCH_URL!
const ELASTICSEARCH_API_KEY = process.env.ELASTICSEARCH_API_KEY!

// The product number pattern - in ES it's stored as AW12-W-OW-{size}
const PRODUCT_PATTERN = 'AW12-W-OW'
const VARIANT_NAME = 'Off White'
const COMPANY = 'varg'

interface ESPurchaseDelivery {
  id: string
  createdAt: string
  productNumber: string
  productVariantName: string
  productVariantId: number
  sizeNumber: string | null
  quantity: number
  purchaseOrderDelivery: {
    id: string
    purchaseOrderId: number
    supplier: string
  }
  unitTotalCostSEK: number
  EAN: string | null
}

interface StockItem {
  productNumber: string
  variantName: string
  variantId: number
  size: string
  sizeNumber: string
  physicalQuantity: number
  EAN: string | null
}

async function esRequest<T>(path: string, body?: object): Promise<T> {
  const response = await fetch(`${ELASTICSEARCH_URL}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      'Authorization': `ApiKey ${ELASTICSEARCH_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`ES request failed: ${response.status} - ${errorText}`)
  }

  return response.json()
}

async function fetchDeliveries(): Promise<ESPurchaseDelivery[]> {
  // Search for all products matching the pattern (e.g., AW12-W-OW*)
  const result = await esRequest<{
    hits: {
      hits: Array<{ _source: ESPurchaseDelivery }>
    }
  }>(`/${COMPANY}_purchasing_order_deliveries_v2/_search`, {
    size: 10000,
    query: {
      wildcard: { 'productNumber.keyword': `${PRODUCT_PATTERN}*` }
    },
    sort: [{ createdAt: 'asc' }],
    _source: [
      'id', 'createdAt', 'productNumber', 'productVariantName', 'productVariantId',
      'sizeNumber', 'quantity', 'purchaseOrderDelivery', 'unitTotalCostSEK', 'EAN'
    ],
  })

  console.log(`\n✅ Hittade ${result.hits.hits.length} leveransrader för produkter som matchar ${PRODUCT_PATTERN}*`)

  return result.hits.hits.map(h => h._source)
}

interface StockData {
  quantity: number
  EAN: string | null
  variantId: number
  sizeNumber: string
}

async function fetchCurrentStock(): Promise<Map<string, StockData>> {
  // Find the latest stock index date
  const latestResult = await esRequest<{
    aggregations?: { max_date: { value_as_string: string } }
  }>(`/${COMPANY}_stock-*/_search`, {
    size: 0,
    aggs: { max_date: { max: { field: 'date' } } }
  })

  const maxDate = latestResult.aggregations?.max_date?.value_as_string?.split('T')[0]
  if (!maxDate) {
    console.log('No stock data found')
    return new Map()
  }

  console.log(`📅 Lagersaldo per: ${maxDate}`)

  // Try searching by productNumber first (base product number without size)
  const BASE_PRODUCT = 'AW12-W'
  const stockResult = await esRequest<{
    hits: {
      hits: Array<{ _source: StockItem & { productNumber: string } }>
    }
  }>(`/${COMPANY}_stock-*/_search`, {
    size: 10000,
    query: {
      bool: {
        must: [
          { term: { date: maxDate } },
          { term: { 'productNumber.keyword': BASE_PRODUCT } },
          { term: { 'variantName.keyword': VARIANT_NAME } },
        ]
      }
    },
    _source: ['productNumber', 'variantName', 'variantId', 'size', 'sizeNumber', 'physicalQuantity', 'EAN'],
  })

  console.log(`   Hittade ${stockResult.hits.hits.length} lagerrader för ${BASE_PRODUCT} / ${VARIANT_NAME}`)

  // Show what sizes we found in stock
  console.log('\n   Lagersaldo per storlek (från stock index):')
  const stockBySize = new Map<string, StockData>()
  for (const hit of stockResult.hits.hits) {
    const size = hit._source.size
    const qty = hit._source.physicalQuantity
    const ean = hit._source.EAN
    const variantId = hit._source.variantId
    const sizeNumber = hit._source.sizeNumber
    stockBySize.set(size, { quantity: qty, EAN: ean, variantId, sizeNumber })
    console.log(`   • ${size}: ${qty} st (EAN: ${ean || 'SAKNAS'}, variantId: ${variantId}, sizeNumber: ${sizeNumber})`)
  }

  return stockBySize
}

function formatDate(isoDate: string): string {
  const d = new Date(isoDate)
  return d.toLocaleDateString('sv-SE', { year: 'numeric', month: 'short', day: 'numeric' })
}

// Mapping from delivery sizeNumber to stock size name
const SIZE_MAP: Record<string, string> = {
  '-2': 'XS',
  '-3': 'S',
  '-4': 'M',
  '-5': 'L',
  '-6': 'XL',
  '07': 'XXL',
}

function mapSize(sizeNumber: string | null): string {
  if (!sizeNumber) return 'Unknown'
  return SIZE_MAP[sizeNumber] || sizeNumber
}

async function searchProducts(searchTerm: string): Promise<void> {
  console.log(`\n🔎 Söker efter produkter som innehåller "${searchTerm}"...`)

  const result = await esRequest<{
    aggregations?: {
      products: {
        buckets: Array<{
          key: string
          variants: { buckets: Array<{ key: string; doc_count: number }> }
        }>
      }
    }
  }>(`/${COMPANY}_purchasing_order_deliveries_v2/_search`, {
    size: 0,
    query: {
      wildcard: { 'productNumber.keyword': `*${searchTerm}*` }
    },
    aggs: {
      products: {
        terms: { field: 'productNumber.keyword', size: 50 },
        aggs: {
          variants: {
            terms: { field: 'productVariantName.keyword', size: 50 }
          }
        }
      }
    }
  })

  const products = result.aggregations?.products.buckets || []
  if (products.length === 0) {
    console.log('   Inga produkter hittades!')
    return
  }

  console.log(`\n   Hittade ${products.length} produkt(er):`)
  for (const p of products) {
    console.log(`\n   📦 ${p.key}`)
    for (const v of p.variants.buckets) {
      console.log(`      • ${v.key} (${v.doc_count} leveranser)`)
    }
  }
}

async function main() {
  console.log('=' .repeat(80))
  console.log(`FIFO-analys för: ${PRODUCT_PATTERN}* - ${VARIANT_NAME}`)
  console.log('=' .repeat(80))

  // Fetch all deliveries and current stock
  const [deliveries, stockBySize] = await Promise.all([
    fetchDeliveries(),
    fetchCurrentStock(),
  ])

  if (deliveries.length === 0) {
    console.log('\n❌ Inga leveranser hittades för denna produkt/variant!')
    return
  }

  // Group deliveries by size (mapped to readable names)
  const deliveriesBySize = new Map<string, ESPurchaseDelivery[]>()
  for (const d of deliveries) {
    const size = mapSize(d.sizeNumber)
    if (!deliveriesBySize.has(size)) {
      deliveriesBySize.set(size, [])
    }
    deliveriesBySize.get(size)!.push(d)
  }

  // Sort sizes in a logical order
  const sizeOrder = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']
  const sortedSizes = [...deliveriesBySize.keys()].sort((a, b) => {
    const ai = sizeOrder.indexOf(a)
    const bi = sizeOrder.indexOf(b)
    if (ai === -1 && bi === -1) return a.localeCompare(b)
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })

  // Process each size
  for (const size of sortedSizes) {
    const sizeDeliveries = deliveriesBySize.get(size)!
    const stockData = stockBySize.get(size)
    const currentStock = stockData?.quantity || 0
    const stockEAN = stockData?.EAN

    const stockVariantId = stockData?.variantId
    const stockSizeNumber = stockData?.sizeNumber

    console.log('\n' + '-'.repeat(80))
    console.log(`📦 Storlek: ${size}`)
    console.log(`   Nuvarande lagersaldo: ${currentStock} st`)
    console.log(`   Stock EAN: ${stockEAN || 'SAKNAS'}`)
    console.log(`   Stock variantId: ${stockVariantId}, sizeNumber: ${stockSizeNumber}`)
    console.log(`   Size key: ${stockVariantId}-${stockSizeNumber}`)
    console.log('-'.repeat(80))

    // Show all deliveries for this size with key comparison
    console.log('\n   Alla leveranser (äldsta först):')
    let totalDelivered = 0
    for (const d of sizeDeliveries) {
      totalDelivered += d.quantity
      const deliverySizeKey = `${d.productVariantId}-${d.sizeNumber}`
      const stockSizeKey = `${stockVariantId}-${stockSizeNumber}`
      const keyMatch = deliverySizeKey === stockSizeKey ? '✅' : '❌'
      console.log(`   • ${formatDate(d.createdAt)}: ${d.quantity} st @ ${d.unitTotalCostSEK.toFixed(2)} SEK/st (PO #${d.purchaseOrderDelivery.purchaseOrderId})`)
      console.log(`     Delivery key: ${deliverySizeKey} ${keyMatch} (matchar stock key: ${keyMatch === '✅' ? 'JA' : 'NEJ'})`)
    }
    console.log(`   Totalt levererat: ${totalDelivered} st`)

    // Apply CORRECT FIFO logic: oldest stock is SOLD first, remaining is from NEWEST
    console.log('\n   FIFO-allokering av nuvarande lager:')

    // Calculate how much was sold (consumed from oldest first)
    const sold = totalDelivered - currentStock
    let remainingToSell = Math.max(0, sold)
    const fifoLayers: { date: string; qty: number; cost: number }[] = []

    for (const d of sizeDeliveries) {
      // How much of this delivery was sold?
      const soldFromDelivery = Math.min(remainingToSell, d.quantity)
      remainingToSell -= soldFromDelivery

      // What remains from this delivery?
      const remainingFromDelivery = d.quantity - soldFromDelivery

      if (remainingFromDelivery > 0) {
        fifoLayers.push({
          date: d.createdAt,
          qty: remainingFromDelivery,
          cost: d.unitTotalCostSEK,
        })
      }
    }

    if (fifoLayers.length === 0) {
      console.log('   (Inget lager kvar)')
    } else {
      for (const layer of fifoLayers) {
        console.log(`   → ${layer.qty} st från ${formatDate(layer.date)} @ ${layer.cost.toFixed(2)} SEK/st`)
      }
      // The oldest REMAINING stock determines the purchase date
      console.log(`\n   ⏰ Äldsta inköpsdatum som visas i systemet: ${formatDate(fifoLayers[0].date)}`)
    }
  }

  // Summary
  console.log('\n' + '='.repeat(80))
  console.log('SAMMANFATTNING')
  console.log('='.repeat(80))

  let totalStock = 0
  let oldestOverall: string | null = null

  for (const size of sortedSizes) {
    const stockData = stockBySize.get(size)
    const currentStock = stockData?.quantity || 0
    totalStock += currentStock

    const sizeDeliveries = deliveriesBySize.get(size)!
    const totalDeliveredForSize = sizeDeliveries.reduce((sum, d) => sum + d.quantity, 0)
    const sold = totalDeliveredForSize - currentStock
    let remainingToSell = Math.max(0, sold)

    // Find the oldest layer that still has remaining stock
    for (const d of sizeDeliveries) {
      const soldFromDelivery = Math.min(remainingToSell, d.quantity)
      remainingToSell -= soldFromDelivery
      const remainingFromDelivery = d.quantity - soldFromDelivery

      if (remainingFromDelivery > 0) {
        // This is the oldest remaining layer for this size
        if (!oldestOverall || d.createdAt < oldestOverall) {
          oldestOverall = d.createdAt
        }
        break // Found the oldest remaining, stop
      }
    }
  }

  console.log(`\nTotalt lagersaldo för ${VARIANT_NAME}: ${totalStock} st`)
  if (oldestOverall) {
    console.log(`Äldsta inköpsdatum (för hela varianten): ${formatDate(oldestOverall)}`)
  }
}

main().catch(console.error)
