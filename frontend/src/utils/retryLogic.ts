// Retry logic utilities for handling transient failures

interface RetryOptions {
  maxAttempts?: number
  delay?: number
  backoffMultiplier?: number
  retryCondition?: (error: any, response?: Response) => boolean
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  delay: 1000, // 1 second
  backoffMultiplier: 2,
  retryCondition: (error: any, response?: Response) => {
    // Retry on network errors
    if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
      return true
    }
    
    // Retry on server errors (5xx) or rate limiting (429)
    if (response) {
      return response.status >= 500 || response.status === 429
    }
    
    // Retry on timeout errors
    if (error.message && error.message.includes('timeout')) {
      return true
    }
    
    return false
  }
}

export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  let lastError: any
  
  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      
      // Check if we should retry
      const shouldRetry = opts.retryCondition(error, (error as any)?.response)
      
      // Don't retry if it's the last attempt or if retry condition is not met
      if (attempt === opts.maxAttempts || !shouldRetry) {
        throw error
      }
      
      // Calculate delay with exponential backoff
      const delay = opts.delay * Math.pow(opts.backoffMultiplier, attempt - 1)
      
      console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`, (error as any)?.message || error)
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  throw lastError
}

// Enhanced fetch with retry logic
export async function fetchWithRetry(
  url: string, 
  init?: RequestInit, 
  retryOptions?: RetryOptions
): Promise<Response> {
  return retryWithBackoff(async () => {
    const response = await fetch(url, init)
    
    // If response is not ok and should be retried, throw an error with response attached
    if (!response.ok && retryOptions?.retryCondition) {
      const error = new Error(`HTTP ${response.status}: ${response.statusText}`)
      ;(error as any).response = response
      
      if (retryOptions.retryCondition(error, response)) {
        throw error
      }
    }
    
    return response
  }, retryOptions)
}

// Convenience wrapper for API calls
export class ApiClient {
  private baseUrl: string
  private defaultHeaders: HeadersInit
  private retryOptions: RetryOptions

  constructor(baseUrl: string, defaultHeaders: HeadersInit = {}, retryOptions: RetryOptions = {}) {
    this.baseUrl = baseUrl
    this.defaultHeaders = defaultHeaders
    this.retryOptions = retryOptions
  }

  async request<T = any>(
    endpoint: string,
    options: RequestInit & { retryOptions?: RetryOptions } = {}
  ): Promise<T> {
    const { retryOptions, ...fetchOptions } = options
    
    const url = `${this.baseUrl}${endpoint}`
    const init: RequestInit = {
      ...fetchOptions,
      headers: {
        ...this.defaultHeaders,
        ...fetchOptions.headers
      }
    }

    console.log('API Request:', {
      url,
      method: init.method,
      headers: init.headers,
      body: init.body
    })
    
    const response = await fetchWithRetry(url, init, {
      ...this.retryOptions,
      ...retryOptions
    })

    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}: ${response.statusText}`)
      ;(error as any).response = response
      throw error
    }

    return response.json()
  }

  async get<T = any>(endpoint: string, options?: RequestInit & { retryOptions?: RetryOptions }): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' })
  }

  async post<T = any>(endpoint: string, data?: any, options?: RequestInit & { retryOptions?: RetryOptions }): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers
      },
      body: data ? JSON.stringify(data) : undefined
    })
  }

  async put<T = any>(endpoint: string, data?: any, options?: RequestInit & { retryOptions?: RetryOptions }): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers
      },
      body: data ? JSON.stringify(data) : undefined
    })
  }

  async delete<T = any>(endpoint: string, options?: RequestInit & { retryOptions?: RetryOptions }): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' })
  }

  // Update authorization header
  setAuthToken(token: string) {
    this.defaultHeaders = {
      ...this.defaultHeaders,
      'Authorization': `Bearer ${token}`
    }
  }
}