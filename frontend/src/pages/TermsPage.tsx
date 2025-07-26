import { useNavigate } from 'react-router-dom'
import { DocumentCheckIcon, ShieldCheckIcon, ExclamationTriangleIcon } from '../components/Icons'

export default function TermsPage() {
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
              <DocumentCheckIcon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Terms of Service
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400">
            Last updated: July 26, 2025
          </p>
        </div>

        {/* Content */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 space-y-8">
          
          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Acceptance of Terms</h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              By accessing or using AWS Cost Optimizer ("Service"), you agree to be bound by these Terms of Service ("Terms"). 
              If you disagree with any part of these terms, you may not access the Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Description of Service</h2>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6">
              <div className="flex items-start space-x-4">
                <ShieldCheckIcon className="w-6 h-6 text-blue-600 dark:text-blue-400 mt-1" />
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">AWS Cost Optimization Service</h3>
                  <p className="text-gray-700 dark:text-gray-300">
                    AWS Cost Optimizer analyzes your AWS infrastructure using read-only access to identify 
                    cost optimization opportunities. We provide recommendations for reducing AWS spending through 
                    rightsizing, resource cleanup, and storage optimization.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">User Accounts & Responsibilities</h2>
            <div className="space-y-4 text-gray-700 dark:text-gray-300">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Account Security</h3>
                <p>You are responsible for maintaining the confidentiality of your account credentials and for all activities under your account.</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">AWS Account Access</h3>
                <p>You grant us read-only access to your AWS account through IAM roles. You can revoke this access at any time by deleting the IAM role.</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Accurate Information</h3>
                <p>You agree to provide accurate and complete information when using our Service.</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Subscription & Billing</h2>
            <div className="space-y-4">
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Free Trial</h3>
                <p className="text-gray-700 dark:text-gray-300">
                  We offer a 14-day free trial. No credit card required. You can cancel anytime during the trial without charges.
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Paid Subscriptions</h3>
                <p className="text-gray-700 dark:text-gray-300">
                  Subscriptions are billed monthly or annually in advance. All fees are non-refundable except as required by law.
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Cancellation</h3>
                <p className="text-gray-700 dark:text-gray-300">
                  You may cancel your subscription at any time. Service continues until the end of your current billing period.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Service Limitations & Disclaimers</h2>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-6">
              <div className="flex items-start space-x-4">
                <ExclamationTriangleIcon className="w-6 h-6 text-yellow-600 dark:text-yellow-400 mt-1" />
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Important Disclaimers</h3>
                  <ul className="space-y-2 text-gray-700 dark:text-gray-300">
                    <li>• Our recommendations are advisory only. You are responsible for implementing changes.</li>
                    <li>• We cannot guarantee specific cost savings amounts.</li>
                    <li>• You should test recommendations in non-production environments first.</li>
                    <li>• We are not liable for any AWS charges incurred based on our recommendations.</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Service Availability</h2>
            <div className="space-y-4 text-gray-700 dark:text-gray-300">
              <p>
                <strong>Uptime Target:</strong> We strive for 99.9% uptime but do not guarantee uninterrupted service.
              </p>
              <p>
                <strong>Maintenance:</strong> We may perform scheduled maintenance with advance notice.
              </p>
              <p>
                <strong>Service Changes:</strong> We reserve the right to modify or discontinue features with reasonable notice.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Intellectual Property</h2>
            <div className="space-y-4 text-gray-700 dark:text-gray-300">
              <p>
                <strong>Our IP:</strong> The Service, including software, algorithms, and content, is our intellectual property.
              </p>
              <p>
                <strong>Your Data:</strong> You retain ownership of your AWS data. We only use it to provide our Service.
              </p>
              <p>
                <strong>Feedback:</strong> Any feedback you provide may be used to improve our Service without compensation.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Limitation of Liability</h2>
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-6">
              <p className="text-gray-700 dark:text-gray-300">
                <strong>LIMITATION:</strong> Our total liability shall not exceed the amount you paid us in the 12 months 
                preceding the claim. We are not liable for indirect, incidental, or consequential damages.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Prohibited Use</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">You agree not to:</p>
            <ul className="space-y-2 text-gray-700 dark:text-gray-300">
              <li className="flex items-start">
                <span className="w-2 h-2 bg-red-600 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                <span>Use the Service for any illegal purpose</span>
              </li>
              <li className="flex items-start">
                <span className="w-2 h-2 bg-red-600 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                <span>Attempt to reverse engineer or hack our systems</span>
              </li>
              <li className="flex items-start">
                <span className="w-2 h-2 bg-red-600 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                <span>Resell or redistribute our Service without permission</span>
              </li>
              <li className="flex items-start">
                <span className="w-2 h-2 bg-red-600 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                <span>Use the Service to compete with us</span>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Termination</h2>
            <div className="space-y-4 text-gray-700 dark:text-gray-300">
              <p>
                <strong>By You:</strong> You may terminate your account at any time through your account settings.
              </p>
              <p>
                <strong>By Us:</strong> We may terminate accounts that violate these Terms or for any reason with 30 days notice.
              </p>
              <p>
                <strong>Effect:</strong> Upon termination, your access ends and we will delete your data within 30 days.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Governing Law</h2>
            <p className="text-gray-700 dark:text-gray-300">
              These Terms are governed by the laws of England and Wales. Any disputes will be resolved 
              in the courts of England and Wales.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Contact Information</h2>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6">
              <p className="text-gray-700 dark:text-gray-300">
                For questions about these Terms of Service, contact us at:<br />
                <strong>Email:</strong> legal@awscostoptimizer.com<br />
                <strong>Subject:</strong> Terms of Service Inquiry<br />
                <strong>Response Time:</strong> Within 48 hours
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Changes to Terms</h2>
            <p className="text-gray-700 dark:text-gray-300">
              We may modify these Terms from time to time. We will notify you of material changes by email 
              and by posting updated Terms on our website. Continued use of the Service constitutes acceptance 
              of the modified Terms.
            </p>
          </section>

        </div>

        {/* Footer Links */}
        <div className="text-center mt-12">
          <div className="flex justify-center space-x-6 text-sm">
            <button
              onClick={() => navigate('/privacy')}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
            >
              Privacy Policy
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