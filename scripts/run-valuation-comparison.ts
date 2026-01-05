/**
 * Script to run valuation comparison between Centra and Elasticsearch
 * Usage: npx tsx scripts/run-valuation-comparison.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env' })

import { ValuationComparisonService } from '../lib/services/valuation-comparison'
import type { Env } from '../types'

async function main() {
  const company = 'varg' as const
  const date = '2026-01-01'
  const csvFileName = 'vargStockDecember.csv'

  console.log('='.repeat(60))
  console.log('Lagervärdering: Centra vs Elasticsearch FIFO')
  console.log('='.repeat(60))
  console.log(`Företag: ${company}`)
  console.log(`Datum: ${date}`)
  console.log(`CSV-fil: ${csvFileName}`)
  console.log('')

  const env: Env = process.env as unknown as Env

  // Verify ES credentials
  if (!env.ELASTICSEARCH_URL || !env.ELASTICSEARCH_API_KEY) {
    console.error('ERROR: Missing ELASTICSEARCH_URL or ELASTICSEARCH_API_KEY in .env.local')
    process.exit(1)
  }

  const service = new ValuationComparisonService(env)

  // Read CSV file
  const projectRoot = process.cwd()
  const csvPath = path.join(projectRoot, csvFileName)

  if (!fs.existsSync(csvPath)) {
    console.error(`ERROR: CSV file not found: ${csvPath}`)
    process.exit(1)
  }

  console.log('Läser Centra CSV...')
  const csvContent = fs.readFileSync(csvPath, 'utf-8')
  const centraData = service.parseCentraCSV(csvContent)
  console.log(`  ${centraData.length} rader inlästa från Centra`)

  // Run comparison
  console.log('')
  console.log('Kör jämförelse...')
  const { comparisons, summary } = await service.runComparison(company, centraData, date)

  // Print summary
  console.log('')
  console.log('='.repeat(60))
  console.log('SAMMANFATTNING')
  console.log('='.repeat(60))
  console.log('')
  console.log('ES FIFO TOTALT (alla produkter i ES):')
  console.log(`  Totalt värde:         ${summary.totalEsValueFull.toLocaleString('sv-SE')} SEK`)
  console.log(`  Totalt antal enheter: ${summary.totalEsItemsFull.toLocaleString('sv-SE')}`)
  console.log('')
  console.log('JÄMFÖRELSE (matchade EAN):')
  console.log(`  Centra-värde:         ${summary.totalCentraValue.toLocaleString('sv-SE')} SEK`)
  console.log(`  ES FIFO matchat:      ${summary.totalEsValueMatched.toLocaleString('sv-SE')} SEK`)
  console.log(`  Skillnad:             ${summary.totalDifference > 0 ? '+' : ''}${summary.totalDifference.toLocaleString('sv-SE')} SEK (${summary.totalDifferencePercent > 0 ? '+' : ''}${summary.totalDifferencePercent.toFixed(2)}%)`)
  console.log('')
  console.log('EJ MATCHAT:')
  console.log(`  ES-värde ej i Centra: ${(summary.totalEsValueFull - summary.totalEsValueMatched).toLocaleString('sv-SE')} SEK`)
  console.log('')
  console.log('STATISTIK:')
  console.log(`  Antal EAN jämförda:   ${summary.itemsCompared}`)
  console.log(`  Endast i Centra:      ${summary.itemsOnlyInCentra}`)
  console.log(`  Endast i ES:          ${summary.itemsOnlyInEs}`)
  console.log(`  Med kvantitetsskillnad: ${summary.itemsWithQtyDiff}`)
  console.log(`  Med värdeskillnad >1%:  ${summary.itemsWithValueDiff}`)

  // Show top 20 largest differences
  console.log('')
  console.log('='.repeat(60))
  console.log('TOP 20 STÖRSTA AVVIKELSER (absolut värde)')
  console.log('='.repeat(60))

  const top20 = comparisons.slice(0, 20)
  for (const item of top20) {
    console.log(`${item.SKU} ${item.variant} ${item.size}`)
    console.log(`  Centra: ${item.centraQty} st × ${item.centraCostPrice} = ${item.centraCOG.toLocaleString('sv-SE')} SEK`)
    console.log(`  ES:     ${item.esQty} st × ${item.esAvgCost} = ${item.esFifoValue.toLocaleString('sv-SE')} SEK`)
    console.log(`  Diff:   ${item.valueDiff.toLocaleString('sv-SE')} SEK (${item.valueDiffPercent.toFixed(1)}%)`)
    console.log(`  Orsak:  ${item.possibleReason}`)
    console.log('')
  }

  // Generate and save CSV
  const csvOutput = service.generateCSV(comparisons, summary)
  const outputPath = path.join(projectRoot, `valuation-comparison-${company}-${date}.csv`)
  fs.writeFileSync(outputPath, csvOutput, 'utf-8')
  console.log('='.repeat(60))
  console.log(`CSV-rapport sparad: ${outputPath}`)
  console.log('='.repeat(60))
}

main().catch(console.error)
