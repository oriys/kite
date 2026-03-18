export interface ServiceInstance {
  address: string
  port: number
  metadata: Record<string, string>
}

interface NacosServiceListResponse {
  count: number
  doms: string[]
}

interface NacosInstance {
  ip: string
  port: number
  metadata: Record<string, string>
}

interface NacosInstanceListResponse {
  hosts: NacosInstance[]
}

export async function listNacosServices(
  nacosAddress: string,
  namespace?: string,
): Promise<string[]> {
  const url = new URL('/nacos/v1/ns/service/list', nacosAddress)
  url.searchParams.set('pageNo', '1')
  url.searchParams.set('pageSize', '1000')
  if (namespace) url.searchParams.set('namespaceId', namespace)

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10_000) })
  if (!res.ok) throw new Error(`Nacos returned ${res.status}`)

  const data = (await res.json()) as NacosServiceListResponse
  return data.doms ?? []
}

export async function getNacosInstances(
  nacosAddress: string,
  serviceName: string,
  namespace?: string,
): Promise<ServiceInstance[]> {
  const url = new URL('/nacos/v1/ns/instance/list', nacosAddress)
  url.searchParams.set('serviceName', serviceName)
  if (namespace) url.searchParams.set('namespaceId', namespace)

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10_000) })
  if (!res.ok) throw new Error(`Nacos returned ${res.status}`)

  const data = (await res.json()) as NacosInstanceListResponse
  return (data.hosts ?? []).map((host) => ({
    address: host.ip,
    port: host.port,
    metadata: host.metadata ?? {},
  }))
}
