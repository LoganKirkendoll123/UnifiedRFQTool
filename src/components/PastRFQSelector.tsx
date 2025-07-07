import React, { useState, useEffect } from 'react';
import { 
  History, 
  Search, 
  Calendar, 
  User, 
  Package, 
  DollarSign, 
  TrendingUp, 
  Play, 
  Trash2, 
  Eye,
  Filter,
  ChevronDown,
  ChevronUp,
  Clock,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { RFQBatchSummary, loadRFQBatchSummaries, deleteRFQBatch } from '../utils/rfqStorage';
import { formatCurrency } from '../utils/pricingCalculator';

interface PastRFQSelectorProps {
  onSelectBatch: (batchId: string) => void;
  onClose: () => void;
  isVisible: boolean;
}

export const PastRFQSelector: React.FC<PastRFQSelectorProps> = ({
  onSelectBatch,
  onClose,
  isVisible
}) => {
  const [batches, setBatches] = useState<RFQBatchSummary[]>([]);
  const [filteredBatches, setFilteredBatches] = useState<RFQBatchSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [selectedMode, setSelectedMode] = useState<string>('');
  const [sortBy, setSortBy] = useState<'created_at' | 'batch_name' | 'total_rfqs' | 'best_total_price'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (isVisible) {
      loadBatches();
    }
  }, [isVisible]);

  useEffect(() => {
    filterAndSortBatches();
  }, [batches, searchTerm, selectedCustomer, selectedMode, sortBy, sortOrder]);

  const loadBatches = async () => {
    setLoading(true);
    setError('');
    try {
      const batchSummaries = await loadRFQBatchSummaries();
      setBatches(batchSummaries);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load past RFQs';
      setError(errorMsg);
      console.error('❌ Failed to load RFQ batches:', err);
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortBatches = () => {
    let filtered = [...batches];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(batch =>
        batch.batch_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (batch.customer_name && batch.customer_name.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Apply customer filter
    if (selectedCustomer) {
      filtered = filtered.filter(batch => batch.customer_name === selectedCustomer);
    }

    // Apply mode filter
    if (selectedMode) {
      filtered = filtered.filter(batch => batch.processing_mode === selectedMode);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aVal: any, bVal: any;
      
      switch (sortBy) {
        case 'created_at':
          aVal = new Date(a.created_at).getTime();
          bVal = new Date(b.created_at).getTime();
          break;
        case 'batch_name':
          aVal = a.batch_name.toLowerCase();
          bVal = b.batch_name.toLowerCase();
          break;
        case 'total_rfqs':
          aVal = a.total_rfqs;
          bVal = b.total_rfqs;
          break;
        case 'best_total_price':
          aVal = a.best_total_price;
          bVal = b.best_total_price;
          break;
        default:
          return 0;
      }

      if (sortOrder === 'asc') {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      } else {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      }
    });

    setFilteredBatches(filtered);
  };

  const handleDeleteBatch = async (batchId: string, batchName: string) => {
    if (!confirm(`Are you sure you want to delete "${batchName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await deleteRFQBatch(batchId);
      setBatches(prev => prev.filter(b => b.id !== batchId));
    } catch (err) {
      console.error('❌ Failed to delete batch:', err);
      alert('Failed to delete batch. Please try again.');
    }
  };

  const getUniqueCustomers = () => {
    const customers = batches
      .map(b => b.customer_name)
      .filter(Boolean)
      .filter((value, index, self) => self.indexOf(value) === index)
      .sort();
    return customers;
  };

  const getUniqueModes = () => {
    const modes = batches
      .map(b => b.processing_mode)
      .filter((value, index, self) => self.indexOf(value) === index)
      .sort();
    return modes;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getSuccessRate = (batch: RFQBatchSummary) => {
    if (batch.total_rfqs === 0) return 0;
    return Math.round((batch.successful_rfqs / batch.total_rfqs) * 100);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <History className="h-6 w-6" />
              <div>
                <h2 className="text-xl font-bold">Run from Past RFQ</h2>
                <p className="text-blue-100 text-sm">Select a previous RFQ batch to rerun with current settings</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-blue-200 transition-colors"
            >
              <span className="text-2xl">×</span>
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center space-x-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by batch name or customer..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg border transition-colors ${
                showFilters ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Filter className="h-4 w-4" />
              <span>Filters</span>
              {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Customer</label>
                <select
                  value={selectedCustomer}
                  onChange={(e) => setSelectedCustomer(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">All Customers</option>
                  {getUniqueCustomers().map(customer => (
                    <option key={customer} value={customer}>{customer}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Processing Mode</label>
                <select
                  value={selectedMode}
                  onChange={(e) => setSelectedMode(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">All Modes</option>
                  {getUniqueModes().map(mode => (
                    <option key={mode} value={mode}>{mode}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
                <div className="flex space-x-2">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="created_at">Date</option>
                    <option value="batch_name">Name</option>
                    <option value="total_rfqs">RFQ Count</option>
                    <option value="best_total_price">Best Price</option>
                  </select>
                  <button
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    {sortOrder === 'asc' ? '↑' : '↓'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto max-h-96">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading past RFQs...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center text-red-600">
                <AlertCircle className="h-8 w-8 mx-auto mb-4" />
                <p>{error}</p>
                <button
                  onClick={loadBatches}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : filteredBatches.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center text-gray-500">
                <History className="h-8 w-8 mx-auto mb-4" />
                <p>No past RFQs found</p>
                {searchTerm || selectedCustomer || selectedMode ? (
                  <button
                    onClick={() => {
                      setSearchTerm('');
                      setSelectedCustomer('');
                      setSelectedMode('');
                    }}
                    className="mt-2 text-blue-600 hover:text-blue-700 text-sm"
                  >
                    Clear filters
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="p-6">
              <div className="grid gap-4">
                {filteredBatches.map((batch) => (
                  <div
                    key={batch.id}
                    className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-md transition-all duration-200"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="font-semibold text-gray-900">{batch.batch_name}</h3>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            batch.processing_mode === 'smart' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {batch.processing_mode}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div className="flex items-center space-x-2">
                            <Calendar className="h-4 w-4 text-gray-400" />
                            <span className="text-gray-600">{formatDate(batch.created_at)}</span>
                          </div>
                          
                          {batch.customer_name && (
                            <div className="flex items-center space-x-2">
                              <User className="h-4 w-4 text-gray-400" />
                              <span className="text-gray-600">{batch.customer_name}</span>
                            </div>
                          )}
                          
                          <div className="flex items-center space-x-2">
                            <Package className="h-4 w-4 text-gray-400" />
                            <span className="text-gray-600">
                              {batch.total_rfqs} RFQ{batch.total_rfqs !== 1 ? 's' : ''}
                            </span>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <TrendingUp className="h-4 w-4 text-gray-400" />
                            <span className="text-gray-600">
                              {batch.total_quotes} quote{batch.total_quotes !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-6 mt-3">
                          <div className="flex items-center space-x-2">
                            <DollarSign className="h-4 w-4 text-green-600" />
                            <span className="text-sm font-medium text-green-600">
                              Best: {formatCurrency(batch.best_total_price)}
                            </span>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <TrendingUp className="h-4 w-4 text-blue-600" />
                            <span className="text-sm font-medium text-blue-600">
                              Profit: {formatCurrency(batch.total_profit)}
                            </span>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <CheckCircle className="h-4 w-4 text-purple-600" />
                            <span className="text-sm font-medium text-purple-600">
                              {getSuccessRate(batch)}% success
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2 ml-4">
                        <button
                          onClick={() => onSelectBatch(batch.id)}
                          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          <Play className="h-4 w-4" />
                          <span>Rerun</span>
                        </button>
                        
                        <button
                          onClick={() => handleDeleteBatch(batch.id, batch.batch_name)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete batch"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              {filteredBatches.length} of {batches.length} batches shown
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};