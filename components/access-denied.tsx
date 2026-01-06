'use client';

import Link from 'next/link';
import { ShieldX, ArrowRight, LogOut } from 'lucide-react';
import { useRoles } from '@/hooks/use-roles';
import { COMPANIES, type CompanyId } from '@/config/companies';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CompanyLogo } from '@/components/logos';
import { SidebarInset } from '@/components/ui/sidebar';
import { Header } from '@/components/layout/header';

interface AccessDeniedProps {
  requestedPath?: string;
}

export function AccessDenied({ requestedPath }: AccessDeniedProps) {
  const { allowedCompanies, hasOverviewAccess, isLoading } = useRoles();

  if (isLoading) {
    return (
      <SidebarInset>
        <Header pageName="Laddar..." />
        <main className="flex-1 p-6 flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground">Kontrollerar behörighet...</div>
        </main>
      </SidebarInset>
    );
  }

  // Filter out 'all' from allowed companies for display
  const accessibleCompanies = allowedCompanies.filter(
    (id): id is Exclude<CompanyId, 'all'> => id !== 'all'
  );

  return (
    <SidebarInset>
      <Header pageName="Ingen behörighet" />
      <main className="flex-1 p-6 flex items-center justify-center">
        <Card className="max-w-lg w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <ShieldX className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle className="text-xl">Ingen behörighet</CardTitle>
            <CardDescription>
              Du har inte behörighet att se den här sidan.
              {requestedPath && (
                <span className="block mt-1 text-xs font-mono opacity-70">
                  {requestedPath}
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(accessibleCompanies.length > 0 || hasOverviewAccess) && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground text-center">
                  Du har tillgång till följande:
                </p>
                <div className="space-y-2">
                  {hasOverviewAccess && (
                    <Button
                      variant="outline"
                      className="w-full justify-between"
                      asChild
                    >
                      <Link href="/">
                        <span className="flex items-center gap-2">
                          <CompanyLogo companyId="all" className="h-4 w-4" />
                          Översikt - Alla bolag
                        </span>
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  )}
                  {accessibleCompanies.map((companyId) => {
                    const company = COMPANIES[companyId];
                    return (
                      <Button
                        key={companyId}
                        variant="outline"
                        className="w-full justify-between"
                        asChild
                      >
                        <Link href={`/${companyId}`}>
                          <span className="flex items-center gap-2">
                            <CompanyLogo companyId={companyId} className="h-4 w-4" />
                            {company.name}
                          </span>
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    );
                  })}
                </div>
              </div>
            )}

            {accessibleCompanies.length === 0 && !hasOverviewAccess && (
              <div className="text-center space-y-4">
                <p className="text-sm text-muted-foreground">
                  Du har ingen behörighet i systemet. Kontakta en administratör för att få tillgång.
                </p>
                <Button variant="destructive" asChild>
                  {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
                  <a href="/auth/logout">
                    <LogOut className="mr-2 h-4 w-4" />
                    Logga ut
                  </a>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </SidebarInset>
  );
}
