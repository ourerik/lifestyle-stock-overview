import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { ElasticsearchConnector } from '@/lib/connectors/elasticsearch'
import type { CompanyId } from '@/config/companies'
import type { Env } from '@/types'
import type { DeliveryListItem, DeliveriesResponse, DeliverySortField } from '@/types/delivery'

const VALID_COMPANIES: Exclude<CompanyId, 'all'>[] = ['varg', 'sneaky-steve']
const VALID_SORT_FIELDS: DeliverySortField[] = [
  'createdAt',
  'supplier',
  'productNumber',
  'productName',
  'quantity',
  'unitCostSEK',
  'totalCostSEK',
]

export async function GET(request: NextRequest) {
  // Check authentication
  const session = await auth0.getSession(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse query params
  const searchParams = request.nextUrl.searchParams
  const company = searchParams.get('company') as Exclude<CompanyId, 'all'>
  const page = parseInt(searchParams.get('page') || '0', 10)
  const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '50', 10), 100)
  const sortBy = (searchParams.get('sortBy') || 'createdAt') as DeliverySortField
  const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc'

  // Validate params
  if (!company || !VALID_COMPANIES.includes(company)) {
    return NextResponse.json(
      { error: 'Invalid company parameter. Must be "varg" or "sneaky-steve"' },
      { status: 400 }
    )
  }

  if (!VALID_SORT_FIELDS.includes(sortBy)) {
    return NextResponse.json(
      { error: `Invalid sortBy parameter. Must be one of: ${VALID_SORT_FIELDS.join(', ')}` },
      { status: 400 }
    )
  }

  if (sortOrder !== 'asc' && sortOrder !== 'desc') {
    return NextResponse.json(
      { error: 'Invalid sortOrder parameter. Must be "asc" or "desc"' },
      { status: 400 }
    )
  }

  try {
    const env: Env = process.env as unknown as Env
    const es = new ElasticsearchConnector(env)

    const result = await es.fetchPurchaseDeliveriesPaginated(company, {
      page,
      pageSize,
      sortBy,
      sortOrder,
    })

    // Transform ES documents to list items
    const deliveries: DeliveryListItem[] = result.deliveries.map(d => ({
      id: d.id,
      createdAt: d.createdAt,
      supplier: d.purchaseOrderDelivery.supplier,
      purchaseOrderId: d.purchaseOrderDelivery.purchaseOrderId,
      productNumber: d.productNumber,
      productName: d.productName,
      variantName: d.productVariantName,
      sizeNumber: d.sizeNumber,
      quantity: d.quantity,
      currency: d.currency,
      unitCostSEK: d.unitTotalCostSEK,
      totalCostSEK: d.totalCostSEK,
    }))

    const response: DeliveriesResponse = {
      deliveries,
      total: result.total,
      page,
      pageSize,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Failed to fetch deliveries:', error)
    return NextResponse.json(
      { error: 'Failed to fetch deliveries' },
      { status: 500 }
    )
  }
}
