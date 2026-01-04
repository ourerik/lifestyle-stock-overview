import type { Env, SalesData } from '@/types';

interface CentraGraphQLResponse {
  data?: {
    orders: CentraGraphQLOrder[];
  };
  errors?: Array<{ message: string }>;
}

interface CentraPODeliveryResponse {
  data?: {
    purchaseOrderDeliveries: CentraPODelivery[];
  };
  errors?: Array<{ message: string }>;
}

export interface CentraPODelivery {
  id: number;
  number: string;
  status: string;
  createdAt: string;
  supplier: { id: number; name: string };
  warehouse: { id: number; name: string } | null;
  purchaseOrder: { id: number; createdAt: string };
  lines: CentraPODeliveryLine[];
}

interface CentraCostValue {
  value: number;
  currency: { code: string };
}

export interface CentraPODeliveryLine {
  quantity: number;
  unitCost: CentraCostValue;
  landedCost: CentraCostValue;
  customsValue: CentraCostValue;
  productSize: {
    id: number;
    EAN: string | null;
    SKU: string | null;
    sizeNumber: string | null;
  };
  product: { id: number; name: string };
  productVariant: { id: number; name: string; variantNumber: string | null };
}

interface CentraGraphQLOrder {
  number: number;
  status: string;
  grandTotal: {
    value: number;
    currency: { code: string };
    conversionRate: number;
  };
  totals: {
    taxIncluded: {
      value: number;
    };
  };
  lines: Array<{
    quantity: number;
  }>;
}

export class CentraConnector {
  private baseUrl: string;
  private apiKey: string;
  private isB2B: boolean;

  constructor(env: Env, envPrefix: string, isB2B: boolean) {
    // Ensure baseUrl ends with /graphql
    let url = (env[`${envPrefix}_BASE_URL`] as string)?.replace(/\/$/, '') || '';
    if (!url.endsWith('/graphql')) {
      url = url + '/graphql';
    }
    this.baseUrl = url;
    this.apiKey = env[`${envPrefix}_API_KEY`] as string;
    this.isB2B = isB2B;

    if (!this.baseUrl || !this.apiKey) {
      throw new Error(`Missing Centra credentials for ${envPrefix}`);
    }
  }

  async fetchSales(
    startDate: string,
    endDate: string
  ): Promise<{ sales: SalesData; returns: SalesData }> {
    // Convert dates to Centra format (YYYY-MM-DD HH:MM:SS)
    const fromDate = startDate.replace('T', ' ');
    const toDate = endDate.replace('T', ' ');

    const storeType = this.isB2B ? 'WHOLESALE' : 'DIRECT_TO_CONSUMER';

    const query = `
      query GetOrders($from: DateTimeTz!, $to: DateTimeTz!, $storeType: StoreType!, $page: Int!) {
        orders(
          where: {
            createdAt: { from: $from, to: $to }
            storeType: $storeType
          }
          limit: 100
          page: $page
        ) {
          number
          status
          grandTotal {
            value
            currency { code }
            conversionRate
          }
          totals {
            taxIncluded {
              value
            }
          }
          lines {
            quantity
          }
        }
      }
    `;

    let allOrders: CentraGraphQLOrder[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          query,
          variables: {
            from: fromDate,
            to: toDate,
            storeType,
            page,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Centra GraphQL failed: ${response.status} - ${errorText}`);
      }

      const result: CentraGraphQLResponse = await response.json();

      if (result.errors && result.errors.length > 0) {
        throw new Error(`Centra GraphQL errors: ${result.errors.map((e) => e.message).join(', ')}`);
      }

      const orders = result.data?.orders || [];
      allOrders = allOrders.concat(orders);

      // If we got less than 100, we've reached the end
      if (orders.length < 100) {
        hasMore = false;
      } else {
        page++;
      }
    }

    // Separate orders and returns based on status
    const regularOrders = allOrders.filter((o) => !this.isReturn(o));
    const returns = allOrders.filter((o) => this.isReturn(o));

    // Calculate net value: grandTotal - taxIncluded, then convert to SEK
    const getBaseAmount = (order: CentraGraphQLOrder): number => {
      const gross = order.grandTotal?.value || 0;
      const tax = order.totals?.taxIncluded?.value || 0;
      const net = gross - tax;
      const rate = order.grandTotal?.conversionRate || 1;
      return net * rate; // Convert to SEK if needed (rate=1 for SEK)
    };

    // Sum quantities from all lines in an order
    const getProductCount = (order: CentraGraphQLOrder): number => {
      return (order.lines || []).reduce((sum, line) => sum + Number(line.quantity || 0), 0);
    };

    return {
      sales: {
        amount: Math.round(regularOrders.reduce((sum, o) => sum + getBaseAmount(o), 0)),
        orderCount: regularOrders.length,
        productCount: regularOrders.reduce((sum, o) => sum + getProductCount(o), 0),
      },
      returns: {
        // Returns shown as negative
        amount: Math.round(returns.reduce((sum, o) => sum + getBaseAmount(o), 0)) * -1,
        orderCount: returns.length,
        productCount: returns.reduce((sum, o) => sum + getProductCount(o), 0),
      },
    };
  }

  private isReturn(order: CentraGraphQLOrder): boolean {
    const returnStatuses = ['returned', 'refunded', 'return', 'cancelled'];
    return returnStatuses.includes(order.status?.toLowerCase() || '');
  }

  /**
   * Fetch all purchase order deliveries with status INSERTED (completed deliveries)
   * @param sinceId - Only fetch deliveries with id > sinceId (for incremental sync)
   */
  async fetchPurchaseOrderDeliveries(sinceId?: number): Promise<CentraPODelivery[]> {
    const query = `
      query GetPODeliveries($page: Int!) {
        purchaseOrderDeliveries(
          limit: 100
          page: $page
          where: { status: INSERTED }
        ) {
          id
          number
          status
          createdAt
          supplier { id name }
          warehouse { id name }
          purchaseOrder { id createdAt }
          lines {
            quantity
            unitCost { value currency { code } }
            landedCost { value currency { code } }
            customsValue { value currency { code } }
            productSize { id EAN SKU sizeNumber }
            product { id name }
            productVariant { id name variantNumber }
          }
        }
      }
    `;

    let allDeliveries: CentraPODelivery[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          query,
          variables: { page },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Centra GraphQL failed: ${response.status} - ${errorText}`);
      }

      const result: CentraPODeliveryResponse = await response.json();

      if (result.errors && result.errors.length > 0) {
        throw new Error(`Centra GraphQL errors: ${result.errors.map((e) => e.message).join(', ')}`);
      }

      const deliveries = result.data?.purchaseOrderDeliveries || [];

      // Filter deliveries if sinceId is provided
      const filtered = sinceId
        ? deliveries.filter(d => d.id > sinceId)
        : deliveries;

      allDeliveries = allDeliveries.concat(filtered);

      // If we got less than 100, we've reached the end
      if (deliveries.length < 100) {
        hasMore = false;
      } else {
        page++;
      }
    }

    return allDeliveries;
  }
}
