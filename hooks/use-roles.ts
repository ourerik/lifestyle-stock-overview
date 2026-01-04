'use client';

import { useMemo } from 'react';
import { useUser } from '@auth0/nextjs-auth0/client';
import { getUserRoles, type UserRoles } from '@/lib/auth/roles';

export interface UseRolesReturn extends UserRoles {
  isLoading: boolean;
  isAuthenticated: boolean;
}

export function useRoles(): UseRolesReturn {
  const { user, isLoading } = useUser();

  const roleInfo = useMemo(() => {
    return getUserRoles(user as Record<string, unknown> | null);
  }, [user]);

  return {
    ...roleInfo,
    isLoading,
    isAuthenticated: !!user,
  };
}
