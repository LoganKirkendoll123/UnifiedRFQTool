import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Percent, 
  BarChart3, 
  PieChart, 
  Target,
  Clock,
  Truck,
  Award,
  AlertTriangle,
  CheckCircle,
  ArrowUp,
  ArrowDown,
  Minus
} from 'lucide-react';
import { BatchData, BatchRequest, BatchResponse } from '../utils/apiClient';
import { formatCurrency } from '../utils/pricingCalculator';

interface BatchAnalyticsProps {
  originalBatch: BatchData;
  originalRequests: BatchRequest[];
  originalResponses: BatchResponse[];
  newResponses: BatchResponse[];
  onClose: () => void;
}

interface CarrierComparison {
  carrierName: string;
  originalCount: number;
  newCount: number;
  originalAvgPrice: number;
  newAvgPrice: number;
  priceChange: number;
  priceChangePercent: number;
  originalAvgProfit: number;
  newAvgProfit: number;
  profitChange: number;
  profitChangePercent: number;
}

interface RequestComparison {
  requestId: string;
  route: string;
  pallets: number;
  weight: number;
  originalBestPrice: number;
  newBestPrice: number;
  priceChange: number;
  priceChangePercent: number;
  originalQuoteCount: number;
  newQuoteCount: number;
  availabilityChange: number;
}

export const BatchAnalytics: React.FC<BatchAnalyticsProps> = ({
  originalBatch,
  originalRequests,
  originalResponses,
  newResponses,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'carriers' | 'requests'>('overview');
  const [carrierComparisons, setCarrierComparisons] = useState<CarrierComparison[]>([]);
  const [requestComparisons, setRequestComparisons] = useState<RequestComparison[]>([]);
  const [overallStats, setOverallStats] = useState({
    totalPriceDifference: 0,
    avgPriceChange: 0,
    totalProfitDifference: 0,
    avgProfitChange: 0,
    carrierAvailabilityChange: 0,
    betterPricingCount: 0,
    worsePricingCount: 0,
    unchangedCount: 0
  });

  useEffect(() => {
    calculateAnalytics();
  }, [originalResponses, newResponses]);

  const calculateAnalytics = () => {
    // Group responses by carrier
    const originalByCarrier = groupResponsesByCarrier(originalResponses);
    const newByCarrier = groupResponsesByCarrier(newResponses);
    
    // Calculate carrier comparisons
    const carriers = new Set([...Object.keys(originalByCarrier), ...Object.keys(newByCarrier)]);
    const carrierComps: CarrierComparison[] = [];
    
    carriers.forEach(carrierName => {
      const originalQuotes = originalByCarrier[carrierName] || [];
      const newQuotes = newByCarrier[carrierName] || [];
      
      const originalAvgPrice = originalQuotes.length > 0 
        ? originalQuotes.reduce((sum, q) => sum + q.customer_price, 0) / originalQuotes.length 
        : 0;
      const newAvgPrice = newQuotes.length > 0 
        ? newQuotes.reduce((sum, q) => sum + q.customer_price, 0) / newQuotes.length 
        : 0;
      
      const originalAvgProfit = originalQuotes.length > 0 
        ? originalQuotes.reduce((sum, q) => sum + q.profit, 0) / originalQuotes.length 
        : 0;
      const newAvgProfit = newQuotes.length > 0 
        ? newQuotes.reduce((sum, q) => sum + q.profit, 0) / newQuotes.length 
        : 0;
      
      const priceChange = newAvgPrice - originalAvgPrice;
      const priceChangePercent = originalAvgPrice > 0 ? (priceChange / originalAvgPrice) * 100 : 0;
      
      const profitChange = newAvgProfit - originalAvgProfit;
      const profitChangePercent = originalAvgProfit > 0 ? (profitChange / originalAvgProfit) * 100 : 0;
      
      carrierComps.push({
        carrierName,
        originalCount: originalQuotes.length,
        newCount: newQuotes.length,
        originalAvgPrice,
        newAvgPrice,
        priceChange,
        priceChangePercent,
        originalAvgProfit,
        newAvgProfit,
        profitChange,
        profitChangePercent
      });
    });
    
    setCarrierComparisons(carrierComps.sort((a, b) => Math.abs(b.priceChangePercent) - Math.abs(a.priceChangePercent)));
    
    // Group responses by request
    const originalByRequest = groupResponsesByRequest(originalResponses);
    const newByRequest = groupResponsesByRequest(newResponses);
    
    // Calculate request comparisons
    const requestComps: RequestComparison[] = [];
    originalRequests.forEach(request => {
      const originalQuotes = originalByRequest[request.id] || [];
      const newQuotes = newByRequest[request.id] || [];
      
      const originalBestPrice = originalQuotes.length > 0 
        ? Math.min(...originalQuotes.map(q => q.customer_price)) 
        : 0;
      const newBestPrice = newQuotes.length > 0 
        ? Math.min(...newQuotes.map(q => q.customer_price)) 
        : 0;
      
      const priceChange = newBestPrice - originalBestPrice;
      const priceChangePercent = originalBestPrice > 0 ? (priceChange / originalBestPrice) * 100 : 0;
      
      requestComps.push({
        requestId: request.id,
        route: `${request.from_zip} → ${request.to_zip}`,
        pallets: request.pallets,
        weight: request.gross_weight,
        originalBestPrice,
        newBestPrice,
        priceChange,
        priceChangePercent,
        originalQuoteCount: originalQuotes.length,
        newQuoteCount: newQuotes.length,
        availabilityChange: newQuotes.length - originalQuotes.length
      });
    });
    
    setRequestComparisons(requestComps.sort((a, b) => a.priceChangePercent - b.priceChangePercent));
    
    // Calculate overall statistics
    const totalOriginalValue = originalResponses.reduce((sum, r) => sum + r.customer_price, 0);
    const totalNewValue = newResponses.reduce((sum, r) => sum + r.customer_price, 0);
    const totalPriceDifference = totalNewValue - totalOriginalValue;
    const avgPriceChange = totalOriginalValue > 0 ? (totalPriceDifference / totalOriginalValue) * 100 : 0;
    
    const totalOriginalProfit = originalResponses.reduce((sum, r) => sum + r.profit, 0);
    const totalNewProfit = newResponses.reduce((sum, r) => sum + r.profit, 0);
    const totalProfitDifference = totalNewProfit - totalOriginalProfit;
    const avgProfitChange = totalOriginalProfit > 0 ? (totalProfitDifference / totalOriginalProfit) * 100 : 0;
    
    const betterPricingCount = requestComps.filter(r => r.priceChange < 0).length;
    const worsePricingCount = requestComps.filter(r => r.priceChange > 0).length;
    const unchangedCount = requestComps.filter(r => Math.abs(r.priceChange) < 0.01).length;
    
    setOverallStats({
      totalPriceDifference,
      avgPriceChange,
      totalProfitDifference,
      avgProfitChange,
      carrierAvailabilityChange: newResponses.length - originalResponses.length,
      betterPricingCount,
      worsePricingCount,
      unchangedCount
    });
  };

  const groupResponsesByCarrier = (responses: BatchResponse[]) => {
    return responses.reduce((groups, response) => {
      const carrier = response.carrier_name;
      if (!groups[carrier]) {
        groups[carrier] = [];
      }
      groups[carrier].push(response);
      return groups;
    }, {} as Record<string, BatchResponse[]>);
  };

  const groupResponsesByRequest = (responses: BatchResponse[]) => {
    return responses.reduce((groups, response) => {
      const requestId = response.request_id;
      if (!groups[requestId]) {
        groups[requestId] = [];
      }
      groups[requestId].push(response);
      return groups;
    }, {} as Record<string, BatchResponse[]>);
  };

  const getChangeIcon = (change: number) => {
    if (change > 0) return <ArrowUp className="h-4 w-4 text-red-500" />;
    if (change < 0) return <ArrowDown className="h-4 w-4 text-green-500" />;
    return <Minus className="h-4 w-4 text-gray-500" />;
  };

  const getChangeColor = (change: number, isPrice: boolean = true) => {
    if (change > 0) return isPrice ? 'text-red-600' : 'text-green-600';
    if (change < 0) return isPrice ? 'text-green-600' : 'text-red-600';
    return 'text-gray-600';
  };

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Price Impact</p>
              <div className="flex items-center space-x-2">
                <span className={`text-2xl font-bold ${getChangeColor(overallStats.avgPriceChange)}`}>
                  {overallStats.avgPriceChange > 0 ? '+' : ''}{overallStats.avgPriceChange.toFixed(1)}%
                </span>
                {getChangeIcon(overallStats.avgPriceChange)}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {formatCurrency(Math.abs(overallStats.totalPriceDifference))} total difference
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Profit Impact</p>
              <div className="flex items-center space-x-2">
                <span className={`text-2xl font-bold ${getChangeColor(overallStats.avgProfitChange, false)}`}>
                  {overallStats.avgProfitChange > 0 ? '+' : ''}{overallStats.avgProfitChange.toFixed(1)}%
                </span>
                {getChangeIcon(overallStats.avgProfitChange)}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {formatCurrency(Math.abs(overallStats.totalProfitDifference))} total difference
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Quote Availability</p>
              <div className="flex items-center space-x-2">
                <span className={`text-2xl font-bold ${getChangeColor(overallStats.carrierAvailabilityChange, false)}`}>
                  {overallStats.carrierAvailabilityChange > 0 ? '+' : ''}{overallStats.carrierAvailabilityChange}
                </span>
                {getChangeIcon(overallStats.carrierAvailabilityChange)}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {newResponses.length} vs {originalResponses.length} quotes
              </p>
            </div>
            <Truck className="h-8 w-8 text-purple-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Better Pricing</p>
              <div className="flex items-center space-x-2">
                <span className="text-2xl font-bold text-green-600">
                  {overallStats.betterPricingCount}
                </span>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                of {requestComparisons.length} shipments improved
              </p>
            </div>
            <Target className="h-8 w-8 text-green-500" />
          </div>
        </div>
      </div>

      {/* Detailed Breakdown */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Pricing Impact Breakdown</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">{overallStats.betterPricingCount}</div>
            <div className="text-sm text-gray-600">Better Pricing</div>
            <div className="text-xs text-gray-500">Lower cost than original</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-red-600">{overallStats.worsePricingCount}</div>
            <div className="text-sm text-gray-600">Higher Pricing</div>
            <div className="text-xs text-gray-500">Higher cost than original</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-gray-600">{overallStats.unchangedCount}</div>
            <div className="text-sm text-gray-600">Unchanged</div>
            <div className="text-xs text-gray-500">Similar pricing</div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderCarriers = () => (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Carrier Performance Comparison</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Carrier</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quote Count</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg Price Change</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg Profit Change</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Impact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {carrierComparisons.map((carrier) => (
                <tr key={carrier.carrierName} className="hover:bg-gray-50">
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">{carrier.carrierName}</div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-600">
                      {carrier.newCount} vs {carrier.originalCount}
                      {carrier.newCount !== carrier.originalCount && (
                        <span className={`ml-2 ${getChangeColor(carrier.newCount - carrier.originalCount, false)}`}>
                          ({carrier.newCount > carrier.originalCount ? '+' : ''}{carrier.newCount - carrier.originalCount})
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <span className={`font-medium ${getChangeColor(carrier.priceChangePercent)}`}>
                        {carrier.priceChangePercent > 0 ? '+' : ''}{carrier.priceChangePercent.toFixed(1)}%
                      </span>
                      {getChangeIcon(carrier.priceChangePercent)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatCurrency(carrier.newAvgPrice)} vs {formatCurrency(carrier.originalAvgPrice)}
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <span className={`font-medium ${getChangeColor(carrier.profitChangePercent, false)}`}>
                        {carrier.profitChangePercent > 0 ? '+' : ''}{carrier.profitChangePercent.toFixed(1)}%
                      </span>
                      {getChangeIcon(carrier.profitChangePercent)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatCurrency(carrier.newAvgProfit)} vs {formatCurrency(carrier.originalAvgProfit)}
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    {Math.abs(carrier.priceChangePercent) > 5 ? (
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        carrier.priceChangePercent < 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {carrier.priceChangePercent < 0 ? 'Significant Improvement' : 'Significant Increase'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        Minimal Change
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderRequests = () => (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Shipment-by-Shipment Comparison</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Route</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Best Price Change</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quote Availability</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Impact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {requestComparisons.map((request) => (
                <tr key={request.requestId} className="hover:bg-gray-50">
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">{request.route}</div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-600">
                      {request.pallets} pallets, {request.weight.toLocaleString()} lbs
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <span className={`font-medium ${getChangeColor(request.priceChangePercent)}`}>
                        {request.priceChangePercent > 0 ? '+' : ''}{request.priceChangePercent.toFixed(1)}%
                      </span>
                      {getChangeIcon(request.priceChangePercent)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatCurrency(request.newBestPrice)} vs {formatCurrency(request.originalBestPrice)}
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-600">
                      {request.newQuoteCount} vs {request.originalQuoteCount}
                      {request.availabilityChange !== 0 && (
                        <span className={`ml-2 ${getChangeColor(request.availabilityChange, false)}`}>
                          ({request.availabilityChange > 0 ? '+' : ''}{request.availabilityChange})
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    {Math.abs(request.priceChangePercent) > 10 ? (
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        request.priceChangePercent < 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {request.priceChangePercent < 0 ? 'Major Savings' : 'Major Increase'}
                      </span>
                    ) : Math.abs(request.priceChangePercent) > 3 ? (
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        request.priceChangePercent < 0 ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {request.priceChangePercent < 0 ? 'Moderate Savings' : 'Moderate Increase'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        Minimal Change
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-7xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">Batch Analytics: {originalBatch.batch_name}</h2>
              <p className="text-blue-100 text-sm">
                Comparing original results from {new Date(originalBatch.created_at).toLocaleDateString()} with current market conditions
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 transition-colors"
            >
              <span className="sr-only">Close</span>
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {[
              { id: 'overview', label: 'Overview', icon: BarChart3 },
              { id: 'carriers', label: 'Carrier Analysis', icon: Truck },
              { id: 'requests', label: 'Shipment Analysis', icon: Target }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 py-4 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[calc(90vh-180px)] overflow-y-auto">
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'carriers' && renderCarriers()}
          {activeTab === 'requests' && renderRequests()}
        </div>
      </div>
    </div>
  );
};