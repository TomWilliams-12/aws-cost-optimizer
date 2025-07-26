import React from 'react'

interface SkeletonProps {
  className?: string
  variant?: 'text' | 'rectangular' | 'circular'
  width?: string | number
  height?: string | number
  animation?: 'pulse' | 'wave'
}

export const Skeleton: React.FC<SkeletonProps> = ({ 
  className = '',
  variant = 'text',
  width,
  height,
  animation = 'pulse'
}) => {
  const baseClasses = 'bg-gray-200 rounded'
  
  const variantClasses = {
    text: 'h-4',
    rectangular: 'h-20',
    circular: 'rounded-full'
  }
  
  const animationClasses = {
    pulse: 'animate-pulse',
    wave: 'animate-pulse' // Could implement wave animation later
  }
  
  const style: React.CSSProperties = {}
  if (width) style.width = typeof width === 'number' ? `${width}px` : width
  if (height) style.height = typeof height === 'number' ? `${height}px` : height
  
  return (
    <div 
      className={`${baseClasses} ${variantClasses[variant]} ${animationClasses[animation]} ${className}`}
      style={style}
    />
  )
}

// Specialized skeleton components
export const SkeletonText: React.FC<{ lines?: number; className?: string }> = ({ 
  lines = 1, 
  className = '' 
}) => (
  <div className={`space-y-2 ${className}`}>
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton 
        key={i} 
        variant="text" 
        className={i === lines - 1 ? 'w-3/4' : 'w-full'} 
      />
    ))}
  </div>
)

export const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`bg-white p-4 rounded-lg shadow border border-gray-100 ${className}`}>
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center">
        <Skeleton variant="circular" width={40} height={40} className="mr-3" />
        <div>
          <Skeleton variant="text" width={80} className="mb-2" />
          <Skeleton variant="text" width={120} />
        </div>
      </div>
    </div>
    <div className="mt-3">
      <Skeleton variant="text" width={60} className="mb-2" />
      <Skeleton variant="rectangular" height={8} className="mb-2" />
    </div>
  </div>
)

export const SkeletonAccountCard: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`bg-gradient-to-r from-gray-50 to-blue-50 border border-gray-200 rounded-xl p-6 ${className}`}>
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-4">
        <Skeleton variant="rectangular" width={48} height={48} className="rounded-lg" />
        <div>
          <Skeleton variant="text" width={180} height={20} className="mb-2" />
          <div className="flex items-center space-x-2">
            <Skeleton variant="rectangular" width={80} height={20} className="rounded-full" />
            <Skeleton variant="text" width={120} height={16} />
          </div>
        </div>
      </div>
      <div className="flex items-center space-x-3">
        <Skeleton variant="rectangular" width={80} height={36} className="rounded-lg" />
        <Skeleton variant="rectangular" width={60} height={32} className="rounded-lg" />
      </div>
    </div>
  </div>
)

export const SkeletonMetricsCard: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`bg-white p-4 rounded-lg shadow border border-gray-100 ${className}`}>
    <div className="flex items-center justify-between">
      <div className="flex items-center">
        <Skeleton variant="rectangular" width={40} height={40} className="rounded-lg mr-3" />
        <div>
          <Skeleton variant="text" width={60} height={12} className="mb-2" />
          <Skeleton variant="text" width={40} height={24} />
        </div>
      </div>
    </div>
    <div className="mt-3">
      <Skeleton variant="text" width={80} height={12} className="mb-2" />
      <div className="flex items-center">
        <Skeleton variant="rectangular" height={6} className="flex-1 mr-2 rounded-full" />
        <Skeleton variant="text" width={40} height={12} />
      </div>
    </div>
  </div>
)

export const SkeletonChart: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`bg-white rounded-lg shadow border border-gray-100 p-4 ${className}`}>
    <div className="mb-4">
      <Skeleton variant="text" width={150} height={20} className="mb-2" />
      <Skeleton variant="text" width={250} height={14} />
    </div>
    <div className="h-64 flex items-end justify-center space-x-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton 
          key={i} 
          variant="rectangular" 
          width={40} 
          height={Math.random() * 150 + 50} 
          className="rounded-t"
        />
      ))}
    </div>
    <div className="mt-4 flex justify-center space-x-4">
      <div className="flex items-center">
        <Skeleton variant="rectangular" width={12} height={12} className="mr-2" />
        <Skeleton variant="text" width={60} height={12} />
      </div>
      <div className="flex items-center">
        <Skeleton variant="rectangular" width={12} height={12} className="mr-2" />
        <Skeleton variant="text" width={80} height={12} />
      </div>
    </div>
  </div>
)