export type CompanyId = 'all' | 'varg' | 'sneaky-steve' | 'disentis';

export interface ConnectorConfig {
  type: 'zettle' | 'centra-b2c' | 'centra-b2b' | 'centra-b2b-shipped';
  label: string;
  envPrefix: string;
  showIfZero?: boolean;
  trackReturns?: boolean;
  excludeFromTotals?: boolean;
}

export interface CompanyConfig {
  id: CompanyId;
  name: string;
  displayName: string;
  connectors?: ConnectorConfig[];
  companies?: CompanyId[]; // For 'all' - which companies to aggregate
}

export const COMPANIES: Record<CompanyId, CompanyConfig> = {
  all: {
    id: 'all',
    name: 'Översikt',
    displayName: 'Alla bolag',
    companies: ['sneaky-steve', 'varg', 'disentis'],
  },
  varg: {
    id: 'varg',
    name: 'Varg',
    displayName: 'Varg',
    connectors: [
      { type: 'zettle', label: 'Event', envPrefix: 'VARG_ZETTLE', showIfZero: false },
      { type: 'centra-b2c', label: 'Web', envPrefix: 'VARG_CENTRA', showIfZero: true, trackReturns: true },
      { type: 'centra-b2b-shipped', label: 'B2B', envPrefix: 'VARG_CENTRA', showIfZero: true },
      { type: 'centra-b2b', label: 'B2B', envPrefix: 'VARG_CENTRA', showIfZero: true, trackReturns: true, excludeFromTotals: true },
    ],
  },
  'sneaky-steve': {
    id: 'sneaky-steve',
    name: 'Sneaky Steve',
    displayName: 'Sneaky Steve',
    connectors: [
      { type: 'zettle', label: 'Store', envPrefix: 'SNEAKY_ZETTLE', showIfZero: true },
      { type: 'centra-b2c', label: 'Web', envPrefix: 'SNEAKY_CENTRA', showIfZero: true, trackReturns: true },
      { type: 'centra-b2b-shipped', label: 'B2B', envPrefix: 'SNEAKY_CENTRA', showIfZero: true },
      { type: 'centra-b2b', label: 'B2B', envPrefix: 'SNEAKY_CENTRA', showIfZero: true, trackReturns: true, excludeFromTotals: true },
    ],
  },
  disentis: {
    id: 'disentis',
    name: 'Disentis',
    displayName: 'Disentis',
    connectors: [
      { type: 'centra-b2c', label: 'Web', envPrefix: 'DISENTIS_CENTRA', showIfZero: true, trackReturns: true },
    ],
  },
};

export const COMPANY_LIST = Object.values(COMPANIES);

// Feature allowlist: which companies can access the "Experiment" (product-media)
// AI image generation feature. Used by UI menu gating AND server-side access
// checks so we only need one allowlist to update.
const PRODUCT_MEDIA_COMPANIES: CompanyId[] = ['sneaky-steve', 'varg', 'disentis'];

export function canUseProductMedia(companyId: CompanyId): boolean {
  return PRODUCT_MEDIA_COMPANIES.includes(companyId);
}

/**
 * Resolve the Centra env prefix (e.g. 'SNEAKY_CENTRA', 'VARG_CENTRA') for a
 * company by looking up its B2C connector. Used where we need to instantiate
 * a CentraConnector without hardcoding prefixes per company.
 */
export function getCentraEnvPrefix(companyId: CompanyId): string {
  const config = COMPANIES[companyId]
  const b2c = config?.connectors?.find((c) => c.type === 'centra-b2c')
  if (!b2c) {
    throw new Error(`No centra-b2c connector configured for company "${companyId}"`)
  }
  return b2c.envPrefix
}
