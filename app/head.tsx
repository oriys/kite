export default function Head() {
  return (
    <>
      <link
        rel="icon"
        href="/icon-light-32x32.png"
        media="(prefers-color-scheme: light)"
      />
      <link
        rel="icon"
        href="/icon-dark-32x32.png"
        media="(prefers-color-scheme: dark)"
      />
      <link rel="icon" href="/icon.svg" type="image/svg+xml" />
      <link rel="apple-touch-icon" href="/apple-icon.png" />
    </>
  )
}
