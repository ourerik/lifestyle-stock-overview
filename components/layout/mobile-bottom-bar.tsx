'use client';

import { useState, useRef, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useUser } from '@auth0/nextjs-auth0/client';
import {
  Menu,
  ChevronDown,
  LogOut,
  User,
  Check,
  LayoutDashboard,
  Package,
  Truck,
  BarChart3,
  Settings,
  Home,
  Circle,
  type LucideIcon,
} from 'lucide-react';
import { useBottomBarConfig, type BottomBarSlot, type AvailablePage } from '@/hooks/use-bottom-bar-config';
import { useRoles } from '@/hooks/use-roles';
import { COMPANY_LIST, COMPANIES, type CompanyId } from '@/config/companies';
import { CompanyLogo } from '@/components/logos';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  Package,
  Truck,
  BarChart3,
  Settings,
  Home,
  Circle,
};

function getIcon(iconName: string): LucideIcon {
  return iconMap[iconName] || Circle;
}

interface SlotButtonProps {
  slot: BottomBarSlot;
  index: number;
  isActive: boolean;
  currentCompany: string;
  onLongPress: (index: number) => void;
}

function SlotButton({ slot, index, isActive, currentCompany, onLongPress }: SlotButtonProps) {
  const router = useRouter();
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const isLongPress = useRef(false);

  const Icon = getIcon(slot.icon);
  const href = slot.href.replace('{company}', currentCompany);

  const handleTouchStart = useCallback(() => {
    isLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      onLongPress(index);
    }, 500);
  }, [index, onLongPress]);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (!isLongPress.current) {
      router.push(href);
    }
  }, [href, router]);

  const handleTouchCancel = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (!isLongPress.current) {
      router.push(href);
    }
  }, [href, router]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    onLongPress(index);
  }, [index, onLongPress]);

  return (
    <button
      type="button"
      className={cn(
        'flex flex-col items-center justify-center gap-0.5 text-muted-foreground transition-colors',
        isActive && 'text-primary'
      )}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    >
      <Icon className="h-5 w-5" />
      <span className="text-[10px] font-medium">{slot.label}</span>
    </button>
  );
}

interface ConfigSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slotIndex: number | null;
  availablePages: AvailablePage[];
  currentSlot: BottomBarSlot | null;
  onSelectPage: (page: AvailablePage) => void;
}

function ConfigSheet({ open, onOpenChange, slotIndex, availablePages, currentSlot, onSelectPage }: ConfigSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="pb-[env(safe-area-inset-bottom)]">
        <SheetHeader>
          <SheetTitle>Konfigurera snabbknapp {slotIndex !== null ? slotIndex + 1 : ''}</SheetTitle>
        </SheetHeader>
        <div className="py-4">
          <div className="space-y-1">
            {availablePages.map((page) => {
              const Icon = getIcon(page.icon);
              const isSelected = currentSlot?.id === page.id;
              return (
                <SheetClose key={page.id} asChild>
                  <button
                    type="button"
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
                      isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-accent'
                    )}
                    onClick={() => onSelectPage(page)}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="flex-1 font-medium">{page.label}</span>
                    {isSelected && <Check className="h-4 w-4" />}
                  </button>
                </SheetClose>
              );
            })}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function MobileBottomBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading: userLoading } = useUser();
  const { allowedCompanies, hasOverviewAccess, isLoading: rolesLoading } = useRoles();
  const { slots, setSlot, availablePages } = useBottomBarConfig();

  const [menuOpen, setMenuOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [configSlotIndex, setConfigSlotIndex] = useState<number | null>(null);

  const isLoading = userLoading || rolesLoading;

  // Determine current company from URL
  const pathSegments = pathname.split('/').filter(Boolean);
  const companySlug = pathSegments[0];
  const isCompanyPage = companySlug && companySlug in COMPANIES && companySlug !== 'all';
  const currentCompany: CompanyId = isCompanyPage ? (companySlug as CompanyId) : 'all';
  const companyConfig = COMPANIES[currentCompany];

  // Filter companies based on user access
  const accessibleCompanies = COMPANY_LIST.filter((company) => {
    if (company.id === 'all') {
      return hasOverviewAccess;
    }
    return allowedCompanies.includes(company.id as CompanyId);
  });

  const showCompanySelector = accessibleCompanies.length > 1;

  const handleCompanySelect = (companyId: CompanyId) => {
    if (companyId === 'all') {
      router.push('/');
    } else {
      router.push(`/${companyId}`);
    }
  };

  const handleLongPress = useCallback((index: number) => {
    setConfigSlotIndex(index);
    setConfigOpen(true);
  }, []);

  const handleSelectPage = useCallback((page: AvailablePage) => {
    if (configSlotIndex !== null) {
      setSlot(configSlotIndex, {
        id: page.id,
        icon: page.icon,
        label: page.label,
        href: page.href,
      });
    }
    setConfigOpen(false);
    setConfigSlotIndex(null);
  }, [configSlotIndex, setSlot]);

  const isSlotActive = (slot: BottomBarSlot): boolean => {
    const href = slot.href.replace('{company}', currentCompany);
    if (href === '/' || href === `/${currentCompany}`) {
      // Dashboard - active only on exact match or company root without other sections
      return pathname === href || (pathname === `/${currentCompany}` && !pathname.includes('/inventory') && !pathname.includes('/deliveries') && !pathname.includes('/performance') && !pathname.includes('/settings'));
    }
    return pathname.startsWith(href);
  };

  // Navigation items for the menu sheet
  const navItems = [
    { icon: 'LayoutDashboard', label: 'Dashboard', href: currentCompany === 'all' ? '/' : `/${currentCompany}`, isActive: !pathname.includes('/inventory') && !pathname.includes('/deliveries') && !pathname.includes('/performance') && !pathname.includes('/settings') },
    ...(isCompanyPage ? [
      { icon: 'Package', label: 'Lager', href: `/${currentCompany}/inventory`, isActive: pathname.includes('/inventory') },
      { icon: 'Truck', label: 'Inleveranser', href: `/${currentCompany}/deliveries`, isActive: pathname.includes('/deliveries') },
      { icon: 'BarChart3', label: 'Prestation', href: `/${currentCompany}/performance`, isActive: pathname.includes('/performance') },
      { icon: 'Settings', label: 'Installningar', href: `/${currentCompany}/settings/ad-costs`, isActive: pathname.includes('/settings') },
    ] : []),
  ];

  return (
    <>
      {/* Fixed bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background border-t pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-4 h-14">
          {/* Slots 1-3: Configurable quick links */}
          {slots.map((slot, index) => (
            <SlotButton
              key={slot.id}
              slot={slot}
              index={index}
              isActive={isSlotActive(slot)}
              currentCompany={currentCompany}
              onLongPress={handleLongPress}
            />
          ))}
          {/* Slot 4: Menu button */}
          <button
            type="button"
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 text-muted-foreground transition-colors',
              menuOpen && 'text-primary'
            )}
            onClick={() => setMenuOpen(true)}
          >
            <Menu className="h-5 w-5" />
            <span className="text-[10px] font-medium">Meny</span>
          </button>
        </div>
      </div>

      {/* Configuration Sheet */}
      <ConfigSheet
        open={configOpen}
        onOpenChange={setConfigOpen}
        slotIndex={configSlotIndex}
        availablePages={availablePages}
        currentSlot={configSlotIndex !== null ? slots[configSlotIndex] : null}
        onSelectPage={handleSelectPage}
      />

      {/* Menu Sheet */}
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="bottom" className="pb-[env(safe-area-inset-bottom)] max-h-[85vh] overflow-auto">
          <SheetHeader>
            <SheetTitle>Meny</SheetTitle>
          </SheetHeader>
          <div className="py-4 space-y-6">
            {/* Company Selector */}
            <div>
              {showCompanySelector ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 rounded-lg border p-3 text-left"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white">
                        <CompanyLogo companyId={currentCompany} className="h-6 w-6" />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold">{companyConfig.name}</div>
                        <div className="text-sm text-muted-foreground">{companyConfig.displayName}</div>
                      </div>
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-[calc(100vw-3rem)]" align="start">
                    {accessibleCompanies.map((company) => (
                      <DropdownMenuItem
                        key={company.id}
                        onClick={() => {
                          handleCompanySelect(company.id as CompanyId);
                          setMenuOpen(false);
                        }}
                        className={cn(
                          'py-2.5',
                          currentCompany === company.id && 'bg-accent'
                        )}
                      >
                        <CompanyLogo companyId={company.id as CompanyId} className="mr-2 h-5 w-5" />
                        {company.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <div className="flex items-center gap-3 rounded-lg border p-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white">
                    <CompanyLogo companyId={currentCompany} className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold">{companyConfig.name}</div>
                    <div className="text-sm text-muted-foreground">{companyConfig.displayName}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Navigation Links */}
            <div className="space-y-1">
              {navItems.map((item) => {
                const Icon = getIcon(item.icon);
                return (
                  <SheetClose key={item.href} asChild>
                    <a
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors',
                        item.isActive ? 'bg-primary/10 text-primary' : 'hover:bg-accent'
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="font-medium">{item.label}</span>
                    </a>
                  </SheetClose>
                );
              })}
            </div>

            {/* User Profile */}
            <div className="border-t pt-4">
              {isLoading ? (
                <div className="flex items-center gap-3 px-3 py-2">
                  <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                    <div className="h-2.5 w-32 animate-pulse rounded bg-muted" />
                  </div>
                </div>
              ) : user ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-3 px-3 py-2">
                    {user.picture ? (
                      <img
                        src={user.picture}
                        alt={user.name || 'User'}
                        className="h-10 w-10 rounded-full"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <User className="h-5 w-5" />
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="font-semibold">{user.name}</div>
                      <div className="text-sm text-muted-foreground">{user.email}</div>
                    </div>
                  </div>
                  <SheetClose asChild>
                    <a
                      href="/auth/logout"
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <LogOut className="h-5 w-5" />
                      <span className="font-medium">Logga ut</span>
                    </a>
                  </SheetClose>
                </div>
              ) : (
                <SheetClose asChild>
                  <a
                    href="/auth/login"
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-accent transition-colors"
                  >
                    <User className="h-5 w-5" />
                    <span className="font-medium">Logga in</span>
                  </a>
                </SheetClose>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
