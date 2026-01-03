import { CompanyId } from '@/config/companies';
import { VargLogo } from './varg-logo';
import { SneakySteveLogo } from './sneaky-steve-logo';
import { Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CompanyLogoProps {
  companyId: CompanyId;
  className?: string;
}

export function CompanyLogo({ companyId, className }: CompanyLogoProps) {
  switch (companyId) {
    case 'varg':
      return <VargLogo className={className} />;
    case 'sneaky-steve':
      return <SneakySteveLogo className={className} />;
    default:
      return <Building2 className={cn('h-4 w-4', className)} />;
  }
}
