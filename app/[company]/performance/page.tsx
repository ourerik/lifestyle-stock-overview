import { notFound } from 'next/navigation'
import { SidebarInset } from '@/components/ui/sidebar'
import { Header } from '@/components/layout/header'
import { PerformancePageView } from '@/components/performance'
import { RequireCompanyAccess } from '@/components/require-company-access'
import { COMPANIES, CompanyId } from '@/config/companies'

interface PageProps {
  params: Promise<{ company: string }>
}

export default async function PerformancePage({ params }: PageProps) {
  const { company } = await params

  // Validate company exists (exclude 'all' since performance is per-company only)
  if (company === 'all' || !(company in COMPANIES)) {
    notFound()
  }

  const companyId = company as Exclude<CompanyId, 'all'>
  const companyConfig = COMPANIES[companyId]

  return (
    <RequireCompanyAccess companyId={companyId}>
      <SidebarInset>
        <Header companyName={companyConfig.name} companySlug={companyId} pageName="Prestation" />
        <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6">
          <PerformancePageView companyId={companyId} />
        </main>
      </SidebarInset>
    </RequireCompanyAccess>
  )
}
