import React, { useState, useEffect } from 'react';
import { 
  Calculator,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Building2,
  Target,
  ArrowRight,
  BarChart3,
  CheckCircle,
  AlertTriangle,
  Info,
  Loader,
  RefreshCw,
  Save,
  Award
} from 'lucide-react';
import { BatchData, BatchRequest, BatchResponse, Project44APIClient, FreshXAPIClient } from '../utils/apiClient';
import { formatCurrency } from '../utils/pricingCalculator';
import { PricingSettings } from '../types';

interface MarginAnalysisModeProps {
  project44Client: Project44APIClient | null;
  freshxClient: FreshXAPIClient | null;
  pricingSettings: PricingSettings;
  selectedCustomer: string;
  onMarginRecommendation: (customer: string, carrier: string, recommendedMargin: number) => void;
}

interface CarrierMarginAnalysis {
  carrierName: string;
  carrierScac?: string;
  quotesAnalyzed: number;
  avgCarrierRate: number;
  avgCustomerPrice: number;
  currentMarginPercent: number;
  avgProfitPerShipment: number;
  recommendedMargin: number;
  potentialProfitIncrease: number;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  marginConsistency: number; // How consistent margins are across quotes
}

export const MarginAnalysisMode: React.FC<MarginAnalysisModeProps> = ({
  project44Client,
  freshxClient,
  pricingSettings,
  selectedCustomer,
  onMarginRecommendation
}) => {
  const [batches, setBatches] = useState<BatchData[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<BatchData | null>(null);
  const [batchRequests, setBatchRequests] = useState<BatchRequest[]>([]);
  const [originalResponses, setOriginalResponses] = useState<BatchResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<CarrierMarginAnalysis[]>([]);
  const [overallStats, setOverallStats] = useState({
    totalQuotes: 0,
    avgMargin: 0,
    totalProfitOpportunity: 0,
    carriersAnalyzed: 0
  });

  useEffect(() => {
    loadBatches();
  }, []);

  const loadBatches = async () => {
    if (!project44Client) return;

    try {
      console.log('📋 Loading batches for margin analysis...');
      const allBatches = await project44Client.getAllBatches();
      // Filter to only batches with substantial quote data
      const batchesWithData = allBatches.filter(batch => 
        batch.total_rfqs > 0 && 
        batch.total_quotes >= 5 && // At least 5 quotes for meaningful analysis
        batch.customer_name // Only batches with customer context
      );
      setBatches(batchesWithData);
      console.log(`✅ Loaded ${batchesWithData.length} batches suitable for margin analysis`);
    } catch (error) {
      console.error('❌ Failed to load batches:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadBatchDetails = async (batch: BatchData) => {
    if (!project44Client) return;

    try {
      console.log(`📋 Loading details for batch ${batch.id}...`);
      setSelectedBatch(batch);
      
      const [requests, responses] = await Promise.all([
        project44Client.getBatchRequests(batch.id),
        project44Client.getBatchResponses(batch.id)
      ]);
      
      setBatchRequests(requests);
      setOriginalResponses(responses);
      setAnalysis([]);
      
      console.log(`✅ Loaded ${requests.length} requests and ${responses.length} responses`);
    } catch (error) {
      console.error('❌ Failed to load batch details:', error);
    }
  };

  const analyzeExistingMargins = async () => {
    if (!selectedBatch || originalResponses.length === 0) {
      console.error('❌ No batch or responses to analyze');
      return;
    }

    setAnalyzing(true);

    try {
      console.log(`🧮 Analyzing margins for ${originalResponses.length} quotes in batch: ${selectedBatch.batch_name}`);
      
      // Group responses by carrier
      const carrierGroups = groupResponsesByCarrier(originalResponses);
      const carrierAnalyses: CarrierMarginAnalysis[] = [];
      
      // Analyze each carrier
      Object.entries(carrierGroups).forEach(([carrierName, quotes]) => {
        if (quotes.length < 2) {
          console.log(`⚠️ Skipping ${carrierName}: Only ${quotes.length} quote(s) - insufficient data`);
          return;
        }

        console.log(`📊 Analyzing ${carrierName}: ${quotes.length} quotes`);
        
        const analysis = analyzeCarrierMargins(carrierName, quotes);
        if (analysis) {
          carrierAnalyses.push(analysis);
        }
      });

      // Sort by potential profit increase (highest opportunity first)
      carrierAnalyses.sort((a, b) => b.potentialProfitIncrease - a.potentialProfitIncrease);
      
      setAnalysis(carrierAnalyses);
      
      // Calculate overall statistics
      const totalQuotes = originalResponses.length;
      const avgMargin = originalResponses.reduce((sum, r) => sum + (r.applied_margin_percentage || 0), 0) / totalQuotes;
      const totalProfitOpportunity = carrierAnalyses.reduce((sum, a) => sum + a.potentialProfitIncrease, 0);
      
      setOverallStats({
        totalQuotes,
        avgMargin,
        totalProfitOpportunity,
        carriersAnalyzed: carrierAnalyses.length
      });
      
      console.log(`✅ Margin analysis complete: ${carrierAnalyses.length} carriers analyzed`);
      
    } catch (error) {
      console.error('❌ Failed to analyze margins:', error);
    } finally {
      setAnalyzing(false);
    }
  };

  const analyzeCarrierMargins = (carrierName: string, quotes: BatchResponse[]): CarrierMarginAnalysis | null => {
    // Extract carrier rates and customer prices
    const validQuotes = quotes.filter(q => q.carrier_total_rate > 0 && q.customer_price > 0);
    
    if (validQuotes.length === 0) {
      console.log(`⚠️ No valid quotes for ${carrierName}`);
      return null;
    }

    const avgCarrierRate = validQuotes.reduce((sum, q) => sum + q.carrier_total_rate, 0) / validQuotes.length;
    const avgCustomerPrice = validQuotes.reduce((sum, q) => sum + q.customer_price, 0) / validQuotes.length;
    const avgProfitPerShipment = validQuotes.reduce((sum, q) => sum + q.profit, 0) / validQuotes.length;
    
    // Current margin percentage (profit / customer price)
    const currentMarginPercent = avgCustomerPrice > 0 ? (avgProfitPerShipment / avgCustomerPrice) * 100 : 0;
    
    // Calculate margin consistency (how much margins vary)
    const margins = validQuotes.map(q => q.customer_price > 0 ? (q.profit / q.customer_price) * 100 : 0);
    const marginVariance = calculateVariance(margins);
    const marginConsistency = Math.max(0, 100 - marginVariance); // Higher = more consistent
    
    // Determine recommended margin based on various factors
    const { recommendedMargin, confidence, reasoning } = calculateOptimalMargin(
      avgCarrierRate,
      avgCustomerPrice,
      currentMarginPercent,
      marginConsistency,
      validQuotes.length,
      selectedBatch.customer_name || ''
    );
    
    // Calculate potential profit increase per shipment
    const recommendedCustomerPrice = avgCarrierRate / (1 - recommendedMargin / 100);
    const recommendedProfit = recommendedCustomerPrice - avgCarrierRate;
    const potentialProfitIncrease = Math.max(0, recommendedProfit - avgProfitPerShipment);

    return {
      carrierName,
      carrierScac: validQuotes[0]?.carrier_scac,
      quotesAnalyzed: validQuotes.length,
      avgCarrierRate,
      avgCustomerPrice,
      currentMarginPercent,
      avgProfitPerShipment,
      recommendedMargin,
      potentialProfitIncrease,
      confidence,
      reasoning,
      marginConsistency
    };
  };

  const calculateOptimalMargin = (
    avgCarrierRate: number,
    avgCustomerPrice: number,
    currentMarginPercent: number,
    marginConsistency: number,
    quoteCount: number,
    customerName: string
  ) => {
    let recommendedMargin = currentMarginPercent;
    let confidence: 'high' | 'medium' | 'low' = 'medium';
    let reasoning = 'Current margin maintained';

    // Base confidence on data quality
    if (quoteCount >= 10 && marginConsistency >= 70) {
      confidence = 'high';
    } else if (quoteCount >= 5 && marginConsistency >= 50) {
      confidence = 'medium';
    } else {
      confidence = 'low';
    }

    // Industry standard margins for freight
    const industryMinMargin = 18;
    const industryTargetMargin = 25;
    const industryMaxMargin = 35;

    // Analyze current performance
    if (currentMarginPercent < industryMinMargin) {
      // Below industry minimum - needs improvement
      recommendedMargin = Math.min(industryMinMargin + 2, currentMarginPercent + 5);
      reasoning = `Below industry minimum (${industryMinMargin}%) - gradual increase recommended`;
    } else if (currentMarginPercent < industryTargetMargin) {
      // Below target but above minimum - room for improvement
      recommendedMargin = Math.min(industryTargetMargin, currentMarginPercent + 3);
      reasoning = `Below industry target (${industryTargetMargin}%) - margin increase opportunity`;
    } else if (currentMarginPercent > industryMaxMargin) {
      // Very high margin - may be uncompetitive
      recommendedMargin = Math.max(industryTargetMargin, currentMarginPercent - 2);
      reasoning = `Above typical range (${industryMaxMargin}%) - consider slight reduction for competitiveness`;
      confidence = confidence === 'high' ? 'medium' : 'low'; // Lower confidence for high margins
    } else {
      // In good range - minor optimization
      if (marginConsistency < 60) {
        recommendedMargin = currentMarginPercent + 1;
        reasoning = 'Good margin range but inconsistent - slight standardization increase';
      } else {
        recommendedMargin = currentMarginPercent;
        reasoning = 'Margin in optimal range and consistent';
      }
    }

    // Customer-specific adjustments
    if (customerName.toLowerCase().includes('premium') || customerName.toLowerCase().includes('enterprise')) {
      recommendedMargin += 2;
      reasoning += ' (premium customer adjustment)';
    }

    // Round to 1 decimal place and ensure reasonable bounds
    recommendedMargin = Math.round(Math.max(15, Math.min(40, recommendedMargin)) * 10) / 10;

    return { recommendedMargin, confidence, reasoning };
  };

  const calculateVariance = (values: number[]): number => {
    if (values.length <= 1) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length;
    
    return Math.sqrt(variance); // Return standard deviation as percentage
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

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getMarginChangeColor = (current: number, recommended: number) => {
    const diff = recommended - current;
    if (diff > 1) return 'text-green-600';
    if (diff < -1) return 'text-red-600';
    return 'text-gray-600';
  };

  const saveMarginRecommendations = async () => {
    if (!selectedCustomer || analysis.length === 0) return;

    try {
      console.log(`💾 Saving margin recommendations for customer: ${selectedCustomer}`);
      
      // Save high and medium confidence recommendations
      const recommendationsToSave = analysis.filter(a => 
        a.confidence === 'high' || 
        (a.confidence === 'medium' && a.potentialProfitIncrease > 50)
      );
      
      recommendationsToSave.forEach(carrierAnalysis => {
        onMarginRecommendation(
          selectedCustomer,
          carrierAnalysis.carrierName,
          carrierAnalysis.recommendedMargin
        );
      });
      
      console.log(`✅ Saved ${recommendationsToSave.length} margin recommendations`);
    } catch (error) {
      console.error('❌ Failed to save margin recommendations:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Batch Selection */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Batch for Margin Analysis</h3>
        <p className="text-sm text-gray-600 mb-4">
          Analyze existing quotes to determine optimal customer-carrier margins based on historical pricing data.
        </p>
        
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader className="h-6 w-6 text-blue-500 animate-spin" />
            <span className="ml-2 text-gray-600">Loading batches...</span>
          </div>
        ) : batches.length === 0 ? (
          <div className="text-center py-8">
            <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
            <p className="text-gray-600">No suitable batches found. Need batches with customer context and at least 5 quotes.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {batches.map((batch) => (
              <div
                key={batch.id}
                onClick={() => loadBatchDetails(batch)}
                className={`p-4 border rounded-lg cursor-pointer transition-all duration-200 hover:shadow-md ${
                  selectedBatch?.id === batch.id
                    ? 'border-green-500 bg-green-50 shadow-sm'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 truncate">{batch.batch_name}</h4>
                    <div className="mt-2 space-y-1 text-sm text-gray-600">
                      <div>{batch.total_rfqs} RFQs • {batch.total_quotes} quotes</div>
                      <div>{new Date(batch.created_at).toLocaleDateString()}</div>
                      <div className="font-medium text-blue-600">Customer: {batch.customer_name}</div>
                    </div>
                  </div>
                  {selectedBatch?.id === batch.id && (
                    <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Analysis Controls */}
      {selectedBatch && originalResponses.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Margin Analysis</h3>
              <p className="text-sm text-gray-600 mt-1">
                Analyze {originalResponses.length} existing quotes from "{selectedBatch.batch_name}" to determine optimal margins
              </p>
            </div>
            
            <button
              onClick={analyzeExistingMargins}
              disabled={analyzing}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {analyzing ? (
                <>
                  <Loader className="h-4 w-4 animate-spin" />
                  <span>Analyzing...</span>
                </>
              ) : (
                <>
                  <Calculator className="h-4 w-4" />
                  <span>Analyze Margins</span>
                </>
              )}
            </button>
          </div>

          {/* Batch Info */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-sm text-gray-600">Customer</div>
              <div className="font-medium">{selectedBatch.customer_name}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-sm text-gray-600">Total Quotes</div>
              <div className="font-medium">{originalResponses.length}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-sm text-gray-600">Unique Carriers</div>
              <div className="font-medium">
                {new Set(originalResponses.map(r => r.carrier_name)).size}
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-sm text-gray-600">Date Range</div>
              <div className="font-medium">{new Date(selectedBatch.created_at).toLocaleDateString()}</div>
            </div>
          </div>
        </div>
      )}

      {/* Analysis Results */}
      {analysis.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Margin Optimization Results</h3>
              <p className="text-sm text-gray-600 mt-1">
                Customer-carrier margin recommendations based on historical quote analysis
              </p>
            </div>
            
            {selectedCustomer && (
              <button
                onClick={saveMarginRecommendations}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Save className="h-4 w-4" />
                <span>Save High-Value Recommendations</span>
              </button>
            )}
          </div>

          {/* Overall Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-600">{overallStats.carriersAnalyzed}</div>
              <div className="text-sm text-blue-700">Carriers Analyzed</div>
              <div className="text-xs text-blue-600">From {overallStats.totalQuotes} total quotes</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-600">{overallStats.avgMargin.toFixed(1)}%</div>
              <div className="text-sm text-green-700">Current Avg Margin</div>
              <div className="text-xs text-green-600">Across all carriers</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-purple-600">{formatCurrency(overallStats.totalProfitOpportunity)}</div>
              <div className="text-sm text-purple-700">Total Profit Opportunity</div>
              <div className="text-xs text-purple-600">Per shipment improvement</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-orange-600">
                {analysis.filter(a => a.confidence === 'high').length}
              </div>
              <div className="text-sm text-orange-700">High Confidence</div>
              <div className="text-xs text-orange-600">Recommendations</div>
            </div>
          </div>

          {/* Carrier Analysis Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Carrier</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Current Margin</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recommended</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Profit Increase</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data Quality</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Confidence</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reasoning</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {analysis.map((carrierAnalysis) => (
                  <tr key={carrierAnalysis.carrierName} className="hover:bg-gray-50">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div>
                        <div className="font-medium text-gray-900">{carrierAnalysis.carrierName}</div>
                        {carrierAnalysis.carrierScac && (
                          <div className="text-sm text-gray-500">SCAC: {carrierAnalysis.carrierScac}</div>
                        )}
                        <div className="text-xs text-gray-400">{carrierAnalysis.quotesAnalyzed} quotes analyzed</div>
                      </div>
                    </td>
                    
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="font-medium">{carrierAnalysis.currentMarginPercent.toFixed(1)}%</div>
                      <div className="text-sm text-gray-500">{formatCurrency(carrierAnalysis.avgProfitPerShipment)} avg profit</div>
                    </td>
                    
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <div className={`font-bold ${getMarginChangeColor(carrierAnalysis.currentMarginPercent, carrierAnalysis.recommendedMargin)}`}>
                          {carrierAnalysis.recommendedMargin.toFixed(1)}%
                        </div>
                        {carrierAnalysis.recommendedMargin > carrierAnalysis.currentMarginPercent && (
                          <TrendingUp className="h-4 w-4 text-green-500" />
                        )}
                        {carrierAnalysis.recommendedMargin < carrierAnalysis.currentMarginPercent && (
                          <TrendingDown className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        {((carrierAnalysis.recommendedMargin - carrierAnalysis.currentMarginPercent) > 0 ? '+' : '')}
                        {(carrierAnalysis.recommendedMargin - carrierAnalysis.currentMarginPercent).toFixed(1)}% change
                      </div>
                    </td>
                    
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="font-bold text-green-600">{formatCurrency(carrierAnalysis.potentialProfitIncrease)}</div>
                      <div className="text-xs text-gray-500">per shipment</div>
                    </td>
                    
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm">
                        <div>{carrierAnalysis.marginConsistency.toFixed(0)}% consistent</div>
                        <div className="text-xs text-gray-500">{carrierAnalysis.quotesAnalyzed} quotes</div>
                      </div>
                    </td>
                    
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getConfidenceColor(carrierAnalysis.confidence)}`}>
                        {carrierAnalysis.confidence.toUpperCase()}
                      </span>
                    </td>
                    
                    <td className="px-4 py-4">
                      <div className="text-sm text-gray-600 max-w-xs">
                        {carrierAnalysis.reasoning}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Industry Benchmarks */}
          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h4 className="text-sm font-medium text-yellow-900 mb-2 flex items-center space-x-2">
              <Award className="h-4 w-4" />
              <span>Industry Margin Benchmarks</span>
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-yellow-700">Minimum Acceptable:</div>
                <div className="font-bold text-yellow-900">18% - 20%</div>
              </div>
              <div>
                <div className="text-yellow-700">Industry Target:</div>
                <div className="font-bold text-yellow-900">25% - 28%</div>
              </div>
              <div>
                <div className="text-yellow-700">Premium Range:</div>
                <div className="font-bold text-yellow-900">30% - 35%</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};