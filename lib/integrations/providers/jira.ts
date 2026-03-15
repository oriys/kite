import type { integrations } from '@/lib/schema'

type Integration = typeof integrations.$inferSelect

interface JiraConfig {
  siteUrl: string
  email: string
  apiToken: string
  projectKey: string
}

async function jiraFetch(
  config: JiraConfig,
  path: string,
  options: RequestInit = {},
) {
  const base = config.siteUrl.replace(/\/+$/, '')
  const credentials = Buffer.from(
    `${config.email}:${config.apiToken}`,
  ).toString('base64')

  const res = await fetch(`${base}/rest/api/3${path}`, {
    ...options,
    headers: {
      Authorization: `Basic ${credentials}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    },
    signal: AbortSignal.timeout(15_000),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Jira API ${res.status}: ${body.slice(0, 200)}`)
  }

  return res.json()
}

export async function handleJiraEvent(
  integration: Integration,
  event: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const config = integration.config as JiraConfig

  if (!config.siteUrl || !config.email || !config.apiToken || !config.projectKey) {
    throw new Error('Jira integration not fully configured')
  }

  switch (event) {
    case 'approval.requested': {
      const docTitle = (payload.docTitle as string) ?? 'Untitled'
      const linkUrl = (payload.linkUrl as string) ?? ''

      await jiraFetch(config, '/issue', {
        method: 'POST',
        body: JSON.stringify({
          fields: {
            project: { key: config.projectKey },
            summary: `Approval requested: ${docTitle}`,
            description: {
              type: 'doc',
              version: 1,
              content: [
                {
                  type: 'paragraph',
                  content: [
                    {
                      type: 'text',
                      text: `An approval has been requested for "${docTitle}" in Kite.`,
                    },
                    ...(linkUrl
                      ? [
                          { type: 'text', text: ' ' },
                          {
                            type: 'text',
                            text: 'View in Kite',
                            marks: [{ type: 'link', attrs: { href: linkUrl } }],
                          },
                        ]
                      : []),
                  ],
                },
              ],
            },
            issuetype: { name: 'Task' },
          },
        }),
      })
      break
    }

    case 'document.published': {
      const issueKey = payload.jiraIssueKey as string | undefined
      const docTitle = (payload.title as string) ?? 'Untitled'
      const linkUrl = (payload.linkUrl as string) ?? ''

      if (issueKey) {
        await jiraFetch(config, `/issue/${issueKey}/comment`, {
          method: 'POST',
          body: JSON.stringify({
            body: {
              type: 'doc',
              version: 1,
              content: [
                {
                  type: 'paragraph',
                  content: [
                    {
                      type: 'text',
                      text: `Document "${docTitle}" has been published in Kite.`,
                    },
                    ...(linkUrl
                      ? [
                          { type: 'text', text: ' ' },
                          {
                            type: 'text',
                            text: 'View in Kite',
                            marks: [{ type: 'link', attrs: { href: linkUrl } }],
                          },
                        ]
                      : []),
                  ],
                },
              ],
            },
          }),
        })
      }
      break
    }
  }
}
