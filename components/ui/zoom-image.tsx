'use client'

import Image, { ImageProps } from 'next/image'
import { ZoomIn } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface ZoomImageProps extends ImageProps {
  alt: string
  caption?: string
}

export function ZoomImage({
  src,
  alt,
  caption,
  className,
  width,
  height,
  ...props
}: ZoomImageProps) {
  if (!src) return null

  return (
    <Dialog>
      <DialogTrigger asChild>
        <div className={cn('relative cursor-zoom-in overflow-hidden rounded-lg border bg-muted/50 group', className)}>
          <Image
            src={src}
            alt={alt}
            width={width ?? 800}
            height={height ?? 400}
            className="h-auto w-full object-cover transition-transform duration-300 group-hover:scale-105"
            {...props}
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
            <ZoomIn className="h-8 w-8 text-white" />
          </div>
        </div>
      </DialogTrigger>
      <DialogContent className="max-w-4xl border-none bg-transparent p-0 shadow-none">
        <DialogTitle className="sr-only">{alt}</DialogTitle>
        <div className="relative h-[80vh] w-full overflow-hidden rounded-lg bg-background shadow-2xl">
           {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={typeof src === 'string' ? src : ''}
            alt={alt}
            className="h-full w-full object-contain"
          />
          {caption && (
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-4 text-center text-sm text-white backdrop-blur-md">
              {caption}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
