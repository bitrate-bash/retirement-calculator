// RetirementCalculator.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, Sector } from 'recharts';
import * as XLSX from 'xlsx';
// Import sample data (this will be in the GitHub repo)
import { sampleInvestments } from './sampleInvestmentData';

// Try to import personal data (this will be ignored by Git)
let personalData = null;
try {
  // This import will fail in the GitHub repo since the file is gitignored
  personalData = require('./investmentData').personalInvestments;
} catch (e) {
  // If personal data file doesn't exist, we'll use the sample data
  console.log('Using sample investment data. Create src/investmentData.js for personal data.');
}

// Add IBM Plex Mono font import
import '@fontsource/ibm-plex-mono';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/600.css';

// Helper function to save investments to localStorage
const saveInvestmentsToLocalStorage = (usInvestments, indiaInvestments, propertyInvestments) => {
  try {
    const investmentsData = {
      usInvestments,
      indiaInvestments,
      propertyInvestments,
      lastUpdated: new Date().toISOString()
    };
    localStorage.setItem('retirementCalculatorInvestments', JSON.stringify(investmentsData));
    console.log('Investments saved to localStorage');
  } catch (error) {
    console.error('Error saving investments to localStorage:', error);
  }
};

// Helper function to load investments from localStorage
const loadInvestmentsFromLocalStorage = () => {
  try {
    const savedData = localStorage.getItem('retirementCalculatorInvestments');
    if (savedData) {
      const parsedData = JSON.parse(savedData);
      console.log('Investments loaded from localStorage (last updated: ' + new Date(parsedData.lastUpdated).toLocaleString() + ')');
      return {
        usInvestments: parsedData.usInvestments,
        indiaInvestments: parsedData.indiaInvestments,
        propertyInvestments: parsedData.propertyInvestments
      };
    }
  } catch (error) {
    console.error('Error loading investments from localStorage:', error);
  }
  return null;
};

const InfoButton = ({ title, explanation, example }) => {
  const [showModal, setShowModal] = useState(false);
  
  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="ml-2 text-white/40 hover:text-white/80 transition-colors"
        title={`Show ${title} calculation`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
      </button>
      
      {showModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-black/90 rounded-xl p-5 sm:p-6 md:p-8 max-w-2xl w-full border border-white/20 shadow-xl font-['IBM_Plex_Mono'] max-h-[90vh] overflow-y-auto text-left">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-white tracking-tight">{title} Calculation</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-white/60 hover:text-white text-2xl transition-colors"
              >
                ×
              </button>
            </div>
            
            <div className="space-y-6">
              <div className="text-white/80 text-sm text-left leading-relaxed">
                {explanation}
              </div>
              
              {example && (
                <div className="bg-white/10 p-5 rounded-lg border border-white/10">
                  <h4 className="text-white font-medium mb-4 text-left">Example:</h4>
                  <div className="text-white/80 text-sm whitespace-pre-wrap font-mono text-left leading-relaxed">
                    {example}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const RetirementCalculator = () => {
  // Initial total values
  const [currentAssets, setCurrentAssets] = useState(2491500);
  const [userInputTotal, setUserInputTotal] = useState(2491500);
  const [retirementGoal, setRetirementGoal] = useState(5000000);
  const [yearsToRetirement, setYearsToRetirement] = useState(15);
  const [inflationRate, setInflationRate] = useState(3.0);
  
  // Asset type default return rates
  const assetTypeReturns = {
    'Private Equity': 12.0,
    'Stocks': 8.0,
    'Real Estate': 5.0,
    'Cash Deposit': 2.0,
    'Cash': 1.5,
    '401K': 7.0,
    'Bonus': 0.0,
  };
  
  // Try to load from localStorage first, then fall back to personal data or sample data
  const savedInvestments = loadInvestmentsFromLocalStorage();
  const initialData = savedInvestments || personalData || sampleInvestments;
  
  // Dynamic investment categories based on data
  const [usInvestments, setUsInvestments] = useState(initialData.usInvestments);
  const [indiaInvestments, setIndiaInvestments] = useState(initialData.indiaInvestments);
  const [propertyInvestments, setPropertyInvestments] = useState(initialData.propertyInvestments);
  
  // New investment form state
  const [newInvestment, setNewInvestment] = useState({
    category: 'us',
    name: '',
    type: '',
    assetType: 'Stocks',
    amount: 0,
    returnRate: 8.0
  });
  
  // Category totals
  const [usTotal, setUsTotal] = useState(0);
  const [indiaTotal, setIndiaTotal] = useState(0);
  const [propertyTotal, setPropertyTotal] = useState(0);
  
  // Expanded sections
  const [expanded, setExpanded] = useState({
    us: true,
    india: true,
    property: false,
    addNew: false,
    assetAllocation: true
  });
  
  // View options
  const [activeView, setActiveView] = useState('calculator'); // 'calculator', 'allocation'
  
  // Results
  const [requiredAnnualSavings, setRequiredAnnualSavings] = useState(0);
  const [projectedData, setProjectedData] = useState([]);
  const [realGoal, setRealGoal] = useState(0);
  const [showDownloadInfo, setShowDownloadInfo] = useState(false);
  
  // Asset allocation data
  const [allocationData, setAllocationData] = useState([]);
  const [activeAssetIndex, setActiveAssetIndex] = useState(0);
  const [assetTypeAllocationData, setAssetTypeAllocationData] = useState([]);
  
  // Add yearly savings state
  const [yearlyContribution, setYearlyContribution] = useState(0);
  
  // Add new state for the add investment form
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Add state for visible lines
  const [visibleLines, setVisibleLines] = useState({
    totalAssets: true,
    targetGoal: true,
    additionalSavings: true,
    // Asset type visibility
    PrivateEquity: true,
    Stocks: true,
    RealEstate: true,
    CashDeposit: false,
    Cash: false,
    '401K': false, // Set to false to hide by default
    Bonus: false,
    // Legacy categories (hidden by default)
    usInvestments: false,
    indiaInvestments: false,
    property: false,
  });
  
  // Add upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadError, setUploadError] = useState('');
  
  // Add new state for info modal
  const [showInfoModal, setShowInfoModal] = useState(false);
  
  // Save investments to localStorage whenever they change
  useEffect(() => {
    saveInvestmentsToLocalStorage(usInvestments, indiaInvestments, propertyInvestments);
  }, [usInvestments, indiaInvestments, propertyInvestments]);
  
  // Calculate category totals
  useEffect(() => {
    const usSum = usInvestments.reduce((sum, inv) => sum + inv.amount, 0);
    const indiaSum = indiaInvestments.reduce((sum, inv) => sum + inv.amount, 0);
    const propertySum = propertyInvestments.reduce((sum, inv) => sum + inv.amount, 0);
    
    setUsTotal(usSum);
    setIndiaTotal(indiaSum);
    setPropertyTotal(propertySum);
    
    const total = usSum + indiaSum + propertySum;
    setCurrentAssets(total);
    setUserInputTotal(total);
    
    // Prepare asset allocation data for pie chart
    const allocData = [
      { name: 'US Investments', value: usSum, color: '#34d399' },
      { name: 'India Investments', value: indiaSum, color: '#fbbf24' },
      { name: 'Property', value: propertySum, color: '#c084fc' }
    ].filter(item => item.value > 0);
    
    setAllocationData(allocData);
    
    // Prepare asset type allocation data
    const allInvestments = [...usInvestments, ...indiaInvestments, ...propertyInvestments];
    const assetTypes = {};
    allInvestments.forEach(inv => {
      if (!assetTypes[inv.assetType]) {
        assetTypes[inv.assetType] = 0;
      }
      assetTypes[inv.assetType] += inv.amount;
    });
    
    const assetTypeColors = {
      'Private Equity': '#ec4899',
      'Stocks': '#3b82f6',
      'Real Estate': '#8b5cf6',
      'Cash Deposit': '#10b981',
      'Cash': '#14b8a6',
      '401K': '#6366f1',
      'Bonus': '#f97316',
    };
    
    const assetTypeData = Object.keys(assetTypes).map(type => ({
      name: type,
      value: assetTypes[type],
      color: assetTypeColors[type] || '#9ca3af'
    }));
    
    setAssetTypeAllocationData(assetTypeData);
    
  }, [usInvestments, indiaInvestments, propertyInvestments]);
  
  // Update allocation percentages in a separate effect
  useEffect(() => {
    const total = currentAssets;
    if (total === 0) return; // Skip if total is 0 to avoid division by zero
    
    // Update allocation percentages without triggering re-renders of the investment arrays
    const updatedUsInvestments = usInvestments.map(inv => ({
      ...inv,
      allocation: (inv.amount / total) * 100
    }));
    
    const updatedIndiaInvestments = indiaInvestments.map(inv => ({
      ...inv,
      allocation: (inv.amount / total) * 100
    }));
    
    const updatedPropertyInvestments = propertyInvestments.map(inv => ({
      ...inv,
      allocation: (inv.amount / total) * 100
    }));
    
    // Only update if allocations have actually changed
    if (JSON.stringify(updatedUsInvestments) !== JSON.stringify(usInvestments)) {
      setUsInvestments(updatedUsInvestments);
    }
    if (JSON.stringify(updatedIndiaInvestments) !== JSON.stringify(indiaInvestments)) {
      setIndiaInvestments(updatedIndiaInvestments);
    }
    if (JSON.stringify(updatedPropertyInvestments) !== JSON.stringify(propertyInvestments)) {
      setPropertyInvestments(updatedPropertyInvestments);
    }
  }, [currentAssets]);
  
  // Function to generate a unique ID
  const generateId = (prefix) => {
    return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).substr(2, 5)}`;
  };
  
  // Add new investment
  const addInvestment = () => {
    const newId = generateId(newInvestment.category);
    const investmentToAdd = {
      id: newId,
      name: newInvestment.name,
      type: newInvestment.name,
      assetType: newInvestment.assetType,
      amount: newInvestment.amount,
      returnRate: newInvestment.returnRate,
      allocation: 0 // Will be recalculated
    };
    
    if (newInvestment.category === 'us') {
      setUsInvestments(prev => [...prev, investmentToAdd]);
    } else if (newInvestment.category === 'india') {
      setIndiaInvestments(prev => [...prev, investmentToAdd]);
    } else if (newInvestment.category === 'property') {
      setPropertyInvestments(prev => [...prev, investmentToAdd]);
    }
    
    setNewInvestment({
      category: 'us',
      name: '',
      type: '',
      assetType: 'Stocks',
      amount: 0,
      returnRate: 8.0
    });
  };
  
  // Remove investment
  const removeInvestment = (category, id) => {
    if (category === 'us') {
      setUsInvestments(prev => prev.filter(inv => inv.id !== id));
    } else if (category === 'india') {
      setIndiaInvestments(prev => prev.filter(inv => inv.id !== id));
    } else if (category === 'property') {
      setPropertyInvestments(prev => prev.filter(inv => inv.id !== id));
    }
  };
  
  // Update investment amount
  const updateInvestmentAmount = (category, id, amount) => {
    if (category === 'us') {
      setUsInvestments(prev => 
        prev.map(inv => 
          inv.id === id ? { ...inv, amount: Number(amount) } : inv
        )
      );
    } else if (category === 'india') {
      setIndiaInvestments(prev => 
        prev.map(inv => 
          inv.id === id ? { ...inv, amount: Number(amount) } : inv
        )
      );
    } else if (category === 'property') {
      setPropertyInvestments(prev => 
        prev.map(inv => 
          inv.id === id ? { ...inv, amount: Number(amount) } : inv
        )
      );
    }
  };
  
  // Update investment return rate
  const updateInvestmentReturnRate = (category, id, rate) => {
    if (category === 'us') {
      setUsInvestments(prev => 
        prev.map(inv => 
          inv.id === id ? { ...inv, returnRate: Number(rate) } : inv
        )
      );
    } else if (category === 'india') {
      setIndiaInvestments(prev => 
        prev.map(inv => 
          inv.id === id ? { ...inv, returnRate: Number(rate) } : inv
        )
      );
    } else if (category === 'property') {
      setPropertyInvestments(prev => 
        prev.map(inv => 
          inv.id === id ? { ...inv, returnRate: Number(rate) } : inv
        )
      );
    }
  };
  
  // Update asset type
  const updateInvestmentAssetType = (category, id, assetType) => {
    // Also update the return rate based on the asset type
    const defaultReturnRate = assetTypeReturns[assetType] || 5.0;
    
    if (category === 'us') {
      setUsInvestments(prev => 
        prev.map(inv => 
          inv.id === id ? { ...inv, assetType, returnRate: defaultReturnRate } : inv
        )
      );
    } else if (category === 'india') {
      setIndiaInvestments(prev => 
        prev.map(inv => 
          inv.id === id ? { ...inv, assetType, returnRate: defaultReturnRate } : inv
        )
      );
    } else if (category === 'property') {
      setPropertyInvestments(prev => 
        prev.map(inv => 
          inv.id === id ? { ...inv, assetType, returnRate: defaultReturnRate } : inv
        )
      );
    }
  };
  
  // Update total assets and distribute proportionally
  const handleTotalAssetsChange = (newTotal) => {
    if (currentAssets === 0) {
      // If all are zero, distribute evenly among categories
      const thirdValue = newTotal / 3;
      
      if (usInvestments.length > 0) {
        const usShare = thirdValue;
        const perUsInvestment = usShare / usInvestments.length;
        setUsInvestments(usInvestments.map(inv => ({ ...inv, amount: perUsInvestment })));
      }
      
      if (indiaInvestments.length > 0) {
        const indiaShare = thirdValue;
        const perIndiaInvestment = indiaShare / indiaInvestments.length;
        setIndiaInvestments(indiaInvestments.map(inv => ({ ...inv, amount: perIndiaInvestment })));
      }
      
      if (propertyInvestments.length > 0) {
        const propertyShare = thirdValue;
        const perPropertyInvestment = propertyShare / propertyInvestments.length;
        setPropertyInvestments(propertyInvestments.map(inv => ({ ...inv, amount: perPropertyInvestment })));
      }
    } else {
      // Adjust all values proportionally
      const ratio = newTotal / currentAssets;
      
      setUsInvestments(usInvestments.map(inv => ({ 
        ...inv, 
        amount: inv.amount * ratio 
      })));
      
      setIndiaInvestments(indiaInvestments.map(inv => ({ 
        ...inv, 
        amount: inv.amount * ratio 
      })));
      
      setPropertyInvestments(propertyInvestments.map(inv => ({ 
        ...inv, 
        amount: inv.amount * ratio 
      })));
    }
    
    setUserInputTotal(newTotal);
  };
  
  // Toggle expanded sections
  const toggleSection = (section) => {
    setExpanded({
      ...expanded,
      [section]: !expanded[section]
    });
  };
  
  // Calculate weighted average return
  const calculateWeightedAvgReturn = () => {
    const allInvestments = [...usInvestments, ...indiaInvestments, ...propertyInvestments];
    const totalAmount = allInvestments.reduce((sum, inv) => sum + inv.amount, 0);
    
    if (totalAmount === 0) return 0.05; // Default 5% if no investments
    
    const weightedSum = allInvestments.reduce((sum, inv) => {
      return sum + (inv.amount / totalAmount) * (inv.returnRate / 100);
    }, 0);
    
    return weightedSum;
  };
  
  // Handle asset click on pie chart
  const onPieEnter = (_, index) => {
    setActiveAssetIndex(index);
  };
  
  // Calculate projections
  useEffect(() => {
    // Calculate inflation-adjusted goal
    const adjustedGoal = retirementGoal * Math.pow(1 + (inflationRate / 100), yearsToRetirement);
    setRealGoal(adjustedGoal);
    
    // Calculate future values for each investment
    const allInvestments = [
      ...usInvestments.map(inv => ({ ...inv, category: 'us' })),
      ...indiaInvestments.map(inv => ({ ...inv, category: 'india' })),
      ...propertyInvestments.map(inv => ({ ...inv, category: 'property' }))
    ];
    
    // Calculate future value of current investments
    const futureValues = allInvestments.map(inv => {
      return {
        ...inv,
        futureValue: inv.amount * Math.pow(1 + (inv.returnRate / 100), yearsToRetirement)
      };
    });
    
    // Group future values by category
    const usFV = futureValues
      .filter(inv => inv.category === 'us')
      .reduce((sum, inv) => sum + inv.futureValue, 0);
      
    const indiaFV = futureValues
      .filter(inv => inv.category === 'india')
      .reduce((sum, inv) => sum + inv.futureValue, 0);
      
    const propertyFV = futureValues
      .filter(inv => inv.category === 'property')
      .reduce((sum, inv) => sum + inv.futureValue, 0);
      
    const totalProjectedAssets = usFV + indiaFV + propertyFV;
    const shortfall = adjustedGoal - totalProjectedAssets;
    
    // Calculate weighted average return rate
    const weightedAvgReturn = calculateWeightedAvgReturn();
    
    // Calculate required annual savings (after considering yearly contribution)
    let annualSavings = Math.max(0, (shortfall * weightedAvgReturn / (Math.pow(1 + weightedAvgReturn, yearsToRetirement) - 1)) - yearlyContribution);
    
    setRequiredAnnualSavings(annualSavings);
    
    // Generate projection data year by year
    const data = [];
    
    // Create a copy of the investments for projection
    let projectedInvestments = allInvestments.map(inv => ({
      ...inv,
      currentAmount: inv.amount
    }));
    
    let cumulativeSavings = 0;
    
    for (let year = 0; year <= yearsToRetirement; year++) {
      // Calculate totals for each asset type
      const assetTypeTotals = {};
      
      // Initialize totals for each asset type
      Object.keys(assetTypeReturns).forEach(assetType => {
        assetTypeTotals[assetType] = 0;
      });
      
      // Sum up investments by asset type
      projectedInvestments.forEach(inv => {
        if (assetTypeTotals[inv.assetType] !== undefined) {
          assetTypeTotals[inv.assetType] += inv.currentAmount;
        }
      });
      
      // Calculate totals for legacy categories (for backward compatibility)
      const usTotal = projectedInvestments
        .filter(inv => inv.category === 'us')
        .reduce((sum, inv) => sum + inv.currentAmount, 0);
        
      const indiaTotal = projectedInvestments
        .filter(inv => inv.category === 'india')
        .reduce((sum, inv) => sum + inv.currentAmount, 0);
        
      const propertyTotal = projectedInvestments
        .filter(inv => inv.category === 'property')
        .reduce((sum, inv) => sum + inv.currentAmount, 0);
      
      const totalInvestments = usTotal + indiaTotal + propertyTotal;
      const totalAssets = totalInvestments + cumulativeSavings;
      
      // Calculate real value (inflation-adjusted)
      const inflationFactor = Math.pow(1 + (inflationRate / 100), year);
      const realValue = totalAssets / inflationFactor;
      
      // Create data point with both asset type and legacy category data
      const dataPoint = {
        year,
        totalAssets: Math.round(totalAssets),
        realValue: Math.round(realValue),
        targetGoal: Math.round(retirementGoal * inflationFactor),
        additionalSavings: Math.round(cumulativeSavings),
        // Legacy data (for backward compatibility)
        usInvestments: Math.round(usTotal),
        indiaInvestments: Math.round(indiaTotal),
        property: Math.round(propertyTotal),
      };
      
      // Add asset type data
      Object.keys(assetTypeTotals).forEach(assetType => {
        // Convert asset type key to camelCase for use as property name
        const assetTypeKey = assetType.replace(/\s+/g, '');
        dataPoint[assetTypeKey] = Math.round(assetTypeTotals[assetType]);
      });
      
      data.push(dataPoint);
      
      if (year < yearsToRetirement) {
        // Grow each investment by its specific return rate
        projectedInvestments = projectedInvestments.map(inv => ({
          ...inv,
          currentAmount: inv.currentAmount * (1 + (inv.returnRate / 100))
        }));
        
        // Add yearly contribution and annual savings, then grow them at weighted average rate
        const weightedAvgReturn = calculateWeightedAvgReturn();
        cumulativeSavings = (cumulativeSavings + yearlyContribution + annualSavings) * (1 + weightedAvgReturn);
      }
    }
    
    setProjectedData(data);
  }, [
    usInvestments, 
    indiaInvestments, 
    propertyInvestments, 
    retirementGoal, 
    yearsToRetirement, 
    inflationRate,
    yearlyContribution
  ]);
  
  // Toggle line visibility
  const toggleLine = (line) => {
    setVisibleLines(prev => ({
      ...prev,
      [line]: !prev[line]
    }));
  };
  
  // Format currency
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(value);
  };

  // Format currency without leading $
  const formatCurrencyValue = (value) => {
    return formatCurrency(value).slice(1); // Remove the leading $
  };
  
  // Format percentage
  const formatPercentage = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'percent',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value / 100);
  };
  
  // Calculate future value helper function
  const calculateFutureValue = (amount, rate, years) => {
    return amount * Math.pow(1 + (rate / 100), years);
  };

  // Modify the renderInvestmentTable function
  const renderInvestmentTable = () => {
    const allInvestments = [
      ...usInvestments.map(inv => ({ ...inv, location: 'US' })),
      ...indiaInvestments.map(inv => ({ ...inv, location: 'India' })),
      ...propertyInvestments.map(inv => ({ ...inv, location: 'Property' }))
    ];

    // Calculate totals for each column
    const totals = allInvestments.reduce((acc, inv) => ({
      amount: acc.amount + inv.amount,
      year1: acc.year1 + calculateFutureValue(inv.amount, inv.returnRate, 1),
      year3: acc.year3 + calculateFutureValue(inv.amount, inv.returnRate, 3),
      year5: acc.year5 + calculateFutureValue(inv.amount, inv.returnRate, 5),
      year10: acc.year10 + calculateFutureValue(inv.amount, inv.returnRate, 10),
      year15: acc.year15 + calculateFutureValue(inv.amount, inv.returnRate, 15),
    }), {
      amount: 0,
      year1: 0,
      year3: 0,
      year5: 0,
      year10: 0,
      year15: 0
    });

    return (
      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="min-w-full divide-y divide-white/10">
          <thead>
            <tr className="bg-white/5">
              <th scope="col" className="p-2 text-center text-xs font-semibold uppercase tracking-wider text-white/80 w-24">Location</th>
              <th scope="col" className="p-2 text-center text-xs font-semibold uppercase tracking-wider text-white/80 w-32">Name</th>
              <th scope="col" className="p-2 text-center text-xs font-semibold uppercase tracking-wider text-white/80 w-36">Asset Type</th>
              <th scope="col" className="p-2 text-center text-xs font-semibold uppercase tracking-wider text-white/80 w-28">Amount</th>
              <th scope="col" className="p-2 text-center text-xs font-semibold uppercase tracking-wider text-white/80 w-20">Return Rate</th>
              <th scope="col" className="p-2 text-center text-xs font-semibold uppercase tracking-wider text-white/80 w-24">1 Year</th>
              <th scope="col" className="p-2 text-center text-xs font-semibold uppercase tracking-wider text-white/80 w-24">3 Years</th>
              <th scope="col" className="p-2 text-center text-xs font-semibold uppercase tracking-wider text-white/80 w-24">5 Years</th>
              <th scope="col" className="p-2 text-center text-xs font-semibold uppercase tracking-wider text-white/80 w-24">10 Years</th>
              <th scope="col" className="p-2 text-center text-xs font-semibold uppercase tracking-wider text-white/80 w-24">15 Years</th>
              <th scope="col" className="p-2 text-center text-xs font-semibold uppercase tracking-wider text-white/80 w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10 bg-white/5">
            {allInvestments.map((inv) => (
              <tr key={inv.id} className="hover:bg-white/10 transition-colors">
                <td className="p-2 text-sm">
                  <select
                    value={inv.location}
                    onChange={(e) => {
                      const newLocation = e.target.value;
                      const oldLocation = inv.location.toLowerCase();
                      
                      // Remove from old array
                      if (oldLocation === 'us') {
                        setUsInvestments(usInvestments.filter(i => i.id !== inv.id));
                      } else if (oldLocation === 'india') {
                        setIndiaInvestments(indiaInvestments.filter(i => i.id !== inv.id));
                      } else {
                        setPropertyInvestments(propertyInvestments.filter(i => i.id !== inv.id));
                      }
                      
                      // Add to new array
                      const newInvestment = { ...inv, location: newLocation };
                      if (newLocation === 'US') {
                        setUsInvestments([...usInvestments, newInvestment]);
                      } else if (newLocation === 'India') {
                        setIndiaInvestments([...indiaInvestments, newInvestment]);
                      } else {
                        setPropertyInvestments([...propertyInvestments, newInvestment]);
                      }
                    }}
                    className="w-full p-1 bg-white/10 border border-white/20 rounded text-white text-sm"
                  >
                    <option value="US">US</option>
                    <option value="India">India</option>
                    <option value="Property">Property</option>
                  </select>
                </td>
                <td className="p-2 text-sm">
                  <input
                    type="text"
                    value={inv.name}
                    onChange={(e) => updateInvestmentName(inv.location.toLowerCase(), inv.id, e.target.value)}
                    className="w-full p-1 bg-white/10 border border-white/20 rounded text-white text-sm text-left"
                  />
                </td>
                <td className="p-2 text-sm">
          <select
                    value={inv.assetType}
                    onChange={(e) => updateInvestmentAssetType(inv.location.toLowerCase(), inv.id, e.target.value)}
                    className="w-full p-1 bg-white/10 border border-white/20 rounded text-white text-sm"
          >
            {Object.keys(assetTypeReturns).map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
                </td>
                <td className="p-2 text-sm">
                  <div className="flex items-center space-x-2">
        <input
                      type="number"
                      value={inv.amount}
                      onChange={(e) => updateInvestmentAmount(inv.location.toLowerCase(), inv.id, e.target.value)}
                      className="w-24 p-1 bg-white/10 border border-white/20 rounded text-white text-sm"
          min="0"
                      step="1000"
                    />
                    <span className="text-white/60 text-xs">({formatPercentage(inv.allocation)})</span>
                  </div>
                </td>
                <td className="p-2 text-sm">
                  <div className="flex items-center space-x-1">
            <input
              type="number"
                      value={inv.returnRate}
                      onChange={(e) => updateInvestmentReturnRate(inv.location.toLowerCase(), inv.id, e.target.value)}
                      className="w-16 p-1 bg-white/10 border border-white/20 rounded text-white text-sm"
              min="0"
              max="20"
              step="0.1"
            />
                    <span className="text-white/60">%</span>
          </div>
                </td>
                <td className="p-2 text-sm text-white text-center">
                  <div className="font-medium">
                    {formatCurrency(calculateFutureValue(inv.amount, inv.returnRate, 1))}
        </div>
                </td>
                <td className="p-2 text-sm text-white text-center">
                  <div className="font-medium">
                    {formatCurrency(calculateFutureValue(inv.amount, inv.returnRate, 3))}
      </div>
                </td>
                <td className="p-2 text-sm text-white text-center">
                  <div className="font-medium">
                    {formatCurrency(calculateFutureValue(inv.amount, inv.returnRate, 5))}
        </div>
                </td>
                <td className="p-2 text-sm text-white text-center">
                  <div className="font-medium">
                    {formatCurrency(calculateFutureValue(inv.amount, inv.returnRate, 10))}
      </div>
                </td>
                <td className="p-2 text-sm text-white text-center">
                  <div className="font-medium">
                    {formatCurrency(calculateFutureValue(inv.amount, inv.returnRate, 15))}
                  </div>
                </td>
                <td className="p-2 text-sm">
          <button 
                    onClick={(e) => {
                      e.preventDefault();
                      const shouldDelete = window.confirm('Are you sure you want to delete this investment?');
                      if (shouldDelete) {
                        removeInvestment(inv.location.toLowerCase(), inv.id);
                      }
                    }}
                    className="text-white/40 hover:text-red-400 transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/5"
                    title="Delete investment"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
          </button>
                </td>
              </tr>
            ))}
            
            {showAddForm && (
              <tr className="bg-white/5">
                <td className="p-2 text-sm">
                  <select
                    value={newInvestment.category}
                    onChange={(e) => setNewInvestment({ ...newInvestment, category: e.target.value })}
                    className="w-full p-1 bg-white/10 border border-white/20 rounded text-white text-sm"
                  >
                    <option value="us">US</option>
                    <option value="india">India</option>
                    <option value="property">Property</option>
                  </select>
                </td>
                <td className="p-2 text-sm">
                    <input
                      type="text"
                      value={newInvestment.name}
                      onChange={(e) => setNewInvestment({ ...newInvestment, name: e.target.value })}
                    className="w-full p-1 bg-white/10 border border-white/20 rounded text-white text-sm"
                    placeholder="Investment Name"
                  />
                </td>
                <td className="p-2 text-sm">
                    <select
                      value={newInvestment.assetType}
                      onChange={(e) => {
                        const assetType = e.target.value;
                        setNewInvestment({ 
                          ...newInvestment, 
                          assetType,
                        returnRate: assetTypeReturns[assetType]
                        });
                      }}
                    className="w-full p-1 bg-white/10 border border-white/20 rounded text-white text-sm"
                    >
                      {Object.keys(assetTypeReturns).map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                </td>
                <td className="p-2 text-sm">
                    <input 
                      type="number" 
                      value={newInvestment.amount}
                      onChange={(e) => setNewInvestment({ ...newInvestment, amount: Number(e.target.value) })}
                    className="w-24 p-1 bg-white/10 border border-white/20 rounded text-white text-sm"
                      min="0"
                      step="1000"
                    />
                </td>
                <td className="p-2 text-sm">
                  <div className="flex items-center space-x-1">
                  <input
                      type="number"
                      value={newInvestment.returnRate}
                      onChange={(e) => setNewInvestment({ ...newInvestment, returnRate: Number(e.target.value) })}
                      className="w-16 p-1 bg-white/10 border border-white/20 rounded text-white text-sm"
                    min="0"
                      max="20"
                      step="0.1"
                    />
                    <span className="text-white/60">%</span>
                </div>
                </td>
                <td colSpan="5" className="p-2 text-sm text-white italic">
                  Projected values will appear after saving
                </td>
                <td className="p-2 text-sm">
                  <div className="flex space-x-2">
                    <button 
                      onClick={() => {
                        if (!newInvestment.name) {
                          alert('Please enter an investment name');
                          return;
                        }
                        addInvestment();
                        setShowAddForm(false);
                      }}
                      className="text-green-400 hover:text-green-300 transition-colors"
                      title="Save investment"
                    >
                      ✓
                    </button>
                  <button
                    onClick={() => {
                        setShowAddForm(false);
                        setNewInvestment({
                          category: 'us',
                          name: '',
                          type: '',
                          assetType: 'Stocks',
                          amount: 0,
                          returnRate: 8.0
                        });
                      }}
                      className="text-red-400 hover:text-red-300 transition-colors"
                      title="Cancel"
                    >
                      ×
                  </button>
                </div>
                </td>
              </tr>
            )}
            
            {/* Totals row - updated with better visual separation */}
            <tr className="bg-white/10 border-t border-white/20 font-medium">
              <td className="p-3 text-sm text-white"></td>
              <td className="p-3 text-sm font-semibold text-white text-left">Totals</td>
              <td className="p-3 text-sm text-white"></td>
              <td className="p-3 text-sm font-semibold text-white text-right">{formatCurrency(totals.amount)}</td>
              <td className="p-3 text-sm text-white"></td>
              <td className="p-3 text-sm text-center">
                <div className="font-semibold text-white">
                  {formatCurrency(totals.year1)}
            </div>
                <div className="text-xs text-green-400">
                  (+{((totals.year1 / totals.amount - 1) * 100).toFixed(1)}%)
                </div>
              </td>
              <td className="p-3 text-sm text-center">
                <div className="font-semibold text-white">
                  {formatCurrency(totals.year3)}
                </div>
                <div className="text-xs text-green-400">
                  (+{((totals.year3 / totals.amount - 1) * 100).toFixed(1)}%)
                </div>
              </td>
              <td className="p-3 text-sm text-center">
                <div className="font-semibold text-white">
                  {formatCurrency(totals.year5)}
                </div>
                <div className="text-xs text-green-400">
                  (+{((totals.year5 / totals.amount - 1) * 100).toFixed(1)}%)
                </div>
              </td>
              <td className="p-3 text-sm text-center">
                <div className="font-semibold text-white">
                  {formatCurrency(totals.year10)}
                </div>
                <div className="text-xs text-green-400">
                  (+{((totals.year10 / totals.amount - 1) * 100).toFixed(1)}%)
                </div>
              </td>
              <td className="p-3 text-sm text-center">
                <div className="font-semibold text-white">
                  {formatCurrency(totals.year15)}
                </div>
                <div className="text-xs text-green-400">
                  (+{((totals.year15 / totals.amount - 1) * 100).toFixed(1)}%)
                </div>
              </td>
              <td className="p-3 text-sm text-white"></td>
            </tr>
            
            {/* Inflation-Adjusted Totals row */}
            <tr className="bg-amber-950/30 border-b border-white/20 font-medium">
              <td className="p-3 text-sm text-white"></td>
              <td className="p-3 text-sm font-semibold text-amber-400 text-left">Inflation-Adjusted</td>
              <td className="p-3 text-sm text-white"></td>
              <td className="p-3 text-sm font-semibold text-white text-right">{formatCurrency(totals.amount)}</td>
              <td className="p-3 text-sm text-white"></td>
              <td className="p-3 text-sm text-center">
                <div className="font-semibold text-white">
                  {formatCurrency(totals.year1 / Math.pow(1 + (inflationRate / 100), 1))}
              </div>
                <div className="text-xs text-amber-400">
                  (+{((totals.year1 / Math.pow(1 + (inflationRate / 100), 1) / totals.amount - 1) * 100).toFixed(1)}%)
                </div>
              </td>
              <td className="p-3 text-sm text-center">
                <div className="font-semibold text-white">
                  {formatCurrency(totals.year3 / Math.pow(1 + (inflationRate / 100), 3))}
                </div>
                <div className="text-xs text-amber-400">
                  (+{((totals.year3 / Math.pow(1 + (inflationRate / 100), 3) / totals.amount - 1) * 100).toFixed(1)}%)
                </div>
              </td>
              <td className="p-3 text-sm text-center">
                <div className="font-semibold text-white">
                  {formatCurrency(totals.year5 / Math.pow(1 + (inflationRate / 100), 5))}
                </div>
                <div className="text-xs text-amber-400">
                  (+{((totals.year5 / Math.pow(1 + (inflationRate / 100), 5) / totals.amount - 1) * 100).toFixed(1)}%)
                </div>
              </td>
              <td className="p-3 text-sm text-center">
                <div className="font-semibold text-white">
                  {formatCurrency(totals.year10 / Math.pow(1 + (inflationRate / 100), 10))}
                </div>
                <div className="text-xs text-amber-400">
                  (+{((totals.year10 / Math.pow(1 + (inflationRate / 100), 10) / totals.amount - 1) * 100).toFixed(1)}%)
                </div>
              </td>
              <td className="p-3 text-sm text-center">
                <div className="font-semibold text-white">
                  {formatCurrency(totals.year15 / Math.pow(1 + (inflationRate / 100), 15))}
                </div>
                <div className="text-xs text-amber-400">
                  (+{((totals.year15 / Math.pow(1 + (inflationRate / 100), 15) / totals.amount - 1) * 100).toFixed(1)}%)
                </div>
              </td>
              <td className="p-3 text-sm text-white"></td>
            </tr>
            
            <tr>
              <td colSpan="11" className="p-3">
                  <button
                  onClick={() => setShowAddForm(true)}
                  className="w-full p-2 rounded-lg border bg-white/10 text-white border-white/20 hover:bg-white/20 transition-colors text-sm font-medium"
                  disabled={showAddForm}
                    >
                  + Add Investment
                  </button>
              </td>
            </tr>
          </tbody>
        </table>
                </div>
    );
  };
  
  // Add export function
  const exportToExcel = () => {
    // Create a new workbook
    const workbook = XLSX.utils.book_new();

    // Sheet 1: Parameters
    const parameterData = [
      ['Parameter', 'Value', 'Notes'],
      ['Current Total Assets', currentAssets, 'Total current investments'],
      ['Retirement Goal', retirementGoal, 'Target amount'],
      ['Years to Retirement', yearsToRetirement, 'Planning horizon'],
      ['Inflation Rate', inflationRate, 'Annual inflation rate (%)'],
      ['Required Annual Savings', requiredAnnualSavings, 'Additional savings needed per year'],
      ['Yearly Contribution', yearlyContribution, 'Planned annual contribution'],
      ['Inflation-Adjusted Goal', realGoal, 'Goal adjusted for inflation'],
      ['Weighted Average Return', calculateWeightedAvgReturn() * 100, 'Portfolio weighted average return (%)']
    ];

    const wsParams = XLSX.utils.aoa_to_sheet(parameterData);
    XLSX.utils.book_append_sheet(workbook, wsParams, "Parameters");

    // Sheet 2: Current investments
    const investmentData = [
      ['Location', 'Name', 'Asset Type', 'Amount', 'Return Rate', '1 Year', '3 Years', '5 Years', '10 Years', '15 Years'],
      ...usInvestments.map(inv => [
        'US',
        inv.name,
        inv.assetType,
        inv.amount,
        inv.returnRate,
        calculateFutureValue(inv.amount, inv.returnRate, 1),
        calculateFutureValue(inv.amount, inv.returnRate, 3),
        calculateFutureValue(inv.amount, inv.returnRate, 5),
        calculateFutureValue(inv.amount, inv.returnRate, 10),
        calculateFutureValue(inv.amount, inv.returnRate, 15)
      ]),
      ...indiaInvestments.map(inv => [
        'India',
        inv.name,
        inv.assetType,
        inv.amount,
        inv.returnRate,
        calculateFutureValue(inv.amount, inv.returnRate, 1),
        calculateFutureValue(inv.amount, inv.returnRate, 3),
        calculateFutureValue(inv.amount, inv.returnRate, 5),
        calculateFutureValue(inv.amount, inv.returnRate, 10),
        calculateFutureValue(inv.amount, inv.returnRate, 15)
      ]),
      ...propertyInvestments.map(inv => [
        'Property',
        inv.name,
        inv.assetType,
        inv.amount,
        inv.returnRate,
        calculateFutureValue(inv.amount, inv.returnRate, 1),
        calculateFutureValue(inv.amount, inv.returnRate, 3),
        calculateFutureValue(inv.amount, inv.returnRate, 5),
        calculateFutureValue(inv.amount, inv.returnRate, 10),
        calculateFutureValue(inv.amount, inv.returnRate, 15)
      ])
    ];

    const ws1 = XLSX.utils.aoa_to_sheet(investmentData);
    XLSX.utils.book_append_sheet(workbook, ws1, "Current Investments");

    // Sheet 3: Year by Year Breakdown
    const breakdownData = [
      ['Year', 'Total Assets', 'Real Value', 'Additional Savings', 'Inflation Factor', 'Notes'],
      ...projectedData.map(data => [
        data.year,
        data.totalAssets,
        data.realValue,
        data.additionalSavings,
        Math.pow(1 + (inflationRate / 100), data.year),
        data.year === 0 ? 'Initial Year' : 'Projected'
      ])
    ];

    const ws2 = XLSX.utils.aoa_to_sheet(breakdownData);
    XLSX.utils.book_append_sheet(workbook, ws2, "Year by Year Breakdown");

    // Apply number formatting
    ['B', 'C', 'D'].forEach(col => {
      for (let i = 2; i <= breakdownData.length; i++) {
        if (ws2[`${col}${i}`]) {
          ws2[`${col}${i}`].z = '#,##0';
        }
      }
    });

    // Format inflation factor column
    for (let i = 2; i <= breakdownData.length; i++) {
      if (ws2[`E${i}`]) {
        ws2[`E${i}`].z = '0.00';
      }
    }

    // Generate Excel file
    XLSX.writeFile(workbook, 'Retirement_Plan.xlsx');
  };
  
  // Add file upload handler
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(e.target.result, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(firstSheet);

        // Validate the data structure
        if (!data.length) {
          setUploadError('File is empty');
          return;
        }

        // Check required columns
        const requiredColumns = ['Location', 'Name', 'Asset Type', 'Amount', 'Return Rate'];
        const missingColumns = requiredColumns.filter(col => 
          !Object.keys(data[0]).some(key => key.toLowerCase() === col.toLowerCase())
        );

        if (missingColumns.length) {
          setUploadError(`Missing required columns: ${missingColumns.join(', ')}`);
          return;
        }

        // Process the data
        const newInvestments = data.map(row => ({
          id: generateId(row.Location.toLowerCase()),
          name: row.Name,
          type: row.Name,
          assetType: row['Asset Type'],
          amount: Number(row.Amount),
          returnRate: Number(row['Return Rate']),
          allocation: 0
        }));

        // Group by location
        const usInvs = newInvestments.filter(inv => inv.name && inv.amount && 
          row.Location.toLowerCase() === 'us');
        const indiaInvs = newInvestments.filter(inv => inv.name && inv.amount && 
          row.Location.toLowerCase() === 'india');
        const propertyInvs = newInvestments.filter(inv => inv.name && inv.amount && 
          row.Location.toLowerCase() === 'property');

        // Update state
        setUsInvestments(usInvs);
        setIndiaInvestments(indiaInvs);
        setPropertyInvestments(propertyInvs);
        setShowUploadModal(false);
        setUploadError('');

      } catch (error) {
        setUploadError('Error processing file. Please check the format.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Upload Modal Component
  const UploadModal = () => {
    if (!showUploadModal) return null;

    return (
      <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
        <div className="bg-black rounded-xl p-8 max-w-2xl w-full border border-white/20 shadow-xl font-['IBM_Plex_Mono']">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-semibold text-white tracking-tight">Upload Investments</h3>
                  <button
                    onClick={() => {
                setShowUploadModal(false);
                setUploadError('');
                    }}
              className="text-white/60 hover:text-white text-2xl transition-colors"
                  >
              ×
                  </button>
                </div>
                
          <div className="space-y-6">
            <div className="bg-white/5 p-6 rounded-lg border border-white/20">
              <h4 className="font-medium text-white text-lg mb-4 tracking-tight">File Format Requirements</h4>
              <ul className="space-y-3 text-white/80 text-sm">
                <li className="flex items-start">
                  <span className="text-indigo-400 mr-2">•</span>
                  Upload an Excel file (.xlsx) or CSV file
                </li>
                <li className="flex items-start">
                  <span className="text-indigo-400 mr-2">•</span>
                  First row must contain column headers
                </li>
                <li className="flex items-start">
                  <span className="text-indigo-400 mr-2">•</span>
                  <div>
                    <div>Required columns:</div>
                    <ul className="mt-2 ml-4 space-y-2 text-white/60">
                      <li className="flex items-start">
                        <span className="text-indigo-400/70 mr-2">◦</span>
                        Location (US, India, or Property)
                      </li>
                      <li className="flex items-start">
                        <span className="text-indigo-400/70 mr-2">◦</span>
                        Name (Investment name)
                      </li>
                      <li className="flex items-start">
                        <span className="text-indigo-400/70 mr-2">◦</span>
                        Asset Type (Must match one of: {Object.keys(assetTypeReturns).join(', ')})
                      </li>
                      <li className="flex items-start">
                        <span className="text-indigo-400/70 mr-2">◦</span>
                        Amount (Numeric value)
                      </li>
                      <li className="flex items-start">
                        <span className="text-indigo-400/70 mr-2">◦</span>
                        Return Rate (Percentage as number, e.g., 8 for 8%)
                      </li>
                    </ul>
                </div>
                </li>
                <li className="flex items-start">
                  <span className="text-indigo-400 mr-2">•</span>
                  All amounts should be in USD
                </li>
                <li className="flex items-start">
                  <span className="text-indigo-400 mr-2">•</span>
                  Return rates should be entered as numbers (e.g., 8 for 8%)
                </li>
              </ul>
            </div>
            
            <div className="bg-white/5 p-6 rounded-lg border border-white/20">
              <h4 className="font-medium text-white text-lg mb-4 tracking-tight">Example Format</h4>
              <div className="bg-black p-4 rounded-lg border border-white/10 font-mono text-sm">
                <pre className="text-white/80 whitespace-pre-wrap">
Location,Name,Asset Type,Amount,Return Rate
US,TPEG,Private Equity,75000,12
India,Property Fund,Real Estate,50000,5
US,401k Fund,401K,100000,7</pre>
              </div>
              </div>
              
            {uploadError && (
              <div className="bg-red-900/20 border border-red-500/30 text-red-400 p-4 rounded-lg flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                {uploadError}
              </div>
            )}
            
            <div className="mt-6">
                    <input
                type="file"
                accept=".xlsx,.csv"
                onChange={handleFileUpload}
                className="block w-full text-sm text-white/80
                  file:mr-4 file:py-2.5 file:px-6
                  file:rounded-lg file:border-0
                  file:text-sm file:font-medium
                  file:bg-white/10 file:text-white
                  hover:file:bg-white/20
                  file:transition-colors
                  cursor-pointer
                  focus:outline-none"
                    />
                  </div>
          </div>
        </div>
      </div>
    );
  };
  
  // Add new update name function
  const updateInvestmentName = (category, id, name) => {
    if (category === 'us') {
      setUsInvestments(prev => 
        prev.map(inv => 
          inv.id === id ? { ...inv, name, type: name } : inv
        )
      );
    } else if (category === 'india') {
      setIndiaInvestments(prev => 
        prev.map(inv => 
          inv.id === id ? { ...inv, name, type: name } : inv
        )
      );
    } else if (category === 'property') {
      setPropertyInvestments(prev => 
        prev.map(inv => 
          inv.id === id ? { ...inv, name, type: name } : inv
        )
      );
    }
  };
  
  // Add InfoModal Component
  const InfoModal = () => {
    if (!showInfoModal) return null;

    return (
      <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
        <div className="bg-black/90 rounded-xl p-6 max-w-4xl w-full border border-white/20 shadow-xl font-['IBM_Plex_Mono'] max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-semibold text-white tracking-tight">How the Calculator Works</h3>
            <button
              onClick={() => setShowInfoModal(false)}
              className="text-white/60 hover:text-white text-2xl transition-colors"
            >
              ×
            </button>
                  </div>
                  
          <div className="space-y-6">
            {/* Core Components */}
            <div className="bg-white/5 p-5 rounded-lg border border-white/20">
              <h4 className="font-medium text-white text-lg mb-4 tracking-tight text-left">Core Components</h4>
              <ul className="space-y-3 text-white/80 text-sm">
                <li className="flex items-start">
                  <span className="text-green-400 mr-2 mt-0.5">•</span>
                  <div className="text-left">
                    <strong className="text-white">Target Amount:</strong> Your desired retirement savings goal in today's dollars.
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="text-indigo-400 mr-2 mt-0.5">•</span>
                  <div className="text-left">
                    <strong className="text-white">Years until Retirement:</strong> The time horizon for your investment planning.
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="text-amber-400 mr-2 mt-0.5">•</span>
                  <div className="text-left">
                    <strong className="text-white">Inflation Rate:</strong> Annual rate of inflation used to calculate the real future value of your goal.
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="text-purple-400 mr-2 mt-0.5">•</span>
                  <div className="text-left">
                    <strong className="text-white">Yearly Contribution:</strong> The amount you plan to invest each year in addition to your current assets.
                  </div>
                </li>
              </ul>
                  </div>
                  
            {/* Calculations */}
            <div className="bg-white/5 p-5 rounded-lg border border-white/20">
              <h4 className="font-medium text-white text-lg mb-4 tracking-tight text-left">Key Calculations</h4>
              <ul className="space-y-4 text-white/80 text-sm">
                <li className="flex items-start">
                  <span className="text-green-400 mr-2 mt-0.5">•</span>
                  <div className="text-left">
                    <strong className="text-white">Inflation-Adjusted Goal:</strong>
                    <div className="mt-2 bg-white/10 p-3 rounded border border-white/10 font-mono text-left">
                      Goal × (1 + Inflation Rate)^Years to Retirement
                    </div>
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="text-indigo-400 mr-2 mt-0.5">•</span>
                  <div className="text-left">
                    <strong className="text-white">Future Value of Investments:</strong>
                    <div className="mt-2 bg-white/10 p-3 rounded border border-white/10 font-mono text-left">
                      Investment Amount × (1 + Return Rate)^Years
                    </div>
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="text-amber-400 mr-2 mt-0.5">•</span>
                  <div className="text-left">
                    <strong className="text-white">Weighted Average Return:</strong>
                    <div className="mt-2 bg-white/10 p-3 rounded border border-white/10 font-mono text-left">
                      Σ(Investment Amount × Return Rate) / Total Investments
                    </div>
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="text-purple-400 mr-2 mt-0.5">•</span>
                  <div className="text-left">
                    <strong className="text-white">Required Annual Savings:</strong>
                    <div className="mt-2 bg-white/10 p-3 rounded border border-white/10 font-mono text-left">
                      (Shortfall × Weighted Return) / ((1 + Weighted Return)^Years - 1) - Yearly Contribution
                    </div>
                  </div>
                </li>
              </ul>
                  </div>
                  
            {/* Investment Management */}
            <div className="bg-white/5 p-5 rounded-lg border border-white/20">
              <h4 className="font-medium text-white text-lg mb-4 tracking-tight text-left">Investment Management</h4>
              <ul className="space-y-4 text-white/80 text-sm">
                <li className="flex items-start">
                  <span className="text-green-400 mr-2 mt-0.5">•</span>
                  <div className="text-left">
                    <strong className="text-white">Asset Types & Default Returns:</strong>
                    <ul className="mt-2 ml-4 space-y-1 text-white/70">
                      <li>Private Equity: 12.0%</li>
                      <li>Stocks: 8.0%</li>
                      <li>Real Estate: 5.0%</li>
                      <li>401K: 7.0%</li>
                      <li>Cash Deposit: 2.0%</li>
                      <li>Cash: 1.5%</li>
                      <li>Bonus: 0.0%</li>
                    </ul>
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="text-indigo-400 mr-2 mt-0.5">•</span>
                  <div className="text-left">
                    <strong className="text-white">Investment Categories:</strong>
                    <div className="mt-2">Investments are categorized into US, India, and Property, allowing for geographic and asset-type diversification tracking.</div>
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="text-amber-400 mr-2 mt-0.5">•</span>
                  <div className="text-left">
                    <strong className="text-white">Allocation Percentages:</strong>
                    <div className="mt-2">Each investment's allocation is calculated as: (Investment Amount / Total Assets) × 100</div>
                  </div>
                </li>
              </ul>
            </div>
                  
            {/* Projections */}
            <div className="bg-white/5 p-5 rounded-lg border border-white/20">
              <h4 className="font-medium text-white text-lg mb-4 tracking-tight text-left">Growth Projections</h4>
              <ul className="space-y-3 text-white/80 text-sm">
                <li className="flex items-start">
                  <span className="text-green-400 mr-2 mt-0.5">•</span>
                  <div className="text-left">
                    <strong className="text-white">Total Assets:</strong> Sum of all investments plus accumulated additional savings.
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="text-indigo-400 mr-2 mt-0.5">•</span>
                  <div className="text-left">
                    <strong className="text-white">Real Value:</strong> Total assets adjusted for inflation to show purchasing power in today's dollars.
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="text-amber-400 mr-2 mt-0.5">•</span>
                  <div className="text-left">
                    <strong className="text-white">Additional Savings:</strong> Accumulated yearly contributions and required savings, grown at the weighted average return rate.
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  // Add a button to clear localStorage data
  const clearSavedData = () => {
    if (window.confirm('Are you sure you want to clear all saved investment data? This cannot be undone.')) {
      localStorage.removeItem('retirementCalculatorInvestments');
      // Reload with initial data
      const initialData = personalData || sampleInvestments;
      setUsInvestments(initialData.usInvestments);
      setIndiaInvestments(initialData.indiaInvestments);
      setPropertyInvestments(initialData.propertyInvestments);
      alert('Saved data has been cleared. The page will now show the default investments.');
    }
  };
  
  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-[1280px] mx-auto p-4 sm:p-6 md:p-8 font-['IBM_Plex_Mono'] text-white">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Retirement Calculator</h1>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setShowInfoModal(true)}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors flex items-center gap-2 font-medium"
              title="How it works"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <span>Info</span>
            </button>
            <button
              onClick={() => setShowUploadModal(true)}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors flex items-center gap-2 font-medium"
            >
              <span>Upload Investments</span>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </button>
            <button
              onClick={exportToExcel}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors flex items-center gap-2 font-medium"
            >
              <span>Export to Excel</span>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 00-1.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 101.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
            <button
              onClick={clearSavedData}
              className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-white rounded-lg transition-colors flex items-center gap-2 font-medium"
              title="Clear saved data and revert to default investments"
            >
              <span>Reset Data</span>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>

        <UploadModal />
        <InfoModal />

        {/* Retirement Goal and Current Assets Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Retirement Goal Controls */}
          <div className="bg-white/5 p-6 rounded-lg border border-white/10">
            <h2 className="text-2xl font-semibold mb-6 tracking-tight">Retirement Goal</h2>
            <div className="space-y-6">
                <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium text-white/80">Target Amount</label>
                  <span className="text-xl font-semibold text-green-400">{formatCurrency(retirementGoal)}</span>
                </div>
                  <input
                    type="range"
                    min="2000000"
                    max="20000000"
                    step="100000"
                    value={retirementGoal}
                    onChange={(e) => setRetirementGoal(Number(e.target.value))}
                  className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-green-400"
                  />
                </div>
                <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium text-white/80">Years until Retirement</label>
                  <span className="text-xl font-semibold text-indigo-400">{yearsToRetirement} years</span>
                </div>
                  <input
                    type="range"
                    min="5"
                    max="30"
                    step="1"
                    value={yearsToRetirement}
                    onChange={(e) => setYearsToRetirement(Number(e.target.value))}
                  className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-400"
                  />
                </div>
                <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium text-white/80">Inflation Rate</label>
                  <span className="text-xl font-semibold text-amber-400">{inflationRate}%</span>
                </div>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="0.1"
                    value={inflationRate}
                    onChange={(e) => setInflationRate(Number(e.target.value))}
                  className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-400"
                  />
                </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium text-white/80">Yearly Contribution</label>
                  <span className="text-xl font-semibold text-purple-400">{formatCurrency(yearlyContribution)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="200000"
                  step="1000"
                  value={yearlyContribution}
                  onChange={(e) => setYearlyContribution(Number(e.target.value))}
                  className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-400"
                />
              </div>
            </div>
          </div>
          
          {/* Current Assets and Contributions */}
          <div className="bg-white/5 p-6 rounded-lg border border-white/10">
          <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-semibold mb-4 tracking-tight">Total Current Assets</h2>
                <div className="text-4xl font-semibold text-green-400 mb-2">
                  ${formatCurrencyValue(userInputTotal)}
                </div>
                </div>
              
              <div className="border-t border-white/10 pt-6">
                <h2 className="text-2xl font-semibold mb-4 tracking-tight">
                  Inflation-Adjusted Goal
                  <InfoButton 
                    title="Inflation-Adjusted Goal"
                    explanation="The inflation-adjusted goal calculates how much money you'll need in the future to have the same purchasing power as your target amount today. This accounts for the fact that money loses value over time due to inflation."
                    example={`For a retirement goal of $5,000,000 with ${inflationRate}% annual inflation over ${yearsToRetirement} years:

Goal × (1 + Inflation Rate)^Years to Retirement
$5,000,000 × (1 + ${inflationRate/100})^${yearsToRetirement} = $${formatCurrencyValue(realGoal)}

This means you'll need $${formatCurrencyValue(realGoal)} in ${yearsToRetirement} years to have the same purchasing power as $5,000,000 today.`}
                  />
                </h2>
                <div className="text-4xl font-semibold text-indigo-300 mb-2">
                  ${formatCurrencyValue(realGoal)}
                </div>
                <div className="text-white/80 text-sm">target adjusted for inflation over {yearsToRetirement} years</div>
                <div className="text-white/60 text-xs mt-1">
                  (at {inflationRate}% annual inflation rate)
              </div>
            </div>
            
              <div className="border-t border-white/10 pt-6">
                <h2 className="text-2xl font-semibold mb-4 tracking-tight">
                  Additional Savings Needed
                  <InfoButton 
                    title="Additional Savings Needed"
                    explanation="This calculation determines how much additional money you need to save each year (beyond your planned yearly contribution) to reach your inflation-adjusted retirement goal. It uses the weighted average return rate of your current investments."
                    example={`For an inflation-adjusted goal of $${formatCurrencyValue(realGoal)}, current assets of $${formatCurrencyValue(userInputTotal)}, yearly contribution of $${formatCurrencyValue(yearlyContribution)}, and ${formatPercentage(calculateWeightedAvgReturn())} weighted average return over ${yearsToRetirement} years:

1. Calculate the shortfall: Inflation-Adjusted Goal - Future Value of Current Assets
   Shortfall = $${formatCurrencyValue(realGoal)} - $${formatCurrencyValue(calculateFutureValue(userInputTotal, calculateWeightedAvgReturn(), yearsToRetirement))}

2. Calculate required annual savings:
   (Shortfall × Weighted Return) / ((1 + Weighted Return)^Years - 1) - Yearly Contribution

This equals $${formatCurrencyValue(requiredAnnualSavings)} per year in additional savings needed.`}
                  />
                </h2>
                <div className="text-4xl font-semibold text-purple-400 mb-2">
                  ${formatCurrencyValue(requiredAnnualSavings)}
                </div>
                <div className="text-white/80 text-sm">per year (beyond yearly contribution)</div>
                <div className="text-white/60 text-xs mt-1">
                  based on {formatPercentage(calculateWeightedAvgReturn())} weighted avg return
                </div>
              </div>
            </div>
              </div>
            </div>
            
        {/* Projected Growth Chart Section */}
        <div className="bg-white/5 rounded-lg p-6 sm:p-8 mb-8 border border-white/10">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold">
              Projected Growth
              <InfoButton 
                title="Projected Growth Chart"
                explanation="This chart visualizes how your investments and savings are projected to grow over time. It shows the total assets, individual asset types, additional savings, and your inflation-adjusted target goal."
                example={`The chart projects growth based on:

1. Each investment grows at its specific return rate
2. Additional savings (yearly contribution + required savings) grow at the weighted average return rate
3. The target goal line increases with inflation

For example, in year ${Math.floor(yearsToRetirement/2)}:
- Total assets: $${formatCurrencyValue(projectedData[Math.floor(yearsToRetirement/2)]?.totalAssets || 0)}
- Real value (inflation-adjusted): $${formatCurrencyValue(projectedData[Math.floor(yearsToRetirement/2)]?.realValue || 0)}
- Target goal: $${formatCurrencyValue(projectedData[Math.floor(yearsToRetirement/2)]?.targetGoal || 0)}`}
              />
            </h2>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => toggleLine('totalAssets')}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  visibleLines.totalAssets ? 'bg-blue-400/20 text-blue-300' : 'bg-white/10 text-white'
                }`}
              >
                Total Assets
              </button>
              
              {/* Asset Type buttons */}
              <button
                onClick={() => toggleLine('PrivateEquity')}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  visibleLines.PrivateEquity ? 'bg-purple-400/20 text-purple-300' : 'bg-white/10 text-white'
                }`}
              >
                Private Equity
              </button>
              <button
                onClick={() => toggleLine('Stocks')}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  visibleLines.Stocks ? 'bg-green-400/20 text-green-300' : 'bg-white/10 text-white'
                }`}
              >
                Stocks
              </button>
              <button
                onClick={() => toggleLine('RealEstate')}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  visibleLines.RealEstate ? 'bg-yellow-400/20 text-yellow-300' : 'bg-white/10 text-white'
                }`}
              >
                Real Estate
              </button>
              <button
                onClick={() => toggleLine('additionalSavings')}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  visibleLines.additionalSavings ? 'bg-blue-500/20 text-blue-400' : 'bg-white/10 text-white'
                }`}
              >
                Additional Savings
              </button>
              <button
                onClick={() => toggleLine('targetGoal')}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  visibleLines.targetGoal ? 'bg-red-400/20 text-red-300' : 'bg-white/10 text-white'
                }`}
              >
                Target Goal
              </button>
            </div>
          </div>
          <div className="w-full h-[450px]">
            <ResponsiveContainer>
              <LineChart data={projectedData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                <XAxis 
                  dataKey="year" 
                  stroke="#fff"
                  label={{ value: 'Years', position: 'bottom', fill: '#fff' }}
                />
                <YAxis 
                  stroke="#fff"
                  tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`}
                  label={{
                    value: 'Amount',
                    angle: -90,
                    position: 'left',
                    fill: '#fff',
                  }}
                />
                <Tooltip 
                  formatter={(value) => [`$${formatCurrencyValue(value)}`, '']}
                  contentStyle={{ 
                    backgroundColor: 'rgba(0, 0, 0, 0.9)', 
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '0.5rem',
                    fontFamily: 'IBM Plex Mono',
                    fontSize: '0.875rem',
                    color: '#fff'
                  }}
                />
                <Legend 
                  layout="horizontal"
                  verticalAlign="bottom"
                  align="center"
                  wrapperStyle={{
                    paddingTop: 20,
                    marginBottom: 20
                  }}
                  iconSize={10}
                  itemStyle={{
                    fontSize: '0.75rem',
                    color: '#fff',
                    paddingLeft: 15,
                    paddingRight: 15
                  }}
                  formatter={(value) => <span style={{ color: '#fff' }}>{value}</span>}
                  margin={{ top: 0, right: 0, bottom: 20, left: 0 }}
                  content={(props) => {
                    const { payload } = props;
                    
                    return (
                      <div className="flex flex-wrap justify-center mt-4 mb-2 gap-x-6 gap-y-2">
                        {payload.map((entry, index) => (
                          <div key={`item-${index}`} className="flex items-center">
                            <svg width="10" height="10" className="mr-2">
                              <rect width="10" height="10" fill={entry.color} />
                            </svg>
                            <span className="text-xs text-white">{entry.value}</span>
                          </div>
                        ))}
                      </div>
                    );
                  }}
                />
                {visibleLines.totalAssets && (
                  <Line
                    type="monotone"
                    dataKey="totalAssets"
                    name="Total Assets"
                    stroke="#93C5FD"
                    strokeWidth={2}
                    dot={false}
                  />
                )}
                
                {/* Asset Type lines */}
                {visibleLines.PrivateEquity && (
                  <Line
                    type="monotone"
                    dataKey="PrivateEquity"
                    name="Private Equity"
                    stroke="#A78BFA"
                    strokeWidth={1}
                    dot={false}
                  />
                )}
                {visibleLines.Stocks && (
                  <Line
                    type="monotone"
                    dataKey="Stocks"
                    name="Stocks"
                    stroke="#34D399"
                    strokeWidth={1}
                    dot={false}
                  />
                )}
                {visibleLines.RealEstate && (
                  <Line
                    type="monotone"
                    dataKey="RealEstate"
                    name="Real Estate"
                    stroke="#FCD34D"
                    strokeWidth={1}
                    dot={false}
                  />
                )}
                {visibleLines['401K'] && (
                  <Line
                    type="monotone"
                    dataKey="401K"
                    name="401K"
                    stroke="#60A5FA"
                    strokeWidth={1}
                    dot={false}
                  />
                )}
                {visibleLines.CashDeposit && (
                  <Line
                    type="monotone"
                    dataKey="CashDeposit"
                    name="Cash Deposit"
                    stroke="#F87171"
                    strokeWidth={1}
                    dot={false}
                  />
                )}
                {visibleLines.Cash && (
                  <Line
                    type="monotone"
                    dataKey="Cash"
                    name="Cash"
                    stroke="#6EE7B7"
                    strokeWidth={1}
                    dot={false}
                  />
                )}
                {visibleLines.Bonus && (
                  <Line
                    type="monotone"
                    dataKey="Bonus"
                    name="Bonus"
                    stroke="#C4B5FD"
                    strokeWidth={1}
                    dot={false}
                  />
                )}
                
                {visibleLines.additionalSavings && (
                  <Line
                    type="monotone"
                    dataKey="additionalSavings"
                    name="Additional Savings"
                    stroke="#60A5FA"
                    strokeWidth={1}
                    dot={false}
                  />
                )}
                {visibleLines.targetGoal && (
                  <Line
                    type="monotone"
                    dataKey="targetGoal"
                    name="Target Goal"
                    stroke="#EF4444"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        {/* Combined Investments Section */}
        <div className="bg-white/5 rounded-lg p-6 sm:p-8 mb-8 border border-white/10">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold">
              All Investments (${formatCurrencyValue(userInputTotal)})
              <InfoButton 
                title="Investment Projections"
                explanation="This table shows how each of your investments is projected to grow over time based on its individual return rate. The calculations use compound interest without adjusting for inflation."
                example={`For an investment of $100,000 with an 8% annual return:

After 1 year: $100,000 × (1 + 0.08)^1 = $108,000
After 3 years: $100,000 × (1 + 0.08)^3 = $125,971
After 5 years: $100,000 × (1 + 0.08)^5 = $146,933
After 10 years: $100,000 × (1 + 0.08)^10 = $215,892
After 15 years: $100,000 × (1 + 0.08)^15 = $317,217

The totals row sums all investments, and the inflation-adjusted row shows what these values would be worth in today's dollars.`}
              />
            </h2>
            </div>
          {renderInvestmentTable()}
          </div>
          
        {/* Year by Year Breakdown Section */}
        <div className="bg-white/5 rounded-lg p-6 sm:p-8 mb-8 border border-white/10">
          <h2 className="text-2xl font-semibold mb-6 text-white">
            Year by Year Breakdown
            <InfoButton 
              title="Year by Year Breakdown"
              explanation="This table provides a detailed year-by-year projection of your retirement plan, showing how your total assets grow over time, their inflation-adjusted real value, and the accumulation of additional savings."
              example={`For each year, the table shows:

1. Total Assets: Sum of all investments plus accumulated additional savings
2. Real Value: Total assets adjusted for inflation (what they're worth in today's dollars)
3. Additional Savings: Accumulated yearly contributions and required savings

For example, in year ${Math.min(5, yearsToRetirement)}:
- Total Assets: $${formatCurrencyValue(projectedData[Math.min(5, yearsToRetirement)]?.totalAssets || 0)}
- Real Value: $${formatCurrencyValue(projectedData[Math.min(5, yearsToRetirement)]?.realValue || 0)}
- Additional Savings: $${formatCurrencyValue(projectedData[Math.min(5, yearsToRetirement)]?.additionalSavings || 0)}`}
            />
          </h2>
            <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10">
              <thead>
                <tr className="bg-white/5">
                  <th scope="col" className="p-3 sm:p-4 text-center text-xs font-semibold uppercase tracking-wider text-white/80">Year</th>
                  <th scope="col" className="p-3 sm:p-4 text-center text-xs font-semibold uppercase tracking-wider text-white/80">Total Assets</th>
                  <th scope="col" className="p-3 sm:p-4 text-center text-xs font-semibold uppercase tracking-wider text-white/80">Real Value</th>
                  <th scope="col" className="p-3 sm:p-4 text-center text-xs font-semibold uppercase tracking-wider text-white/80">Additional Savings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-white/5">
                {projectedData.map((data) => (
                  <tr key={data.year} className={`hover:bg-white/10 transition-colors ${data.year === 0 ? 'bg-white/10 border-t-2 border-white/20' : ''}`}>
                    <td className="p-3 sm:p-4 text-sm font-medium text-white text-center">{data.year}</td>
                    <td className="p-3 sm:p-4 text-sm text-white text-center">{formatCurrency(data.totalAssets)}</td>
                    <td className="p-3 sm:p-4 text-sm text-white text-center">{formatCurrency(data.realValue)}</td>
                    <td className="p-3 sm:p-4 text-sm text-center">
                      {data.year === 0 ? 
                        <span className="text-indigo-400 font-medium">+{formatCurrency(requiredAnnualSavings)} needed/year</span> :
                        <span className="text-white/80">{formatCurrency(data.additionalSavings)}</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>
    </div>
  );
};

export default RetirementCalculator;