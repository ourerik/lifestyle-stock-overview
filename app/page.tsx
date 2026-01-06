import { SidebarInset } from '@/components/ui/sidebar';
import { Header } from '@/components/layout/header';
import { DashboardView } from '@/components/dashboard';
import { RequireCompanyAccess } from '@/components/require-company-access';

export default function DashboardPage() {
  return (
    <RequireCompanyAccess companyId="all">
      <SidebarInset>
        <Header pageName="Översikt" />
        <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6">
          <DashboardView companyId="all" />
        </main>
      </SidebarInset>
    </RequireCompanyAccess>
  );
}
