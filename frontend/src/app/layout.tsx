import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Anti-Promo Email Optimizer',
  description: 'Automatically optimize your marketing emails to land in the inbox',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-gray-100 min-h-screen">{children}</body>
    </html>
  )
}
