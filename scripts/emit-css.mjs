// Writes the default stylesheet to ./styles.css after tsup has built dist/core.js, so the
// static file and the runtime string can never drift apart.
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { glassScrollCSS } from '../dist/core.js'

const out = fileURLToPath(new URL('../styles.css', import.meta.url))
writeFileSync(out, `/* glass-scroll — generated, do not edit */\n${glassScrollCSS}\n`)
console.log(`styles.css written (${glassScrollCSS.length} bytes)`)
