'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { DataTable, type Column } from '@/components/ui/data-table';
import { usePeriod } from '@/providers/period-provider';
import type { CompanyId } from '@/config/companies';
import type { TopProductsData, TopProductItem } from '@/types/top-products';

const PAGE_SIZE = 10;

interface TopProductsProps {
  companyId: CompanyId;
}

export function TopProducts({ companyId }: TopProductsProps) {
  const { currentPeriod, comparisonType, customDateRange } = usePeriod();
  const [data, setData] = useState<TopProductsData[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        company: companyId,
        period: currentPeriod,
        comparison: comparisonType,
      });

      if (currentPeriod === 'custom' && customDateRange) {
        params.set('from', customDateRange.from);
        params.set('to', customDateRange.to);
      }

      const response = await fetch(`/api/dashboard/top-products?${params}`);
      if (!response.ok) throw new Error('Kunde inte hämta data');

      const result = await response.json();
      setData(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ett fel uppstod');
    } finally {
      setIsLoading(false);
    }
  }, [companyId, currentPeriod, comparisonType, customDateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (error) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return <TopProductsSkeleton />;
  }

  if (!data || data.length === 0) return null;

  return (
    <>
      {data.map((companyData) => (
        <TopProductsCard key={companyData.companyId} data={companyData} />
      ))}
    </>
  );
}

// ==========================================================================
// Column definitions
// ==========================================================================

const productColumn: Column<TopProductItem> = {
  id: 'product',
  label: 'Produkt',
  accessor: (row) => row.productName,
  sortable: true,
  renderCell: (_value, row) => (
    <div className="flex items-center gap-3">
      {row.image ? (
        <img
          src={row.image}
          alt={row.productName}
          className="h-8 w-8 rounded object-cover flex-shrink-0"
        />
      ) : (
        <div className="h-8 w-8 rounded bg-muted flex-shrink-0" />
      )}
      <div className="min-w-0">
        <div className="font-medium truncate">{row.productName}</div>
        <div className="text-xs text-muted-foreground">{row.productNumber}</div>
      </div>
    </div>
  ),
};

function getAllColumns(hasStore: boolean): Column<TopProductItem>[] {
  const cols: Column<TopProductItem>[] = [
    productColumn,
    {
      id: 'ecom',
      label: 'Ecom',
      accessor: (row) => row.channels.ecom,
      sortable: true,
      align: 'right',
      format: 'number',
      renderCell: (value) => (value > 0 ? Number(value).toLocaleString('sv-SE') : '–'),
    },
  ];

  if (hasStore) {
    cols.push({
      id: 'store',
      label: 'Butik',
      accessor: (row) => row.channels.store,
      sortable: true,
      align: 'right',
      format: 'number',
      renderCell: (value) => (value > 0 ? Number(value).toLocaleString('sv-SE') : '–'),
    });
  }

  cols.push(
    {
      id: 'b2b',
      label: 'B2B',
      accessor: (row) => row.channels.b2b,
      sortable: true,
      align: 'right',
      format: 'number',
      renderCell: (value) => (value > 0 ? Number(value).toLocaleString('sv-SE') : '–'),
    },
    {
      id: 'total',
      label: 'Totalt',
      accessor: 'totalQuantity',
      sortable: true,
      align: 'right',
      format: 'number',
    }
  );

  return cols;
}

function getSingleChannelColumns(channel: 'ecom' | 'store' | 'b2b'): Column<TopProductItem>[] {
  return [
    productColumn,
    {
      id: 'quantity',
      label: 'Antal',
      accessor: (row) => row.channels[channel],
      sortable: true,
      align: 'right',
      format: 'number',
    },
  ];
}

// ==========================================================================
// Card component per company
// ==========================================================================

function TopProductsCard({ data }: { data: TopProductsData }) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [data]);

  const allColumns = useMemo(() => getAllColumns(data.hasStore), [data.hasStore]);
  const ecomColumns = useMemo(() => getSingleChannelColumns('ecom'), []);
  const storeColumns = useMemo(() => getSingleChannelColumns('store'), []);
  const b2bColumns = useMemo(() => getSingleChannelColumns('b2b'), []);

  const allProducts = useMemo(
    () => data.products.slice(0, visibleCount),
    [data.products, visibleCount]
  );

  const ecomProducts = useMemo(
    () => data.products.filter((p) => p.channels.ecom > 0).slice(0, visibleCount),
    [data.products, visibleCount]
  );

  const storeProducts = useMemo(
    () => data.products.filter((p) => p.channels.store > 0).slice(0, visibleCount),
    [data.products, visibleCount]
  );

  const b2bProducts = useMemo(
    () => data.products.filter((p) => p.channels.b2b > 0).slice(0, visibleCount),
    [data.products, visibleCount]
  );

  const hasMore = data.products.length > visibleCount;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bästsäljare</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="alla">
          <TabsList>
            <TabsTrigger value="alla">Alla</TabsTrigger>
            <TabsTrigger value="ecom">Ecom</TabsTrigger>
            {data.hasStore && <TabsTrigger value="store">Butik</TabsTrigger>}
            <TabsTrigger value="b2b">B2B</TabsTrigger>
          </TabsList>

          <TabsContent value="alla">
            <DataTable<TopProductItem>
              data={allProducts}
              columns={allColumns}
              tableId={`top-products-all-${data.companyId}`}
              rowKey="productNumber"
              defaultSortField="total"
              defaultSortOrder="desc"
              showColumnSelector={false}
              emptyMessage="Inga produkter för vald period"
              mobileFullBleed
            />
          </TabsContent>

          <TabsContent value="ecom">
            <DataTable<TopProductItem>
              data={ecomProducts}
              columns={ecomColumns}
              tableId={`top-products-ecom-${data.companyId}`}
              rowKey="productNumber"
              defaultSortField="quantity"
              defaultSortOrder="desc"
              showColumnSelector={false}
              emptyMessage="Inga produkter för vald period"
              mobileFullBleed
            />
          </TabsContent>

          {data.hasStore && (
            <TabsContent value="store">
              <DataTable<TopProductItem>
                data={storeProducts}
                columns={storeColumns}
                tableId={`top-products-store-${data.companyId}`}
                rowKey="productNumber"
                defaultSortField="quantity"
                defaultSortOrder="desc"
                showColumnSelector={false}
                emptyMessage="Inga produkter för vald period"
                mobileFullBleed
              />
            </TabsContent>
          )}

          <TabsContent value="b2b">
            <DataTable<TopProductItem>
              data={b2bProducts}
              columns={b2bColumns}
              tableId={`top-products-b2b-${data.companyId}`}
              rowKey="productNumber"
              defaultSortField="quantity"
              defaultSortOrder="desc"
              showColumnSelector={false}
              emptyMessage="Inga produkter för vald period"
              mobileFullBleed
            />
          </TabsContent>
        </Tabs>

        {hasMore && (
          <div className="mt-3 flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
            >
              Visa fler
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TopProductsSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-28" />
      </CardHeader>
      <CardContent>
        <Skeleton className="mb-4 h-9 w-64" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
