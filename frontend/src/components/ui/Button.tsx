import React from 'react'
import { clsx } from 'clsx'

type ButtonElement = HTMLButtonElement | HTMLAnchorElement

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive'
  size?: 'default' | 'sm' | 'lg'
  asChild?: boolean
  children: React.ReactNode
}

const Button = React.forwardRef<ButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'default',
      size = 'default',
      asChild = false,
      children,
      type,
      ...props
    },
    ref
  ) => {
    const classes = clsx(
      'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background',
      {
        'bg-primary text-primary-foreground hover:bg-primary/90': variant === 'default',
        'bg-secondary text-secondary-foreground hover:bg-secondary/80': variant === 'secondary',
        'border border-input hover:bg-accent hover:text-accent-foreground': variant === 'outline',
        'hover:bg-accent hover:text-accent-foreground': variant === 'ghost',
        'bg-destructive text-destructive-foreground hover:bg-destructive/90': variant === 'destructive',
      },
      {
        'h-10 py-2 px-4': size === 'default',
        'h-9 px-3 rounded-md': size === 'sm',
        'h-11 px-8 rounded-md': size === 'lg',
      },
      className
    )

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children, {
        className: clsx(classes, children.props.className),
        ref,
        ...props,
      })
    }

    return (
      <button
        className={classes}
        type={type ?? 'button'}
        ref={ref as React.Ref<HTMLButtonElement>}
        {...props}
      >
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'

export { Button }
