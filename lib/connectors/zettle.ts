import type { Env, SalesData, ZettleTokenResponse, ZettlePurchasesResponse } from '@/types';

const TOKEN_URL = 'https://oauth.zettle.com/token';
const PURCHASES_URL = 'https://purchase.izettle.com/purchases/v2';

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
}
