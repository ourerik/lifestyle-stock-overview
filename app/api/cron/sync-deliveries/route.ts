import { NextRequest, NextResponse } from 'next/server'
import { DeliverySyncService } from '@/lib/services/delivery-sync'
import type { CompanyId } from '@/config/companies'
import type { Env } from '@/types'

const VALID_COMPANIES: Exclude<CompanyId, 'all'>[] = ['varg', 'sneaky-steve']

/**
 * POST /api/cron/sync-deliveries
 *
 * Syncs purchase order deliveries from Centra to Elasticsearch.
 * Designed to be called by Vercel Cron or manually with CRON_SECRET.
 *
 * Body: { company?: 'varg' | 'sneaky-steve' | 'all' }
 * Headers: Authorization: Bearer {CRON_SECRET}
 */
export async function POST(request: NextRequest) {
  // Validate CRON_SECRET
  const authHeader = request.headers.get('Authorization')
  const cronSecret = process.env.CRON_SECRET

  // Allow requests from Vercel Cron (no auth header but special header)
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
    const syncService = new DeliverySyncService(env)

    if (companyParam === 'all') {
      // Sync all companies
      const results = await syncService.syncAll()
      return NextResponse.json({
        success: true,
        results,
        syncedAt: new Date().toISOString(),
      })
    } else if (VALID_COMPANIES.includes(companyParam as Exclude<CompanyId, 'all'>)) {
      // Sync single company
      const result = await syncService.syncDeliveries(companyParam as Exclude<CompanyId, 'all'>)
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
    console.error('[Sync API] Failed:', error)
    return NextResponse.json(
      { error: 'Sync failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

// Also allow GET for easy testing/verification
export async function GET(request: NextRequest) {
  // Only allow authenticated requests for status check
  const authHeader = request.headers.get('Authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  return NextResponse.json({
    endpoint: '/api/cron/sync-deliveries',
    method: 'POST',
    description: 'Syncs purchase order deliveries from Centra to Elasticsearch',
    body: { company: 'varg | sneaky-steve | all (default)' },
  })
}
