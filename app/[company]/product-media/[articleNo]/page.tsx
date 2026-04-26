import { notFound } from 'next/navigation'
import { SidebarInset } from '@/components/ui/sidebar'
import { Header } from '@/components/layout/header'
import { ProductMediaDetailView } from '@/components/product-media'
import { RequireCompanyAccess } from '@/components/require-company-access'
import { COMPANIES, CompanyId, canUseProductMedia } from '@/config/companies'

interface PageProps {
  params: Promise<{ company: string; articleNo: string }>
}

export default async function ProductMediaDetailPage({ params }: PageProps) {
  const { company, articleNo } = await params

  if (!(company in COMPANIES) || !canUseProductMedia(company as CompanyId)) {
    notFound()
  }

  const companyId = company as Exclude<CompanyId, 'all'>
  const companyConfig = COMPANIES[companyId]

  return (
    <RequireCompanyAccess companyId={companyId}>
      <SidebarInset>
        <Header
          companyName={companyConfig.name}
          companySlug={companyId}
          pageName={`Experiment – ${articleNo}`}
        />
        <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6">
          <ProductMediaDetailView companyId={companyId} articleNo={articleNo} />
        </main>
      </SidebarInset>
    </RequireCompanyAccess>
  )
}
