import type { Metadata } from 'next'
import { GlassScroll } from 'glass-scroll'
import { ThemeToggle } from './theme-toggle'
import './globals.css'

export const metadata: Metadata = {
  title: 'glass-scroll — Next.js App Router example',
  description: 'The whole site is covered by one <GlassScroll /> in the root layout.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ThemeToggle />
        {children}
        {/*
          The entire integration: one self-closing component in the root layout. This file is a
          server component; GlassScroll carries its own "use client" boundary.
        */}
        <GlassScroll />
      </body>
    </html>
  )
}
