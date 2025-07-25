import { useState } from 'react';
import { CheckCircle, Cloud, Settings, User } from 'lucide-react';

interface AccountOnboardingWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (accountData: {
    accountName: string;
    awsAccountId: string;
    roleArn: string;
    region: string;
  }) => void;
  isLoading?: boolean;
}

const steps = [
  { id: 1, name: 'Account Info', icon: User, description: 'Basic account details' },
  { id: 2, name: 'IAM Setup', icon: Settings, description: 'Configure AWS permissions' },
  { id: 3, name: 'Verify & Connect', icon: CheckCircle, description: 'Test connection' },
];

const AWS_REGIONS = [
  { value: 'us-east-1', label: 'US East (N. Virginia)' },
  { value: 'us-east-2', label: 'US East (Ohio)' },
  { value: 'us-west-1', label: 'US West (N. California)' },
  { value: 'us-west-2', label: 'US West (Oregon)' },
  { value: 'af-south-1', label: 'Africa (Cape Town)' },
  { value: 'ap-east-1', label: 'Asia Pacific (Hong Kong)' },
  { value: 'ap-south-1', label: 'Asia Pacific (Mumbai)' },
  { value: 'ap-south-2', label: 'Asia Pacific (Hyderabad)' },
  { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' },
  { value: 'ap-southeast-2', label: 'Asia Pacific (Sydney)' },
  { value: 'ap-southeast-3', label: 'Asia Pacific (Jakarta)' },
  { value: 'ap-southeast-4', label: 'Asia Pacific (Melbourne)' },
  { value: 'ap-northeast-1', label: 'Asia Pacific (Tokyo)' },
  { value: 'ap-northeast-2', label: 'Asia Pacific (Seoul)' },
  { value: 'ap-northeast-3', label: 'Asia Pacific (Osaka)' },
  { value: 'ca-central-1', label: 'Canada (Central)' },
  { value: 'ca-west-1', label: 'Canada (Calgary)' },
  { value: 'eu-central-1', label: 'Europe (Frankfurt)' },
  { value: 'eu-central-2', label: 'Europe (Zurich)' },
  { value: 'eu-west-1', label: 'Europe (Ireland)' },
  { value: 'eu-west-2', label: 'Europe (London)' },
  { value: 'eu-west-3', label: 'Europe (Paris)' },
  { value: 'eu-north-1', label: 'Europe (Stockholm)' },
  { value: 'eu-south-1', label: 'Europe (Milan)' },
  { value: 'eu-south-2', label: 'Europe (Spain)' },
  { value: 'il-central-1', label: 'Israel (Tel Aviv)' },
  { value: 'me-central-1', label: 'Middle East (UAE)' },
  { value: 'me-south-1', label: 'Middle East (Bahrain)' },
  { value: 'sa-east-1', label: 'South America (São Paulo)' },
];

export function AccountOnboardingWizard({ isOpen, onClose, onSubmit, isLoading }: AccountOnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [accountName, setAccountName] = useState('');
  const [awsAccountId, setAwsAccountId] = useState('');
  const [roleArn, setRoleArn] = useState('');
  const [region, setRegion] = useState('us-east-1');
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!isOpen) return null;

  const validateStep1 = () => {
    const newErrors: Record<string, string> = {};
    
    if (!accountName.trim()) {
      newErrors.accountName = 'Account name is required';
    }
    
    if (!awsAccountId.trim()) {
      newErrors.awsAccountId = 'AWS Account ID is required';
    } else if (!/^\d{12}$/.test(awsAccountId.trim())) {
      newErrors.awsAccountId = 'AWS Account ID must be 12 digits';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep3 = () => {
    const newErrors: Record<string, string> = {};
    
    if (!roleArn.trim()) {
      newErrors.roleArn = 'Role ARN is required';
    } else if (!roleArn.match(/^arn:aws:iam::\d{12}:role\/.+$/)) {
      newErrors.roleArn = 'Invalid Role ARN format';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (currentStep === 1 && !validateStep1()) return;
    if (currentStep === 3 && !validateStep3()) return;
    
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    if (!validateStep3()) return;
    
    try {
      await onSubmit({
        accountName: accountName.trim(),
        awsAccountId: awsAccountId.trim(),
        roleArn: roleArn.trim(),
        region,
      });
    } catch (error: any) {
      // Error is handled by the parent component and displayed in the dashboard
    }
  };

  const generateCloudFormationTemplate = () => {
    return `AWSTemplateFormatVersion: '2010-09-09'
Description: 'IAM Role for AWS Cost Saver access'

Resources:
  CostSaverRole:
    Type: AWS::IAM::Role
    Properties:
      RoleName: CostSaverRole
      AssumeRolePolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Effect: Allow
            Principal:
              AWS: 'arn:aws:iam::504264909935:root'
            Action: 'sts:AssumeRole'
            Condition:
              StringEquals:
                'sts:ExternalId': 'cost-saver-${awsAccountId}'
      ManagedPolicyArns:
        - arn:aws:iam::aws:policy/ReadOnlyAccess
        - arn:aws:iam::aws:policy/job-function/Billing
      Path: '/'

Outputs:
  RoleArn:
    Description: 'ARN of the created role'
    Value: !GetAtt CostSaverRole.Arn`;
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert('Template copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Connect AWS Account</h2>
          <p className="text-sm text-gray-600 mt-1">
            Follow these steps to securely connect your AWS account
          </p>
        </div>

        {/* Progress Steps */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            {steps.map((step) => (
              <div key={step.id} className="flex items-center">
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                    step.id < currentStep
                      ? 'bg-green-500 border-green-500 text-white'
                      : step.id === currentStep
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-gray-300 text-gray-400'
                  }`}
                >
                  {step.id < currentStep ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <step.icon className="w-5 h-5" />
                  )}
                </div>
                <div className="ml-3">
                  <p className={`text-sm font-medium ${
                    step.id <= currentStep ? 'text-gray-900' : 'text-gray-400'
                  }`}>
                    {step.name}
                  </p>
                  <p className="text-xs text-gray-500">{step.description}</p>
                </div>
                {step.id < steps.length && (
                  <div className={`mx-4 h-px w-16 ${
                    step.id < currentStep ? 'bg-green-500' : 'bg-gray-300'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="px-6 py-6">
          {/* Step 1: Account Info */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Account Information</h3>
                <p className="text-sm text-gray-600 mb-6">
                  Enter basic information about your AWS account
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Account Name
                </label>
                <input
                  type="text"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    errors.accountName ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="e.g., Production, Development, Testing"
                />
                {errors.accountName && (
                  <p className="text-red-600 text-sm mt-1">{errors.accountName}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  AWS Account ID
                </label>
                <input
                  type="text"
                  value={awsAccountId}
                  onChange={(e) => setAwsAccountId(e.target.value.replace(/\D/g, '').slice(0, 12))}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    errors.awsAccountId ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="123456789012"
                />
                {errors.awsAccountId && (
                  <p className="text-red-600 text-sm mt-1">{errors.awsAccountId}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  Find this in AWS Console → Account Settings
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Primary Region
                </label>
                <select
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {AWS_REGIONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Choose your primary AWS region for cost analysis
                </p>
              </div>
            </div>
          )}

          {/* Step 2: IAM Setup */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">IAM Role Setup</h3>
                <p className="text-sm text-gray-600 mb-6">
                  Create an IAM role in your AWS account to allow secure access for cost analysis
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start">
                  <Cloud className="w-6 h-6 text-blue-600 mt-1 mr-3" />
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-blue-900 mb-2">
                      Option 1: CloudFormation Template (Recommended)
                    </h4>
                    <p className="text-sm text-blue-800 mb-3">
                      Use this CloudFormation template to automatically create the required IAM role:
                    </p>
                    <div className="bg-white border border-blue-200 rounded p-3 text-xs font-mono">
                      <pre className="whitespace-pre-wrap overflow-x-auto">
                        {generateCloudFormationTemplate()}
                      </pre>
                    </div>
                    <button
                      onClick={() => copyToClipboard(generateCloudFormationTemplate())}
                      className="mt-3 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                    >
                      Copy Template
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-900 mb-2">
                  Option 2: Manual Setup
                </h4>
                <ol className="text-sm text-gray-700 space-y-2 list-decimal list-inside">
                  <li>Go to AWS Console → IAM → Roles → Create Role</li>
                  <li>Choose "Another AWS Account" and enter our account ID</li>
                  <li>Attach policies: ReadOnlyAccess and Billing</li>
                  <li>Name the role "CostSaverRole"</li>
                  <li>Copy the Role ARN for the next step</li>
                </ol>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  <strong>Security Note:</strong> The role only grants read-only access and cannot make changes to your AWS resources.
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Verify & Connect */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Verify & Connect</h3>
                <p className="text-sm text-gray-600 mb-6">
                  Enter the IAM role ARN to establish the connection
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  IAM Role ARN
                </label>
                <input
                  type="text"
                  value={roleArn}
                  onChange={(e) => setRoleArn(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    errors.roleArn ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder={`arn:aws:iam::${awsAccountId}:role/CostSaverRole`}
                />
                {errors.roleArn && (
                  <p className="text-red-600 text-sm mt-1">{errors.roleArn}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  Copy this from the CloudFormation stack outputs or IAM console
                </p>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-800">
                  <strong>Ready to connect!</strong> We'll test the connection and verify permissions before adding your account.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
          >
            Cancel
          </button>
          
          <div className="flex space-x-3">
            {currentStep > 1 && (
              <button
                onClick={handleBack}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Back
              </button>
            )}
            
            {currentStep < 3 ? (
              <button
                onClick={handleNext}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={isLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                {isLoading ? 'Connecting...' : 'Connect Account'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}