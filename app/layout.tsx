import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'teloNova AI – DSGVO-konform',
  description: 'KI-Assistent nach europäischem Datenschutzrecht',
  icons: {
    icon: '/favicon.png',
    apple: '/favicon.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className="dark">
      <body className={`${inter.variable} bg-main text-white antialiased`}>
        {children}
      </body>
    </html>
  )
}
