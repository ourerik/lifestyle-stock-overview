export type CompanyId = 'all' | 'varg' | 'sneaky-steve';

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
    companies: ['sneaky-steve', 'varg'],
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
};

export const COMPANY_LIST = Object.values(COMPANIES);
