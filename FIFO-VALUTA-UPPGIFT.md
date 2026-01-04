# FIFO Lagervärde - Valutakonvertering

## Bakgrund
Vi har implementerat FIFO-baserad lagervärdesberäkning som hämtar inköpsorderleveranser från Centra och beräknar lagervärde. **Problemet är att kostnaderna sparas i originalvaluta (USD/EUR) utan konvertering till SEK.**

## Nuvarande implementation

### Filer som finns
- `lib/connectors/centra.ts` - Hämtar `purchaseOrderDeliveries` från Centra GraphQL
- `lib/connectors/elasticsearch.ts` - Sparar/hämtar leveranser från ES
- `lib/services/delivery-sync.ts` - Synkar leveranser från Centra → ES
- `lib/services/fifo-calculator.ts` - Beräknar FIFO-värden
- `app/api/cron/sync-deliveries/route.ts` - Cron endpoint för synk
- `app/api/inventory/valuation/route.ts` - API för FIFO-data
- `types/fifo.ts` - TypeScript-typer
- `components/inventory/product-detail-sheet.tsx` - UI som visar lagervärde/ålder

### ES-index
- `varg_purchasing_order_deliveries`
- `sneaky_purchasing_order_deliveries`

## Problemet
Centra returnerar kostnader i leverantörens valuta:
- Svenska leverantörer: SEK
- Kinesiska/Litauiska: USD eller EUR

Centra har ett `converted`-fält men det använder växelkurs från **PO-skapandedatum**, inte leveransdatum. Exempel:
- PO #48 skapad 2025-03-10, levererad 2025-11-29
- Centras kurs: 10.51 USD/SEK (från mars)
- Verklig kurs vid leverans: ~9.20 USD/SEK

## Lösning: Riksbanken API

### API-endpoint
```
GET https://api.riksbank.se/swea/v1/CrossRates/{fromCurrency}/{toCurrency}/{date}
```

Exempel:
```bash
curl "https://api.riksbank.se/swea/v1/CrossRates/USD/SEK/2025-11-29"
# Returnerar: {"value": 10.8234, "date": "2025-11-29"}
```

### Implementation

#### 1. Skapa Riksbanken connector
**Fil:** `lib/connectors/riksbanken.ts`

```typescript
interface ExchangeRate {
  value: number
  date: string
}

export class RiksbankenConnector {
  private cache: Map<string, number> = new Map()

  async getRate(currency: string, date: string): Promise<number> {
    if (currency === 'SEK') return 1

    const cacheKey = `${currency}_${date}`
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!
    }

    const response = await fetch(
      `https://api.riksbank.se/swea/v1/CrossRates/${currency}/SEK/${date}`
    )
    const data: ExchangeRate = await response.json()

    this.cache.set(cacheKey, data.value)
    return data.value
  }
}
```

#### 2. Uppdatera Centra connector
Utöka GraphQL-queryn att hämta valutakod:

```graphql
lines {
  quantity
  unitCost { value currency { code } }
  landedCost { value currency { code } }
  customsValue { value currency { code } }
  ...
}
```

Uppdatera typer:
```typescript
export interface CentraPODeliveryLine {
  unitCost: { value: number; currency: { code: string } }
  landedCost: { value: number; currency: { code: string } }
  customsValue: { value: number; currency: { code: string } }
  ...
}
```

#### 3. Uppdatera ES-struktur
Lägg till i `ESPurchaseDelivery`:
```typescript
currency: string           // Originalvaluta (USD, EUR, SEK)
exchangeRate: number       // Kurs vid leveransdatum
unitCostSEK: number        // Konverterat värde
unitTotalCostSEK: number   // landedCost konverterat
```

#### 4. Uppdatera delivery-sync.ts
I `transformLine()`:
1. Hämta valutakod från Centra-data
2. Hämta växelkurs från Riksbanken för `delivery.createdAt`
3. Konvertera alla kostnader till SEK
4. Spara både original och konverterade värden

#### 5. Re-synka all data
Eftersom befintlig data saknar valutakonvertering måste vi:
1. Ta bort gamla index eller
2. Uppdatera alla dokument med nya fält

Enklast: Töm index och kör full synk igen (inga `sinceId`-filter).

## Testdata

### PO #48 (delivery 148) - Fidelity Manufacturing (USD)
```json
{
  "deliveryDate": "2025-11-29",
  "unitCost": { "value": 31.25, "currency": "USD" },
  "landedCost": { "value": 36.82, "currency": "USD" }
}
```

Med Riksbankens kurs ~10.82 för 2025-11-29:
- unitCostSEK: 31.25 × 10.82 = 338.13 SEK
- landedCostSEK: 36.82 × 10.82 = 398.39 SEK

### PO #31 (delivery 147) - Omniteksas (EUR)
```json
{
  "deliveryDate": "2025-11-29",
  "unitCost": { "value": 49.8, "currency": "EUR" },
  "landedCost": { "value": 49.8, "currency": "EUR" }
}
```

## Ordning

1. Skapa `lib/connectors/riksbanken.ts`
2. Uppdatera `lib/connectors/centra.ts` - lägg till currency i query
3. Uppdatera `lib/connectors/elasticsearch.ts` - nya fält i ESPurchaseDelivery
4. Uppdatera `lib/services/delivery-sync.ts` - valutakonvertering
5. Uppdatera `lib/services/fifo-calculator.ts` - använd `unitTotalCostSEK`
6. Töm ES-index och kör full synk
7. Testa i UI

## Kommandon

Synka leveranser (efter implementation):
```bash
curl -X POST http://localhost:3000/api/cron/sync-deliveries \
  -H "Authorization: Bearer fifo-sync-secret-2024"
```

Testa valuation:
```bash
curl "http://localhost:3000/api/inventory/valuation?company=varg&productNumber=AW127-W"
```
