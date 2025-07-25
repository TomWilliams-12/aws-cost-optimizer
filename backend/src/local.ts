import express from 'express'
import cors from 'cors'
import jwt from 'jsonwebtoken'

const app = express()
const PORT = 3000
const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret'

app.use(cors())
app.use(express.json())

// Mock user database for development
const mockUsers = new Map()

// Auth routes
app.post('/dev/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' })
    }

    // For development, accept demo credentials
    if (email === 'demo@example.com' && password === 'password') {
      const user = {
        id: 'demo-user-id',
        email: 'demo@example.com',
        name: 'Demo User',
        subscriptionTier: 'starter',
        subscriptionStatus: 'active',
        accountsLimit: 3,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const accessToken = jwt.sign(
        { userId: user.id, email: user.email, subscriptionTier: user.subscriptionTier },
        JWT_SECRET,
        { expiresIn: '7d' }
      )

      return res.json({
        user,
        tokens: {
          accessToken,
          expiresIn: 7 * 24 * 60 * 60,
        },
      })
    }

    // Check mock database for other users
    const user = mockUsers.get(email.toLowerCase())
    if (!user || user.password !== password) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    const accessToken = jwt.sign(
      { userId: user.id, email: user.email, subscriptionTier: user.subscriptionTier },
      JWT_SECRET,
      { expiresIn: '7d' }
    )

    const { password: _, ...userResponse } = user
    res.json({
      user: userResponse,
      tokens: {
        accessToken,
        expiresIn: 7 * 24 * 60 * 60,
      },
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.post('/dev/auth/register', async (req, res) => {
  try {
    const { name, email, password, company } = req.body

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' })
    }

    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters long' })
    }

    const emailLower = email.toLowerCase()

    // Check if user already exists
    if (mockUsers.has(emailLower)) {
      return res.status(409).json({ message: 'User with this email already exists' })
    }

    const user = {
      id: `user-${Date.now()}`,
      email: emailLower,
      name: name.trim(),
      password, // In real app, this would be hashed
      company: company?.trim(),
      subscriptionTier: 'starter',
      subscriptionStatus: 'active', // Active for development
      accountsLimit: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    mockUsers.set(emailLower, user)

    const accessToken = jwt.sign(
      { userId: user.id, email: user.email, subscriptionTier: user.subscriptionTier },
      JWT_SECRET,
      { expiresIn: '7d' }
    )

    const { password: _, ...userResponse } = user
    res.status(201).json({
      user: userResponse,
      tokens: {
        accessToken,
        expiresIn: 7 * 24 * 60 * 60,
      },
    })
  } catch (error) {
    console.error('Registration error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Unified auth endpoint to match frontend expectation
app.post('/dev/auth', async (req, res) => {
  try {
    const { action, name, email, password, company } = req.body

    if (action === 'login') {
      // For development, accept demo credentials
      if (email === 'demo@example.com' && password === 'password') {
        const user = {
          id: 'demo-user-id',
          email: 'demo@example.com',
          name: 'Demo User',
          subscriptionTier: 'starter',
          subscriptionStatus: 'active',
          accountsLimit: 3,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }

        const accessToken = jwt.sign(
          { userId: user.id, email: user.email, subscriptionTier: user.subscriptionTier },
          JWT_SECRET,
          { expiresIn: '7d' }
        )

        return res.json({
          user,
          tokens: {
            accessToken,
            expiresIn: 7 * 24 * 60 * 60,
          },
        })
      }

      // Check mock database for other users
      const user = mockUsers.get(email.toLowerCase())
      if (!user || user.password !== password) {
        return res.status(401).json({ message: 'Invalid credentials' })
      }

      const accessToken = jwt.sign(
        { userId: user.id, email: user.email, subscriptionTier: user.subscriptionTier },
        JWT_SECRET,
        { expiresIn: '7d' }
      )

      const { password: _, ...userResponse } = user
      res.json({
        user: userResponse,
        tokens: {
          accessToken,
          expiresIn: 7 * 24 * 60 * 60,
        },
      })
    } else if (action === 'register') {
      if (!name || !email || !password) {
        return res.status(400).json({ message: 'Name, email, and password are required' })
      }

      if (password.length < 8) {
        return res.status(400).json({ message: 'Password must be at least 8 characters long' })
      }

      const emailLower = email.toLowerCase()

      // Check if user already exists
      if (mockUsers.has(emailLower)) {
        return res.status(409).json({ message: 'User with this email already exists' })
      }

      const user = {
        id: `user-${Date.now()}`,
        email: emailLower,
        name: name.trim(),
        password, // In real app, this would be hashed
        company: company?.trim(),
        subscriptionTier: 'starter',
        subscriptionStatus: 'active', // Active for development
        accountsLimit: 3,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      mockUsers.set(emailLower, user)

      const accessToken = jwt.sign(
        { userId: user.id, email: user.email, subscriptionTier: user.subscriptionTier },
        JWT_SECRET,
        { expiresIn: '7d' }
      )

      const { password: _, ...userResponse } = user
      res.status(201).json({
        user: userResponse,
        tokens: {
          accessToken,
          expiresIn: 7 * 24 * 60 * 60,
        },
      })
    } else {
      res.status(400).json({ message: 'Invalid action. Must be "login" or "register"' })
    }
  } catch (error) {
    console.error('Auth error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.listen(PORT, () => {
  console.log(`Local development server running on http://localhost:${PORT}`)
  console.log('Available endpoints:')
  console.log('  POST /dev/auth (unified endpoint)')
  console.log('  POST /dev/auth/login (legacy)')
  console.log('  POST /dev/auth/register (legacy)')
})