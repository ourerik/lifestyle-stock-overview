import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'

// Cache directory - one file per currency
const CACHE_DIR = join(process.cwd(), 'data', 'exchange-rates')

// Currency to Riksbank series ID mapping
const CURRENCY_SERIES: Record<string, string> = {
  USD: 'SEKUSDPMI',
  EUR: 'SEKEURPMI',
  CAD: 'SEKCADPMI',
}

// In-memory cache: { "USD": { "2024-01-15": 10.45, ... }, ... }
type CurrencyCache = Record<string, number>
type RateCache = Record<string, CurrencyCache>

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export class RiksbankenConnector {
  private cache: RateCache = {}
  private baseUrl = 'https://api.riksbank.se/swea/v1'
  private loadedCurrencies = new Set<string>()
  private dirtyCurrencies = new Set<string>()

  private getCacheFilePath(currency: string): string {
    return join(CACHE_DIR, `${currency}.json`)
  }

  private loadCurrencyCache(currency: string): void {
    if (this.loadedCurrencies.has(currency)) return

    const filePath = this.getCacheFilePath(currency)
    try {
      if (existsSync(filePath)) {
        const data = readFileSync(filePath, 'utf-8')
        this.cache[currency] = JSON.parse(data)
        const count = Object.keys(this.cache[currency]).length
        console.log(`[Riksbanken] Loaded ${count} dates for ${currency}`)
      } else {
        this.cache[currency] = {}
      }
    } catch (error) {
      console.warn(`[Riksbanken] Failed to load ${currency} cache:`, error)
      this.cache[currency] = {}
    }
    this.loadedCurrencies.add(currency)
  }

  private saveCurrencyCache(currency: string): void {
    if (!this.dirtyCurrencies.has(currency)) return

    try {
      if (!existsSync(CACHE_DIR)) {
        mkdirSync(CACHE_DIR, { recursive: true })
      }

      // Sort by date before saving
      const sorted: CurrencyCache = {}
      const dates = Object.keys(this.cache[currency] || {}).sort()
      for (const date of dates) {
        sorted[date] = this.cache[currency][date]
      }

      const filePath = this.getCacheFilePath(currency)
      writeFileSync(filePath, JSON.stringify(sorted, null, 2))
      this.dirtyCurrencies.delete(currency)
      console.log(`[Riksbanken] Saved ${currency} cache (${dates.length} dates)`)
    } catch (error) {
      console.warn(`[Riksbanken] Failed to save ${currency} cache:`, error)
    }
  }

  saveCache(): void {
    for (const currency of this.dirtyCurrencies) {
      this.saveCurrencyCache(currency)
    }
  }

  private getCached(currency: string, date: string): number | null {
    this.loadCurrencyCache(currency)
    return this.cache[currency]?.[date] ?? null
  }

  private setCache(currency: string, date: string, rate: number): void {
    this.loadCurrencyCache(currency)
    if (!this.cache[currency]) {
      this.cache[currency] = {}
    }
    this.cache[currency][date] = rate
    this.dirtyCurrencies.add(currency)
  }

  private findNearestCachedDate(currency: string, targetDate: string): string | null {
    this.loadCurrencyCache(currency)
    const dates = Object.keys(this.cache[currency] || {}).sort()

    // Find the latest date that is <= targetDate
    let nearest: string | null = null
    for (const date of dates) {
      if (date <= targetDate) {
        nearest = date
      } else {
        break
      }
    }
    return nearest
  }

  private getLatestCachedDate(currency: string): string | null {
    this.loadCurrencyCache(currency)
    const dates = Object.keys(this.cache[currency] || {}).sort()
    return dates.length > 0 ? dates[dates.length - 1] : null
  }

  private async fetchDateRange(
    currency: string,
    fromDate: string,
    toDate: string
  ): Promise<void> {
    const seriesId = CURRENCY_SERIES[currency]
    if (!seriesId) {
      console.warn(`[Riksbanken] Unknown currency: ${currency}`)
      return
    }

    const url = `${this.baseUrl}/Observations/${seriesId}/${fromDate}/${toDate}`
    console.log(`[Riksbanken] Fetching ${currency} from ${fromDate} to ${toDate}`)

    try {
      const response = await fetch(url)

      if (response.status === 429) {
        console.log('[Riksbanken] Rate limited, waiting 60s...')
        await delay(60000)
        return this.fetchDateRange(currency, fromDate, toDate)
      }

      if (!response.ok) {
        console.warn(`[Riksbanken] API error: ${response.status}`)
        return
      }

      const text = await response.text()
      if (!text || text.trim() === '') {
        console.log(`[Riksbanken] Empty response for ${currency}`)
        return
      }

      const data = JSON.parse(text)
      if (!Array.isArray(data)) {
        console.warn(`[Riksbanken] Unexpected response format`)
        return
      }

      let count = 0
      for (const obs of data) {
        if (obs.date && typeof obs.value === 'number') {
          this.setCache(currency, obs.date, obs.value)
          count++
        }
      }
      console.log(`[Riksbanken] Cached ${count} rates for ${currency}`)
    } catch (error) {
      console.warn(`[Riksbanken] Failed to fetch ${currency}:`, error)
    }
  }

  async getRate(currency: string, date: string): Promise<number> {
    // SEK to SEK is always 1
    if (currency === 'SEK') return 1

    // Check cache first
    const cached = this.getCached(currency, date)
    if (cached !== null) {
      return cached
    }

    // Date not in cache - try to find nearest bank day
    const nearest = this.findNearestCachedDate(currency, date)
    if (nearest) {
      const rate = this.cache[currency][nearest]
      // Cache for the requested date too (weekend/holiday lookup)
      this.setCache(currency, date, rate)
      return rate
    }

    // No cached data at all - fetch from API
    const latestCached = this.getLatestCachedDate(currency)
    const fromDate = latestCached
      ? this.addDays(latestCached, 1)
      : '2020-01-01'
    const toDate = new Date().toISOString().split('T')[0]

    if (fromDate <= toDate) {
      await this.fetchDateRange(currency, fromDate, toDate)
    }

    // Try again after fetching
    const nearestAfterFetch = this.findNearestCachedDate(currency, date)
    if (nearestAfterFetch) {
      const rate = this.cache[currency][nearestAfterFetch]
      this.setCache(currency, date, rate)
      return rate
    }

    // Still nothing - return 1.0 as fallback
    console.warn(`[Riksbanken] No rate found for ${currency} on ${date}, using 1.0`)
    this.setCache(currency, date, 1)
    return 1
  }

  private addDays(dateStr: string, days: number): string {
    const date = new Date(dateStr)
    date.setDate(date.getDate() + days)
    return date.toISOString().split('T')[0]
  }

  async getRates(currencies: string[], date: string): Promise<Map<string, number>> {
    const rates = new Map<string, number>()
    const uniqueCurrencies = [...new Set(currencies)]

    for (const currency of uniqueCurrencies) {
      const rate = await this.getRate(currency, date)
      rates.set(currency, rate)
    }

    return rates
  }
}
