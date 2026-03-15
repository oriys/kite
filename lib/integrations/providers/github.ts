import type { integrations } from '@/lib/schema'

type Integration = typeof integrations.$inferSelect

interface GithubConfig {
  accessToken: string
  owner: string
  repo: string
}

const GITHUB_API = 'https://api.github.com'

async function githubFetch(
  config: GithubConfig,
  path: string,
  options: RequestInit = {},
) {
  const res = await fetch(`${GITHUB_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    },
    signal: AbortSignal.timeout(15_000),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`GitHub API ${res.status}: ${body.slice(0, 200)}`)
  }

  return res.json()
}

export async function handleGithubEvent(
  integration: Integration,
  event: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const config = integration.config as GithubConfig

  if (!config.accessToken || !config.owner || !config.repo) {
    throw new Error('GitHub integration not fully configured')
  }

  switch (event) {
    case 'document.published': {
      const title = (payload.title as string) ?? 'untitled'
      const slug = (payload.slug as string) ?? title.toLowerCase().replace(/\s+/g, '-')
      const content = (payload.content as string) ?? ''
      const path = `docs/${slug}.md`
      const message = `docs: update ${title}`

      const existing = await fetch(
        `${GITHUB_API}/repos/${config.owner}/${config.repo}/contents/${path}`,
        {
          headers: {
            Authorization: `Bearer ${config.accessToken}`,
            Accept: 'application/vnd.github+json',
          },
          signal: AbortSignal.timeout(10_000),
        },
      ).then((r) => (r.ok ? r.json() : null)).catch(() => null)

      await githubFetch(
        config,
        `/repos/${config.owner}/${config.repo}/contents/${path}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            message,
            content: Buffer.from(content).toString('base64'),
            ...(existing?.sha ? { sha: existing.sha } : {}),
          }),
        },
      )
      break
    }

    case 'approval.requested': {
      const docTitle = (payload.docTitle as string) ?? 'Untitled'
      const linkUrl = (payload.linkUrl as string) ?? ''

      await githubFetch(
        config,
        `/repos/${config.owner}/${config.repo}/issues`,
        {
          method: 'POST',
          body: JSON.stringify({
            title: `Approval requested: ${docTitle}`,
            body: `An approval has been requested for **${docTitle}** in Kite.\n\n${linkUrl ? `[View in Kite](${linkUrl})` : ''}`,
            labels: ['kite', 'approval'],
          }),
        },
      )
      break
    }

    case 'openapi.updated': {
      const prNumber = payload.prNumber as number | undefined
      const summary = (payload.summary as string) ?? 'OpenAPI spec updated'

      if (prNumber) {
        await githubFetch(
          config,
          `/repos/${config.owner}/${config.repo}/issues/${prNumber}/comments`,
          {
            method: 'POST',
            body: JSON.stringify({
              body: `🔄 **OpenAPI Update**\n\n${summary}`,
            }),
          },
        )
      }
      break
    }
  }
}
