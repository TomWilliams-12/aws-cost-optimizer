import React from 'react'
import { EnhancedError, getErrorIcon, getErrorColor } from '../utils/errorHandling'

interface ErrorDisplayProps {
  error: EnhancedError
  onRetry?: () => void
  onDismiss?: () => void
  className?: string
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  onRetry,
  onDismiss,
  className = ''
}) => {
  const icon = getErrorIcon(error.type)
  const colorClass = getErrorColor(error.type)
  
  const colorClasses = {
    blue: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-800',
      button: 'bg-blue-100 hover:bg-blue-200 text-blue-800'
    },
    yellow: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      text: 'text-yellow-800',
      button: 'bg-yellow-100 hover:bg-yellow-200 text-yellow-800'
    },
    red: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-800',
      button: 'bg-red-100 hover:bg-red-200 text-red-800'
    },
    purple: {
      bg: 'bg-purple-50',
      border: 'border-purple-200',
      text: 'text-purple-800',
      button: 'bg-purple-100 hover:bg-purple-200 text-purple-800'
    },
    gray: {
      bg: 'bg-gray-50',
      border: 'border-gray-200',
      text: 'text-gray-800',
      button: 'bg-gray-100 hover:bg-gray-200 text-gray-800'
    }
  }
  
  const colors = colorClasses[colorClass as keyof typeof colorClasses]

  return (
    <div className={`${colors.bg} ${colors.border} border rounded-lg p-4 ${className}`}>
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <span className="text-2xl">{icon}</span>
        </div>
        <div className="ml-3 flex-1">
          <h3 className={`text-sm font-medium ${colors.text}`}>
            {error.message}
          </h3>
          
          {error.statusCode && (
            <p className={`text-xs ${colors.text} opacity-75 mt-1`}>
              Error Code: {error.statusCode}
            </p>
          )}
          
          {error.suggestions && error.suggestions.length > 0 && (
            <div className="mt-2">
              <p className={`text-xs ${colors.text} font-medium mb-1`}>
                What you can do:
              </p>
              <ul className={`text-xs ${colors.text} space-y-1`}>
                {error.suggestions.map((suggestion, index) => (
                  <li key={index} className="flex items-start">
                    <span className="mr-1">•</span>
                    <span>{suggestion}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          <div className="flex items-center space-x-2 mt-3">
            {error.recoverable && onRetry && (
              <button
                onClick={onRetry}
                className={`inline-flex items-center px-3 py-1 rounded-md text-xs font-medium ${colors.button} transition-colors duration-200`}
              >
                Try Again
              </button>
            )}
            
            {onDismiss && (
              <button
                onClick={onDismiss}
                className={`inline-flex items-center px-3 py-1 rounded-md text-xs font-medium ${colors.button} transition-colors duration-200`}
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
        
        {onDismiss && (
          <div className="flex-shrink-0 ml-2">
            <button
              onClick={onDismiss}
              className={`inline-flex rounded-md p-1.5 ${colors.text} hover:bg-black hover:bg-opacity-10 focus:outline-none focus:bg-black focus:bg-opacity-10 transition-colors duration-200`}
            >
              <span className="sr-only">Dismiss</span>
              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// Simplified error display for inline use
export const InlineError: React.FC<{ message: string; onRetry?: () => void }> = ({
  message,
  onRetry
}) => (
  <div className="flex items-center space-x-2 text-sm text-red-600">
    <span>❌</span>
    <span>{message}</span>
    {onRetry && (
      <button
        onClick={onRetry}
        className="text-blue-600 hover:text-blue-800 underline text-xs"
      >
        Retry
      </button>
    )}
  </div>
)