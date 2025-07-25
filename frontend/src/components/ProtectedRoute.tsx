import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return <div>Loading...</div> // Or a spinner component
  }

  if (!user) {
    return <Navigate to="/login" />
  }

  return children
} 