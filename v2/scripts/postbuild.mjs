import fs from 'node:fs'
import path from 'node:path'

const src = path.resolve(process.cwd(), 'dist')
const dst = path.resolve(process.cwd(), '..', 'dist-v2')

if (!fs.existsSync(src)) {
  console.error(`[postbuild] ${src} missing — run vite build first`)
  process.exit(1)
}

fs.rmSync(dst, { recursive: true, force: true })
fs.cpSync(src, dst, { recursive: true })

const files = fs.readdirSync(dst, { recursive: true })
console.log(`[postbuild] v2/dist -> dist-v2/ copied (${files.length} entries)`)
