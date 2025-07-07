import React, { useState, useEffect, useCallback } from 'react';
import { 
  Upload, 
  Play, 
  Download, 
  FileText, 
  Settings, 
  Users, 
  History,
  AlertCircle,
  CheckCircle,
  Loader,
  Brain,
  Zap,
  Target,
  BarChart3,
  TrendingUp,
  Package,
  Clock,
  DollarSign,
  Truck,
  RefreshCw,
  X
} from 'lucide-react';
import { FileUpload } from './FileUpload';
import { TemplateDownload } from './TemplateDownload';
import { PricingSettingsComponent } from './PricingSettings';
import { CarrierSelection } from './CarrierSelection';
import { ProcessingStatus } from './ProcessingStatus';
import { ResultsTable } from './ResultsTable';
import { PastRFQSelector } from './PastRFQSelector';
import { parseCSV, parseXLSX } from '../utils/fileParser';
import { useRFQProcessor } from '../hooks/useRFQProcessor';
import { useCarrierManagement } from '../hooks/useCarrierManagement';
import { Project44APIClient, FreshXAPIClient } from '../utils/apiClient';
import { RFQRow, PricingSettings } from '../types';
import { generateBatchName } from '../utils/rfqStorage';
import * as XLSX from 'xlsx';

interface UnifiedRFQToolProps {
  project44Client: Project44APIClient | null;
  freshxClient: FreshXAPIClient | null;
  initialPricingSettings: PricingSettings;
  initialSelectedCustomer: string;
}

export const UnifiedRFQTool: React.FC<UnifiedRFQToolProps> = ({
  project44Client,
  freshxClient,
  initialPricingSettings,
  initialSelectedCustomer
}) => {
  // Core state
  const [rfqData, setRfqData] = useState<RFQRow[]>([]);
  const [pricingSettings, setPricingSettings] = useState<PricingSettings>(initialPricingSettings);
  const [selectedCustomer, setSelectedCustomer] = useState<string>(initialSelectedCustomer);
  const [fileError, setFileError] = useState<string>('');
  const [activeMode, setActiveMode] = useState<'upload' | 'manual' | 'past' | 'analysis'>('upload');
  const [showPastRFQSelector, setShowPastRFQSelector] = useState(false);
  const [currentBatchName, setCurrentBatchName] = useState<string>('');

  // Use hooks
  const carrierManagement = useCarrierManagement({ project44Client });
  const rfqProcessor = useRFQProcessor({ project44Client, freshxClient });

  // Auto-generate batch name when RFQ data changes
  useEffect(() => {
    if (rfqData.length > 0) {
      const batchName = generateBatchName(rfqData, selectedCustomer);
      setCurrentBatchName(batchName);
    } else {
      setCurrentBatchName('');
    }
  }, [rfqData, selectedCustomer]);

  const handleFileSelect = async (file: File) => {
    setFileError('');
    try {
      let parsedData: RFQRow[];
      
      if (file.name.endsWith('.csv')) {
        parsedData = await parseCSV(file, true);
      } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        parsedData = await parseXLSX(file, true);
      } else {
        throw new Error('Unsupported file format. Please use CSV or Excel files.');
      }
      
      if (parsedData.length === 0) {
        throw new Error('No valid data found in file');
      }
      
      setRfqData(parsedData);
      console.log(`✅ Loaded ${parsedData.length} RFQs from file`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to parse file';
      setFileError(errorMessage);
      console.error('❌ File parsing error:', error);
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

    try {
      setFileError('');
      
      const options = {
        selectedCarriers: carrierManagement.selectedCarriers,
        pricingSettings,
        selectedCustomer
      };

      // Process with automatic batch creation and saving
      await rfqProcessor.processMultipleRFQs(rfqData, options, currentBatchName);
      
      console.log('✅ RFQ processing completed with automatic saving');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Processing failed';
      setFileError(errorMessage);
      console.error('❌ RFQ processing error:', error);
    }
  };

  const handleSingleRFQProcess = async () => {
    if (rfqData.length === 0) {
      setFileError('No RFQ data to process');
      return;
    }

    const selectedCarrierIds = carrierManagement.getSelectedCarrierIds();
    if (selectedCarrierIds.length === 0) {
      setFileError('Please select at least one carrier');
      return;
    }

    try {
      setFileError('');
      
      const options = {
        selectedCarriers: carrierManagement.selectedCarriers,
        pricingSettings,
        selectedCustomer
      };

      // Process single RFQ with automatic batch creation and saving
      await rfqProcessor.processSingleRFQ(rfqData[0], options);
      
      console.log('✅ Single RFQ processing completed with automatic saving');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Processing failed';
      setFileError(errorMessage);
      console.error('❌ Single RFQ processing error:', error);
    }
  };

  const handleAccountGroupProcess = async () => {
    if (rfqData.length === 0) {
      setFileError('No RFQ data to process');
      return;
    }

    if (carrierManagement.carrierGroups.length === 0) {
      setFileError('No carrier groups available');
      return;
    }

    try {
      setFileError('');
      
      const options = {
        pricingSettings,
        selectedCustomer
      };

      // Use the first available group for account group processing
      const accountGroupCode = carrierManagement.carrierGroups[0].groupCode;
      
      // Process with automatic batch creation and saving
      await rfqProcessor.processRFQsForAccountGroup(rfqData, accountGroupCode, options);
      
      console.log('✅ Account group processing completed with automatic saving');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Processing failed';
      setFileError(errorMessage);
      console.error('❌ Account group processing error:', error);
    }
  };

  const loadPastRFQData = async (batchId: string) => {
    try {
      console.log('📥 Loading past RFQ data:', batchId);
      
      // Load the results using the processor hook
      const results = await rfqProcessor.loadPastRFQResults(batchId);
      
      if (results.length === 0) {
        throw new Error('No RFQ data found in this batch');
      }

      // Extract RFQ data from results
      const pastRfqData = results.map(result => result.originalData);
      setRfqData(pastRfqData);
      
      console.log(`✅ Loaded ${pastRfqData.length} past RFQs and ${results.length} results`);
      setShowPastRFQSelector(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load past RFQ data';
      setFileError(`Failed to load past RFQ data:\n\n${errorMessage}`);
      console.error('❌ Error loading past RFQ data:', error);
    }
  };

  const handleExportResults = () => {
    if (rfqProcessor.results.length === 0) {
      setFileError('No results to export');
      return;
    }

    try {
      // Create export data
      const exportData = rfqProcessor.results.flatMap((result, resultIndex) => {
        if (result.quotes.length === 0) {
          return [{
            'RFQ #': resultIndex + 1,
            'Status': result.status,
            'Error': result.error || '',
            'Route': `${result.originalData.fromZip} → ${result.originalData.toZip}`,
            'Pallets': result.originalData.pallets,
            'Weight': result.originalData.grossWeight,
            'Quoting Decision': result.quotingDecision,
            'Quoting Reason': result.quotingReason,
            'Carrier': '',
            'Service Level': '',
            'Customer Price': '',
            'Profit': '',
            'Transit Days': ''
          }];
        }

        return result.quotes.map((quote, quoteIndex) => ({
          'RFQ #': resultIndex + 1,
          'Quote #': quoteIndex + 1,
          'Status': result.status,
          'Route': `${result.originalData.fromZip} → ${result.originalData.toZip}`,
          'Pallets': result.originalData.pallets,
          'Weight': result.originalData.grossWeight,
          'Quoting Decision': result.quotingDecision,
          'Quoting Reason': result.quotingReason,
          'Carrier': quote.carrier.name,
          'Carrier Code': quote.carrierCode || quote.carrier.scac || '',
          'Service Level': quote.serviceLevel?.code || '',
          'Service Description': quote.serviceLevel?.description || '',
          'Customer Price': (quote as any).customerPrice || 0,
          'Carrier Rate': (quote as any).carrierTotalRate || 0,
          'Profit': (quote as any).profit || 0,
          'Margin %': (quote as any).appliedMarginPercentage?.toFixed(1) || '',
          'Transit Days': quote.transitDays || '',
          'Quote Mode': (quote as any).quoteMode || ''
        }));
      });

      // Create workbook and export
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'RFQ Results');
      
      const fileName = `rfq-results-${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);
      
      console.log('✅ Results exported successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Export failed';
      setFileError(errorMessage);
      console.error('❌ Export error:', error);
    }
  };

  const handlePriceUpdate = (resultIndex: number, quoteId: number, newPrice: number) => {
    rfqProcessor.updateQuotePricing(resultIndex, quoteId, newPrice, {
      pricingSettings,
      selectedCustomer
    });
  };

  const clearData = () => {
    setRfqData([]);
    rfqProcessor.clearResults();
    setFileError('');
    setCurrentBatchName('');
  };

  const getProcessingStats = () => {
    const { results } = rfqProcessor;
    const totalQuotes = results.reduce((sum, result) => sum + result.quotes.length, 0);
    const successfulRFQs = results.filter(result => result.status === 'success').length;
    const errorRFQs = results.filter(result => result.status === 'error').length;
    
    return {
      totalRFQs: results.length,
      successfulRFQs,
      errorRFQs,
      totalQuotes
    };
  };

  const stats = getProcessingStats();

  return (
    <div className="space-y-6">
      {/* Mode Selection */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Smart RFQ Processing</h2>
            <p className="text-sm text-gray-600 mt-1">
              Intelligent routing: FreshX for reefer, Project44 for LTL/VLTL with automatic dual-mode comparison
            </p>
          </div>
          
          {rfqData.length > 0 && (
            <button
              onClick={clearData}
              className="flex items-center space-x-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <X className="h-4 w-4" />
              <span>Clear Data</span>
            </button>
          )}
        </div>

        {/* Mode Tabs */}
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg mb-6">
          <button
            onClick={() => setActiveMode('upload')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
              activeMode === 'upload'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <Upload className="h-4 w-4" />
            <span>File Upload</span>
          </button>
          
          <button
            onClick={() => setShowPastRFQSelector(true)}
            className="flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-all duration-200"
          >
            <History className="h-4 w-4" />
            <span>Past RFQs</span>
          </button>
        </div>

        {/* File Upload Mode */}
        {activeMode === 'upload' && (
          <div className="space-y-6">
            {rfqData.length === 0 ? (
              <div className="space-y-4">
                <FileUpload
                  onFileSelect={handleFileSelect}
                  error={fileError}
                  isProcessing={rfqProcessor.processingStatus.isProcessing}
                />
                
                <div className="text-center">
                  <div className="text-sm text-gray-500 mb-4">or</div>
                  <TemplateDownload isProject44={true} />
                </div>
              </div>
            ) : (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="font-medium text-green-900">
                      ✅ {rfqData.length} RFQ{rfqData.length !== 1 ? 's' : ''} loaded successfully
                    </p>
                    {currentBatchName && (
                      <p className="text-sm text-green-700 mt-1">
                        Batch: {currentBatchName}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Configuration Panels */}
      {rfqData.length > 0 && (
        <>
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

          {/* Processing Controls */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Processing Options</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Choose your processing mode - all results are automatically saved
                </p>
              </div>
              
              {rfqProcessor.processingStatus.isProcessing && (
                <div className="flex items-center space-x-2 text-blue-600">
                  <Loader className="h-5 w-5 animate-spin" />
                  <span className="text-sm font-medium">Processing...</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Smart Multi-Mode Processing */}
              <button
                onClick={handleProcessRFQs}
                disabled={rfqProcessor.processingStatus.isProcessing || carrierManagement.getSelectedCarrierCount() === 0}
                className="flex flex-col items-center p-6 border-2 border-blue-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                <div className="bg-blue-600 p-3 rounded-lg mb-3 group-hover:bg-blue-700 transition-colors">
                  <Brain className="h-6 w-6 text-white" />
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">Smart Multi-Mode</h4>
                <p className="text-sm text-gray-600 text-center mb-3">
                  Intelligent routing with dual-mode comparison for VLTL shipments
                </p>
                <div className="text-xs text-blue-600 font-medium">
                  {carrierManagement.getSelectedCarrierCount()} carriers selected
                </div>
              </button>

              {/* Single RFQ Test */}
              <button
                onClick={handleSingleRFQProcess}
                disabled={rfqProcessor.processingStatus.isProcessing || carrierManagement.getSelectedCarrierCount() === 0}
                className="flex flex-col items-center p-6 border-2 border-green-200 rounded-lg hover:border-green-400 hover:bg-green-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                <div className="bg-green-600 p-3 rounded-lg mb-3 group-hover:bg-green-700 transition-colors">
                  <Target className="h-6 w-6 text-white" />
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">Single RFQ Test</h4>
                <p className="text-sm text-gray-600 text-center mb-3">
                  Process first RFQ only for testing and validation
                </p>
                <div className="text-xs text-green-600 font-medium">
                  Test with {carrierManagement.getSelectedCarrierCount()} carriers
                </div>
              </button>

              {/* Account Group Analysis */}
              <button
                onClick={handleAccountGroupProcess}
                disabled={rfqProcessor.processingStatus.isProcessing || carrierManagement.carrierGroups.length === 0}
                className="flex flex-col items-center p-6 border-2 border-purple-200 rounded-lg hover:border-purple-400 hover:bg-purple-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                <div className="bg-purple-600 p-3 rounded-lg mb-3 group-hover:bg-purple-700 transition-colors">
                  <BarChart3 className="h-6 w-6 text-white" />
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">Account Group</h4>
                <p className="text-sm text-gray-600 text-center mb-3">
                  Process with entire account group for comprehensive analysis
                </p>
                <div className="text-xs text-purple-600 font-medium">
                  {carrierManagement.carrierGroups.length} group{carrierManagement.carrierGroups.length !== 1 ? 's' : ''} available
                </div>
              </button>

              {/* Negotiation Impact */}
              <button
                onClick={handleAccountGroupProcess}
                disabled={rfqProcessor.processingStatus.isProcessing || carrierManagement.carrierGroups.length === 0}
                className="flex flex-col items-center p-6 border-2 border-orange-200 rounded-lg hover:border-orange-400 hover:bg-orange-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                <div className="bg-orange-600 p-3 rounded-lg mb-3 group-hover:bg-orange-700 transition-colors">
                  <TrendingUp className="h-6 w-6 text-white" />
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">Negotiation Impact</h4>
                <p className="text-sm text-gray-600 text-center mb-3">
                  Analyze potential savings from carrier negotiations
                </p>
                <div className="text-xs text-orange-600 font-medium">
                  Impact analysis mode
                </div>
              </button>
            </div>

            {fileError && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-red-700 whitespace-pre-line">{fileError}</div>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Processing Status */}
      {rfqProcessor.processingStatus.isProcessing && (
        <ProcessingStatus
          total={rfqProcessor.processingStatus.totalSteps}
          completed={rfqProcessor.processingStatus.currentStep}
          success={stats.successfulRFQs}
          errors={stats.errorRFQs}
          isProcessing={rfqProcessor.processingStatus.isProcessing}
          currentCarrier={rfqProcessor.processingStatus.currentItem}
        />
      )}

      {/* Results */}
      {rfqProcessor.results.length > 0 && (
        <div className="space-y-6">
          {/* Results Summary */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Processing Results</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Results automatically saved to database for future reference
                </p>
              </div>
              
              <button
                onClick={handleExportResults}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Download className="h-4 w-4" />
                <span>Export Results</span>
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-blue-700">{stats.totalRFQs}</div>
                <div className="text-sm text-blue-600">Total RFQs</div>
              </div>
              
              <div className="bg-green-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-green-700">{stats.successfulRFQs}</div>
                <div className="text-sm text-green-600">Successful</div>
              </div>
              
              <div className="bg-red-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-red-700">{stats.errorRFQs}</div>
                <div className="text-sm text-red-600">Errors</div>
              </div>
              
              <div className="bg-purple-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-purple-700">{stats.totalQuotes}</div>
                <div className="text-sm text-purple-600">Total Quotes</div>
              </div>
            </div>
          </div>

          {/* Results Table */}
          <ResultsTable
            results={rfqProcessor.results}
            onExport={handleExportResults}
            onPriceUpdate={handlePriceUpdate}
          />
        </div>
      )}

      {/* Past RFQ Selector Modal */}
      <PastRFQSelector
        isVisible={showPastRFQSelector}
        onClose={() => setShowPastRFQSelector(false)}
        onSelectBatch={loadPastRFQData}
      />
    </div>
  );
};