import { GlassScrollArea } from 'glass-scroll'

const paragraphs = Array.from({ length: 40 }, (_, i) => i + 1)

export default function Home() {
  return (
    <main className="page">
      <h1>glass-scroll</h1>
      <p className="lede">
        The page scrollbar on the right is the overlay. It reserves no layout width, so nothing
        shifts when this page grows. Every scrollbar below is the CSS-themed native bar, drawn from
        the same variables.
      </p>

      <section>
        <h2>A wrapped scroll area</h2>
        <GlassScrollArea className="pane" data-testid="area">
          <div className="pane-inner">
            {paragraphs.slice(0, 12).map((n) => (
              <p key={n}>Area line {n}. This pane has its own overlay, pinned to the pane.</p>
            ))}
          </div>
        </GlassScrollArea>
      </section>

      <section>
        <h2>A horizontal area</h2>
        <GlassScrollArea axis="x" className="strip" data-testid="strip">
          <div className="strip-inner">
            {paragraphs.slice(0, 14).map((n) => (
              <div className="card" key={n}>
                Card {n}
              </div>
            ))}
          </div>
        </GlassScrollArea>
      </section>

      <section>
        <h2>A plain nested container</h2>
        <p className="note">
          No overlay here. This is the browser&apos;s own scrollbar, re-themed by CSS to match.
        </p>
        <div className="native" data-testid="native">
          {paragraphs.slice(0, 12).map((n) => (
            <p key={n}>Native line {n}.</p>
          ))}
        </div>
      </section>

      <section>
        <h2>Opted out</h2>
        <p className="note">
          This one carries <code>data-glass-scroll=&quot;off&quot;</code>, so it keeps the browser
          default scrollbar.
        </p>
        <div className="native" data-glass-scroll="off" data-testid="excluded">
          {paragraphs.slice(0, 12).map((n) => (
            <p key={n}>Excluded line {n}.</p>
          ))}
        </div>
      </section>

      <section>
        <h2>Long page</h2>
        {paragraphs.map((n) => (
          <p key={n}>
            Page paragraph {n}. Scroll the page to see the overlay thumb track your position, then
            drag it.
          </p>
        ))}
      </section>
    </main>
  )
}
