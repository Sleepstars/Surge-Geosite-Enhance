import React from 'react'
import { clsx } from 'clsx'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'md', 
  className 
}) => {
  return (
    <div
      className={clsx(
        'animate-spin rounded-full border-2 border-current border-t-transparent',
        {
          'h-4 w-4': size === 'sm',
          'h-6 w-6': size === 'md',
          'h-8 w-8': size === 'lg',
        },
        className
      )}
    />
  )
}

interface LoadingStateProps {
  children?: React.ReactNode
  className?: string
}

export const LoadingState: React.FC<LoadingStateProps> = ({ 
  children, 
  className 
}) => {
  return (
    <div className={clsx('flex items-center justify-center p-8', className)}>
      <div className="flex flex-col items-center gap-3">
        <LoadingSpinner size="lg" className="text-primary" />
        {children && (
          <p className="text-sm text-muted-foreground">{children}</p>
        )}
      </div>
    </div>
  )
}

interface ErrorStateProps {
  error: string
  onRetry?: () => void
  className?: string
}

export const ErrorState: React.FC<ErrorStateProps> = ({ 
  error, 
  onRetry, 
  className 
}) => {
  return (
    <div className={clsx('flex items-center justify-center p-8', className)}>
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="rounded-full bg-destructive/10 p-3">
          <svg
            className="h-6 w-6 text-destructive"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>
        <div>
          <p className="font-medium text-foreground">出错了</p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="text-sm text-primary hover:text-primary/80 underline"
          >
            重试
          </button>
        )}
      </div>
    </div>
  )
}
