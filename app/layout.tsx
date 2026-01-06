import type { Metadata } from 'next';
import { Noto_Sans } from 'next/font/google';
import { Auth0Provider } from '@auth0/nextjs-auth0/client';
import './globals.css';
import { PeriodProvider } from '@/providers/period-provider';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { MobileBottomBar } from '@/components/layout/mobile-bottom-bar';

const notoSans = Noto_Sans({
  variable: '--font-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'Lifestyle Stock Overview',
  description: 'Dashboard för försäljning och lager',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sv" className={notoSans.variable}>
      <body className="font-sans antialiased">
        <Auth0Provider>
          <PeriodProvider>
            <SidebarProvider>
              <AppSidebar />
              {children}
              <MobileBottomBar />
            </SidebarProvider>
          </PeriodProvider>
        </Auth0Provider>
      </body>
    </html>
  );
}
