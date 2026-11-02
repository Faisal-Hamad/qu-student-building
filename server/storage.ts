import { AwsClient } from 'aws4fetch'

// Photos live in a private Cloudflare R2 bucket (S3-compatible). Without R2 settings, local development
// keeps them on disk in ./.data/uploads; on Vercel the R2 settings are required.
const env = () => ({
  account: process.env.R2_ACCOUNT_ID,
  key: process.env.R2_ACCESS_KEY_ID,
  secret: process.env.R2_SECRET_ACCESS_KEY,
  bucket: process.env.R2_BUCKET,
})

export const storageConfigured = () => {
  const e = env()
  return Boolean(e.account && e.key && e.secret && e.bucket) || !process.env.VERCEL
}

let client: AwsClient | undefined
function r2() {
  const e = env()
  if (!(e.account && e.key && e.secret && e.bucket)) return null
  client ??= new AwsClient({ accessKeyId: e.key, secretAccessKey: e.secret, service: 's3', region: 'auto' })
  return { client, url: (k: string) => `https://${e.account}.r2.cloudflarestorage.com/${e.bucket}/${k}` }
}

const localDir = () => process.env.UPLOAD_DIR ?? './.data/uploads'
const safeKey = (k: string) => {
  if (!/^[\w./-]+$/.test(k) || k.includes('..')) throw new Error('bad key')
  return k
}

export async function putObject(key: string, body: Uint8Array, contentType: string) {
  const r = r2()
  if (r) {
    const res = await r.client.fetch(r.url(safeKey(key)), { method: 'PUT', body, headers: { 'content-type': contentType } })
    if (!res.ok) throw new Error(`R2 put failed: ${res.status}`)
    return
  }
  const { mkdir, writeFile } = await import('node:fs/promises')
  const path = await import('node:path')
  const file = path.join(localDir(), safeKey(key))
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, body)
}

export async function getObject(key: string): Promise<Uint8Array | null> {
  const r = r2()
  if (r) {
    const res = await r.client.fetch(r.url(safeKey(key)))
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`R2 get failed: ${res.status}`)
    return new Uint8Array(await res.arrayBuffer())
  }
  const { readFile } = await import('node:fs/promises')
  const path = await import('node:path')
  return readFile(path.join(localDir(), safeKey(key))).then((b) => new Uint8Array(b)).catch(() => null)
}

export async function deleteObject(key: string) {
  const r = r2()
  if (r) {
    const res = await r.client.fetch(r.url(safeKey(key)), { method: 'DELETE' })
    if (!res.ok && res.status !== 404) throw new Error(`R2 delete failed: ${res.status}`)
    return
  }
  const { rm } = await import('node:fs/promises')
  const path = await import('node:path')
  await rm(path.join(localDir(), safeKey(key)), { force: true })
}

// Only real images are accepted, judged by their first bytes rather than the declared type.
export function sniffImage(b: Uint8Array): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png'
  if (String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP') return 'image/webp'
  return null
}
