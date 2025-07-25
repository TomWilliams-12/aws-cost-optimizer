import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface SavingsImpactChartProps {
  analysisResult: any
}

export function SavingsImpactChart({ analysisResult }: SavingsImpactChartProps) {
  if (!analysisResult) {
    return (
      <div className="bg-white rounded-lg shadow border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Savings Impact Analysis</h3>
        <div className="flex items-center justify-center h-64 text-gray-500">
          <div className="text-center">
            <div className="text-4xl mb-2">📈</div>
            <p>Run analysis to see savings impact</p>
          </div>
        </div>
      </div>
    )
  }

  // Prepare data for the chart
  const data = [
    {
      name: 'EBS',
      fullName: 'EBS Volumes',
      monthly: (analysisResult.unattachedVolumes || []).reduce(
        (sum: number, vol: any) => sum + (vol.potentialSavings || 0), 0
      ),
      annual: (analysisResult.unattachedVolumes || []).reduce(
        (sum: number, vol: any) => sum + (vol.potentialSavings || 0), 0
      ) * 12,
      count: analysisResult.unattachedVolumes?.length || 0,
      color: '#f59e0b',
      impact: 'high'
    },
    {
      name: 'EC2',
      fullName: 'EC2 Instances',
      monthly: (analysisResult.ec2Recommendations || []).reduce(
        (sum: number, rec: any) => sum + (rec.potentialSavings?.monthly || 0), 0
      ),
      annual: (analysisResult.ec2Recommendations || []).reduce(
        (sum: number, rec: any) => sum + (rec.potentialSavings?.annual || 0), 0
      ),
      count: analysisResult.ec2Recommendations?.length || 0,
      color: '#3b82f6',
      impact: 'high'
    },
    {
      name: 'S3',
      fullName: 'S3 Storage',
      monthly: (analysisResult.s3Analysis || []).reduce(
        (sum: number, bucket: any) => sum + (bucket.potentialSavings?.monthly || 0), 0
      ),
      annual: (analysisResult.s3Analysis || []).reduce(
        (sum: number, bucket: any) => sum + (bucket.potentialSavings?.annual || 0), 0
      ),
      count: analysisResult.s3Analysis?.reduce((sum: number, bucket: any) => sum + (bucket.recommendations?.length || 0), 0) || 0,
      color: '#8b5cf6',
      impact: 'medium'
    },
    {
      name: 'IPs',
      fullName: 'Elastic IPs',
      monthly: (analysisResult.unusedElasticIPs || []).reduce(
        (sum: number, ip: any) => sum + (ip.monthlyCost || 0), 0
      ),
      annual: (analysisResult.unusedElasticIPs || []).reduce(
        (sum: number, ip: any) => sum + (ip.monthlyCost || 0), 0
      ) * 12,
      count: analysisResult.unusedElasticIPs?.length || 0,
      color: '#ef4444',
      impact: 'high'
    },
    {
      name: 'LBs',
      fullName: 'Load Balancers',
      monthly: (analysisResult.loadBalancerAnalysis || []).reduce(
        (sum: number, lb: any) => sum + (lb.potentialSavings || 0), 0
      ),
      annual: (analysisResult.loadBalancerAnalysis || []).reduce(
        (sum: number, lb: any) => sum + (lb.potentialSavings || 0), 0
      ) * 12,
      count: analysisResult.loadBalancerAnalysis?.filter((lb: any) => lb.recommendation !== 'keep').length || 0,
      color: '#06b6d4',
      impact: 'high'
    }
  ].filter(item => item.monthly > 0) // Only show services with savings

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900 mb-2">{data.fullName}</p>
          <div className="space-y-1">
            <p className="text-green-600 font-bold">£{data.monthly.toFixed(2)}/month</p>
            <p className="text-green-700">£{data.annual.toFixed(2)}/year</p>
            <p className="text-sm text-gray-600">{data.count} opportunities</p>
            <p className={`text-xs px-2 py-1 rounded-full inline-block ${
              data.impact === 'high' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
            }`}>
              {data.impact} impact
            </p>
          </div>
        </div>
      )
    }
    return null
  }

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Savings Impact Analysis</h3>
        <div className="flex items-center justify-center h-64 text-gray-500">
          <div className="text-center">
            <div className="text-4xl mb-2 text-green-500">✅</div>
            <p className="font-medium">No savings opportunities found</p>
            <p className="text-sm mt-1">Your resources are well-optimized!</p>
          </div>
        </div>
      </div>
    )
  }


  return (
    <div className="bg-white rounded-lg shadow border border-gray-100 p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Savings Impact Analysis</h3>
        <div className="flex items-center space-x-4 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-red-100 border border-red-300 rounded"></div>
            <span className="text-gray-600">High Impact</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-yellow-100 border border-yellow-300 rounded"></div>
            <span className="text-gray-600">Medium Impact</span>
          </div>
        </div>
      </div>
      
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{
              top: 20,
              right: 30,
              left: 20,
              bottom: 5,
            }}
            barCategoryGap="20%"
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis 
              dataKey="name" 
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#6b7280', fontSize: 12 }}
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#6b7280', fontSize: 12 }}
              tickFormatter={(value) => `£${value}`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar 
              dataKey="monthly" 
              radius={[4, 4, 0, 0]}
              name="Monthly Savings"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Quick Stats */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-lg font-bold text-gray-900">
              {data.reduce((sum, item) => sum + item.count, 0)}
            </div>
            <div className="text-xs text-gray-600">Total Opportunities</div>
          </div>
          <div>
            <div className="text-lg font-bold text-green-600">
              £{data.reduce((sum, item) => sum + item.monthly, 0).toFixed(0)}
            </div>
            <div className="text-xs text-gray-600">Monthly Savings</div>
          </div>
          <div>
            <div className="text-lg font-bold text-green-700">
              £{data.reduce((sum, item) => sum + item.annual, 0).toFixed(0)}
            </div>
            <div className="text-xs text-gray-600">Annual Savings</div>
          </div>
        </div>
      </div>
    </div>
  )
}