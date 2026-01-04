import { writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'

const BASE_URL = 'https://api.riksbank.se/swea/v1'
const CACHE_DIR = join(process.cwd(), 'data', 'exchange-rates')

// Currency to Riksbank series ID mapping
const CURRENCY_SERIES: Record<string, string> = {
  USD: 'SEKUSDPMI',
  EUR: 'SEKEURPMI',
  CAD: 'SEKCADPMI',
}

interface Observation {
  date: string
  value: number
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

async function fetchDateRange(
  seriesId: string,
  fromDate: string,
  toDate: string
): Promise<Observation[]> {
  const url = `${BASE_URL}/Observations/${seriesId}/${fromDate}/${toDate}`
  console.log(`Fetching: ${url}`)

  const response = await fetch(url)

  if (!response.ok) {
    if (response.status === 429) {
      console.log('Rate limited, waiting 60s...')
      await delay(60000)
      return fetchDateRange(seriesId, fromDate, toDate)
    }
    throw new Error(`API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()

  // API returns array of observations
  if (!Array.isArray(data)) {
    console.log('Unexpected response format:', data)
    return []
  }

  return data.map((obs: { date: string; value: number }) => ({
    date: obs.date,
    value: obs.value,
  }))
}

function sortObjectByKeys(obj: Record<string, number>): Record<string, number> {
  const sorted: Record<string, number> = {}
  const keys = Object.keys(obj).sort()
  for (const key of keys) {
    sorted[key] = obj[key]
  }
  return sorted
}

async function populateCurrency(currency: string, fromDate: string, toDate: string) {
  const seriesId = CURRENCY_SERIES[currency]
  if (!seriesId) {
    console.error(`Unknown currency: ${currency}`)
    return
  }

  console.log(`\n=== Populating ${currency} (${seriesId}) ===`)
  console.log(`Date range: ${fromDate} to ${toDate}`)

  const observations = await fetchDateRange(seriesId, fromDate, toDate)
  console.log(`Received ${observations.length} observations`)

  if (observations.length === 0) {
    console.log('No observations received')
    return
  }

  // Convert to cache format: { "2020-01-02": 9.45, ... }
  const cache: Record<string, number> = {}
  for (const obs of observations) {
    cache[obs.date] = obs.value
  }

  // Sort by date
  const sortedCache = sortObjectByKeys(cache)

  // Save to file
  const filePath = join(CACHE_DIR, `${currency}.json`)
  writeFileSync(filePath, JSON.stringify(sortedCache, null, 2))
  console.log(`Saved to ${filePath}`)

  // Show date range
  const dates = Object.keys(sortedCache)
  console.log(`Date range in cache: ${dates[0]} to ${dates[dates.length - 1]}`)
}

async function main() {
  const fromDate = '2020-01-01'
  const toDate = new Date().toISOString().split('T')[0]

  console.log('Populating exchange rates cache')
  console.log(`From: ${fromDate}`)
  console.log(`To: ${toDate}`)

  // Ensure cache directory exists
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true })
    console.log(`Created directory: ${CACHE_DIR}`)
  }

  const currencies = Object.keys(CURRENCY_SERIES)

  for (const currency of currencies) {
    await populateCurrency(currency, fromDate, toDate)
    // Small delay between currencies to be nice to the API
    await delay(1000)
  }

  console.log('\n=== Done ===')
}

main().catch(console.error)
