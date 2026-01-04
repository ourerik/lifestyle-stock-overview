import { ElasticsearchConnector, type ESExchangeRate } from './elasticsearch'
import type { Env } from '@/types'

// Currency to Riksbank series ID mapping
const CURRENCY_SERIES: Record<string, string> = {
  USD: 'SEKUSDPMI',
  EUR: 'SEKEURPMI',
  CAD: 'SEKCADPMI',
}

// In-memory cache: { "USD": { "2024-01-15": 10.45, ... }, ... }
type CurrencyCache = Map<string, number>
type RateCache = Map<string, CurrencyCache>

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export class RiksbankenConnector {
  private cache: RateCache = new Map()
  private baseUrl = 'https://api.riksbank.se/swea/v1'
  private loadedCurrencies = new Set<string>()
  private pendingRates: ESExchangeRate[] = []
  private es: ElasticsearchConnector

  constructor(env: Env) {
    this.es = new ElasticsearchConnector(env)
  }

  private async loadCurrencyCache(currency: string): Promise<void> {
    if (this.loadedCurrencies.has(currency)) return

    try {
      const rates = await this.es.fetchExchangeRates(currency)
      this.cache.set(currency, rates)
      console.log(`[Riksbanken] Loaded ${rates.size} dates for ${currency} from ES`)
    } catch (error) {
      console.warn(`[Riksbanken] Failed to load ${currency} cache from ES:`, error)
      this.cache.set(currency, new Map())
    }
    this.loadedCurrencies.add(currency)
  }

  /**
   * Save any pending rates to Elasticsearch
   * Call this after processing is complete
   */
  async saveCache(): Promise<void> {
    if (this.pendingRates.length === 0) return

    try {
      const result = await this.es.saveExchangeRates(this.pendingRates)
      console.log(`[Riksbanken] Saved ${result.indexed} rates to ES`)
      this.pendingRates = []
    } catch (error) {
      console.warn(`[Riksbanken] Failed to save rates to ES:`, error)
    }
  }

  private getCached(currency: string): CurrencyCache {
    if (!this.cache.has(currency)) {
      this.cache.set(currency, new Map())
    }
    return this.cache.get(currency)!
  }

  private setCache(currency: string, date: string, rate: number): void {
    const currencyCache = this.getCached(currency)
    if (!currencyCache.has(date)) {
      currencyCache.set(date, rate)
      this.pendingRates.push({ currency, date, rate })
    }
  }

  private findNearestCachedDate(currency: string, targetDate: string): string | null {
    const currencyCache = this.getCached(currency)
    const dates = [...currencyCache.keys()].sort()

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
    const currencyCache = this.getCached(currency)
    const dates = [...currencyCache.keys()].sort()
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

    // Ensure cache is loaded from ES
    await this.loadCurrencyCache(currency)

    // Check cache first
    const currencyCache = this.getCached(currency)
    const cached = currencyCache.get(date)
    if (cached !== undefined) {
      return cached
    }

    // Date not in cache - try to find nearest bank day
    const nearest = this.findNearestCachedDate(currency, date)
    if (nearest) {
      const rate = currencyCache.get(nearest)!
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
      const rate = currencyCache.get(nearestAfterFetch)!
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
