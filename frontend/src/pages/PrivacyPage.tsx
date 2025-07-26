import { useNavigate } from 'react-router-dom'
import { ShieldCheckIcon, LockClosedIcon, EyeIcon } from '../components/Icons'

export default function PrivacyPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <button
            onClick={() => navigate('/')}
            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 mb-6 inline-flex items-center"
          >
            ← Back to Home
          </button>
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
              <ShieldCheckIcon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Privacy Policy
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400">
            Last updated: July 26, 2025
          </p>
        </div>

        {/* Content */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 space-y-8">
          
          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Overview</h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              AWS Cost Optimizer ("we," "our," or "us") is committed to protecting your privacy and the security of your data. 
              This Privacy Policy explains how we collect, use, and protect information when you use our cost optimization service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Information We Collect</h2>
            
            <div className="space-y-4">
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6">
                <div className="flex items-start space-x-4">
                  <EyeIcon className="w-6 h-6 text-blue-600 dark:text-blue-400 mt-1" />
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-2">AWS Resource Metadata</h3>
                    <p className="text-gray-700 dark:text-gray-300">
                      We collect metadata about your AWS resources (instance types, sizes, utilization metrics) 
                      for cost analysis purposes. We do NOT access your application data, databases, or business logic.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6">
                <div className="flex items-start space-x-4">
                  <LockClosedIcon className="w-6 h-6 text-green-600 dark:text-green-400 mt-1" />
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Account Information</h3>
                    <p className="text-gray-700 dark:text-gray-300">
                      We collect your email address, company name (optional), and AWS account information 
                      necessary to provide our service.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6">
                <div className="flex items-start space-x-4">
                  <ShieldCheckIcon className="w-6 h-6 text-purple-600 dark:text-purple-400 mt-1" />
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Usage Data</h3>
                    <p className="text-gray-700 dark:text-gray-300">
                      We collect information about how you use our service (analysis frequency, features used) 
                      to improve our platform and provide better recommendations.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">How We Use Your Information</h2>
            <ul className="space-y-3 text-gray-700 dark:text-gray-300">
              <li className="flex items-start">
                <span className="w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                <span>Analyze your AWS resources to identify cost optimization opportunities</span>
              </li>
              <li className="flex items-start">
                <span className="w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                <span>Generate cost savings recommendations and reports</span>
              </li>
              <li className="flex items-start">
                <span className="w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                <span>Provide customer support and service improvements</span>
              </li>
              <li className="flex items-start">
                <span className="w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                <span>Send you important service updates and security notifications</span>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Data Security & Storage</h2>
            <div className="space-y-4 text-gray-700 dark:text-gray-300">
              <p>
                <strong>Encryption:</strong> All data is encrypted at rest using AES-256 encryption and in transit using TLS 1.3.
              </p>
              <p>
                <strong>Access Controls:</strong> Only authorized personnel have access to customer data, and all access is logged and monitored.
              </p>
              <p>
                <strong>Data Location:</strong> Customer data is stored in AWS EU (Ireland) region with automatic backups.
              </p>
              <p>
                <strong>Retention:</strong> AWS resource metadata is retained for 90 days for trend analysis. Account data is retained as long as your account is active.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Data Sharing</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              We do NOT sell, rent, or share your personal information or AWS data with third parties, except:
            </p>
            <ul className="space-y-2 text-gray-700 dark:text-gray-300">
              <li className="flex items-start">
                <span className="w-2 h-2 bg-red-600 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                <span>When required by law or legal process</span>
              </li>
              <li className="flex items-start">
                <span className="w-2 h-2 bg-red-600 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                <span>To protect our rights, property, or safety</span>
              </li>
              <li className="flex items-start">
                <span className="w-2 h-2 bg-red-600 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                <span>With your explicit consent</span>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Your Rights</h2>
            <div className="space-y-4 text-gray-700 dark:text-gray-300">
              <p><strong>Access:</strong> You can request a copy of all personal data we hold about you.</p>
              <p><strong>Correction:</strong> You can request correction of inaccurate or incomplete data.</p>
              <p><strong>Deletion:</strong> You can request deletion of your account and all associated data.</p>
              <p><strong>Portability:</strong> You can request a machine-readable export of your data.</p>
              <p><strong>Revoke Access:</strong> You can immediately revoke our access to your AWS account by deleting the IAM role.</p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Cookies & Analytics</h2>
            <p className="text-gray-700 dark:text-gray-300">
              We use essential cookies for authentication and session management. We do not use tracking cookies 
              or third-party analytics that collect personal information. Our analytics are privacy-focused and anonymized.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Contact Us</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              If you have questions about this Privacy Policy or want to exercise your rights, contact us:
            </p>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6">
              <p className="text-gray-700 dark:text-gray-300">
                <strong>Email:</strong> privacy@awscostoptimizer.com<br />
                <strong>Subject:</strong> Privacy Policy Inquiry<br />
                <strong>Response Time:</strong> Within 48 hours
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Changes to This Policy</h2>
            <p className="text-gray-700 dark:text-gray-300">
              We may update this Privacy Policy from time to time. We will notify you of any material changes 
              by email and by posting the updated policy on our website. Your continued use of our service 
              after such changes constitutes acceptance of the updated policy.
            </p>
          </section>

        </div>

        {/* Footer Links */}
        <div className="text-center mt-12">
          <div className="flex justify-center space-x-6 text-sm">
            <button
              onClick={() => navigate('/terms')}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
            >
              Terms of Service
            </button>
            <button
              onClick={() => navigate('/security')}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
            >
              Security Details
            </button>
            <button
              onClick={() => navigate('/')}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}