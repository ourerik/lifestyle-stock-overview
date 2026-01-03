import { SidebarInset } from '@/components/ui/sidebar';
import { Header } from '@/components/layout/header';
import { DashboardView } from '@/components/dashboard';

export default function DashboardPage() {
  return (
    <SidebarInset>
      <Header title="Dashboard - Översikt" />
      <main className="flex-1 p-6">
        <DashboardView companyId="all" />
      </main>
    </SidebarInset>
  );
}
