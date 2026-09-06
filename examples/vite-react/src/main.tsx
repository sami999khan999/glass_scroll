import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { GlassScroll, GlassScrollArea } from 'glass-scroll'
import './style.css'

const lines = Array.from({ length: 30 }, (_, i) => i + 1)

function App() {
  return (
    <>
      <main>
        <h1>glass-scroll in Vite</h1>
        <p>One component in the root, and the page scrollbar is the overlay.</p>
        <GlassScrollArea className="pane" preset="minimal">
          <div className="pane-inner">
            {lines.slice(0, 12).map((n) => (
              <p key={n}>An area using the minimal preset. Line {n}.</p>
            ))}
          </div>
        </GlassScrollArea>
        {lines.map((n) => (
          <p key={n}>Page paragraph {n}.</p>
        ))}
      </main>
      <GlassScroll />
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
