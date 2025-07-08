import React, { useState, useEffect } from 'react';
import { 
  Calculator,
  Search,
  Users,
  Building2,
  TrendingUp,
  BarChart3,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Loader,
  Package,
  DollarSign,
  Target,
  Truck,
  Calendar,
  FileText,
  Download,
  ArrowRight,
  Filter,
  Zap,
  Award,
  History
} from 'lucide-react';
import { Project44APIClient, FreshXAPIClient, BatchData, BatchRequest, BatchResponse } from '../utils/apiClient';
import { PricingSettings } from '../types';
import { supabase } from '../utils/supabase';
import { formatCurrency } from '../utils/pricingCalculator';
import { RFQProcessor } from '../utils/rfqProcessor';

interface MarginAnalysisModeProps {
  project44Client: Project44APIClient | null;
  freshxClient: FreshXAPIClient | null;
  pricingSettings: PricingSettings;
  selectedCustomer: string;
  onMarginRecommendation: (customer: string, carrier: string, recommendedMargin: number) => void;
}

interface AnalysisProgress {
  phase: 'batches' | 'processing' | 'analyzing' | 'complete';
  current: number;
  total: number;
  item?: string;
}

interface CarrierAnalysis {
  carrierName: string;
  customerName: string;
  shipmentCount: number;
  avgRevenue: number;
  avgProfit: number;
  currentMargin: number;
  recommendedMargin: number;
  potentialImpact: number;
  confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW';
}

export const MarginAnalysisMode: React.FC<MarginAnalysisModeProps> = ({
  project44Client,
  freshxClient,
  pricingSettings,
  selectedCustomer,
  onMarginRecommendation
}) => {
  const [batches, setBatches] = useState<BatchData[]>([]);
  const [filteredBatches, setFilteredBatches] = useState<BatchData[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<BatchData | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<AnalysisProgress>({ phase: 'complete', current: 0, total: 0 });
  const [error, setError] = useState<string>('');
  const [analysis, setAnalysis] = useState<CarrierAnalysis[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [customers, setCustomers] = useState<string[]>([]);

  // Load customers using same batching approach as RFQ tool (for any customer-related functionality)
  useEffect(() => {
    loadCustomers();
  }, []);

  // Load all batches on component mount
  useEffect(() => {
    loadBatches();
  }, []);

  // Filter batches based on search
  useEffect(() => {
    if (searchTerm) {
      const filtered = batches.filter(batch =>
        batch.batch_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        batch.customer_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredBatches(filtered);
    } else {
      setFilteredBatches(batches);
    }
  }, [searchTerm, batches]);

  const loadCustomers = async () => {
    try {
      console.log('🔍 Loading all customers from CustomerCarriers...');
      
      // Load all customers without any limits - same as RFQ tool
      let allCustomers: any[] = [];
      let from = 0;
      const batchSize = 1000;
      let hasMore = true;
      
      while (hasMore) {
        console.log(`📋 Loading customer batch ${Math.floor(from / batchSize) + 1}: records ${from}-${from + batchSize - 1}`);
        
        const { data, error, count } = await supabase
          .from('CustomerCarriers')
          .select('InternalName', { count: 'exact' })
          .not('InternalName', 'is', null)
          .range(from, from + batchSize - 1);
        
        if (error) {
          throw error;
        }
        
        // Set total count from first batch
        if (from === 0 && count !== null) {
          console.log(`📊 Total customer records available: ${count}`);
        }
        
        if (data && data.length > 0) {
          allCustomers = [...allCustomers, ...data];
          from += batchSize;
          hasMore = data.length === batchSize; // Continue if we got a full batch
          
          console.log(`📋 Loaded customer batch: ${data.length} records (total loaded: ${allCustomers.length})`);
          
          // Small delay to prevent database overload
          await new Promise(resolve => setTimeout(resolve, 100));
        } else {
          hasMore = false;
        }
      }

      // Get unique customer names - same as RFQ tool
      const uniqueCustomers = [...new Set(allCustomers?.map(d => d.InternalName).filter(Boolean))].sort();
      setCustomers(uniqueCustomers);
      
      console.log(`✅ Loaded ${uniqueCustomers.length} unique customers from ${allCustomers.length} total records`);
    } catch (err) {
      console.error('❌ Failed to load customers:', err);
    }
  };

  const loadBatches = async () => {
    if (!project44Client) return;

    setLoading(true);
    setError('');
    setProgress({ phase: 'batches', current: 0, total: 0, item: 'Loading batches...' });

    try {
      console.log(`📋 Loading all batches for margin analysis...`);
      
      // Get all batches
      const allBatches = await project44Client.getAllBatches();
      const batchesWithQuotes = allBatches.filter(batch => batch.total_quotes > 0);
      
      setBatches(batchesWithQuotes);
      setFilteredBatches(batchesWithQuotes);
      
      setProgress({ 
        phase: 'complete', 
        current: batchesWithQuotes.length, 
        total: batchesWithQuotes.length,
        item: 'Batch loading complete'
      });
      
      console.log(`✅ Found ${batchesWithQuotes.length} batches with quotes`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load batches';
      setError(errorMessage);
      console.error('❌ Failed to load batches:', err);
    } finally {
      setLoading(false);
      setTimeout(() => {
        setProgress({ phase: 'complete', current: 0, total: 0 });
      }, 2000);
    }
  };

  const runMarginAnalysis = async () => {
    if (!selectedBatch || !project44Client || !freshxClient) {
      setError('Please select a batch and ensure API clients are configured');
      return;
    }

    setLoading(true);
    setError('');
    setShowResults(false);
    setAnalysis([]);

    try {
      console.log(`🧮 Starting margin analysis for batch: ${selectedBatch.batch_name}`);
      
      setProgress({ 
        phase: 'processing', 
        current: 0, 
        total: 4,
        item: 'Loading batch data...'
      });

      // Step 1: Load original batch data
      const [requests, originalResponses] = await Promise.all([
        project44Client.getBatchRequests(selectedBatch.id),
        project44Client.getBatchResponses(selectedBatch.id)
      ]);

      setProgress({ 
        phase: 'processing', 
        current: 1, 
        total: 4,
        item: `Loaded ${requests.length} requests and ${originalResponses.length} original quotes`
      });

      console.log(`📊 Loaded ${requests.length} requests and ${originalResponses.length} original responses`);

      // Step 2: Reprocess with current settings
      setProgress({ 
        phase: 'processing', 
        current: 2, 
        total: 4,
        item: 'Reprocessing with current settings...'
      });

      const processor = new RFQProcessor(project44Client, freshxClient);
      const newBatchName = `${selectedBatch.batch_name} - Margin Analysis ${new Date().toISOString().split('T')[0]}`;
      const newBatchId = await processor.createBatch(newBatchName, {
        selectedCarriers: selectedBatch.selected_carriers || {},
        pricingSettings,
        selectedCustomer: selectedBatch.customer_name || '',
        createdBy: 'margin-analysis'
      });

      const rfqs = requests.map(request => request.request_payload);
      await processor.processMultipleRFQs(rfqs, {
        selectedCarriers: selectedBatch.selected_carriers || {},
        pricingSettings,
        selectedCustomer: selectedBatch.customer_name || '',
        batchName: newBatchName,
        createdBy: 'margin-analysis',
        onProgress: (current, total, item) => {
          setProgress({ 
            phase: 'processing', 
            current: 2, 
            total: 4,
            item: `Reprocessing ${current}/${total}: ${item || ''}`
          });
        }
      });

      // Step 3: Load new responses
      setProgress({ 
        phase: 'processing', 
        current: 3, 
        total: 4,
        item: 'Loading new quotes...'
      });

      const newResponses = await project44Client.getBatchResponses(newBatchId);
      console.log(`📊 Loaded ${newResponses.length} new responses`);

      // Step 4: Analyze margins by carrier
      setProgress({ 
        phase: 'analyzing', 
        current: 0, 
        total: 0,
        item: 'Analyzing carrier margins...'
      });

      const carrierAnalysis = analyzeCarrierMargins(originalResponses, newResponses, selectedBatch.customer_name || '');
      setAnalysis(carrierAnalysis);
      setShowResults(true);

      setProgress({ 
        phase: 'complete', 
        current: carrierAnalysis.length, 
        total: carrierAnalysis.length,
        item: 'Analysis complete'
      });

      console.log(`✅ Margin analysis completed with ${carrierAnalysis.length} carrier recommendations`);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Analysis failed';
      setError(errorMessage);
      console.error('❌ Margin analysis failed:', err);
    } finally {
      setLoading(false);
      setTimeout(() => {
        setProgress({ phase: 'complete', current: 0, total: 0 });
      }, 3000);
    }
  };

  const analyzeCarrierMargins = (originalResponses: BatchResponse[], newResponses: BatchResponse[], customerName: string): CarrierAnalysis[] => {
    const carrierStats = new Map<string, {
      originalQuotes: BatchResponse[];
      newQuotes: BatchResponse[];
    }>();

    // Group responses by carrier
    originalResponses.forEach(response => {
      const carrier = response.carrier_name;
      if (!carrierStats.has(carrier)) {
        carrierStats.set(carrier, { originalQuotes: [], newQuotes: [] });
      }
      carrierStats.get(carrier)!.originalQuotes.push(response);
    });

    newResponses.forEach(response => {
      const carrier = response.carrier_name;
      if (!carrierStats.has(carrier)) {
        carrierStats.set(carrier, { originalQuotes: [], newQuotes: [] });
      }
      carrierStats.get(carrier)!.newQuotes.push(response);
    });

    const analysis: CarrierAnalysis[] = [];

    carrierStats.forEach((stats, carrierName) => {
      if (stats.originalQuotes.length === 0 || stats.newQuotes.length === 0) return;

      const originalAvgRevenue = stats.originalQuotes.reduce((sum, q) => sum + q.customer_price, 0) / stats.originalQuotes.length;
      const newAvgRevenue = stats.newQuotes.reduce((sum, q) => sum + q.customer_price, 0) / stats.newQuotes.length;
      const originalAvgProfit = stats.originalQuotes.reduce((sum, q) => sum + q.profit, 0) / stats.originalQuotes.length;
      const newAvgProfit = stats.newQuotes.reduce((sum, q) => sum + q.profit, 0) / stats.newQuotes.length;

      const currentMargin = originalAvgRevenue > 0 ? (originalAvgProfit / originalAvgRevenue) * 100 : 0;
      const newMargin = newAvgRevenue > 0 ? (newAvgProfit / newAvgRevenue) * 100 : 0;

      // Calculate recommended margin
      const recommendedMargin = Math.max(
        Math.min(newMargin + 2, 30), // Don't go above 30%
        Math.max(currentMargin - 5, 15) // Don't go below 15%
      );

      const potentialImpact = (recommendedMargin - currentMargin) * originalAvgRevenue / 100;

      const confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW' = 
        stats.originalQuotes.length >= 10 ? 'HIGH' :
        stats.originalQuotes.length >= 5 ? 'MEDIUM' : 'LOW';

      analysis.push({
        carrierName,
        customerName,
        shipmentCount: stats.originalQuotes.length,
        avgRevenue: originalAvgRevenue,
        avgProfit: originalAvgProfit,
        currentMargin,
        recommendedMargin,
        potentialImpact,
        confidenceLevel
      });
    });

    return analysis.sort((a, b) => Math.abs(b.potentialImpact) - Math.abs(a.potentialImpact));
  };

  const exportAnalysis = () => {
    const csvContent = [
      ['Customer', 'Carrier', 'Shipment Count', 'Avg Revenue', 'Current Margin %', 'Recommended Margin %', 'Potential Impact', 'Confidence'],
      ...analysis.map(a => [
        a.customerName,
        a.carrierName,
        a.shipmentCount,
        a.avgRevenue.toFixed(2),
        a.currentMargin.toFixed(1),
        a.recommendedMargin.toFixed(1),
        a.potentialImpact.toFixed(2),
        a.confidenceLevel
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `margin-analysis-${selectedBatch?.customer_name || 'batch'}-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'HIGH': return 'text-green-600 bg-green-100';
      case 'MEDIUM': return 'text-yellow-600 bg-yellow-100';
      case 'LOW': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getBatchStatusBadge = (batch: BatchData) => {
    const successRate = batch.total_rfqs > 0 ? (batch.successful_rfqs / batch.total_rfqs) * 100 : 0;
    
    if (successRate >= 90) {
      return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">Excellent</span>;
    } else if (successRate >= 70) {
      return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Good</span>;
    } else if (successRate >= 50) {
      return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Fair</span>;
    } else {
      return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">Poor</span>;
    }
  };

  const renderProgressBar = () => {
    if (progress.phase === 'complete' || progress.total === 0) return null;

    const percentage = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;

    return (
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center space-x-3 mb-2">
          <Loader className="h-5 w-5 text-blue-600 animate-spin" />
          <div className="flex-1">
            <div className="text-sm font-medium text-blue-900">
              {progress.item || `${progress.phase} in progress...`}
            </div>
            <div className="text-xs text-blue-700">
              {progress.current} of {progress.total} {progress.phase}
            </div>
          </div>
          <div className="text-sm font-medium text-blue-900">
            {percentage.toFixed(1)}%
          </div>
        </div>
        <div className="w-full bg-blue-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Progress Bar */}
      {renderProgressBar()}

      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center space-x-2 text-red-700">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm">{error}</span>
          </div>
        </div>
      )}

      {/* Batch Selection */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-3 mb-4">
          <div className="bg-purple-600 p-2 rounded-lg">
            <History className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Select Historical Batch</h3>
            <p className="text-sm text-gray-600">
              Choose a past batch to analyze carrier margins and determine optimal pricing ({filteredBatches.length} batches available)
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search batches by name or customer..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          {loading && progress.phase === 'batches' ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <Loader className="h-8 w-8 text-purple-500 animate-spin mx-auto" />
                <p className="text-gray-600 mt-2">Loading batches...</p>
              </div>
            </div>
          ) : filteredBatches.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">
                {searchTerm ? 'No batches found matching your search' : 'No batches found with quotes'}
              </p>
              <p className="text-gray-500 text-sm">Process some RFQs to create batches for analysis</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {filteredBatches.map((batch) => (
                <div
                  key={batch.id}
                  onClick={() => setSelectedBatch(batch)}
                  className={`p-4 border rounded-lg cursor-pointer transition-all duration-200 hover:shadow-md ${
                    selectedBatch?.id === batch.id
                      ? 'border-purple-500 bg-purple-50 shadow-sm'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h4 className="font-medium text-gray-900">{batch.batch_name}</h4>
                        {getBatchStatusBadge(batch)}
                        {selectedBatch?.id === batch.id && (
                          <CheckCircle className="h-4 w-4 text-purple-600" />
                        )}
                      </div>
                      
                      <div className="space-y-1 text-sm text-gray-600">
                        {batch.customer_name && (
                          <div className="flex items-center space-x-1">
                            <Users className="h-3 w-3" />
                            <span>{batch.customer_name}</span>
                          </div>
                        )}
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-3 w-3" />
                          <span>{new Date(batch.created_at).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Package className="h-3 w-3" />
                          <span>{batch.total_rfqs} RFQs, {batch.total_quotes} quotes</span>
                        </div>
                        {batch.best_total_price > 0 && (
                          <div className="flex items-center space-x-1">
                            <DollarSign className="h-3 w-3" />
                            <span>Best: {formatCurrency(batch.best_total_price)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Analysis Controls */}
      {selectedBatch && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-green-600 p-2 rounded-lg">
                <Calculator className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Run Margin Analysis</h3>
                <p className="text-sm text-gray-600">
                  Analyze {selectedBatch.batch_name} to determine optimal margins per carrier
                  {selectedBatch.customer_name && (
                    <span className="text-purple-600"> for {selectedBatch.customer_name}</span>
                  )}
                </p>
              </div>
            </div>

            <button
              onClick={runMarginAnalysis}
              disabled={loading}
              className="flex items-center space-x-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <>
                  <Loader className="h-4 w-4 animate-spin" />
                  <span>Analyzing...</span>
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4" />
                  <span>Start Analysis</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Results */}
      {showResults && analysis.length > 0 && (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-600 p-2 rounded-lg">
                <BarChart3 className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Margin Analysis Results</h3>
                <p className="text-sm text-gray-600">
                  {analysis.length} carrier recommendations
                  {selectedBatch?.customer_name && (
                    <span> for {selectedBatch.customer_name}</span>
                  )}
                </p>
              </div>
            </div>
            
            <button
              onClick={exportAnalysis}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Download className="h-4 w-4" />
              <span>Export CSV</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Carrier</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Shipments</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg Revenue</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Current Margin</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recommended</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Impact</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Confidence</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {analysis.map((item) => (
                  <tr key={item.carrierName} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Truck className="h-4 w-4 text-gray-400 mr-2" />
                        <span className="font-medium text-gray-900">{item.carrierName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.shipmentCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(item.avgRevenue)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.currentMargin.toFixed(1)}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-sm font-medium ${
                        item.recommendedMargin > item.currentMargin ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {item.recommendedMargin.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-sm font-medium ${
                        item.potentialImpact > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {item.potentialImpact > 0 ? '+' : ''}{formatCurrency(item.potentialImpact)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        getConfidenceColor(item.confidenceLevel)
                      }`}>
                        {item.confidenceLevel}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => onMarginRecommendation(item.customerName, item.carrierName, item.recommendedMargin)}
                        className="flex items-center space-x-1 text-blue-600 hover:text-blue-700 text-sm font-medium"
                      >
                        <Award className="h-3 w-3" />
                        <span>Apply</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};