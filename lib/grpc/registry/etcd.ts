export interface ServiceInstance {
  address: string
  port: number
  metadata: Record<string, string>
}

interface EtcdKv {
  key: string
  value: string
}

interface EtcdRangeResponse {
  kvs: EtcdKv[] | null
  count: string
}

export async function getEtcdServiceInstances(
  etcdAddress: string,
  servicePrefix: string,
): Promise<ServiceInstance[]> {
  const url = new URL('/v3/kv/range', etcdAddress)

  // Etcd v3 HTTP API expects base64-encoded key and range_end
  const keyBase64 = Buffer.from(servicePrefix).toString('base64')
  // range_end is the prefix with the last byte incremented (prefix scan)
  const prefixBytes = Buffer.from(servicePrefix)
  prefixBytes[prefixBytes.length - 1] += 1
  const rangeEndBase64 = prefixBytes.toString('base64')

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: keyBase64, range_end: rangeEndBase64 }),
    signal: AbortSignal.timeout(10_000),
  })

  if (!res.ok) throw new Error(`Etcd returned ${res.status}`)

  const data = (await res.json()) as EtcdRangeResponse
  const kvs = data.kvs ?? []

  return kvs
    .map((kv) => {
      try {
        const value = Buffer.from(kv.value, 'base64').toString('utf-8')
        const parsed = JSON.parse(value) as {
          address?: string
          host?: string
          ip?: string
          port?: number
          metadata?: Record<string, string>
        }
        const host = parsed.address ?? parsed.host ?? parsed.ip
        if (!host) return null
        return {
          address: host,
          port: parsed.port ?? 0,
          metadata: parsed.metadata ?? {},
        }
      } catch {
        return null
      }
    })
    .filter((inst): inst is ServiceInstance => inst !== null)
}
