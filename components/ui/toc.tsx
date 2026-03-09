'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'
import { useMounted } from '@/hooks/use-mounted'

interface TableOfContentsProps {
  toc: {
    title: string
    url: string
    items?: {
      title: string
      url: string
    }[]
  }[]
  className?: string
}

export function TableOfContents({ toc, className }: TableOfContentsProps) {
  const itemIds = React.useMemo(
    () =>
      toc
        ? toc
            .flatMap((item) => [item.url, item.items?.map((item) => item.url)])
            .flat()
            .filter(Boolean)
            .map((id) => id?.split('#')[1])
        : [],
    [toc]
  )
  const activeHeading = useActiveItem(itemIds)
  const mounted = useMounted()

  if (!toc?.length || !mounted) {
    return null
  }

  return (
    <div className={cn('space-y-2', className)}>
      <p className="font-medium">On This Page</p>
      <ul className="m-0 list-none">
        {toc.map((item, index) => (
          <li key={index} className="mt-0 pt-2">
            <a
              href={item.url}
              className={cn(
                'inline-block no-underline transition-colors hover:text-foreground',
                item.url === `#${activeHeading}`
                  ? 'font-medium text-foreground'
                  : 'text-muted-foreground'
              )}
            >
              {item.title}
            </a>
            {item.items?.length ? (
              <ul className="m-0 list-none pl-4">
                {item.items.map((subItem, subIndex) => (
                  <li key={subIndex} className="mt-0 pt-2">
                    <a
                      href={subItem.url}
                      className={cn(
                        'inline-block no-underline transition-colors hover:text-foreground',
                        subItem.url === `#${activeHeading}`
                          ? 'font-medium text-foreground'
                          : 'text-muted-foreground'
                      )}
                    >
                      {subItem.title}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}

function useActiveItem(itemIds: (string | undefined)[]) {
  const [activeId, setActiveId] = React.useState<string | undefined>(undefined)

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id)
          }
        })
      },
      { rootMargin: `0% 0% -80% 0%` }
    )

    itemIds?.forEach((id) => {
      if (!id) return
      const element = document.getElementById(id)
      if (element) {
        observer.observe(element)
      }
    })

    return () => {
      itemIds?.forEach((id) => {
        if (!id) return
        const element = document.getElementById(id)
        if (element) {
          observer.unobserve(element)
        }
      })
    }
  }, [itemIds])

  return activeId
}
