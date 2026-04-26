import { notFound } from 'next/navigation'
import { SidebarInset } from '@/components/ui/sidebar'
import { Header } from '@/components/layout/header'
import { ProductRankingPageView } from '@/components/product-ranking'
import { RequireCompanyAccess } from '@/components/require-company-access'
import { COMPANIES, CompanyId } from '@/config/companies'

interface PageProps {
  params: Promise<{ company: string }>
}

export default async function ProductRankingPage({ params }: PageProps) {
  const { company } = await params

  // Product ranking is only available for sneaky-steve
  if (company !== 'sneaky-steve' || !(company in COMPANIES)) {
    notFound()
  }

  const companyId = company as Exclude<CompanyId, 'all'>
  const companyConfig = COMPANIES[companyId]

  return (
    <RequireCompanyAccess companyId={companyId}>
      <SidebarInset>
        <Header companyName={companyConfig.name} companySlug={companyId} pageName="Produktranking" />
        <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6">
          <ProductRankingPageView companyId={companyId} />
        </main>
      </SidebarInset>
    </RequireCompanyAccess>
  )
}
