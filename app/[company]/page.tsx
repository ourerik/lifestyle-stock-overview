import { notFound } from 'next/navigation';
import { SidebarInset } from '@/components/ui/sidebar';
import { Header } from '@/components/layout/header';
import { DashboardView } from '@/components/dashboard';
import { COMPANIES, CompanyId } from '@/config/companies';

interface PageProps {
  params: Promise<{ company: string }>;
}

export default async function CompanyDashboardPage({ params }: PageProps) {
  const { company } = await params;

  // Validate company exists (exclude 'all' since that's the root page)
  if (company === 'all' || !(company in COMPANIES)) {
    notFound();
  }

  const companyId = company as CompanyId;
  const companyConfig = COMPANIES[companyId];

  return (
    <SidebarInset>
      <Header title={`Dashboard - ${companyConfig.name}`} />
      <main className="flex-1 p-6">
        <DashboardView companyId={companyId} />
      </main>
    </SidebarInset>
  );
}
