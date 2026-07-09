import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Panel de Gestión de Fincas',
  description: 'Panel de administración de fincas y comunidades',
  other: {
    google: 'notranslate',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" translate="no">
      <body>{children}</body>
    </html>
  )
}
