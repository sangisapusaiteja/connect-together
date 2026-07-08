import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@*/lib/utils"

const messageVariants = cva("flex items-end gap-2", {
  variants: {
    align: {
      start: "justify-start",
      end: "flex-row-reverse justify-start",
    },
  },
  defaultVariants: {
    align: "start",
  },
})

export interface MessageProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof messageVariants> {}

const Message = React.forwardRef<HTMLDivElement, MessageProps>(
  ({ className, align, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(messageVariants({ align }), className)}
      {...props}
    />
  )
)
Message.displayName = "Message"

export interface MessageAvatarProps extends React.HTMLAttributes<HTMLDivElement> {}

const MessageAvatar = React.forwardRef<HTMLDivElement, MessageAvatarProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("w-9 shrink-0 flex flex-col justify-end", className)}
      {...props}
    />
  )
)
MessageAvatar.displayName = "MessageAvatar"

export interface MessageContentProps extends React.HTMLAttributes<HTMLDivElement> {}

const MessageContent = React.forwardRef<HTMLDivElement, MessageContentProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex flex-col max-w-[80%] sm:max-w-[70%]", className)}
      {...props}
    />
  )
)
MessageContent.displayName = "MessageContent"

export interface MessageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

const MessageHeader = React.forwardRef<HTMLDivElement, MessageHeaderProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("text-xs font-medium text-muted-foreground mb-0.5 ml-2", className)}
      {...props}
    />
  )
)
MessageHeader.displayName = "MessageHeader"

export interface MessageFooterProps extends React.HTMLAttributes<HTMLDivElement> {}

const MessageFooter = React.forwardRef<HTMLDivElement, MessageFooterProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("text-[10px] text-muted-foreground/60 mt-0.5", className)}
      {...props}
    />
  )
)
MessageFooter.displayName = "MessageFooter"

export interface MessageGroupProps extends React.HTMLAttributes<HTMLDivElement> {}

const MessageGroup = React.forwardRef<HTMLDivElement, MessageGroupProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col", className)} {...props} />
  )
)
MessageGroup.displayName = "MessageGroup"

export { Message, MessageAvatar, MessageContent, MessageHeader, MessageFooter, MessageGroup, messageVariants }
