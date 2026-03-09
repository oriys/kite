import { withBasePath } from '@/lib/site-path'

export default function Head() {
  return (
    <>
      <link
        rel="icon"
        href={withBasePath('/icon-light-32x32.png')}
        media="(prefers-color-scheme: light)"
      />
      <link
        rel="icon"
        href={withBasePath('/icon-dark-32x32.png')}
        media="(prefers-color-scheme: dark)"
      />
      <link rel="icon" href={withBasePath('/icon.svg')} type="image/svg+xml" />
      <link rel="apple-touch-icon" href={withBasePath('/apple-icon.png')} />
    </>
  )
}
