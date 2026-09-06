'use client'
import { useEffect, useState } from 'react'

/** Toggles the `.dark` class on <html>, which is what GlassScroll's default darkSelector reads. */
export function ThemeToggle() {
  const [dark, setDark] = useState(false)
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])
  return (
    <button className="toggle" data-testid="theme-toggle" onClick={() => setDark((d) => !d)}>
      {dark ? 'Light' : 'Dark'} mode
    </button>
  )
}
