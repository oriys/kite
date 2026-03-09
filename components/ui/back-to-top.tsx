'use client'

import * as React from 'react'
import { ArrowUp } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

export function BackToTop({ className }: { className?: string }) {
  const [show, setShow] = React.useState(false)

  React.useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 300) {
        setShow(true)
      } else {
        setShow(false)
      }
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  if (!show) return null

  return (
    <Button
      variant="outline"
      size="icon"
      className={cn(
        'fixed bottom-8 right-8 z-50 rounded-full shadow-md transition-all duration-300 hover:shadow-lg',
        className
      )}
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
    >
      <ArrowUp className="h-4 w-4" />
      <span className="sr-only">Back to top</span>
    </Button>
  )
}
