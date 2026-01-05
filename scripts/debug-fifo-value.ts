/**
 * Debug script to verify FIFO value matches inventory page
 */

import * as dotenv from 'dotenv'
dotenv.config({ path: '.env' })

import { FifoCalculator } from '../lib/services/fifo-calculator'
import type { Env } from '../types'

async function main() {
  const env: Env = process.env as unknown as Env
  const fifoCalculator = new FifoCalculator(env)

  console.log('='.repeat(60))
  console.log('Verifying FIFO calculation matches inventory page')
  console.log('='.repeat(60))

  // Calculate FIFO without specific date (like inventory page does)
  console.log('\n1. FIFO for LATEST stock (like inventory page):')
  const latest = await fifoCalculator.calculateValuation('varg')
  console.log(`   Total value: ${latest.summary.totalValue.toLocaleString('sv-SE')} SEK`)
  console.log(`   Total items: ${latest.summary.totalItems}`)
  console.log(`   Products: ${latest.products.length}`)

  // Calculate FIFO for specific date
  console.log('\n2. FIFO for 2026-01-01:')
  const jan01 = await fifoCalculator.calculateValuation('varg', undefined, '2026-01-01')
  console.log(`   Total value: ${jan01.summary.totalValue.toLocaleString('sv-SE')} SEK`)
  console.log(`   Total items: ${jan01.summary.totalItems}`)
  console.log(`   Products: ${jan01.products.length}`)
}

main().catch(console.error)
