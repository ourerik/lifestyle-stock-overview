import { NextRequest, NextResponse } from 'next/server'
import { StockChangeSyncService } from '@/lib/services/stockchange-sync'
import type { CompanyId } from '@/config/companies'
import type { Env } from '@/types'

const VALID_COMPANIES: Exclude<CompanyId, 'all'>[] = ['varg', 'sneaky-steve']

export async function POST(request: NextRequest) {
  // Validate CRON_SECRET
  const authHeader = request.headers.get('Authorization')
  const cronSecret = process.env.CRON_SECRET

  const isVercelCron = request.headers.get('x-vercel-cron') === '1'

  if (!isVercelCron) {
    if (!cronSecret) {
      return NextResponse.json(
        { error: 'CRON_SECRET not configured' },
        { status: 500 }
      )
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
  }

  // Parse body
  let body: { company?: string } = {}
  try {
    body = await request.json()
  } catch {
    // Empty body is OK, defaults to 'all'
  }

  const companyParam = body.company || 'all'

  try {
    const env: Env = process.env as unknown as Env
    const syncService = new StockChangeSyncService(env)

    if (companyParam === 'all') {
      const results = await syncService.syncAll()
      return NextResponse.json({
        success: true,
        results,
        syncedAt: new Date().toISOString(),
      })
    } else if (VALID_COMPANIES.includes(companyParam as Exclude<CompanyId, 'all'>)) {
      const result = await syncService.syncStockChanges(companyParam as Exclude<CompanyId, 'all'>)
      return NextResponse.json({
        success: true,
        results: [result],
        syncedAt: new Date().toISOString(),
      })
    } else {
      return NextResponse.json(
        { error: `Invalid company: ${companyParam}. Must be 'varg', 'sneaky-steve', or 'all'` },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('[StockSync API] Failed:', error)
    return NextResponse.json(
      { error: 'Sync failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
