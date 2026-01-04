import { notFound } from 'next/navigation'
import { SidebarInset } from '@/components/ui/sidebar'
import { Header } from '@/components/layout/header'
import { DeliveriesPageView } from '@/components/deliveries/deliveries-page-view'
import { COMPANIES, CompanyId } from '@/config/companies'

interface PageProps {
  params: Promise<{ company: string }>
}

export default async function DeliveriesPage({ params }: PageProps) {
  const { company } = await params

  // Validate company exists (exclude 'all' since deliveries is per-company only)
  if (company === 'all' || !(company in COMPANIES)) {
    notFound()
  }

  const companyId = company as Exclude<CompanyId, 'all'>
  const companyConfig = COMPANIES[companyId]

  return (
    <SidebarInset>
      <Header title={`Inleveranser - ${companyConfig.name}`} />
      <main className="flex-1 p-6">
        <DeliveriesPageView companyId={companyId} />
      </main>
    </SidebarInset>
  )
}
