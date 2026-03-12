import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { ThemeProvider } from '@/components/theme-provider'
import { SessionProvider } from '@/lib/auth-client'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

const shouldRenderAnalytics =
  process.env.VERCEL === '1' ||
  process.env.VERCEL_ENV !== undefined ||
  process.env.NEXT_PUBLIC_ENABLE_VERCEL_ANALYTICS === 'true'

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist-sans',
})

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
})

export const metadata: Metadata = {
  title: 'Editorial System',
  description: 'A calm, editorial design system for docs, products, and internal tools.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geist.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <SessionProvider>
            {children}
          </SessionProvider>
          <Toaster richColors closeButton position="top-right" />
        </ThemeProvider>
        {shouldRenderAnalytics ? <Analytics /> : null}
      </body>
    </html>
  )
}
