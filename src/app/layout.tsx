import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
    title: 'DEA Madrid - Gestión de Desfibriladores',
    description: 'Sistema de gestión de desfibriladores externos automáticos en Madrid',
}

export default function RootLayout({
                                       children,
                                   }: {
    children: React.ReactNode
}) {
    return (
        <html lang="es">
        <body className={inter.className}>{children}</body>
        </html>
    )
}
