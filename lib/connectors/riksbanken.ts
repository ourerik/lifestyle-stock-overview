interface ExchangeRate {
  value: number
  date: string
}

export class RiksbankenConnector {
  private cache: Map<string, number> = new Map()
  private baseUrl = 'https://api.riksbank.se/swea/v1/CrossRates'

  /**
   * Get exchange rate for a currency to SEK on a specific date.
   * If no rate is available for the date (weekends/holidays),
   * tries previous days up to 7 days back.
   */
  async getRate(currency: string, date: string): Promise<number> {
    // SEK to SEK is always 1
    if (currency === 'SEK') return 1

    const cacheKey = `${currency}_${date}`
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!
    }

    // Try to get rate for the date, falling back to previous days
    let currentDate = new Date(date)
    const maxAttempts = 7

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const dateStr = currentDate.toISOString().split('T')[0]

      try {
        const response = await fetch(
          `${this.baseUrl}/${currency}/SEK/${dateStr}`
        )

        if (response.ok) {
          const data: ExchangeRate = await response.json()

          // Cache the rate for both the original date and the actual date
          this.cache.set(cacheKey, data.value)
          this.cache.set(`${currency}_${dateStr}`, data.value)

          console.log(`[Riksbanken] ${currency}/SEK on ${date}: ${data.value} (from ${dateStr})`)
          return data.value
        }

        // 404 or other error - try previous day
        if (response.status === 404) {
          currentDate.setDate(currentDate.getDate() - 1)
          continue
        }

        // Other error - throw
        throw new Error(`Riksbanken API error: ${response.status}`)
      } catch (error) {
        if (attempt === maxAttempts - 1) {
          throw new Error(
            `Failed to get exchange rate for ${currency} on ${date} after ${maxAttempts} attempts: ${error}`
          )
        }
        currentDate.setDate(currentDate.getDate() - 1)
      }
    }

    throw new Error(`No exchange rate found for ${currency} within ${maxAttempts} days of ${date}`)
  }

  /**
   * Batch get rates for multiple currencies on the same date.
   * More efficient when processing multiple deliveries.
   */
  async getRates(currencies: string[], date: string): Promise<Map<string, number>> {
    const rates = new Map<string, number>()

    // Get unique currencies
    const uniqueCurrencies = [...new Set(currencies)]

    // Fetch all rates in parallel
    await Promise.all(
      uniqueCurrencies.map(async (currency) => {
        const rate = await this.getRate(currency, date)
        rates.set(currency, rate)
      })
    )

    return rates
  }
}
