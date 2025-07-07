import React, { useState, useEffect } from 'react';
import { 
  History, 
  Search, 
  Calendar, 
  RefreshCw, 
  Play, 
  BarChart3, 
  FileText, 
  Truck,
  Clock,
  TrendingUp,
  Users,
  Filter,
  ChevronDown,
  AlertCircle,
  CheckCircle,
  Loader
} from 'lucide-react';
import { BatchData, BatchRequest, BatchResponse, Project44APIClient, FreshXAPIClient } from '../utils/apiClient';
import { formatCurrency } from '../utils/pricingCalculator';
import { BatchAnalytics } from './BatchAnalytics';
import { RFQProcessor, RFQProcessingOptions } from '../utils/rfqProcessor';
import { PricingSettings } from '../types';

interface PastBatchManagerProps {
  project44Client: Project44APIClient | null;
  freshxClient: FreshXAPIClient | null;
  onClose: () => void;
  pricingSettings: PricingSettings;
  selectedCustomer: string;
}

export const PastBatchManager: React.FC<PastBatchManagerProps> = ({
  project44Client,
  freshxClient,
  onClose,
  pricingSettings,
  selectedCustomer
}) => {
  const [batches, setBatches] = useState<BatchData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBatch, setSelectedBatch] = useState<BatchData | null>(null);
  const [batchRequests, setBatchRequests] = useState<BatchRequest[]>([]);
  const [originalResponses, setOriginalResponses] = useState<BatchResponse[]>([]);
  const [newResponses, setNewResponses] = useState<BatchResponse[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'created_at' | 'batch_name' | 'total_rfqs'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterBy, setFilterBy] = useState<'all' | 'recent' | 'large'>('all');
  const [reprocessing, setReprocessing] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [currentProgress, setCurrentProgress] = useState({ current: 0, total: 0, item: '' });

  useEffect(() => {
    loadBatches();
  }, []);

  const loadBatches = async () => {
    if (!project44Client) {
      console.error('❌ Project44 client not available');
      setLoading(false);
      return;
    }

    try {
      console.log('📋 Loading all batches...');
      const allBatches = await project44Client.getAllBatches();
      setBatches(allBatches);
      console.log(`✅ Loaded ${allBatches.length} batches`);
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
      setNewResponses([]); // Clear any previous new responses
      
      console.log(`✅ Loaded ${requests.length} requests and ${responses.length} responses`);
    } catch (error) {
      console.error('❌ Failed to load batch details:', error);
    }
  };

  const reprocessBatch = async () => {
    if (!selectedBatch || !project44Client || !freshxClient || batchRequests.length === 0) {
      console.error('❌ Missing required data for reprocessing');
      return;
    }

    setReprocessing(true);
    setNewResponses([]);

    try {
      console.log(`🔄 Reprocessing batch ${selectedBatch.batch_name} with ${batchRequests.length} requests...`);
      
      // Create RFQ processor
      const processor = new RFQProcessor(project44Client, freshxClient);
      
      // Create a new batch for reprocessing
      const newBatchName = `${selectedBatch.batch_name} - Reprocessed ${new Date().toISOString().split('T')[0]}`;
      const newBatchId = await processor.createBatch(newBatchName, {
        selectedCarriers: selectedBatch.selected_carriers || {},
        pricingSettings,
        selectedCustomer,
        createdBy: 'reprocessing'
      });
      
      console.log(`✅ Created new batch for reprocessing: ${newBatchId}`);
      
      // Convert batch requests back to RFQ format
      const rfqs = batchRequests.map(request => request.request_payload);
      
      // Process with current settings
      const results = await processor.processMultipleRFQs(rfqs, {
        selectedCarriers: selectedBatch.selected_carriers || {},
        pricingSettings,
        selectedCustomer,
        batchName: newBatchName,
        createdBy: 'reprocessing',
        onProgress: (current, total, item) => {
          setCurrentProgress({ current, total, item: item || '' });
        }
      });
      
      console.log(`✅ Reprocessing completed: ${results.length} results`);
      
      // Load the new responses from the database
      const newBatchResponses = await project44Client.getBatchResponses(newBatchId);
      setNewResponses(newBatchResponses);
      
      console.log(`✅ Loaded ${newBatchResponses.length} new responses for analysis`);
      
      // Show analytics automatically
      setShowAnalytics(true);
      
    } catch (error) {
      console.error('❌ Failed to reprocess batch:', error);
    } finally {
      setReprocessing(false);
      setCurrentProgress({ current: 0, total: 0, item: '' });
    }
  };

  const filteredAndSortedBatches = batches
    .filter(batch => {
      // Search filter
      if (searchTerm && !batch.batch_name.toLowerCase().includes(searchTerm.toLowerCase()) &&
          !batch.customer_name?.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      
      // Category filter
      if (filterBy === 'recent') {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return new Date(batch.created_at) > weekAgo;
      } else if (filterBy === 'large') {
        return batch.total_rfqs >= 10;
      }
      
      return true;
    })
    .sort((a, b) => {
      let aVal, bVal;
      
      switch (sortBy) {
        case 'batch_name':
          aVal = a.batch_name.toLowerCase();
          bVal = b.batch_name.toLowerCase();
          break;
        case 'total_rfqs':
          aVal = a.total_rfqs;
          bVal = b.total_rfqs;
          break;
        default:
          aVal = new Date(a.created_at).getTime();
          bVal = new Date(b.created_at).getTime();
      }
      
      if (sortOrder === 'asc') {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      } else {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      }
    });

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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <History className="h-6 w-6" />
              <div>
                <h2 className="text-xl font-bold">Past RFQ Batch Manager</h2>
                <p className="text-purple-100 text-sm">
                  Reprocess historical batches and analyze market changes
                </p>
              </div>
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

        <div className="flex h-[calc(90vh-80px)]">
          {/* Batch List */}
          <div className="w-1/2 border-r border-gray-200 overflow-hidden flex flex-col">
            {/* Search and Filters */}
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <div className="space-y-3">
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
                
                <div className="flex items-center space-x-4">
                  <select
                    value={filterBy}
                    onChange={(e) => setFilterBy(e.target.value as any)}
                    className="text-sm border border-gray-300 rounded-md px-3 py-1"
                  >
                    <option value="all">All Batches</option>
                    <option value="recent">Recent (7 days)</option>
                    <option value="large">Large (10+ RFQs)</option>
                  </select>
                  
                  <select
                    value={`${sortBy}-${sortOrder}`}
                    onChange={(e) => {
                      const [field, order] = e.target.value.split('-');
                      setSortBy(field as any);
                      setSortOrder(order as any);
                    }}
                    className="text-sm border border-gray-300 rounded-md px-3 py-1"
                  >
                    <option value="created_at-desc">Newest First</option>
                    <option value="created_at-asc">Oldest First</option>
                    <option value="batch_name-asc">Name A-Z</option>
                    <option value="batch_name-desc">Name Z-A</option>
                    <option value="total_rfqs-desc">Most RFQs</option>
                    <option value="total_rfqs-asc">Fewest RFQs</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Batch List */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <Loader className="h-8 w-8 text-purple-500 animate-spin mx-auto" />
                    <p className="text-gray-600 mt-2">Loading batches...</p>
                  </div>
                </div>
              ) : filteredAndSortedBatches.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <History className="h-12 w-12 text-gray-400 mx-auto" />
                    <p className="text-gray-600 mt-2">No batches found</p>
                    <p className="text-gray-500 text-sm">Process some RFQs to create batches</p>
                  </div>
                </div>
              ) : (
                <div className="p-4 space-y-3">
                  {filteredAndSortedBatches.map((batch) => (
                    <div
                      key={batch.id}
                      onClick={() => loadBatchDetails(batch)}
                      className={`p-4 border rounded-lg cursor-pointer transition-all duration-200 hover:shadow-md ${
                        selectedBatch?.id === batch.id
                          ? 'border-purple-500 bg-purple-50 shadow-sm'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h3 className="font-medium text-gray-900 truncate">{batch.batch_name}</h3>
                            {getBatchStatusBadge(batch)}
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
                              <FileText className="h-3 w-3" />
                              <span>{batch.total_rfqs} RFQs, {batch.total_quotes} quotes</span>
                            </div>
                            {batch.best_total_price > 0 && (
                              <div className="flex items-center space-x-1">
                                <TrendingUp className="h-3 w-3" />
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

          {/* Batch Details */}
          <div className="w-1/2 overflow-hidden flex flex-col">
            {selectedBatch ? (
              <>
                {/* Batch Info */}
                <div className="p-6 border-b border-gray-200 bg-gray-50">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{selectedBatch.batch_name}</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Created by {selectedBatch.created_by} on {new Date(selectedBatch.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    {getBatchStatusBadge(selectedBatch)}
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-white rounded-lg p-3">
                      <div className="text-2xl font-bold text-purple-600">{selectedBatch.total_rfqs}</div>
                      <div className="text-sm text-gray-600">Total RFQs</div>
                    </div>
                    <div className="bg-white rounded-lg p-3">
                      <div className="text-2xl font-bold text-blue-600">{selectedBatch.total_quotes}</div>
                      <div className="text-sm text-gray-600">Total Quotes</div>
                    </div>
                    <div className="bg-white rounded-lg p-3">
                      <div className="text-2xl font-bold text-green-600">
                        {selectedBatch.best_total_price > 0 ? formatCurrency(selectedBatch.best_total_price) : 'N/A'}
                      </div>
                      <div className="text-sm text-gray-600">Best Price</div>
                    </div>
                    <div className="bg-white rounded-lg p-3">
                      <div className="text-2xl font-bold text-orange-600">
                        {selectedBatch.total_profit > 0 ? formatCurrency(selectedBatch.total_profit) : 'N/A'}
                      </div>
                      <div className="text-sm text-gray-600">Total Profit</div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={reprocessBatch}
                      disabled={reprocessing || batchRequests.length === 0}
                      className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                    >
                      {reprocessing ? (
                        <>
                          <Loader className="h-4 w-4 animate-spin" />
                          <span>Reprocessing...</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4" />
                          <span>Reprocess with Current Settings</span>
                        </>
                      )}
                    </button>

                    {newResponses.length > 0 && (
                      <button
                        onClick={() => setShowAnalytics(true)}
                        className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <BarChart3 className="h-4 w-4" />
                        <span>View Analytics</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress */}
                {reprocessing && (
                  <div className="p-4 border-b border-gray-200 bg-blue-50">
                    <div className="flex items-center space-x-3">
                      <Loader className="h-5 w-5 text-blue-600 animate-spin" />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-blue-900">
                          Processing {currentProgress.current} of {currentProgress.total}
                        </div>
                        <div className="text-xs text-blue-700">{currentProgress.item}</div>
                        <div className="w-full bg-blue-200 rounded-full h-2 mt-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ 
                              width: `${currentProgress.total > 0 ? (currentProgress.current / currentProgress.total) * 100 : 0}%` 
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Batch Details */}
                <div className="flex-1 overflow-y-auto p-6">
                  <div className="space-y-6">
                    {/* Original Configuration */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 mb-3">Original Configuration</h4>
                      <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Processing Mode:</span>
                          <span className="font-medium">{selectedBatch.processing_mode}</span>
                        </div>
                        {selectedBatch.customer_name && (
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Customer:</span>
                            <span className="font-medium">{selectedBatch.customer_name}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Selected Carriers:</span>
                          <span className="font-medium">
                            {Object.keys(selectedBatch.selected_carriers || {}).length} carriers
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Request Summary */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 mb-3">Request Summary</h4>
                      <div className="space-y-2">
                        {batchRequests.slice(0, 5).map((request, index) => (
                          <div key={request.id} className="bg-gray-50 rounded-lg p-3">
                            <div className="flex justify-between items-center">
                              <div>
                                <div className="text-sm font-medium">
                                  {request.from_zip} → {request.to_zip}
                                </div>
                                <div className="text-xs text-gray-600">
                                  {request.pallets} pallets, {request.gross_weight.toLocaleString()} lbs
                                </div>
                              </div>
                              <div className="text-xs text-gray-500">
                                {request.quoting_decision.replace('project44-', '').toUpperCase()}
                              </div>
                            </div>
                          </div>
                        ))}
                        {batchRequests.length > 5 && (
                          <div className="text-center text-sm text-gray-500">
                            ... and {batchRequests.length - 5} more requests
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Results Summary */}
                    {newResponses.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-3">Reprocessing Results</h4>
                        <div className="bg-green-50 rounded-lg p-4">
                          <div className="flex items-center space-x-2 mb-2">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <span className="text-sm font-medium text-green-900">
                              Reprocessing Complete
                            </span>
                          </div>
                          <div className="text-sm text-green-700">
                            Generated {newResponses.length} new quotes for comparison with original {originalResponses.length} quotes
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <History className="h-12 w-12 text-gray-400 mx-auto" />
                  <p className="text-gray-600 mt-2">Select a batch to view details</p>
                  <p className="text-gray-500 text-sm">Choose from the list on the left</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Analytics Modal */}
        {showAnalytics && selectedBatch && originalResponses.length > 0 && newResponses.length > 0 && (
          <BatchAnalytics
            originalBatch={selectedBatch}
            originalRequests={batchRequests}
            originalResponses={originalResponses}
            newResponses={newResponses}
            onClose={() => setShowAnalytics(false)}
          />
        )}
      </div>
    </div>
  );
};