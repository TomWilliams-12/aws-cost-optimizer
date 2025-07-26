import { useNavigate } from 'react-router-dom'
import { 
  ShieldCheckIcon, 
  LockClosedIcon, 
  EyeIcon, 
  CheckCircleIcon,
  TrendingUpIcon,
  MoneyIcon,
  LightbulbIcon,
  CloudIcon,
  RocketIcon,
  ArrowRightIcon,
  HardDriveIcon,
  ServerIcon,
  GlobeIcon,
  SearchIcon
} from '../components/Icons'
import { CompactThemeToggle } from '../components/ThemeToggle'

export default function LandingPage() {
  const navigate = useNavigate()

  const features = [
    {
      icon: ShieldCheckIcon,
      title: "100% Read-Only Access",
      description: "We can only analyze your AWS resources - never modify, delete, or create anything."
    },
    {
      icon: LockClosedIcon,
      title: "Bank-Grade Security",
      description: "Cross-account roles with external ID protection. You maintain complete control."
    },
    {
      icon: EyeIcon,
      title: "Complete Transparency",
      description: "Every permission explained. All API calls logged in your CloudTrail."
    },
    {
      icon: RocketIcon,
      title: "5-Minute Setup",
      description: "One-click CloudFormation deployment. Start analyzing costs immediately."
    }
  ]

  const benefits = [
    {
      icon: MoneyIcon,
      title: "20-40% Cost Reduction",
      description: "Identify unused resources, rightsize instances, optimize storage classes",
      color: "text-green-600 dark:text-green-400"
    },
    {
      icon: LightbulbIcon,
      title: "Smart Recommendations",
      description: "90-day CloudWatch analysis ensures performance isn't compromised",
      color: "text-orange-600 dark:text-orange-400"
    },
    {
      icon: TrendingUpIcon,
      title: "Instant ROI",
      description: "Most customers save more in the first month than they pay in a year",
      color: "text-blue-600 dark:text-blue-400"
    },
    {
      icon: CloudIcon,
      title: "Complete Coverage",
      description: "EC2, S3, EBS, Load Balancers, Elastic IPs - all AWS cost centers analyzed",
      color: "text-purple-600 dark:text-purple-400"
    }
  ]

  const testimonials = [
    {
      quote: "Reduced our AWS costs by 35% in the first month. The security transparency gave us complete confidence.",
      author: "Sarah Chen",
      role: "CTO, TechFlow Solutions",
      savings: "$12,000/month"
    },
    {
      quote: "Finally, a cost tool we can trust. Read-only access and detailed permission explanations sealed the deal.",
      author: "Michael Rodriguez",
      role: "DevOps Director, CloudScale Inc",
      savings: "$8,500/month"
    },
    {
      quote: "The CloudFormation setup was incredibly smooth. Started saving money within hours of connecting our account.",
      author: "Emily Watson",
      role: "Infrastructure Lead, DataDriven Co",
      savings: "$15,200/month"
    }
  ]

  const pricingTiers = [
    {
      name: "Starter",
      price: "$49",
      period: "/month",
      description: "Perfect for small teams and startups",
      roi: "Typical savings: $2,000-5,000/month",
      features: [
        "Up to 3 AWS accounts",
        "Monthly cost analysis",
        "Basic recommendations",
        "Email support",
        "30-day money back guarantee"
      ],
      popular: false
    },
    {
      name: "Professional",
      price: "$149",
      period: "/month", 
      description: "Most popular - Best ROI",
      roi: "Typical savings: $5,000-15,000/month",
      features: [
        "Up to 10 AWS accounts",
        "Weekly cost analysis",
        "Advanced rightsizing",
        "Historical trending",
        "Priority support",
        "Implementation guides",
        "ROI guarantee"
      ],
      popular: true
    },
    {
      name: "Enterprise",
      price: "Custom",
      period: "",
      description: "For large organizations",
      roi: "Typical savings: $20,000+/month",
      features: [
        "Unlimited AWS accounts",
        "Daily cost analysis",
        "Custom integrations",
        "Dedicated support",
        "SLA guarantee",
        "On-site training",
        "Dedicated CSM"
      ],
      popular: false
    }
  ]

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors duration-300">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-lg">C</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">AWS Cost Optimizer</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">Secure • Transparent • Effective</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/security')}
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-medium transition-colors duration-200"
              >
                Security
              </button>
              <CompactThemeToggle />
              <button
                onClick={() => navigate('/login')}
                className="px-4 py-2 text-blue-600 dark:text-blue-400 border border-blue-600 dark:border-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 font-medium transition-colors duration-200"
              >
                Sign In
              </button>
              <button
                onClick={() => navigate('/register')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors duration-200"
              >
                Get Started
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6">
              Reduce AWS Costs by{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                20-40%
              </span>
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-400 mb-8 max-w-3xl mx-auto">
              The only AWS cost optimization tool that prioritizes security and transparency. 
              Professional-grade analysis that pays for itself in the first week.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
              <button
                onClick={() => navigate('/register')}
                className="px-8 py-4 bg-blue-600 text-white text-lg font-semibold rounded-lg hover:bg-blue-700 transition-colors duration-200 shadow-lg"
              >
                Start Saving Today - $149/month
              </button>
              <button
                onClick={() => navigate('/security')}
                className="px-8 py-4 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-lg font-semibold rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-200"
              >
                View Security Details
              </button>
            </div>
            <div className="flex items-center justify-center space-x-6 text-sm text-gray-500 dark:text-gray-400">
              <div className="flex items-center space-x-2">
                <CheckCircleIcon className="w-4 h-4 text-green-500" />
                <span>Typical ROI: 2,000%+ in year 1</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircleIcon className="w-4 h-4 text-green-500" />
                <span>5-minute setup</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircleIcon className="w-4 h-4 text-green-500" />
                <span>Cancel anytime</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Product Demo Section */}
      <section className="py-20 bg-gray-50 dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              See Real Savings in Action
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
              Here's how customers are saving thousands every month with AWS Cost Optimizer
            </p>
          </div>

          {/* Real Customer Examples */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
            <div className="bg-white dark:bg-gray-900 rounded-xl p-8 shadow-lg border border-gray-200 dark:border-gray-700">
              <div className="text-center">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                  <HardDriveIcon className="w-8 h-8 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">TechFlow Solutions</h3>
                <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-2">$4,200/month</div>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">Saved by removing 47 unattached EBS volumes</p>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    "We had no idea we were paying for so much unused storage. 
                    AWS Cost Optimizer found volumes from deleted instances we'd forgotten about."
                  </p>
                  <p className="text-xs font-medium text-gray-900 dark:text-white mt-2">- Sarah Chen, CTO</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-xl p-8 shadow-lg border border-gray-200 dark:border-gray-700">
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                  <ServerIcon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">CloudScale Inc</h3>
                <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-2">$7,800/month</div>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">Saved through EC2 rightsizing recommendations</p>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    "Our instances were oversized for actual usage. The CloudWatch analysis 
                    showed we could downsize without any performance impact."
                  </p>
                  <p className="text-xs font-medium text-gray-900 dark:text-white mt-2">- Michael Rodriguez, DevOps Director</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-xl p-8 shadow-lg border border-gray-200 dark:border-gray-700">
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                  <GlobeIcon className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">DataDriven Co</h3>
                <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-2">$2,100/month</div>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">Saved by releasing unused Elastic IPs</p>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    "We had dozens of Elastic IPs from old experiments. 
                    $5/month each adds up fast - easy $2,000+ savings!"
                  </p>
                  <p className="text-xs font-medium text-gray-900 dark:text-white mt-2">- Emily Watson, Infrastructure Lead</p>
                </div>
              </div>
            </div>
          </div>

          {/* Dashboard Preview */}
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4">
              <h3 className="text-xl font-bold text-white">Live Dashboard Preview</h3>
              <p className="text-blue-100">See exactly what you'll get - comprehensive cost analysis in minutes</p>
            </div>
            <div className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-6 border border-green-200 dark:border-green-700">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-sm font-medium text-green-700 dark:text-green-300">Monthly Savings</p>
                      <p className="text-3xl font-bold text-green-800 dark:text-green-200">£14,200</p>
                    </div>
                    <MoneyIcon className="w-8 h-8 text-green-600 dark:text-green-400" />
                  </div>
                  <p className="text-sm text-green-600 dark:text-green-400">↗ Annual: £170,400</p>
                </div>

                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-lg p-6 border border-blue-200 dark:border-blue-700">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Resources Found</p>
                      <p className="text-3xl font-bold text-blue-800 dark:text-blue-200">127</p>
                    </div>
                    <SearchIcon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                  </div>
                  <p className="text-sm text-blue-600 dark:text-blue-400">Optimization opportunities</p>
                </div>

                <div className="bg-gradient-to-br from-orange-50 to-yellow-50 dark:from-orange-900/20 dark:to-yellow-900/20 rounded-lg p-6 border border-orange-200 dark:border-orange-700">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-sm font-medium text-orange-700 dark:text-orange-300">Quick Wins</p>
                      <p className="text-3xl font-bold text-orange-800 dark:text-orange-200">23</p>
                    </div>
                    <RocketIcon className="w-8 h-8 text-orange-600 dark:text-orange-400" />
                  </div>
                  <p className="text-sm text-orange-600 dark:text-orange-400">Implement immediately</p>
                </div>

                <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg p-6 border border-purple-200 dark:border-purple-700">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-sm font-medium text-purple-700 dark:text-purple-300">ROI</p>
                      <p className="text-3xl font-bold text-purple-800 dark:text-purple-200">2,840%</p>
                    </div>
                    <TrendingUpIcon className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                  </div>
                  <p className="text-sm text-purple-600 dark:text-purple-400">First year return</p>
                </div>
              </div>

              {/* Feature Highlights */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4">What You Get Instantly:</h4>
                  <ul className="space-y-3">
                    <li className="flex items-start space-x-3">
                      <CheckCircleIcon className="w-5 h-5 text-green-500 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300"><strong>Unattached EBS volumes</strong> - Often 40-60% of total waste</span>
                    </li>
                    <li className="flex items-start space-x-3">
                      <CheckCircleIcon className="w-5 h-5 text-green-500 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300"><strong>Oversized EC2 instances</strong> - Based on 90-day CloudWatch data</span>
                    </li>
                    <li className="flex items-start space-x-3">
                      <CheckCircleIcon className="w-5 h-5 text-green-500 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300"><strong>Unused Elastic IPs</strong> - $5/month each adds up fast</span>
                    </li>
                    <li className="flex items-start space-x-3">
                      <CheckCircleIcon className="w-5 h-5 text-green-500 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300"><strong>S3 storage optimization</strong> - Lifecycle policy recommendations</span>
                    </li>
                  </ul>
                </div>
                <div>
                  <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4">How It Works:</h4>
                  <div className="space-y-4">
                    <div className="flex items-start space-x-3">
                      <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">1</div>
                      <span className="text-gray-700 dark:text-gray-300">One-click CloudFormation deployment (5 minutes)</span>
                    </div>
                    <div className="flex items-start space-x-3">
                      <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">2</div>
                      <span className="text-gray-700 dark:text-gray-300">Secure read-only analysis of your AWS resources</span>
                    </div>
                    <div className="flex items-start space-x-3">
                      <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">3</div>
                      <span className="text-gray-700 dark:text-gray-300">Detailed recommendations with implementation guides</span>
                    </div>
                    <div className="flex items-start space-x-3">
                      <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">4</div>
                      <span className="text-gray-700 dark:text-gray-300">Start saving money immediately!</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="text-center mt-12">
            <button
              onClick={() => navigate('/register')}
              className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-lg font-semibold rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg transform hover:scale-105"
            >
              Start Saving Now - $149/month
            </button>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
              Professional analysis that pays for itself in the first week
            </p>
          </div>
        </div>
      </section>

      {/* Security First Section */}
      <section className="py-20 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Security First, Always
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
              Unlike other cost tools, we put security and transparency at the forefront. 
              Here's exactly how we protect your AWS infrastructure.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="text-center">
                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                  <feature.icon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{feature.title}</h3>
                <p className="text-gray-600 dark:text-gray-400">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 bg-gray-50 dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Stop Overpaying for AWS
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
              Our customers typically save more in their first month than they pay us in a year.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {benefits.map((benefit, index) => (
              <div key={index} className="bg-white dark:bg-gray-900 rounded-xl p-8 shadow-lg">
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center flex-shrink-0">
                    <benefit.icon className={`w-6 h-6 ${benefit.color}`} />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{benefit.title}</h3>
                    <p className="text-gray-600 dark:text-gray-400">{benefit.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Trusted by Companies Like Yours
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400">
              See what our customers say about security, savings, and setup experience.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-8">
                <div className="mb-6">
                  <div className="flex items-center mb-4">
                    <div className="flex space-x-1">
                      {[...Array(5)].map((_, i) => (
                        <CheckCircleIcon key={i} className="w-5 h-5 text-yellow-500" />
                      ))}
                    </div>
                    <span className="ml-3 text-sm font-semibold text-green-600 dark:text-green-400">
                      Saved {testimonial.savings}
                    </span>
                  </div>
                  <p className="text-gray-700 dark:text-gray-300 italic">"{testimonial.quote}"</p>
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">{testimonial.author}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{testimonial.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 bg-gray-50 dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Professional Pricing That Pays for Itself
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400">
              Customers typically save 20-40x their subscription cost. ROI guaranteed or money back.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {pricingTiers.map((tier, index) => (
              <div key={index} className={`bg-white dark:bg-gray-900 rounded-xl p-8 shadow-lg relative ${
                tier.popular ? 'ring-2 ring-blue-500 scale-105' : ''
              }`}>
                {tier.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-semibold">
                      Most Popular
                    </span>
                  </div>
                )}
                <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{tier.name}</h3>
                  <div className="flex items-baseline justify-center mb-3">
                    <span className="text-4xl font-bold text-gray-900 dark:text-white">{tier.price}</span>
                    <span className="text-gray-600 dark:text-gray-400 ml-1">{tier.period}</span>
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 mb-3">{tier.description}</p>
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg px-4 py-2">
                    <p className="text-sm font-semibold text-green-700 dark:text-green-300">{tier.roi}</p>
                  </div>
                </div>
                <ul className="space-y-3 mb-8">
                  {tier.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-center">
                      <CheckCircleIcon className="w-5 h-5 text-green-500 mr-3" />
                      <span className="text-gray-700 dark:text-gray-300">{feature}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => navigate('/register')}
                  className={`w-full py-3 px-6 rounded-lg font-semibold transition-colors duration-200 ${
                    tier.popular
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  {tier.name === 'Enterprise' ? 'Contact Sales' : 'Get Started'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-blue-600 dark:bg-blue-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Start Saving?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Join hundreds of companies that trust us with their AWS cost optimization.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => navigate('/register')}
              className="px-8 py-4 bg-white text-blue-600 text-lg font-semibold rounded-lg hover:bg-gray-100 transition-colors duration-200 shadow-lg"
            >
              Get Started Today <ArrowRightIcon className="inline ml-2" size={20} />
            </button>
            <button
              onClick={() => navigate('/security')}
              className="px-8 py-4 border border-blue-400 text-white text-lg font-semibold rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              View Security Details
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 dark:bg-gray-950 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">C</span>
                </div>
                <span className="text-xl font-bold">AWS Cost Optimizer</span>
              </div>
              <p className="text-gray-400">
                Secure, transparent AWS cost optimization for modern businesses.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white">Features</a></li>
                <li><a href="#" className="hover:text-white">Pricing</a></li>
                <li><a href="/security" className="hover:text-white">Security</a></li>
                <li><a href="#" className="hover:text-white">API Docs</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white">About</a></li>
                <li><a href="#" className="hover:text-white">Blog</a></li>
                <li><a href="#" className="hover:text-white">Careers</a></li>
                <li><a href="#" className="hover:text-white">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white">Help Center</a></li>
                <li><a href="#" className="hover:text-white">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-white">Terms of Service</a></li>
                <li><a href="#" className="hover:text-white">Status</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-12 pt-8 text-center text-gray-400">
            <p>&copy; 2025 AWS Cost Optimizer. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}