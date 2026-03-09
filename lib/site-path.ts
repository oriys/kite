const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? ''
const isGithubPagesBuild = process.env.GITHUB_ACTIONS === 'true'

export const basePath =
  isGithubPagesBuild && repositoryName && !repositoryName.endsWith('.github.io')
    ? `/${repositoryName}`
    : ''

export function withBasePath(path: string): string {
  if (!path.startsWith('/')) {
    return `${basePath}/${path}`.replace(/\/{2,}/g, '/')
  }

  return `${basePath}${path}` || path
}
