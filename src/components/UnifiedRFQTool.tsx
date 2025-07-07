import React, { useState, useEffect } from 'react';
import { 
  Upload, 
  Play, 
  Settings, 
  BarChart3, 
  FileText, 
  Download,
  History,
  Brain,
  Zap,
  Target,
  Users,
  Building2,
  Truck,
  Package,
  DollarSign,
  CheckCircle,
  AlertCircle,
  Loader,
  RefreshCw,
  Save,
  Clock,
  TrendingUp,
  Award,
  Star,
  Sparkles
} from 'lucide-react';
import { FileUpload } from './FileUpload';
import { TemplateDownload } from './TemplateDownload';
import { PricingSettingsComponent } from './PricingSettings';
import { CarrierSelection } from './CarrierSelection';
import { ProcessingStatus } from './ProcessingStatus';
import { ResultsTable } from './ResultsTable';
import { PastRFQSelector } from './PastRFQSelector';
import { parseCSV, parseXLSX } from './utils/fileParser';
import { useRFQProcessor } from '../hooks/useRFQProcessor';
import { useCarrierManagement } from '../hooks/useCarrierManagement';
import { RFQRow, PricingSettings } from '../types';
import { 
  saveRFQBatch, 
  generateBatchName,
  loadRFQBatch
} from '../utils/rfqStorage';
import { exportToExcel } from '../utils/exportUtils';

interface UnifiedRFQToolProps {
  project44Client: any;
  freshxClient: any;
  initialPricingSettings: PricingSettings;
  initialSelectedCustomer: string;
}

type ProcessingMode = 'file-upload' | 'past-rfq-batch';

export const UnifiedRFQTool: React.FC<UnifiedRFQToolProps> = ({
  project44Client,
  freshxClient,
  initialPricingSettings,
  initialSelectedCustomer
}) => {
  // Core state
  const [processingMode, setProcessingMode] = useState<ProcessingMode>('file-upload');
  const [rfqData, setRfqData] = useState<RFQRow[]>([]);
  const [fileError, setFileError] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPastRFQSelector, setShowPastRFQSelector] = useState(false);
  
  // Settings state
  const [pricingSettings, setPricingSettings] = useState<PricingSettings>(initialPricingSettings);
  const [selectedCustomer, setSelectedCustomer] = useState<string>(initialSelectedCustomer);
  
  // Saving state
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>('');
  const [lastSavedBatchId, setLastSavedBatchId] = useState<string>('');

  // Use hooks
  const carrierManagement = useCarrierManagement({ project44Client });
  const rfqProcessor = useRFQProcessor({ project44Client, freshxClient });

  // Auto-load carriers when client becomes available
  useEffect(() => {
    if (project44Client && !carrierManagement.carriersLoaded && !carrierManagement.isLoadingCarriers) {
      carrierManagement.loadCarriers();
    }
  }, [project44Client, carrierManagement.carriersLoaded, carrierManagement.isLoadingCarriers]);

  const handleFileSelect = async (file: File) => {
    setFileError('');
    setRfqData([]);
    rfqProcessor.clearResults();

    try {
      console.log('📁 Processing file:', file.name, file.type);
      
      let parsedData: RFQRow[];
      if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        parsedData = await parseCSV(file, true);
      } else if (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
                 file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        parsedData = await parseXLSX(file, true);
      } else {
        throw new Error('Unsupported file type. Please upload a CSV or Excel file.');
      }

      if (parsedData.length === 0) {
        throw new Error('No valid data found in file');
      }

      console.log(`✅ Successfully parsed ${parsedData.length} RFQ rows`);
      setRfqData(parsedData);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to parse file';
      console.error('❌ File parsing error:', errorMessage);
      setFileError(errorMessage);
    }
  };

  const handlePastRFQSelect = async (batchId: string) => {
    try {
      console.log('📥 Loading past RFQ batch:', batchId);
      setShowPastRFQSelector(false);
      
      // Load the batch data
      const batchData = await loadRFQBatch(batchId);
      if (!batchData) {
        throw new Error('Batch not found');
      }

      // Set the RFQ data
      setRfqData(batchData.rfq_data);
      
      // Apply the batch settings
      setPricingSettings(batchData.pricing_settings);
      setSelectedCustomer(batchData.customer_name || '');
      carrierManagement.setSelectedCarriers(batchData.selected_carriers);
      
      // Load the past results if available
      if (batchData.results_data && batchData.results_data.length > 0) {
        rfqProcessor.setResults(batchData.results_data);
      } else {
        // Try to reconstruct from database
        try {
          await rfqProcessor.loadPastRFQResults(batchId);
        } catch (error) {
          console.warn('Could not load past results, will need to reprocess:', error);
          rfqProcessor.clearResults();
        }
      }
      
      console.log(`✅ Loaded past RFQ batch: ${batchData.batch_name}`);
    } catch (error) {
      console.error('❌ Failed to load past RFQ batch:', error);
      setFileError(error instanceof Error ? error.message : 'Failed to load past RFQ batch');
    }
  };

  const handleProcessRFQs = async () => {
    if (rfqData.length === 0) {
      setFileError('No RFQ data to process');
      return;
    }

    const selectedCarrierIds = carrierManagement.getSelectedCarrierIds();
    if (selectedCarrierIds.length === 0) {
      setFileError('Please select at least one carrier');
      return;
    }

    setIsProcessing(true);
    setFileError('');

    try {
      console.log('🚀 Starting RFQ processing...', {
        rfqCount: rfqData.length,
        selectedCarriers: selectedCarrierIds.length,
        customer: selectedCustomer
      });

      // Generate batch name for real-time saving
      const batchName = generateBatchName(rfqData, selectedCustomer);

      const results = await rfqProcessor.processMultipleRFQs(rfqData, {
        selectedCarriers: carrierManagement.selectedCarriers,
        pricingSettings,
        selectedCustomer,
        onProgress: (current, total, currentItem) => {
          console.log(`📊 Progress: ${current}/${total} - ${currentItem}`);
        }
      }, batchName);

      console.log(`✅ RFQ processing completed: ${results.length} results`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Processing failed';
      console.error('❌ RFQ processing failed:', errorMessage);
      setFileError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveResults = async () => {
    if (rfqProcessor.results.length === 0) {
      setSaveError('No results to save');
      return;
    }

    setIsSaving(true);
    setSaveError('');

    try {
      const batchName = generateBatchName(rfqData, selectedCustomer);
      
      console.log('💾 Saving RFQ batch...', {
        batchName,
        rfqCount: rfqData.length,
        resultsCount: rfqProcessor.results.length
      });

      const batchId = await saveRFQBatch(
        batchName,
        rfqData,
        rfqProcessor.results,
        pricingSettings,
        carrierManagement.selectedCarriers,
        selectedCustomer
      );

      setLastSavedBatchId(batchId);
      console.log('✅ RFQ batch saved successfully:', batchId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save results';
      console.error('❌ Save failed:', errorMessage);
      setSaveError(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportResults = () => {
    if (rfqProcessor.results.length === 0) {
      alert('No results to export');
      return;
    }

    try {
      exportToExcel(rfqProcessor.results, rfqData);
      console.log('✅ Results exported to Excel');
    } catch (error) {
      console.error('❌ Export failed:', error);
      alert('Failed to export results');
    }
  };

  const handlePriceUpdate = (resultIndex: number, quoteId: number, newPrice: number) => {
    rfqProcessor.updateQuotePricing(resultIndex, quoteId, newPrice, {
      pricingSettings,
      selectedCustomer
    });
  };

  const getProcessingStats = () => {
    const { processingStatus } = rfqProcessor;
    return {
      total: processingStatus.totalSteps,
      completed: processingStatus.currentStep,
      success: rfqProcessor.results.filter(r => r.status === 'success').length,
      errors: rfqProcessor.results.filter(r => r.status === 'error').length,
      isProcessing: processingStatus.isProcessing,
      currentItem: processingStatus.currentItem
    };
  };

  const stats = getProcessingStats();

  return (
    <div className="space-y-8">
      {/* Mode Selection */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-2 rounded-lg">
              <Brain className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Smart Multi-Mode RFQ Processing</h3>
              <p className="text-sm text-gray-600">
                Intelligent routing: FreshX for reefer, Project44 for LTL/VLTL with automatic mode selection
              </p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => {
                setProcessingMode('file-upload');
                setRfqData([]);
                rfqProcessor.clearResults();
                setFileError('');
              }}
              className={`p-6 rounded-xl border-2 transition-all duration-200 text-left ${
                processingMode === 'file-upload'
                  ? 'border-blue-500 bg-blue-50 shadow-md'
                  : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
              }`}
            >
              <div className="flex items-center space-x-3 mb-3">
                <Upload className={`h-6 w-6 ${processingMode === 'file-upload' ? 'text-blue-600' : 'text-gray-500'}`} />
                <h4 className={`text-lg font-semibold ${processingMode === 'file-upload' ? 'text-blue-900' : 'text-gray-700'}`}>
                  Upload New File
                </h4>
              </div>
              <p className={`text-sm ${processingMode === 'file-upload' ? 'text-blue-700' : 'text-gray-600'}`}>
                Upload a CSV or Excel file with RFQ data for smart processing across multiple networks
              </p>
              <div className="mt-3 flex items-center space-x-2">
                <Sparkles className={`h-4 w-4 ${processingMode === 'file-upload' ? 'text-blue-500' : 'text-gray-400'}`} />
                <span className={`text-xs ${processingMode === 'file-upload' ? 'text-blue-600' : 'text-gray-500'}`}>
                  Smart routing • Multi-mode comparison • Real-time saving
                </span>
              </div>
            </button>

            <button
              onClick={() => {
                setProcessingMode('past-rfq-batch');
                setShowPastRFQSelector(true);
              }}
              className={`p-6 rounded-xl border-2 transition-all duration-200 text-left ${
                processingMode === 'past-rfq-batch'
                  ? 'border-green-500 bg-green-50 shadow-md'
                  : 'border-gray-200 hover:border-green-300 hover:bg-green-50'
              }`}
            >
              <div className="flex items-center space-x-3 mb-3">
                <History className={`h-6 w-6 ${processingMode === 'past-rfq-batch' ? 'text-green-600' : 'text-gray-500'}`} />
                <h4 className={`text-lg font-semibold ${processingMode === 'past-rfq-batch' ? 'text-green-900' : 'text-gray-700'}`}>
                  Run from Past RFQ
                </h4>
              </div>
              <p className={`text-sm ${processingMode === 'past-rfq-batch' ? 'text-green-700' : 'text-gray-600'}`}>
                Select and rerun a previously processed RFQ batch with current settings and carriers
              </p>
              <div className="mt-3 flex items-center space-x-2">
                <RefreshCw className={`h-4 w-4 ${processingMode === 'past-rfq-batch' ? 'text-green-500' : 'text-gray-400'}`} />
                <span className={`text-xs ${processingMode === 'past-rfq-batch' ? 'text-green-600' : 'text-gray-500'}`}>
                  Reuse data • Updated pricing • Fresh quotes
                </span>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* File Upload Section (only for file-upload mode) */}
      {processingMode === 'file-upload' && (
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="bg-blue-600 p-2 rounded-lg">
                  <Upload className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Upload RFQ Data</h3>
                  <p className="text-sm text-gray-600">Upload CSV or Excel file with shipment details</p>
                </div>
              </div>
              <TemplateDownload isProject44={true} />
            </div>
          </div>

          <div className="p-6">
            <FileUpload
              onFileSelect={handleFileSelect}
              error={fileError}
              isProcessing={isProcessing}
            />

            {rfqData.length > 0 && (
              <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center space-x-2 text-green-800">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">
                    Successfully loaded {rfqData.length} RFQ{rfqData.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="mt-2 text-sm text-green-700">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <span className="font-medium">Routes:</span> {new Set(rfqData.map(r => `${r.fromZip}-${r.toZip}`)).size}
                    </div>
                    <div>
                      <span className="font-medium">Total Pallets:</span> {rfqData.reduce((sum, r) => sum + r.pallets, 0)}
                    </div>
                    <div>
                      <span className="font-medium">Total Weight:</span> {rfqData.reduce((sum, r) => sum + r.grossWeight, 0).toLocaleString()} lbs
                    </div>
                    <div>
                      <span className="font-medium">Reefer Shipments:</span> {rfqData.filter(r => r.isReefer).length}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Configuration Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Pricing Settings */}
        <PricingSettingsComponent
          settings={pricingSettings}
          onSettingsChange={setPricingSettings}
          selectedCustomer={selectedCustomer}
          onCustomerChange={setSelectedCustomer}
          showAsCard={true}
        />

        {/* Carrier Selection */}
        <CarrierSelection
          carrierGroups={carrierManagement.carrierGroups}
          selectedCarriers={carrierManagement.selectedCarriers}
          onToggleCarrier={carrierManagement.handleCarrierToggle}
          onSelectAll={carrierManagement.handleSelectAll}
          onSelectAllInGroup={carrierManagement.handleSelectAllInGroup}
          isLoading={carrierManagement.isLoadingCarriers}
        />
      </div>

      {/* Processing Controls */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-green-600 p-2 rounded-lg">
                <Play className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Process RFQs</h3>
                <p className="text-sm text-gray-600">
                  {rfqData.length > 0 
                    ? `Ready to process ${rfqData.length} RFQ${rfqData.length !== 1 ? 's' : ''} with ${carrierManagement.getSelectedCarrierCount()} carrier${carrierManagement.getSelectedCarrierCount() !== 1 ? 's' : ''}`
                    : 'Upload RFQ data to begin processing'
                  }
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              {rfqProcessor.results.length > 0 && (
                <>
                  <button
                    onClick={handleSaveResults}
                    disabled={isSaving}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    {isSaving ? (
                      <Loader className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    <span>{isSaving ? 'Saving...' : 'Save Results'}</span>
                  </button>
                  
                  <button
                    onClick={handleExportResults}
                    className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <Download className="h-4 w-4" />
                    <span>Export</span>
                  </button>
                </>
              )}
              
              <button
                onClick={handleProcessRFQs}
                disabled={isProcessing || rfqData.length === 0 || carrierManagement.getSelectedCarrierCount() === 0}
                className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-green-600 to-blue-600 text-white font-medium rounded-lg hover:from-green-700 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-200 shadow-lg"
              >
                {isProcessing ? (
                  <>
                    <Loader className="h-5 w-5 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <Zap className="h-5 w-5" />
                    <span>Process RFQs</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Smart Processing Benefits */}
        <div className="p-6 bg-gradient-to-r from-blue-50 to-purple-50">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-100 p-2 rounded-lg">
                <Brain className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="font-medium text-blue-900">Smart Routing</div>
                <div className="text-sm text-blue-700">Automatic network selection based on shipment characteristics</div>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="bg-purple-100 p-2 rounded-lg">
                <Target className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <div className="font-medium text-purple-900">Multi-Mode Comparison</div>
                <div className="text-sm text-purple-700">VLTL shipments get both Volume LTL and Standard LTL quotes</div>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="bg-green-100 p-2 rounded-lg">
                <Save className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <div className="font-medium text-green-900">Real-Time Saving</div>
                <div className="text-sm text-green-700">Results saved automatically as processing completes</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Processing Status */}
      {(isProcessing || rfqProcessor.results.length > 0) && (
        <ProcessingStatus
          total={stats.total}
          completed={stats.completed}
          success={stats.success}
          errors={stats.errors}
          isProcessing={stats.isProcessing}
          currentCarrier={stats.currentItem}
        />
      )}

      {/* Save Status */}
      {(saveError || lastSavedBatchId) && (
        <div className="bg-white rounded-lg shadow-md p-4">
          {saveError && (
            <div className="flex items-center space-x-2 text-red-600 mb-2">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{saveError}</span>
            </div>
          )}
          {lastSavedBatchId && (
            <div className="flex items-center space-x-2 text-green-600">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm">Results saved successfully (ID: {lastSavedBatchId.substring(0, 8)}...)</span>
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {rfqProcessor.results.length > 0 && (
        <ResultsTable
          results={rfqProcessor.results}
          onExport={handleExportResults}
          onPriceUpdate={handlePriceUpdate}
        />
      )}

      {/* Past RFQ Selector Modal */}
      <PastRFQSelector
        isVisible={showPastRFQSelector}
        onSelectBatch={handlePastRFQSelect}
        onClose={() => setShowPastRFQSelector(false)}
      />
    </div>
  );
};