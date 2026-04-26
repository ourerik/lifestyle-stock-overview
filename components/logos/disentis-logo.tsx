import { Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DisentisLogoProps {
  className?: string;
}

// Placeholder until a real SVG is provided. Swap this body for an <svg> when
// Disentis brand assets are available — no other code needs to change.
export function DisentisLogo({ className }: DisentisLogoProps) {
  return <Building2 className={cn('h-4 w-4', className)} />;
}
