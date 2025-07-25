import { useNavigate } from 'react-router-dom'

export default function WelcomePage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center max-w-2xl mx-auto px-4">
        <h1 className="text-5xl font-bold text-gray-900 mb-6">
          🚀 AWS Cost Optimizer
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Reduce your AWS costs by 20-40% with automated analysis and optimization recommendations
        </p>
        
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="font-semibold text-gray-800 mb-2">✅ Project Setup Complete</h3>
            <ul className="text-sm text-gray-600 text-left space-y-1">
              <li>• React + TypeScript + Tailwind</li>
              <li>• AWS SDK + Serverless Backend</li>
              <li>• CDK Infrastructure as Code</li>
              <li>• Modern development workflow</li>
            </ul>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="font-semibold text-gray-800 mb-2">🚧 Ready for Development</h3>
            <ul className="text-sm text-gray-600 text-left space-y-1">
              <li>• Authentication system</li>
              <li>• AWS account integration</li>
              <li>• Cost analysis engine</li>
              <li>• Reporting & visualization</li>
            </ul>
          </div>
        </div>
        
        <button
          onClick={() => navigate('/login')}
          className="bg-indigo-600 text-white px-8 py-3 rounded-lg text-lg font-medium hover:bg-indigo-700 transition-colors"
        >
          Try Demo Login →
        </button>
        
        <p className="text-sm text-gray-500 mt-4">
          Use any email and password to test the demo
        </p>
      </div>
    </div>
  )
} 