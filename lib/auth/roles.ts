import type { CompanyId } from '@/config/companies';

// Available roles
export type Role = 'Admin' | 'Basic' | 'Sneaky Steve' | 'Varg';

// Role to company access mapping
export const ROLE_COMPANY_ACCESS: Record<Role, CompanyId[]> = {
  Admin: ['all', 'varg', 'sneaky-steve'],
  Basic: ['all', 'varg', 'sneaky-steve'],
  Varg: ['varg'],
  'Sneaky Steve': ['sneaky-steve'],
};

// Roles that grant access to the overview page (/)
export const OVERVIEW_ROLES: Role[] = ['Admin', 'Basic'];

// =====================================================
// USER ROLES CONFIGURATION
// Add users and their roles here
// =====================================================
const USER_ROLES: Record<string, Role[]> = {
  'erik@ourstudio.se': ['Admin'],
  'stefan@tripointx.com': ['Admin'],
  'mamadeleine@vargklader.com': ['Varg'],
  // Add more users here:
  // 'user@example.com': ['Varg'],
  // 'another@example.com': ['Sneaky Steve'],
  // 'both@example.com': ['Varg', 'Sneaky Steve'],
};

export interface UserRoles {
  roles: Role[];
  hasOverviewAccess: boolean;
  allowedCompanies: CompanyId[];
}

/**
 * Get roles for a user based on their email
 */
export function extractRoles(user: Record<string, unknown> | null | undefined): Role[] {
  if (!user) return [];

  const email = user.email as string | undefined;
  if (!email) return [];

  return USER_ROLES[email.toLowerCase()] || [];
}

/**
 * Get allowed companies for a set of roles
 */
export function getAllowedCompanies(roles: Role[]): CompanyId[] {
  const companies = new Set<CompanyId>();

  for (const role of roles) {
    const access = ROLE_COMPANY_ACCESS[role];
    if (access) {
      access.forEach((c) => companies.add(c));
    }
  }

  return Array.from(companies);
}

/**
 * Check if user has access to overview page
 */
export function hasOverviewAccess(roles: Role[]): boolean {
  return roles.some((role) => OVERVIEW_ROLES.includes(role));
}

/**
 * Check if user can access a specific company
 */
export function canAccessCompany(roles: Role[], companyId: CompanyId): boolean {
  if (companyId === 'all') {
    return hasOverviewAccess(roles);
  }
  return getAllowedCompanies(roles).includes(companyId);
}

/**
 * Get complete user role information
 */
export function getUserRoles(user: Record<string, unknown> | null | undefined): UserRoles {
  const roles = extractRoles(user);
  return {
    roles,
    hasOverviewAccess: hasOverviewAccess(roles),
    allowedCompanies: getAllowedCompanies(roles),
  };
}

/**
 * Get default redirect path for a user based on their roles
 */
export function getDefaultPath(roles: Role[]): string {
  if (hasOverviewAccess(roles)) {
    return '/';
  }

  const companies = getAllowedCompanies(roles);
  if (companies.length > 0) {
    return `/${companies[0]}`;
  }

  // No access at all
  return '/';
}
