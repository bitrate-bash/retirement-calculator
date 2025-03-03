// This file contains sample investment data for demonstration purposes
// Replace with your own data when using the application

export const sampleInvestments = {
  usInvestments: [
    { id: 'us1', name: 'US Stock Fund', type: 'Stock Fund', assetType: 'Stocks', amount: 100000, returnRate: 8.0, allocation: 20 },
    { id: 'us2', name: '401K', type: '401K', assetType: 'Retirement', amount: 150000, returnRate: 7.0, allocation: 30 },
    { id: 'us3', name: 'Savings Account', type: 'Savings', assetType: 'Cash', amount: 50000, returnRate: 1.5, allocation: 10 },
  ],
  indiaInvestments: [
    { id: 'in1', name: 'Property Investment', type: 'Property', assetType: 'Real Estate', amount: 200000, returnRate: 5.0, allocation: 40 },
  ],
  propertyInvestments: []
}; 