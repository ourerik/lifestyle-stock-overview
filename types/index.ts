// Environment variables / secrets
export interface Env {
  // Auth0
  AUTH0_SECRET?: string;
  AUTH0_BASE_URL?: string;
  AUTH0_ISSUER_BASE_URL?: string;
  AUTH0_CLIENT_ID?: string;
  AUTH0_CLIENT_SECRET?: string;

  // Elasticsearch
  ELASTICSEARCH_URL?: string;
  ELASTICSEARCH_API_KEY?: string;

  // Dynamic access for company-specific secrets
  [key: string]: string | undefined;
}

// Connector configuration types
export type ConnectorType = 'zettle' | 'centra-b2c' | 'centra-b2b';

export interface BaseConnectorConfig {
  type: ConnectorType;
  label: string;
  envPrefix: string;
  showIfZero: boolean;
}

export interface ZettleConnectorConfig extends BaseConnectorConfig {
  type: 'zettle';
}

export interface CentraConnectorConfig extends BaseConnectorConfig {
  type: 'centra-b2c' | 'centra-b2b';
  trackReturns: boolean;
}

export type ConnectorConfig = ZettleConnectorConfig | CentraConnectorConfig;

// Sales data types
export interface SalesData {
  amount: number; // In SEK (whole numbers)
  orderCount: number;
  productCount: number;
}

export interface ConnectorResult {
  label: string;
  sales: SalesData;
  returns?: SalesData; // Only for Centra connectors
  showIfZero: boolean;
}

export interface CompanyResult {
  name: string;
  results: ConnectorResult[];
}

// Zettle API response types
export interface ZettleTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

export interface ZettleProduct {
  quantity: number;
  name?: string;
}

export interface ZettlePurchase {
  purchaseUUID: string;
  amount: number; // In öre (minor units), incl VAT
  vatAmount: number; // In öre (minor units)
  currency: string;
  timestamp: string;
  products?: ZettleProduct[];
}

export interface ZettlePurchasesResponse {
  purchases: ZettlePurchase[];
  firstPurchaseHash?: string;
  lastPurchaseHash?: string;
}

// Period types
export type PeriodType = 'today' | 'week' | 'month' | 'last-week' | 'last-month';
export type ComparisonType = 'period' | 'year';

export interface DateRange {
  start: string; // ISO format for API
  end: string;
  displayLabel: string;
}

export interface PeriodComparison {
  current: DateRange;
  previous: DateRange;
}

// Dashboard data types
export interface SalesOverview {
  current: SalesData;
  previous: SalesData;
  percentChange: number;
}

export interface ChannelSales {
  channel: string;
  label: string;
  sales: SalesOverview;
  returns?: SalesOverview;
}

export interface CompanySummary {
  companyId: string;
  companyName: string;
  totalSales: SalesOverview;
  b2cAverageOrderValue: SalesOverview; // Excludes B2B
  channels: ChannelSales[]; // Channels for this company
}

export interface DashboardData {
  period: PeriodType;
  company: string;
  totalSales: SalesOverview;
  channels: ChannelSales[];
  companySummaries?: CompanySummary[]; // Only for 'all' company view
  dateRanges: {
    current: { start: string; end: string; label: string };
    previous: { start: string; end: string; label: string };
  };
}
