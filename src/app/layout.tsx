import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Panel de Gestión de Fincas',
  description: 'Panel de administración de fincas y comunidades',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
