# Lifestyle Stock Overview

Dashboard-applikation för att visa försäljnings- och lagerdata för Varg och Sneaky Steve.

## Kom igång

```bash
# Installera dependencies
npm install

# Kopiera environment variables
cp .env.example .env.local

# Starta dev-server
npm run dev
```

Öppna [http://localhost:3000](http://localhost:3000) i webbläsaren.

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **UI:** Shadcn UI (Maia style, blue theme, Noto Sans)
- **Auth:** Auth0 (TBD)
- **Deploy:** Cloudflare Pages (TBD)
- **Data:**
  - Centra GraphQL (försäljning B2C/B2B)
  - Zettle API (butiksförsäljning)
  - Elasticsearch (lagerdata - TBD)

## Features

### Företagsväljare
Dropdown i sidebaren med val mellan:
- **Översikt** - aggregerad data för båda bolagen
- **Varg** - endast Varg-data
- **Sneaky Steve** - endast Sneaky Steve-data

### Försäljningskanaler
| Bolag | Kanaler |
|-------|---------|
| Varg | Event (Zettle), Web (B2C), B2B |
| Sneaky Steve | Store (Zettle), Web (B2C), B2B |

### Peridjämförelser
| Period | Jämförs med |
|--------|-------------|
| Idag | Igår |
| Denna vecka (mån → nu) | Förra veckan (samma dagar) |
| Denna månad (1:a → nu) | Förra månaden (1:a → samma dag) |
| Förra veckan | Veckan innan |
| Förra månaden | Månaden innan |

### Lageranalys (TBD)
- Aktuellt lagersaldo från Elasticsearch
- FIFO-beräkning (äldsta artikelns inköpsdatum)

## Mappstruktur

```
├── app/
│   ├── layout.tsx                 # Root layout med providers
│   └── page.tsx                   # Dashboard
│
├── components/
│   ├── ui/                        # Shadcn komponenter
│   ├── layout/
│   │   ├── app-sidebar.tsx        # Sidebar med företagsväljare
│   │   ├── header.tsx             # Header med periodväljare
│   │   └── period-selector.tsx    # Dropdown för periodval
│   └── dashboard/
│       ├── sales-card.tsx         # Återanvändbart KPI-kort
│       └── channel-breakdown.tsx  # Kanalfördelning med progress bars
│
├── lib/
│   ├── connectors/
│   │   ├── centra.ts              # Centra GraphQL connector
│   │   └── zettle.ts              # Zettle API connector
│   ├── services/
│   │   └── sales-aggregator.ts    # Aggregerar data från alla källor
│   └── utils/
│       ├── date.ts                # Periodberäkningar
│       └── currency.ts            # Valutaformatering
│
├── config/
│   └── companies.ts               # Företagskonfiguration
│
├── providers/
│   ├── company-provider.tsx       # Context för företagsval
│   └── period-provider.tsx        # Context för periodval
│
└── types/
    └── index.ts                   # TypeScript-typer
```

## Komponenter

Alla komponenter är **generiska och återanvändbara**:

### SalesCard
Visar försäljningsdata med jämförelse mot föregående period.

```tsx
<SalesCard
  title="Total försäljning"
  data={{ current, previous, percentChange }}
  comparisonLabel="vs igår"
/>
```

### ChannelBreakdown
Visar försäljning per kanal med progress bars och returer.

```tsx
<ChannelBreakdown channels={channelData} loading={false} />
```

## Environment Variables

Se `.env.example` för alla variabler som behövs.

## Status

### Klart
- [x] Next.js projekt med Shadcn UI
- [x] Sidebar med företagsväljare
- [x] Periodväljare (idag, vecka, månad)
- [x] Dashboard-layout med KPI-kort
- [x] Centra GraphQL connector
- [x] Zettle API connector
- [x] Period-calculator med svensk tidszon
- [x] Valutaformatering

### Kvar att göra
- [ ] Auth0 integration
- [ ] Cloudflare deployment
- [ ] API-routes för data
- [ ] Elasticsearch connector
- [ ] Lagervy med FIFO-beräkning
