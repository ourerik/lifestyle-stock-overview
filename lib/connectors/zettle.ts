import type { Env, SalesData, ZettleTokenResponse, ZettlePurchasesResponse } from '@/types';
import type { ZettleInventoryItem } from '@/types/inventory';

const TOKEN_URL = 'https://oauth.zettle.com/token';
const PURCHASES_URL = 'https://purchase.izettle.com/purchases/v2';
const INVENTORY_URL = 'https://inventory.izettle.com/v3/stock';
const LOCATIONS_URL = 'https://inventory.izettle.com/v3/locations';
const PRODUCTS_URL = 'https://products.izettle.com/organizations/self/products/v2';

export class ZettleConnector {
  private clientId: string;
  private apiKey: string;

  constructor(env: Env, envPrefix: string) {
    this.clientId = env[`${envPrefix}_CLIENT_ID`] as string;
    this.apiKey = env[`${envPrefix}_API_KEY`] as string;

    if (!this.clientId || !this.apiKey) {
      throw new Error(`Missing Zettle credentials for ${envPrefix}`);
    }
  }

  private async getAccessToken(): Promise<string> {
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        client_id: this.clientId,
        assertion: this.apiKey,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Zettle auth failed: ${response.status} - ${errorText}`);
    }

    const data: ZettleTokenResponse = await response.json();
    return data.access_token;
  }

  async fetchSales(startDate: string, endDate: string): Promise<SalesData> {
    const token = await this.getAccessToken();
    let allPurchases: ZettlePurchasesResponse['purchases'] = [];
    let lastPurchaseHash: string | undefined;

    do {
      const params = new URLSearchParams({
        startDate,
        endDate,
        limit: '1000',
      });
      if (lastPurchaseHash) {
        params.append('lastPurchaseHash', lastPurchaseHash);
      }

      const response = await fetch(`${PURCHASES_URL}?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Zettle purchases failed: ${response.status} - ${errorText}`);
      }

      const data: ZettlePurchasesResponse = await response.json();
      allPurchases = allPurchases.concat(data.purchases || []);
      lastPurchaseHash = data.lastPurchaseHash;
    } while (lastPurchaseHash && allPurchases.length % 1000 === 0 && allPurchases.length > 0);

    // Amount is in öre (minor units), subtract VAT and convert to SEK
    const totalOre = allPurchases.reduce((sum, p) => sum + (p.amount - (p.vatAmount || 0)), 0);

    // Count total products from all purchases
    const productCount = allPurchases.reduce((sum, p) => {
      return sum + (p.products || []).reduce((pSum, product) => pSum + Number(product.quantity || 0), 0);
    }, 0);

    return {
      amount: Math.round(totalOre / 100),
      orderCount: allPurchases.length,
      productCount,
    };
  }

  async fetchInventory(): Promise<ZettleInventoryItem[]> {
    const token = await this.getAccessToken();

    // Fetch and log available locations
    await this.logLocations(token);

    // Fetch products to get barcodes
    const barcodeMap = await this.fetchProductBarcodes(token);
    console.log(`[Zettle] Product barcodes loaded: ${barcodeMap.size}`);

    // Fetch stock levels
    const allItems: ZettleInventoryItem[] = [];
    let cursor: string | undefined;
    let pageCount = 0;
    let totalRawItems = 0;
    let withBalance = 0;
    let withBarcode = 0;
    let noBarcode = 0;

    do {
      pageCount++;
      const params = new URLSearchParams({ limit: '1000' });
      if (cursor) {
        params.append('cursor', cursor);
      }

      const response = await fetch(`${INVENTORY_URL}?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Zettle] Inventory API error: ${response.status} - ${errorText}`);
        throw new Error(`Zettle inventory failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      // API returns array directly or wrapped in data/inventoryBalances
      const items = Array.isArray(data) ? data : (data.data || data.inventoryBalances || []);
      totalRawItems += items.length;
      console.log(`[Zettle] Page ${pageCount}: ${items.length} raw items`);

      const zeroBalanceSample: Array<{ productUuid: string; balance: number | string }> = [];

      for (const item of items) {
        // Balance may be a string from the API, so parse it
        const balance = typeof item.balance === 'string' ? parseInt(item.balance, 10) : (item.balance || 0);

        if (balance > 0) {
          withBalance++;
          // Look up barcode from product data
          const variantKey = item.variantUuid
            ? `${item.productUuid}:${item.variantUuid}`
            : item.productUuid;
          const barcode = barcodeMap.get(variantKey) || '';

          if (barcode) {
            withBarcode++;
            allItems.push({
              productUuid: item.productUuid,
              variantUuid: item.variantUuid || '',
              barcode,
              balance,
            });
          } else {
            noBarcode++;
          }
        } else if (zeroBalanceSample.length < 3) {
          // Collect sample of zero balance items for debugging
          zeroBalanceSample.push({
            productUuid: item.productUuid,
            balance: item.balance,
          });
        }
      }

      if (zeroBalanceSample.length > 0) {
        console.log(`[Zettle] Sample of zero balance items:`, zeroBalanceSample);
      }

      // Pagination: Check Link header for next page cursor
      // Format: <url?cursor=xxx>; rel="next"
      const linkHeader = response.headers.get('Link');
      cursor = undefined;

      // Log all response headers for debugging
      console.log(`[Zettle] Response headers:`, Object.fromEntries(response.headers.entries()));

      if (linkHeader) {
        console.log(`[Zettle] Link header: ${linkHeader}`);
        const nextMatch = linkHeader.match(/cursor=([^&>]+)/);
        if (nextMatch) {
          cursor = nextMatch[1];
          console.log(`[Zettle] Next page cursor: ${cursor}`);
        }
      } else if (items.length === 1000) {
        console.log(`[Zettle] Warning: Got 1000 items but no Link header for pagination`);
        // Try alternative pagination - check if response has nextCursor or similar
        if (data.nextCursor || data.cursor) {
          cursor = data.nextCursor || data.cursor;
          console.log(`[Zettle] Found cursor in response body: ${cursor}`);
        }
      }
    } while (cursor);

    console.log(`[Zettle] Summary: ${totalRawItems} raw items, ${withBalance} with balance > 0, ${withBarcode} matched barcode, ${noBarcode} no barcode match`);
    return allItems;
  }

  private async fetchProductBarcodes(token: string): Promise<Map<string, string>> {
    const barcodeMap = new Map<string, string>();
    let cursor: string | undefined;
    let pageCount = 0;

    do {
      pageCount++;
      const params = new URLSearchParams({ limit: '100' });
      if (cursor) {
        params.append('cursor', cursor);
      }

      const response = await fetch(`${PRODUCTS_URL}?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Zettle] Products API error: ${response.status} - ${errorText}`);
        throw new Error(`Zettle products failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      // API returns array directly or wrapped in data/products
      const products = Array.isArray(data) ? data : (data.data || data.products || []);

      for (const product of products) {
        const productUuid = product.uuid;

        // Check if product has variants
        if (product.variants && product.variants.length > 0) {
          for (const variant of product.variants) {
            const variantUuid = variant.uuid;
            // Try multiple possible barcode fields
            const barcode = variant.barcode || variant.ean || variant.sku || '';
            if (barcode) {
              barcodeMap.set(`${productUuid}:${variantUuid}`, barcode);
            }
          }
        } else {
          // Product without variants - use product barcode
          const barcode = product.barcode || product.ean || product.sku || '';
          if (barcode) {
            barcodeMap.set(productUuid, barcode);
          }
        }
      }

      // Pagination: Check Link header for next page cursor
      const linkHeader = response.headers.get('Link');
      cursor = undefined;
      if (linkHeader) {
        const nextMatch = linkHeader.match(/cursor=([^&>]+)/);
        if (nextMatch) {
          cursor = nextMatch[1];
        }
      }
    } while (cursor);

    console.log(`[Zettle] Products: ${pageCount} pages, ${barcodeMap.size} barcodes`);
    return barcodeMap;
  }

  private async logLocations(token: string): Promise<void> {
    try {
      const response = await fetch(LOCATIONS_URL, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        console.error(`[Zettle] Locations API error: ${response.status}`);
        return;
      }

      const data = await response.json();
      const locations = Array.isArray(data) ? data : (data.data || data.locations || []);

      console.log(`[Zettle] Available locations (${locations.length}):`);
      for (const loc of locations) {
        console.log(`  - ${loc.name || loc.type}: ${loc.uuid} (type: ${loc.type})`);
      }
    } catch (error) {
      console.error(`[Zettle] Failed to fetch locations:`, error);
    }
  }
}
