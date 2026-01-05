'use client';

import { LayoutDashboard, Package, Truck, BarChart3, Settings, ChevronDown, LogOut, User } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useUser } from '@auth0/nextjs-auth0/client';
import { useRoles } from '@/hooks/use-roles';
import { COMPANY_LIST, COMPANIES, type CompanyId } from '@/config/companies';
import { CompanyLogo } from '@/components/logos';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
  SidebarFooter,
} from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading: userLoading } = useUser();
  const { allowedCompanies, hasOverviewAccess, isLoading: rolesLoading } = useRoles();

  const isLoading = userLoading || rolesLoading;

  // Filter companies based on user access
  const accessibleCompanies = COMPANY_LIST.filter((company) => {
    if (company.id === 'all') {
      return hasOverviewAccess;
    }
    return allowedCompanies.includes(company.id as CompanyId);
  });

  // Show company selector only if user has access to more than one option
  const showCompanySelector = accessibleCompanies.length > 1;

  // Determine current company from URL
  const pathSegments = pathname.split('/').filter(Boolean);
  const companySlug = pathSegments[0];
  const isCompanyPage = companySlug && companySlug in COMPANIES && companySlug !== 'all';
  const currentCompany: CompanyId = isCompanyPage ? (companySlug as CompanyId) : 'all';
  const companyConfig = COMPANIES[currentCompany];

  const handleCompanySelect = (companyId: CompanyId) => {
    if (companyId === 'all') {
      router.push('/');
    } else {
      router.push(`/${companyId}`);
    }
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            {showCompanySelector ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  >
                    <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-white">
                      <CompanyLogo companyId={currentCompany} className="size-4" />
                    </div>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">{companyConfig.name}</span>
                      <span className="truncate text-xs">{companyConfig.displayName}</span>
                    </div>
                    <ChevronDown className="ml-auto" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                  align="start"
                  side="bottom"
                  sideOffset={4}
                >
                  {accessibleCompanies.map((company) => (
                    <DropdownMenuItem
                      key={company.id}
                      onClick={() => handleCompanySelect(company.id as CompanyId)}
                      className={currentCompany === company.id ? 'bg-accent' : ''}
                    >
                      <CompanyLogo companyId={company.id as CompanyId} className="mr-2 h-4 w-4" />
                      {company.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <SidebarMenuButton size="lg" className="cursor-default">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-white">
                  <CompanyLogo companyId={currentCompany} className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{companyConfig.name}</span>
                  <span className="truncate text-xs">{companyConfig.displayName}</span>
                </div>
              </SidebarMenuButton>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={!pathname.includes('/inventory')}
                  tooltip="Dashboard"
                >
                  <a href={currentCompany === 'all' ? '/' : `/${currentCompany}`}>
                    <LayoutDashboard className="h-4 w-4" />
                    <span>Dashboard</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {isCompanyPage && (
                <>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname.includes('/inventory')}
                      tooltip="Lager"
                    >
                      <a href={`/${currentCompany}/inventory`}>
                        <Package className="h-4 w-4" />
                        <span>Lager</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname.includes('/deliveries')}
                      tooltip="Inleveranser"
                    >
                      <a href={`/${currentCompany}/deliveries`}>
                        <Truck className="h-4 w-4" />
                        <span>Inleveranser</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname.includes('/performance')}
                      tooltip="Prestation"
                    >
                      <a href={`/${currentCompany}/performance`}>
                        <BarChart3 className="h-4 w-4" />
                        <span>Prestation</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname.includes('/settings')}
                      tooltip="Inställningar"
                    >
                      <a href={`/${currentCompany}/settings/ad-costs`}>
                        <Settings className="h-4 w-4" />
                        <span>Inställningar</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            {isLoading ? (
              <SidebarMenuButton size="lg" disabled>
                <div className="h-8 w-8 animate-pulse rounded-full bg-sidebar-accent" />
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <div className="h-3 w-20 animate-pulse rounded bg-sidebar-accent" />
                </div>
              </SidebarMenuButton>
            ) : user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  >
                    {user.picture ? (
                      <img
                        src={user.picture}
                        alt={user.name || 'User'}
                        className="h-8 w-8 rounded-full"
                      />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <User className="h-4 w-4" />
                      </div>
                    )}
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">{user.name}</span>
                      <span className="truncate text-xs">{user.email}</span>
                    </div>
                    <ChevronDown className="ml-auto size-4" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                  side="bottom"
                  align="end"
                  sideOffset={4}
                >
                  <DropdownMenuItem disabled>
                    <User className="mr-2 h-4 w-4" />
                    {user.email}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
                    <a href="/auth/logout" className="text-destructive">
                      <LogOut className="mr-2 h-4 w-4" />
                      Logga ut
                    </a>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <SidebarMenuButton size="lg" asChild>
                {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
                <a href="/auth/login">
                  <User className="h-4 w-4" />
                  <span>Logga in</span>
                </a>
              </SidebarMenuButton>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
