import { notFound } from 'next/navigation'
import { SidebarInset } from '@/components/ui/sidebar'
import { Header } from '@/components/layout/header'
import { AdCostsPageView } from '@/components/settings'
import { RequireCompanyAccess } from '@/components/require-company-access'
import { COMPANIES, CompanyId } from '@/config/companies'

interface PageProps {
  params: Promise<{ company: string }>
}

export default async function AdCostsPage({ params }: PageProps) {
  const { company } = await params

  // Validate company exists (exclude 'all' since settings are per-company only)
  if (company === 'all' || !(company in COMPANIES)) {
    notFound()
  }

  const companyId = company as Exclude<CompanyId, 'all'>
  const companyConfig = COMPANIES[companyId]

  return (
    <RequireCompanyAccess companyId={companyId}>
      <SidebarInset>
        <Header companyName={companyConfig.name} companySlug={companyId} pageName="Annonskostnader" />
        <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6">
          <AdCostsPageView companyId={companyId} />
        </main>
      </SidebarInset>
    </RequireCompanyAccess>
  )
}
