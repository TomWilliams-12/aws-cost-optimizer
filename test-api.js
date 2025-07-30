// Test script to debug API issues
const API_URL = 'https://11opiiigu9.execute-api.eu-west-2.amazonaws.com/dev';

async function testAnalysisEndpoint(token, accountId) {
  console.log('Testing POST /analysis endpoint...');
  
  try {
    const response = await fetch(`${API_URL}/analysis`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ accountId })
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    const text = await response.text();
    console.log('Response body:', text);
    
    if (response.ok) {
      try {
        const data = JSON.parse(text);
        console.log('Parsed response:', JSON.stringify(data, null, 2));
      } catch (e) {
        console.log('Failed to parse as JSON');
      }
    }
  } catch (error) {
    console.error('Request failed:', error);
  }
}

// Instructions:
console.log(`
To test the API:
1. Open browser DevTools on the Cost Optimizer dashboard
2. Run this in console to get your token:
   localStorage.getItem('authToken')
3. Get an accountId from the Network tab or page
4. Run: node test-api.js <token> <accountId>
`);

// Get command line args
const token = process.argv[2];
const accountId = process.argv[3];

if (token && accountId) {
  testAnalysisEndpoint(token, accountId);
} else {
  console.log('Usage: node test-api.js <token> <accountId>');
}