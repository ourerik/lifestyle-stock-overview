/**
 * Debug script to check stock data availability
 */

import * as dotenv from 'dotenv'
dotenv.config({ path: '.env' })

import { ElasticsearchConnector } from '../lib/connectors/elasticsearch'
import type { Env } from '../types'

async function main() {
  const env: Env = process.env as unknown as Env
  const esConnector = new ElasticsearchConnector(env)

  console.log('='.repeat(60))
  console.log('Debugging stock data availability')
  console.log('='.repeat(60))

  // Fetch latest stock (like inventory page does)
  console.log('\n1. Fetching LATEST stock (like inventory page):')
  const latest = await esConnector.fetchStock('varg')
  console.log(`   Date: ${latest.lastUpdated}`)
  console.log(`   Items: ${latest.items.length}`)

  // Fetch specific dates
  const dates = ['2026-01-05', '2026-01-04', '2026-01-03', '2026-01-02', '2026-01-01', '2025-12-31']

  console.log('\n2. Fetching specific dates:')
  for (const date of dates) {
    try {
      const result = await esConnector.fetchStockForSpecificDate('varg', date)
      console.log(`   ${date}: ${result.items.length} items`)
    } catch (e) {
      console.log(`   ${date}: ERROR - ${e}`)
    }
  }

  // Calculate total value for latest
  console.log('\n3. Total quantity in latest stock:')
  const totalQty = latest.items.reduce((sum, item) => sum + item.physicalQuantity, 0)
  console.log(`   Total physical quantity: ${totalQty}`)
}

main().catch(console.error)
