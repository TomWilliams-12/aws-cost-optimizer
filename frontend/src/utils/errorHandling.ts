// Enhanced error handling utilities

export interface EnhancedError {
  message: string
  type: 'network' | 'auth' | 'validation' | 'server' | 'unknown'
  statusCode?: number
  suggestions?: string[]
  recoverable: boolean
}

export function parseApiError(error: any, response?: Response): EnhancedError {
  // Network errors
  if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
    return {
      message: 'Unable to connect to server',
      type: 'network',
      suggestions: [
        'Check your internet connection',
        'Try refreshing the page',
        'Contact support if the problem persists'
      ],
      recoverable: true
    }
  }

  // Response-based errors
  if (response) {
    const statusCode = response.status

    switch (statusCode) {
      case 401:
        return {
          message: 'Your session has expired',
          type: 'auth',
          statusCode,
          suggestions: [
            'Please log in again',
            'Clear your browser cache if the problem persists'
          ],
          recoverable: true
        }

      case 403:
        return {
          message: 'Access denied',
          type: 'auth',
          statusCode,
          suggestions: [
            'You may not have permission for this action',
            'Contact your administrator',
            'Try logging out and back in'
          ],
          recoverable: false
        }

      case 404:
        return {
          message: 'Resource not found',
          type: 'validation',
          statusCode,
          suggestions: [
            'The requested resource may have been deleted',
            'Check if the URL is correct',
            'Try refreshing the page'
          ],
          recoverable: true
        }

      case 429:
        return {
          message: 'Too many requests',
          type: 'server',
          statusCode,
          suggestions: [
            'Please wait a moment before trying again',
            'Our servers are busy processing requests'
          ],
          recoverable: true
        }

      case 500:
      case 502:
      case 503:
      case 504:
        return {
          message: 'Server error occurred',
          type: 'server',
          statusCode,
          suggestions: [
            'This is a temporary issue on our end',
            'Please try again in a few minutes',
            'Contact support if the problem persists'
          ],
          recoverable: true
        }

      default:
        if (statusCode >= 400 && statusCode < 500) {
          return {
            message: 'Request failed',
            type: 'validation',
            statusCode,
            suggestions: [
              'Please check your input and try again',
              'Contact support if you need assistance'
            ],
            recoverable: true
          }
        }
    }
  }

  // Parse error message for specific cases
  const errorMessage = error.message || error.toString()

  if (errorMessage.includes('JWT') || errorMessage.includes('token')) {
    return {
      message: 'Authentication error',
      type: 'auth',
      suggestions: [
        'Your session may have expired',
        'Please log in again'
      ],
      recoverable: true
    }
  }

  if (errorMessage.includes('AWS') || errorMessage.includes('role')) {
    return {
      message: 'AWS connection error',
      type: 'validation',
      suggestions: [
        'Check your AWS account configuration',
        'Verify your IAM role permissions',
        'Ensure the external ID is correct'
      ],
      recoverable: true
    }
  }

  if (errorMessage.includes('timeout')) {
    return {
      message: 'Request timed out',
      type: 'network',
      suggestions: [
        'The operation is taking longer than expected',
        'Please try again',
        'Check your internet connection'
      ],
      recoverable: true
    }
  }

  // Default error
  return {
    message: errorMessage || 'An unexpected error occurred',
    type: 'unknown',
    suggestions: [
      'Please try again',
      'Refresh the page if the problem persists',
      'Contact support for assistance'
    ],
    recoverable: true
  }
}

export function getErrorIcon(type: EnhancedError['type']): string {
  switch (type) {
    case 'network':
      return '🌐'
    case 'auth':
      return '🔒'
    case 'validation':
      return '⚠️'
    case 'server':
      return '🔧'
    default:
      return '❌'
  }
}

export function getErrorColor(type: EnhancedError['type']): string {
  switch (type) {
    case 'network':
      return 'blue'
    case 'auth':
      return 'yellow'
    case 'validation':
      return 'red'
    case 'server':
      return 'purple'
    default:
      return 'gray'
  }
}