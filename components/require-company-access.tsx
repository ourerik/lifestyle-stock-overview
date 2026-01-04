'use client';

import { type ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useRoles } from '@/hooks/use-roles';
import { canAccessCompany, getDefaultPath } from '@/lib/auth/roles';
import type { CompanyId } from '@/config/companies';
import { AccessDenied } from '@/components/access-denied';

interface RequireCompanyAccessProps {
  companyId: CompanyId;
  children: ReactNode;
}

export function RequireCompanyAccess({ companyId, children }: RequireCompanyAccessProps) {
  const { roles, allowedCompanies, isLoading } = useRoles();
  const router = useRouter();

  const hasAccess = canAccessCompany(roles, companyId);
  const defaultPath = getDefaultPath(roles);
  const hasAnyAccess = allowedCompanies.length > 0;

  useEffect(() => {
    // Redirect to default page if user doesn't have access but has access to other pages
    if (!isLoading && !hasAccess && hasAnyAccess) {
      router.replace(defaultPath);
    }
  }, [isLoading, hasAccess, hasAnyAccess, defaultPath, router]);

  // Show nothing while loading or redirecting
  if (isLoading || (!hasAccess && hasAnyAccess)) {
    return null;
  }

  // Show access denied only if user has no access to anything
  if (!hasAccess) {
    return <AccessDenied requestedPath={companyId === 'all' ? '/' : `/${companyId}`} />;
  }

  return <>{children}</>;
}
