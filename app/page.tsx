import { SidebarInset } from '@/components/ui/sidebar';
import { Header } from '@/components/layout/header';
import { DashboardView } from '@/components/dashboard';
import { RequireCompanyAccess } from '@/components/require-company-access';

export default function DashboardPage() {
  return (
    <RequireCompanyAccess companyId="all">
      <SidebarInset>
        <Header title="Dashboard - Översikt" />
        <main className="flex-1 p-6">
          <DashboardView companyId="all" />
        </main>
      </SidebarInset>
    </RequireCompanyAccess>
  );
}
