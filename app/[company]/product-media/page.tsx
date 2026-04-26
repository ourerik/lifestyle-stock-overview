import { notFound } from 'next/navigation'
import { SidebarInset } from '@/components/ui/sidebar'
import { Header } from '@/components/layout/header'
import { ProductMediaListView } from '@/components/product-media'
import { RequireCompanyAccess } from '@/components/require-company-access'
import { COMPANIES, CompanyId, canUseProductMedia } from '@/config/companies'

interface PageProps {
  params: Promise<{ company: string }>
}

export default async function ProductMediaListPage({ params }: PageProps) {
  const { company } = await params

  if (!(company in COMPANIES) || !canUseProductMedia(company as CompanyId)) {
    notFound()
  }

  const companyId = company as Exclude<CompanyId, 'all'>
  const companyConfig = COMPANIES[companyId]

  return (
    <RequireCompanyAccess companyId={companyId}>
      <SidebarInset>
        <Header companyName={companyConfig.name} companySlug={companyId} pageName="Experiment" />
        <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6">
          <ProductMediaListView companyId={companyId} />
        </main>
      </SidebarInset>
    </RequireCompanyAccess>
  )
}
