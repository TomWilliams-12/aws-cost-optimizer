import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'

interface CostBreakdownData {
  name: string
  value: number
  count: number
  color: string
}

interface CostBreakdownChartProps {
  analysisResult: any
}

export function CostBreakdownChart({ analysisResult }: CostBreakdownChartProps) {
  if (!analysisResult) {
    return (
      <div className="bg-white rounded-lg shadow border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Cost Breakdown by Service</h3>
        <div className="flex items-center justify-center h-64 text-gray-500">
          <div className="text-center">
            <div className="text-4xl mb-2">📊</div>
            <p>Run analysis to see cost breakdown</p>
          </div>
        </div>
      </div>
    )
  }

  // Calculate savings by service
  const ebsSavings = (analysisResult.unattachedVolumes || []).reduce(
    (sum: number, vol: any) => sum + (vol.potentialSavings || 0), 0
  )
  
  const ec2Savings = (analysisResult.ec2Recommendations || []).reduce(
    (sum: number, rec: any) => sum + (rec.potentialSavings?.monthly || 0), 0
  )
  
  const s3Savings = (analysisResult.s3Analysis || []).reduce(
    (sum: number, bucket: any) => sum + (bucket.potentialSavings?.monthly || 0), 0
  )
  
  const elasticIpSavings = (analysisResult.unusedElasticIPs || []).reduce(
    (sum: number, ip: any) => sum + (ip.monthlyCost || 0), 0
  )
  
  const loadBalancerSavings = (analysisResult.loadBalancerAnalysis || []).reduce(
    (sum: number, lb: any) => sum + (lb.potentialSavings || 0), 0
  )

  const data: CostBreakdownData[] = [
    {
      name: 'EBS Volumes',
      value: Number(ebsSavings.toFixed(2)),
      count: analysisResult.unattachedVolumes?.length || 0,
      color: '#f59e0b' // amber-500
    },
    {
      name: 'EC2 Instances',
      value: Number(ec2Savings.toFixed(2)),
      count: analysisResult.ec2Recommendations?.length || 0,
      color: '#3b82f6' // blue-500
    },
    {
      name: 'S3 Storage',
      value: Number(s3Savings.toFixed(2)),
      count: analysisResult.s3Analysis?.reduce((sum: number, bucket: any) => sum + (bucket.recommendations?.length || 0), 0) || 0,
      color: '#8b5cf6' // violet-500
    },
    {
      name: 'Elastic IPs',
      value: Number(elasticIpSavings.toFixed(2)),
      count: analysisResult.unusedElasticIPs?.length || 0,
      color: '#ef4444' // red-500
    },
    {
      name: 'Load Balancers',
      value: Number(loadBalancerSavings.toFixed(2)),
      count: analysisResult.loadBalancerAnalysis?.filter((lb: any) => lb.recommendation !== 'keep').length || 0,
      color: '#06b6d4' // cyan-500
    }
  ].filter(item => item.value > 0) // Only show services with savings

  const totalSavings = data.reduce((sum, item) => sum + item.value, 0)

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900">{data.name}</p>
          <p className="text-green-600 font-bold">£{data.value}/month</p>
          <p className="text-sm text-gray-600">{data.count} opportunities</p>
          <p className="text-xs text-gray-500">
            {((data.value / totalSavings) * 100).toFixed(1)}% of total savings
          </p>
        </div>
      )
    }
    return null
  }

  const CustomLegend = ({ payload }: any) => {
    return (
      <div className="flex flex-wrap justify-center gap-4 mt-4">
        {payload?.map((entry: any, index: number) => (
          <div key={index} className="flex items-center space-x-2">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-sm text-gray-700">{entry.value}</span>
            <span className="text-xs text-gray-500">
              (£{entry.payload.value})
            </span>
          </div>
        ))}
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Cost Breakdown by Service</h3>
        <div className="flex items-center justify-center h-64 text-gray-500">
          <div className="text-center">
            <div className="text-4xl mb-2 text-green-500">✅</div>
            <p className="font-medium">No optimization opportunities found</p>
            <p className="text-sm mt-1">Your AWS resources are well-optimized!</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow border border-gray-100 p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Cost Breakdown by Service</h3>
        <div className="text-right">
          <div className="text-2xl font-bold text-green-600">£{totalSavings.toFixed(2)}</div>
          <div className="text-sm text-gray-500">total monthly savings</div>
        </div>
      </div>
      
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={120}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend content={<CustomLegend />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      
      {/* Summary Stats */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <div className="text-xl font-bold text-gray-900">
              {data.reduce((sum, item) => sum + item.count, 0)}
            </div>
            <div className="text-sm text-gray-600">Total Opportunities</div>
          </div>
          <div>
            <div className="text-xl font-bold text-green-600">
              £{(totalSavings * 12).toFixed(0)}
            </div>
            <div className="text-sm text-gray-600">Annual Savings</div>
          </div>
        </div>
      </div>
    </div>
  )
}