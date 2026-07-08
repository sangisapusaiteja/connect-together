import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@*/lib/utils"

const bubbleVariants = cva(
  "relative w-fit break-words rounded-2xl px-4 py-2.5 text-base",
  {
    variants: {
      variant: {
        default: "text-white",
        secondary: "bg-secondary/60 text-foreground",
        muted: "bg-muted text-muted-foreground",
        tinted: "bg-primary/10 text-primary",
        outline: "border border-border bg-transparent text-foreground",
        ghost: "max-w-none bg-transparent text-foreground",
        destructive: "bg-destructive/10 text-destructive border border-destructive/20",
      },
      align: {
        start: "self-start rounded-bl-sm",
        end: "self-end rounded-br-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      align: "start",
    },
  }
)

export interface BubbleProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof bubbleVariants> {}

const Bubble = React.forwardRef<HTMLDivElement, BubbleProps>(
  ({ className, variant, align, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(bubbleVariants({ variant, align }), className)}
      {...props}
    />
  )
)
Bubble.displayName = "Bubble"

export interface BubbleContentProps extends React.HTMLAttributes<HTMLDivElement> {
  render?: React.ReactElement | ((props: any) => React.ReactElement)
}

const BubbleContent = React.forwardRef<HTMLDivElement, BubbleContentProps>(
  ({ className, render, children, ...props }, ref) => {
    if (render) {
      const el = typeof render === "function" ? render({ children, className: cn(className, "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring") }) : render
      return React.cloneElement(el, { ref, ...props }, children)
    }
    return (
      <div ref={ref} className={cn("", className)} {...props}>
        {children}
      </div>
    )
  }
)
BubbleContent.displayName = "BubbleContent"

export interface BubbleReactionsProps extends React.HTMLAttributes<HTMLDivElement> {
  side?: "top" | "bottom"
  align?: "start" | "end"
}

const BubbleReactions = React.forwardRef<HTMLDivElement, BubbleReactionsProps>(
  ({ className, side = "bottom", align = "end", ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex gap-1",
        side === "top" ? "-mt-2 mb-1" : "mt-1 -mb-2",
        align === "end" ? "justify-end" : "justify-start",
        className
      )}
      {...props}
    />
  )
)
BubbleReactions.displayName = "BubbleReactions"

export interface BubbleGroupProps extends React.HTMLAttributes<HTMLDivElement> {}

const BubbleGroup = React.forwardRef<HTMLDivElement, BubbleGroupProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col gap-0.5", className)} {...props} />
  )
)
BubbleGroup.displayName = "BubbleGroup"

export { Bubble, BubbleContent, BubbleReactions, BubbleGroup, bubbleVariants }
