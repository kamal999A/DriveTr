// src/app/layout.tsx
import type { Metadata, Viewport } from 'next';
import { Montserrat, Inter } from 'next/font/google';
import { cookies } from 'next/headers';
import '@/styles/globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { I18nProvider } from '@/lib/i18n';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import PageTransition from '@/components/layout/PageTransition';
import NavigationProgress from '@/components/layout/NavigationProgress';
import ScrollReveal from '@/components/layout/ScrollReveal';

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-montserrat',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'DriveTR — Turkey\'s Car Marketplace',
  description: 'Buy and sell cars in Turkey. Find new and used vehicles with DriveTR.',
};

export const viewport: Viewport = {
  themeColor: '#ae050a',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const langCookie = cookieStore.get('drivetr_lang')?.value;
  const currencyCookie = cookieStore.get('drivetr_currency')?.value;
  const initialLang = langCookie === 'en' || langCookie === 'tr' ? langCookie : 'tr';
  const initialCurrency = currencyCookie === 'TL' || currencyCookie === 'EUR' ? currencyCookie : 'TL';

  return (
    <html lang={initialLang} suppressHydrationWarning data-scroll-behavior="smooth" className={`${montserrat.variable} ${inter.variable}`}>
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body>
        <I18nProvider initialLang={initialLang} initialCurrency={initialCurrency}>
          <AuthProvider>
            <NavigationProgress />
            <ScrollReveal />
            <Navbar />
            <main>
              <PageTransition>{children}</PageTransition>
            </main>
            <Footer />
          </AuthProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
