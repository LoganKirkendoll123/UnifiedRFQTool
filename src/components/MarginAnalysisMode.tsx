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
  Save
} from 'lucide-react';
import { BatchData, BatchRequest, BatchResponse, Project44APIClient, FreshXAPIClient } from '../utils/apiClient';
import { formatCurrency } from '../utils/pricingCalculator';
import { RFQProcessor } from '../utils/rfqProcessor';
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
  originalAvgPrice: number;
  newAvgPrice: number;
  priceChange: number;
  priceChangePercent: number;
  quoteCount: number;
  recommendedMargin: number;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
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
  const [newResponses, setNewResponses] = useState<BatchResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [analysis, setAnalysis] = useState<CarrierMarginAnalysis[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0, item: '' });
  const [error, setError] = useState<string>('');
  const [debugInfo, setDebugInfo] = useState<{
    originalCarriers: string[];
    newCarriers: string[];
    matchedCarriers: string[];
  } | null>(null);

  useEffect(() => {
    loadBatches();
  }, []);

  const loadBatches = async () => {
    if (!project44Client) return;

    try {
      console.log('📋 Loading batches for margin analysis...');
      const allBatches = await project44Client.getAllBatches();
      // Filter to only batches with data
      const batchesWithData = allBatches.filter(batch => batch.total_rfqs > 0 && batch.total_quotes > 0);
      setBatches(batchesWithData);
      console.log(`✅ Loaded ${batchesWithData.length} batches with data`);
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
      setNewResponses([]);
      setAnalysis([]);
      
      console.log(`✅ Loaded ${requests.length} requests and ${responses.length} responses`);
    } catch (error) {
      console.error('❌ Failed to load batch details:', error);
    }
  };

  const reprocessForMarginAnalysis = async () => {
    if (!selectedBatch || !project44Client || !freshxClient || batchRequests.length === 0) {
      console.error('❌ Missing required data for margin analysis');
      setError('Missing required data for margin analysis');
      return;
    }

    setProcessing(true);
    setNewResponses([]);
    setAnalysis([]);
    setError('');
    setDebugInfo(null);

    try {
      console.log(`🔄 Reprocessing batch for margin analysis: ${selectedBatch.batch_name}`);
      
      // Create RFQ processor
      const processor = new RFQProcessor(project44Client, freshxClient);
      
      // Create a new batch for comparison
      const newBatchName = `${selectedBatch.batch_name} - Margin Analysis ${new Date().toISOString().split('T')[0]}`;
      const newBatchId = await processor.createBatch(newBatchName, {
        selectedCarriers: selectedBatch.selected_carriers || {},
        pricingSettings,
        selectedCustomer,
        createdBy: 'margin-analysis'
      });
      
      console.log(`✅ Created analysis batch: ${newBatchId}`);
      
      // Convert batch requests back to RFQ format
      const rfqs = batchRequests.map(request => request.request_payload);
      
      // Process with current settings
      await processor.processMultipleRFQs(rfqs, {
        selectedCarriers: selectedBatch.selected_carriers || {},
        pricingSettings,
        selectedCustomer,
        batchName: newBatchName,
        createdBy: 'margin-analysis',
        onProgress: (current, total, item) => {
          setProgress({ current, total, item: item || '' });
        }
      });
      
      // Load the new responses
      const newBatchResponses = await project44Client.getBatchResponses(newBatchId);
      setNewResponses(newBatchResponses);
      
      console.log(`✅ Margin analysis completed: ${newBatchResponses.length} new responses`);
      
      // Calculate margin analysis
      if (newBatchResponses.length === 0) {
        setError('No quotes received during reprocessing. Check your API credentials and carrier selection.');
        return;
      }
      
      calculateMarginAnalysis(originalResponses, newBatchResponses);
      
    } catch (error) {
      console.error('❌ Failed to reprocess for margin analysis:', error);
      setError(`Failed to reprocess batch: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setProcessing(false);
      setProgress({ current: 0, total: 0, item: '' });
    }
  };

  const calculateMarginAnalysis = (originalResponses: BatchResponse[], newResponses: BatchResponse[]) => {
    console.log('🧮 Calculating carrier margin analysis...');
    console.log(`📊 Original responses: ${originalResponses.length}, New responses: ${newResponses.length}`);
    
    // Group responses by carrier
    const originalByCarrier = groupResponsesByCarrier(originalResponses);
    const newByCarrier = groupResponsesByCarrier(newResponses);
    
    // Debug information
    const originalCarriers = Object.keys(originalByCarrier);
    const newCarriers = Object.keys(newByCarrier);
    const matchedCarriers = originalCarriers.filter(carrier => newByCarrier[carrier]);
    
    console.log(`📊 Original carriers: ${originalCarriers.length}`, originalCarriers);
    console.log(`📊 New carriers: ${newCarriers.length}`, newCarriers);
    console.log(`📊 Matched carriers: ${matchedCarriers.length}`, matchedCarriers);
    
    setDebugInfo({
      originalCarriers,
      newCarriers,
      matchedCarriers
    });
    
    if (matchedCarriers.length === 0) {
      setError('No matching carriers found between original and new quotes. This could be due to different carrier selection or API issues.');
      return;
    }
    
    const carrierAnalyses: CarrierMarginAnalysis[] = [];
    
    // Only analyze carriers that appear in both datasets
    matchedCarriers.forEach(carrierName => {
      const originalQuotes = originalByCarrier[carrierName] || [];
      const newQuotes = newByCarrier[carrierName] || [];
      
      // Skip if we don't have sufficient quotes
      if (originalQuotes.length === 0 || newQuotes.length === 0) {
        console.log(`⚠️ Skipping ${carrierName}: original=${originalQuotes.length}, new=${newQuotes.length}`);
        return;
      }
      
      console.log(`✅ Analyzing ${carrierName}: original=${originalQuotes.length}, new=${newQuotes.length} quotes`);
      
      const originalAvgPrice = originalQuotes.reduce((sum, q) => sum + q.customer_price, 0) / originalQuotes.length;
      const newAvgPrice = newQuotes.reduce((sum, q) => sum + q.customer_price, 0) / newQuotes.length;
      
      const priceChange = newAvgPrice - originalAvgPrice;
      const priceChangePercent = originalAvgPrice > 0 ? (priceChange / originalAvgPrice) * 100 : 0;
      
      // Calculate recommended margin based on price differences
      const { recommendedMargin, confidence, reasoning } = calculateRecommendedMargin(
        originalQuotes,
        newQuotes,
        priceChangePercent
      );
      
      carrierAnalyses.push({
        carrierName,
        carrierScac: originalQuotes[0]?.carrier_scac || newQuotes[0]?.carrier_scac,
        originalAvgPrice,
        newAvgPrice,
        priceChange,
        priceChangePercent,
        quoteCount: Math.min(originalQuotes.length, newQuotes.length),
        recommendedMargin,
        confidence,
        reasoning
      });
    });
    
    console.log(`✅ Generated analysis for ${carrierAnalyses.length} carriers`);
    
    if (carrierAnalyses.length === 0) {
      setError('No carrier analysis could be generated. All carriers may have been filtered out due to insufficient quote data.');
      return;
    }
    
    // Sort by price change impact (most significant first)
    carrierAnalyses.sort((a, b) => Math.abs(b.priceChangePercent) - Math.abs(a.priceChangePercent));
    
    setAnalysis(carrierAnalyses);
    console.log(`✅ Calculated margin analysis for ${carrierAnalyses.length} carriers`);
  };

  const calculateRecommendedMargin = (
    originalQuotes: BatchResponse[],
    newQuotes: BatchResponse[],
    priceChangePercent: number
  ) => {
    // Get current margin from new quotes
    const avgCurrentMargin = newQuotes.reduce((sum, q) => sum + (q.applied_margin_percentage || 0), 0) / newQuotes.length;
    
    let recommendedMargin = avgCurrentMargin;
    let confidence: 'high' | 'medium' | 'low' = 'medium';
    let reasoning = 'Standard margin maintained';
    
    if (priceChangePercent < -10) {
      // Significant cost reduction - can afford higher margin
      recommendedMargin = avgCurrentMargin + 3;
      confidence = 'high';
      reasoning = 'Significant cost reduction allows for higher margin';
    } else if (priceChangePercent < -5) {
      // Moderate cost reduction
      recommendedMargin = avgCurrentMargin + 1.5;
      confidence = 'high';
      reasoning = 'Cost reduction allows for margin increase';
    } else if (priceChangePercent > 10) {
      // Significant cost increase - may need lower margin to stay competitive
      recommendedMargin = Math.max(avgCurrentMargin - 2, 15); // Don't go below 15%
      confidence = 'medium';
      reasoning = 'Cost increase may require lower margin for competitiveness';
    } else if (priceChangePercent > 5) {
      // Moderate cost increase
      recommendedMargin = Math.max(avgCurrentMargin - 1, 18); // Don't go below 18%
      confidence = 'medium';
      reasoning = 'Slight margin reduction to maintain competitiveness';
    } else {
      // Minimal change
      confidence = 'low';
      reasoning = 'Minimal cost change - current margin appropriate';
    }
    
    // Round to 1 decimal place
    recommendedMargin = Math.round(recommendedMargin * 10) / 10;
    
    return { recommendedMargin, confidence, reasoning };
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
      case 'high': return 'text-green-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getPriceChangeColor = (change: number) => {
    if (change > 0) return 'text-red-600';
    if (change < 0) return 'text-green-600';
    return 'text-gray-600';
  };

  const saveMarginRecommendations = async () => {
    if (!project44Client || !selectedCustomer || analysis.length === 0) return;

    try {
      console.log(`💾 Saving margin recommendations for customer: ${selectedCustomer}`);
      
      // Here you would typically save to a customer-carrier margins table
      // For now, we'll just call the callback
      analysis.forEach(carrierAnalysis => {
        if (carrierAnalysis.confidence === 'high' || carrierAnalysis.confidence === 'medium') {
          onMarginRecommendation(
            selectedCustomer,
            carrierAnalysis.carrierName,
            carrierAnalysis.recommendedMargin
          );
        }
      });
      
      console.log('✅ Margin recommendations saved');
    } catch (error) {
      console.error('❌ Failed to save margin recommendations:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Batch Selection */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Past Batch for Analysis</h3>
        
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader className="h-6 w-6 text-blue-500 animate-spin" />
            <span className="ml-2 text-gray-600">Loading batches...</span>
          </div>
        ) : batches.length === 0 ? (
          <div className="text-center py-8">
            <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
            <p className="text-gray-600">No batches with quote data found. Process some RFQs first.</p>
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
                      {batch.customer_name && <div>Customer: {batch.customer_name}</div>}
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
      {selectedBatch && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Margin Analysis Setup</h3>
              <p className="text-sm text-gray-600 mt-1">
                Reprocess "{selectedBatch.batch_name}" with current pricing settings to analyze margin opportunities
              </p>
            </div>
            
            <button
              onClick={reprocessForMarginAnalysis}
              disabled={processing || batchRequests.length === 0}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {processing ? (
                <>
                  <Loader className="h-4 w-4 animate-spin" />
                  <span>Analyzing...</span>
                </>
              ) : (
                <>
                  <Calculator className="h-4 w-4" />
                  <span>Start Margin Analysis</span>
                </>
              )}
            </button>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-red-800">
                  <p className="font-medium mb-1">Analysis Error:</p>
                  <p>{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Debug Information */}
          {debugInfo && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-2">Analysis Debug Information:</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <div className="font-medium">Original Carriers ({debugInfo.originalCarriers.length}):</div>
                    <div className="text-xs max-h-20 overflow-y-auto">
                      {debugInfo.originalCarriers.join(', ') || 'None'}
                    </div>
                  </div>
                  <div>
                    <div className="font-medium">New Carriers ({debugInfo.newCarriers.length}):</div>
                    <div className="text-xs max-h-20 overflow-y-auto">
                      {debugInfo.newCarriers.join(', ') || 'None'}
                    </div>
                  </div>
                  <div>
                    <div className="font-medium">Matched Carriers ({debugInfo.matchedCarriers.length}):</div>
                    <div className="text-xs max-h-20 overflow-y-auto">
                      {debugInfo.matchedCarriers.join(', ') || 'None'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Progress */}
          {processing && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center space-x-3">
                <Loader className="h-5 w-5 text-blue-600 animate-spin" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-blue-900">
                    Processing {progress.current} of {progress.total}
                  </div>
                  <div className="text-xs text-blue-700">{progress.item}</div>
                  <div className="w-full bg-blue-200 rounded-full h-2 mt-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ 
                        width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` 
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Current Settings Display */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-sm text-gray-600">Customer</div>
              <div className="font-medium">{selectedCustomer || 'No customer selected'}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-sm text-gray-600">Pricing Method</div>
              <div className="font-medium">
                {pricingSettings.usesCustomerMargins ? 'Customer Margins' : 'Flat Margin'}
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-sm text-gray-600">Batch Data</div>
              <div className="font-medium">{batchRequests.length} RFQs, {originalResponses.length} quotes</div>
            </div>
          </div>
        </div>
      )}

      {/* Margin Analysis Results */}
      {analysis.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Carrier Margin Analysis Results</h3>
              <p className="text-sm text-gray-600 mt-1">
                Recommended margins per carrier based on price change analysis
              </p>
            </div>
            
            {selectedCustomer && (
              <button
                onClick={saveMarginRecommendations}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Save className="h-4 w-4" />
                <span>Save Recommendations</span>
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Carrier</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price Change</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Current Margin</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recommended</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Confidence</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reasoning</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {analysis.map((carrierAnalysis) => {
                  const currentAvgMargin = newResponses
                    .filter(r => r.carrier_name === carrierAnalysis.carrierName)
                    .reduce((sum, r, _, arr) => sum + (r.applied_margin_percentage || 0) / arr.length, 0);

                  return (
                    <tr key={carrierAnalysis.carrierName} className="hover:bg-gray-50">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div>
                          <div className="font-medium text-gray-900">{carrierAnalysis.carrierName}</div>
                          {carrierAnalysis.carrierScac && (
                            <div className="text-sm text-gray-500">SCAC: {carrierAnalysis.carrierScac}</div>
                          )}
                        </div>
                      </td>
                      
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <div className={`font-medium ${getPriceChangeColor(carrierAnalysis.priceChangePercent)}`}>
                            {carrierAnalysis.priceChangePercent > 0 ? '+' : ''}{carrierAnalysis.priceChangePercent.toFixed(1)}%
                          </div>
                          {carrierAnalysis.priceChangePercent > 0 ? (
                            <TrendingUp className="h-4 w-4 text-red-500" />
                          ) : carrierAnalysis.priceChangePercent < 0 ? (
                            <TrendingDown className="h-4 w-4 text-green-500" />
                          ) : null}
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatCurrency(carrierAnalysis.originalAvgPrice)} → {formatCurrency(carrierAnalysis.newAvgPrice)}
                        </div>
                      </td>
                      
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="font-medium">{currentAvgMargin.toFixed(1)}%</div>
                        <div className="text-xs text-gray-500">{carrierAnalysis.quoteCount} quotes</div>
                      </td>
                      
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <div className="font-bold text-green-600">{carrierAnalysis.recommendedMargin.toFixed(1)}%</div>
                          {carrierAnalysis.recommendedMargin > currentAvgMargin ? (
                            <ArrowRight className="h-4 w-4 text-green-500" />
                          ) : carrierAnalysis.recommendedMargin < currentAvgMargin ? (
                            <ArrowRight className="h-4 w-4 text-red-500 transform rotate-180" />
                          ) : null}
                        </div>
                        <div className="text-xs text-gray-500">
                          {((carrierAnalysis.recommendedMargin - currentAvgMargin) > 0 ? '+' : '')}
                          {(carrierAnalysis.recommendedMargin - currentAvgMargin).toFixed(1)}% change
                        </div>
                      </td>
                      
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          carrierAnalysis.confidence === 'high' ? 'bg-green-100 text-green-800' :
                          carrierAnalysis.confidence === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {carrierAnalysis.confidence.toUpperCase()}
                        </span>
                      </td>
                      
                      <td className="px-4 py-4">
                        <div className="text-sm text-gray-600 max-w-xs">
                          {carrierAnalysis.reasoning}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Analysis Summary */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="text-sm font-medium text-blue-900 mb-2">Analysis Summary</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-blue-700">High Confidence Recommendations:</div>
                <div className="font-bold text-blue-900">
                  {analysis.filter(a => a.confidence === 'high').length} carriers
                </div>
              </div>
              <div>
                <div className="text-blue-700">Margin Increase Opportunities:</div>
                <div className="font-bold text-blue-900">
                  {analysis.filter(a => a.priceChangePercent < -5).length} carriers
                </div>
              </div>
              <div>
                <div className="text-blue-700">Competitive Pressure:</div>
                <div className="font-bold text-blue-900">
                  {analysis.filter(a => a.priceChangePercent > 5).length} carriers
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};