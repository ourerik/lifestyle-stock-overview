# Plan: Mobilanpassning + Komponentstandardisering

> **Status:** Pågående
> **Senast uppdaterad:** 2026-01-06

---

## Klart

### Fas 1: Grundläggande komponenter

| Uppgift | Status | Fil |
|---------|--------|-----|
| Installera shadcn breadcrumb + checkbox | ✅ Klar | `components/ui/breadcrumb.tsx`, `components/ui/checkbox.tsx` |
| Skapa KpiCard | ✅ Klar | `components/ui/kpi-card.tsx` |
| Skapa useColumnVisibility hook | ✅ Klar | `hooks/use-column-visibility.ts` |
| Skapa DataTable | ✅ Klar | `components/ui/data-table.tsx` |
| Skapa useBottomBarConfig hook | ✅ Klar | `hooks/use-bottom-bar-config.ts` |

### Fas 2: Layout-komponenter

| Uppgift | Status | Fil |
|---------|--------|-----|
| Uppdatera Header med Breadcrumb | ✅ Klar | `components/layout/header.tsx` |
| Skapa MobileBottomBar | ✅ Klar | `components/layout/mobile-bottom-bar.tsx` |
| Lägg till MobileBottomBar i layout | ✅ Klar | `app/layout.tsx` |
| Dölj SidebarTrigger på mobil | ✅ Klar | `components/layout/header.tsx` |

### Fas 3: Uppdatera sidor med nya Header-props

| Sida | Status |
|------|--------|
| `app/page.tsx` | ✅ Klar |
| `app/[company]/page.tsx` | ✅ Klar |
| `app/[company]/inventory/page.tsx` | ✅ Klar |
| `app/[company]/deliveries/page.tsx` | ✅ Klar |
| `app/[company]/performance/page.tsx` | ✅ Klar |
| `app/[company]/settings/ad-costs/page.tsx` | ✅ Klar |
| `components/access-denied.tsx` | ✅ Klar |

### Fas 4: Migrera Performance-sidan

| Uppgift | Status |
|---------|--------|
| Ersätt lokal KpiCard med standardiserad | ✅ Klar |
| KPI-kort med horisontell scroll på mobil | ✅ Klar |
| Ersätt PerformanceTable med DataTable | ✅ Klar |
| Kolumnväljare för tabellen | ✅ Klar |

---

## Kvarvarande

### Fas 5: Migrera övriga sidor

| Sida | Uppgift | Status |
|------|---------|--------|
| Inventory | Ersätt lokala SummaryCard med KpiCard | ✅ Klar |
| Inventory | Ersätt InventoryTable med DataTable | ✅ Klar |
| Deliveries | Ersätt lokal SummaryCard med KpiCard | ✅ Klar |
| Deliveries | Ersätt DeliveryTable med DataTable | ✅ Klar |
| Dashboard | Ersätt SalesCard med KpiCard | ⏳ Ej påbörjad |
| Dashboard | Behåll MetricRow i company-card | ✅ Beslut: Behålls |
| Settings | Ersätt ad-costs-list med DataTable | ⏳ Ej påbörjad |

### Fas 6: Städa upp gamla komponenter

| Fil | Status |
|-----|--------|
| `components/performance/performance-table.tsx` | ⏳ Kan tas bort |
| `components/dashboard/sales-card.tsx` | ⏳ Väntar på Dashboard-migrering |
| `components/inventory/inventory-table.tsx` | ⏳ Kan tas bort |
| `components/deliveries/delivery-table.tsx` | ⏳ Kan tas bort |

---

## Nya komponenter (dokumentation)

### KpiCard (`components/ui/kpi-card.tsx`)

```tsx
interface KpiCardProps {
  title: string
  value: string | number
  subtitle?: string
  change?: number | null        // % förändring
  suffix?: string               // t.ex. "%" eller "st"
  icon?: LucideIcon
  loading?: boolean
  invertColors?: boolean        // för metriker där lägre är bättre
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'warning' | 'info'
  format?: 'number' | 'currency' | 'none'
  comparisonLabel?: string      // t.ex. "vs förra året"
  className?: string
}
```

### DataTable (`components/ui/data-table.tsx`)

```tsx
interface Column<T> {
  id: string
  label: string
  accessor: keyof T | ((row: T) => ReactNode)
  sortable?: boolean
  align?: 'left' | 'right' | 'center'
  width?: string
  defaultVisible?: boolean
  format?: 'currency' | 'percent' | 'number' | 'date'
  colorCode?: (value: any, row: T) => 'default' | 'success' | 'warning' | 'danger'
  renderCell?: (value: any, row: T) => ReactNode
}

interface DataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  tableId: string               // för localStorage
  loading?: boolean
  emptyMessage?: string
  onRowClick?: (row: T) => void
  rowKey: keyof T | ((row: T) => string)
  showColumnSelector?: boolean
  defaultSortField?: string
  defaultSortOrder?: 'asc' | 'desc'
  // Kontrollerad sortering (för server-side)
  sortBy?: string | null
  sortOrder?: 'asc' | 'desc'
  onSort?: (field: string) => void
  actions?: (row: T) => ReactNode
  mobileFullBleed?: boolean     // full-bleed scroll på mobil
}
```

### MobileBottomBar (`components/layout/mobile-bottom-bar.tsx`)

- Fixed bottom bar på mobil (md:hidden)
- 4 slots: 3 anpassningsbara + 1 menyknapp
- Long-press (500ms) för att konfigurera slot
- Sparar i localStorage: `mobile-bottom-bar-slots`

### Header (`components/layout/header.tsx`)

```tsx
interface HeaderProps {
  companyName?: string
  companySlug?: string
  pageName: string
}
```

- Visar breadcrumb: `{companyName} / {pageName}`
- SidebarTrigger dold på mobil

---

## localStorage-nycklar

| Nyckel | Användning |
|--------|------------|
| `table-columns-{tableId}` | Synliga kolumner per tabell |
| `mobile-bottom-bar-slots` | Anpassade snabblänkar i bottom bar |
| `performance-period` | Vald tidsperiod på Performance-sidan |

**tableId-värden:**
- `performance-products` - Performance-tabellen
- `inventory-products` - Inventory-tabellen
- `deliveries` - Deliveries-tabellen

---

## Testa

Följande kan testas nu:

1. **Performance-sidan** (`/sneaky-steve/performance`)
   - KPI-kort scrollar horisontellt på mobil
   - Tabell med kolumnväljare
   - Horisontell scroll på tabell

2. **Inventory-sidan** (`/sneaky-steve/inventory`)
   - KPI-kort scrollar horisontellt på mobil
   - Tabell med kolumnväljare och sortering
   - Produktdetaljer via radklick

3. **Deliveries-sidan** (`/sneaky-steve/deliveries`)
   - KPI-kort scrollar horisontellt på mobil
   - Tabell med server-side sortering
   - Paginering

4. **Bottom bar** (alla sidor på mobil)
   - 3 snabblänkar + menyknapp
   - Long-press för att ändra snabblänk
   - Meny öppnas från botten

5. **Breadcrumb** (alla sidor)
   - Visar `Företag / Sida` format
   - Klickbar länk till företagets dashboard
