import './globals.css'
import { Providers } from './Providers'

export const metadata = {
  title: 'Ascendus Creator Portal',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-bg text-text font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
