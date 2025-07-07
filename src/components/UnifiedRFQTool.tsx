import React, { useState, useEffect } from 'react';
import { 
  Upload, 
  Download, 
  Settings, 
  Play, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Truck, 
  BarChart3, 
  FileText, 
  AlertCircle,
  Brain,
  Zap,
  Target,
  DollarSign,
  Users,
  Building2,
  Loader,
  Save,
  Database
} from 'lucide-react';
import { FileUpload } from './FileUpload';
import { TemplateDownload } from './TemplateDownload';
import { PricingSettingsComponent } from './PricingSettings';
import { ProcessingStatus } from './ProcessingStatus';
import { ResultsTable } from './ResultsTable';
import { ApiKeyInput } from './ApiKeyInput';
import { CarrierSelection } from './CarrierSelection';
import { parseCSV, parseXLSX } from '../utils/fileParser';
import { Project44APIClient, FreshXAPIClient } from '../utils/apiClient';
import { useRFQProcessor } from '../hooks/useRFQProcessor';
import { useCarrierManagement } from '../hooks/useCarrierManagement';
import { usePricingSettings } from '../hooks/usePricingSettings';
import { 
  RFQRow, 
  PricingSettings,
  Project44OAuthConfig,
  SmartQuotingResult
} from '../types';
import { 
  saveProject44Config, 
  loadProject44Config,
  saveFreshXApiKey,
  loadFreshXApiKey,
  saveSelectedCarriers,
  loadSelectedCarriers
} from '../utils/credentialStorage';
import { saveRFQBatch, calculateBatchSummary } from '../utils/rfqBatchManager';
import * as XLSX from 'xlsx';

interface UnifiedRFQToolProps {
  project44Client: Project44APIClient | null;
  freshxClient: FreshXAPIClient | null;
  initialPricingSettings: PricingSettings;
  initialSelectedCustomer: string;
}

export const UnifiedRFQTool: React.FC<UnifiedRFQToolProps> = ({
  project44Client: initialProject44Client,
  freshxClient: initialFreshxClient,
  initialPricingSettings,
  initialSelectedCustomer
}) => {
  // Core state
  const [rfqData, setRfqData] = useState<RFQRow[]>([]);
  const [fileError, setFileError] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  
  // API configuration
  const [project44Config, setProject44Config] = useState<Project44OAuthConfig>({
    oauthUrl: '/api/v4/oauth2/token',
    basicUser: '',
    basicPassword: '',
    clientId: '',
    clientSecret: '',
    ratingApiUrl: '/api/v4/ltl/quotes/rates/query'
  });
  const [freshxApiKey, setFreshxApiKey] = useState('');
  const [isProject44Valid, setIsProject44Valid] = useState(false);
  const [isFreshXValid, setIsFreshXValid] = useState(false);
  
  // API clients
  const [project44Client, setProject44Client] = useState<Project44APIClient | null>(initialProject44Client);
  const [freshxClient, setFreshxClient] = useState<FreshXAPIClient | null>(initialFreshxClient);
  
  // Auto-save state
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedBatch, setLastSavedBatch] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string>('');

  // Use consolidated hooks
  const carrierManagement = useCarrierManagement({ project44Client });
  const { 
    pricingSettings, 
    selectedCustomer, 
    updatePricingSettings, 
    updateSelectedCustomer 
  } = usePricingSettings(initialPricingSettings);
  
  const rfqProcessor = useRFQProcessor({ 
    project44Client, 
    freshxClient 
  });

  // Load saved data on component mount
  useEffect(() => {
    console.log('🔄 Loading saved configuration from local storage...');
    
    // Load Project44 config
    const savedProject44Config = loadProject44Config();
    if (savedProject44Config) {
      console.log('✅ Loaded saved Project44 config');
      setProject44Config(savedProject44Config);
      const client = new Project44APIClient(savedProject44Config);
      setProject44Client(client);
      setIsProject44Valid(true);
    }
    
    // Load FreshX API key
    const savedFreshXKey = loadFreshXApiKey();
    if (savedFreshXKey) {
      console.log('✅ Loaded saved FreshX API key');
      setFreshxApiKey(savedFreshXKey);
      const client = new FreshXAPIClient(savedFreshXKey);
      setFreshxClient(client);
      setIsFreshXValid(true);
    }
    
    // Load selected carriers
    const savedCarriers = loadSelectedCarriers();
    if (savedCarriers) {
      console.log('✅ Loaded saved carrier selection');
      carrierManagement.setSelectedCarriers(savedCarriers);
    }
    
    // Set initial customer
    updateSelectedCustomer(initialSelectedCustomer);
  }, []);

  // Auto-save RFQ batch after processing completes
  useEffect(() => {
    const autoSaveBatch = async () => {
      // Only save if we have results and processing is complete
      if (rfqProcessor.results.length > 0 && 
          !rfqProcessor.processingStatus.isProcessing && 
          rfqData.length > 0) {
        
        console.log('💾 Auto-saving RFQ batch to database...');
        setIsSaving(true);
        setSaveError('');
        
        try {
          // Generate batch name with timestamp
          const timestamp = new Date().toISOString().slice(0, 19).replace('T', '_');
          const batchName = fileName 
            ? `${fileName.replace(/\.[^/.]+$/, '')}_${timestamp}`
            : `RFQ_Batch_${timestamp}`;
          
          // Calculate summary statistics
          const summary = calculateBatchSummary(rfqProcessor.results);
          
          // Prepare batch data
          const batchData = {
            batch_name: batchName,
            customer_name: selectedCustomer || null,
            shipment_count: rfqData.length,
            total_quotes_received: summary.total_quotes_received,
            best_total_price: summary.best_total_price,
            total_profit: summary.total_profit,
            pricing_settings: pricingSettings,
            selected_carriers: carrierManagement.selectedCarriers,
            rfq_data: rfqData,
            results_data: rfqProcessor.results,
            created_by: 'unified_rfq_tool'
          };
          
          // Save to database
          const savedBatch = await saveRFQBatch(batchData);
          setLastSavedBatch(savedBatch.id!);
          
          console.log('✅ RFQ batch auto-saved successfully:', savedBatch.id);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Failed to save batch';
          setSaveError(errorMsg);
          console.error('❌ Failed to auto-save RFQ batch:', error);
        } finally {
          setIsSaving(false);
        }
      }
    };

    // Debounce the auto-save to avoid multiple saves
    const timeoutId = setTimeout(autoSaveBatch, 2000);
    return () => clearTimeout(timeoutId);
  }, [rfqProcessor.results, rfqProcessor.processingStatus.isProcessing, rfqData, selectedCustomer, pricingSettings, carrierManagement.selectedCarriers, fileName]);

  const handleProject44ConfigChange = (config: Project44OAuthConfig) => {
    console.log('🔧 Project44 config updated, creating new client...');
    setProject44Config(config);
    saveProject44Config(config);
    
    const client = new Project44APIClient(config);
    setProject44Client(client);
  };

  const handleProject44Validation = (isValid: boolean) => {
    console.log('🔍 Project44 validation result:', isValid);
    setIsProject44Valid(isValid);
  };

  const handleFreshXKeyChange = (apiKey: string) => {
    console.log('🔧 FreshX API key updated, creating new client...');
    setFreshxApiKey(apiKey);
    saveFreshXApiKey(apiKey);
    
    const client = new FreshXAPIClient(apiKey);
    setFreshxClient(client);
  };

  const handleFreshXValidation = (isValid: boolean) => {
    console.log('🔍 FreshX validation result:', isValid);
    setIsFreshXValid(isValid);
  };

  const handleFileSelect = async (file: File) => {
    setFileError('');
    setFileName(file.name);
    rfqProcessor.clearResults();
    
    try {
      console.log('📁 Processing file:', file.name);
      
      let parsedData: RFQRow[];
      
      if (file.name.endsWith('.csv')) {
        parsedData = await parseCSV(file, true);
      } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        parsedData = await parseXLSX(file, true);
      } else {
        throw new Error('Unsupported file format. Please use CSV or XLSX files.');
      }
      
      if (parsedData.length === 0) {
        throw new Error('No valid data found in file');
      }
      
      setRfqData(parsedData);
      console.log(`✅ Successfully parsed ${parsedData.length} RFQ rows`);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to parse file';
      setFileError(errorMessage);
      console.error('❌ File parsing error:', error);
    }
  };

  const handleProcessRFQs = async () => {
    if (rfqData.length === 0) {
      setFileError('No RFQ data to process. Please upload a file first.');
      return;
    }

    const selectedCarrierIds = carrierManagement.getSelectedCarrierIds();
    
    if (selectedCarrierIds.length === 0 && !isFreshXValid) {
      setFileError('Please select at least one carrier or configure FreshX API for reefer shipments.');
      return;
    }

    console.log('🚀 Starting Smart Quoting RFQ processing...');
    
    try {
      await rfqProcessor.processMultipleRFQs(rfqData, {
        selectedCarriers: carrierManagement.selectedCarriers,
        pricingSettings,
        selectedCustomer
      });
      
      console.log('🏁 Smart Quoting RFQ processing completed');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Processing failed';
      setFileError(errorMessage);
      console.error('❌ RFQ processing error:', error);
    }
  };

  const handleExportResults = () => {
    if (rfqProcessor.results.length === 0) {
      console.log('⚠️ No results to export');
      return;
    }

    console.log('📊 Exporting results to Excel...');
    
    try {
      const workbook = XLSX.utils.book_new();
      
      // Create summary sheet
      const summaryData = [
        ['RFQ Processing Summary'],
        [''],
        ['Total RFQs Processed', rfqProcessor.results.length],
        ['Total Quotes Received', rfqProcessor.results.reduce((sum, r) => sum + r.quotes.length, 0)],
        ['Successful RFQs', rfqProcessor.results.filter(r => r.status === 'success').length],
        ['Failed RFQs', rfqProcessor.results.filter(r => r.status === 'error').length],
        ['Processing Date', new Date().toLocaleString()],
        ['Customer', selectedCustomer || 'None selected'],
        ['Batch ID', lastSavedBatch || 'Not saved'],
        ['']
      ];
      
      const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summaryWs, 'Summary');
      
      // Create detailed results sheet
      const detailedData: any[][] = [];
      
      // Headers
      const headers = [
        'RFQ #', 'Status', 'Quoting Decision', 'Origin ZIP', 'Destination ZIP', 
        'Pallets', 'Weight (lbs)', 'Temperature', 'Quotes Received', 'Best Price', 
        'Best Carrier', 'Best Service Level', 'Transit Days', 'Profit', 'Error'
      ];
      detailedData.push(headers);
      
      // Data rows
      rfqProcessor.results.forEach((result, index) => {
        const smartResult = result as SmartQuotingResult;
        const bestQuote = result.quotes.length > 0 
          ? result.quotes.reduce((best, current) => 
              (current as any).customerPrice < (best as any).customerPrice ? current : best
            )
          : null;
        
        const row = [
          index + 1,
          result.status,
          smartResult.quotingDecision || 'N/A',
          result.originalData.fromZip,
          result.originalData.toZip,
          result.originalData.pallets,
          result.originalData.grossWeight,
          result.originalData.temperature || 'AMBIENT',
          result.quotes.length,
          bestQuote ? (bestQuote as any).customerPrice || 0 : 0,
          bestQuote ? bestQuote.carrier.name : '',
          bestQuote ? bestQuote.serviceLevel?.description || 'Standard' : '',
          bestQuote ? bestQuote.transitDays || 'N/A' : '',
          bestQuote ? (bestQuote as any).profit || 0 : 0,
          result.error || ''
        ];
        detailedData.push(row);
      });
      
      const detailedWs = XLSX.utils.aoa_to_sheet(detailedData);
      XLSX.utils.book_append_sheet(workbook, detailedWs, 'Detailed Results');
      
      // Create quotes sheet
      const quotesData: any[][] = [];
      const quoteHeaders = [
        'RFQ #', 'Carrier', 'Service Level', 'Customer Price', 'Carrier Rate', 
        'Profit', 'Margin %', 'Transit Days', 'Quote ID', 'Contract ID'
      ];
      quotesData.push(quoteHeaders);
      
      rfqProcessor.results.forEach((result, rfqIndex) => {
        result.quotes.forEach(quote => {
          const quoteWithPricing = quote as any;
          const row = [
            rfqIndex + 1,
            quote.carrier.name,
            quote.serviceLevel?.description || 'Standard',
            quoteWithPricing.customerPrice || 0,
            quoteWithPricing.carrierTotalRate || 0,
            quoteWithPricing.profit || 0,
            quoteWithPricing.appliedMarginPercentage?.toFixed(1) || '0.0',
            quote.transitDays || 'N/A',
            quote.id || quote.quoteId,
            quote.contractId || ''
          ];
          quotesData.push(row);
        });
      });
      
      const quotesWs = XLSX.utils.aoa_to_sheet(quotesData);
      XLSX.utils.book_append_sheet(workbook, quotesWs, 'All Quotes');
      
      // Generate filename
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
      const filename = `smart-quoting-results-${timestamp}.xlsx`;
      
      // Download file
      XLSX.writeFile(workbook, filename);
      console.log('✅ Results exported successfully');
      
    } catch (error) {
      console.error('❌ Export failed:', error);
      setFileError('Failed to export results');
    }
  };

  const handleCarrierSelectionChange = (carrierId: string, selected: boolean) => {
    carrierManagement.handleCarrierToggle(carrierId, selected);
    // Save updated selection
    const updatedSelection = { ...carrierManagement.selectedCarriers, [carrierId]: selected };
    saveSelectedCarriers(updatedSelection);
  };

  const handleSelectAllCarriers = (selected: boolean) => {
    carrierManagement.handleSelectAll(selected);
    saveSelectedCarriers(carrierManagement.selectedCarriers);
  };

  const handleSelectAllInGroup = (groupCode: string, selected: boolean) => {
    carrierManagement.handleSelectAllInGroup(groupCode, selected);
    saveSelectedCarriers(carrierManagement.selectedCarriers);
  };

  const handlePriceUpdate = (resultIndex: number, quoteId: number, newPrice: number) => {
    rfqProcessor.updateQuotePricing(resultIndex, quoteId, newPrice, {
      pricingSettings,
      selectedCustomer
    });
  };

  const canProcess = rfqData.length > 0 && 
    (carrierManagement.getSelectedCarrierCount() > 0 || isFreshXValid) && 
    !rfqProcessor.processingStatus.isProcessing;

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-xl shadow-xl text-white p-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3">
              <Brain className="h-8 w-8 text-white" />
            </div>
            <div>
              <h2 className="text-3xl font-bold">Smart Quoting Engine</h2>
              <p className="text-blue-100 mt-2">
                Automatically routes shipments to optimal networks: <strong>FreshX</strong> for reefer, 
                <strong>Project44</strong> for LTL/VLTL based on intelligent classification
              </p>
            </div>
          </div>
          
          {/* Auto-save Status */}
          <div className="text-right">
            {isSaving && (
              <div className="flex items-center space-x-2 text-blue-100 mb-2">
                <Loader className="h-4 w-4 animate-spin" />
                <span className="text-sm">Auto-saving...</span>
              </div>
            )}
            {lastSavedBatch && !isSaving && (
              <div className="flex items-center space-x-2 text-green-100 mb-2">
                <Database className="h-4 w-4" />
                <span className="text-sm">Saved to database</span>
              </div>
            )}
            {saveError && (
              <div className="flex items-center space-x-2 text-red-200 mb-2">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">Save failed</span>
              </div>
            )}
            <div className="text-sm text-blue-100">
              {rfqData.length > 0 && `${rfqData.length} RFQ${rfqData.length !== 1 ? 's' : ''} loaded`}
            </div>
          </div>
        </div>
      </div>

      {/* Configuration Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* API Configuration */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Settings className="h-5 w-5 mr-2 text-blue-600" />
              API Configuration
            </h3>
            
            <div className="space-y-6">
              <ApiKeyInput
                value={project44Config.clientId}
                onChange={(clientId) => handleProject44ConfigChange({ ...project44Config, clientId })}
                onValidation={handleProject44Validation}
                isProject44={true}
                onOAuthConfigChange={handleProject44ConfigChange}
              />
              
              <ApiKeyInput
                value={freshxApiKey}
                onChange={handleFreshXKeyChange}
                onValidation={handleFreshXValidation}
                placeholder="Enter your FreshX API key"
              />
            </div>
          </div>

          {/* Template Download */}
          <TemplateDownload isProject44={true} />
        </div>

        {/* Pricing & Customer Settings */}
        <div className="space-y-6">
          <PricingSettingsComponent
            settings={pricingSettings}
            onSettingsChange={updatePricingSettings}
            selectedCustomer={selectedCustomer}
            onCustomerChange={updateSelectedCustomer}
            showAsCard={true}
          />
        </div>
      </div>

      {/* Carrier Selection */}
      {isProject44Valid && (
        <CarrierSelection
          carrierGroups={carrierManagement.carrierGroups}
          selectedCarriers={carrierManagement.selectedCarriers}
          onToggleCarrier={handleCarrierSelectionChange}
          onSelectAll={handleSelectAllCarriers}
          onSelectAllInGroup={handleSelectAllInGroup}
          isLoading={carrierManagement.isLoadingCarriers}
        />
      )}

      {/* File Upload and Processing */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Upload className="h-5 w-5 mr-2 text-green-600" />
          Upload & Process RFQs
        </h3>
        
        <div className="space-y-6">
          <FileUpload
            onFileSelect={handleFileSelect}
            error={fileError}
            isProcessing={rfqProcessor.processingStatus.isProcessing}
          />
          
          {rfqData.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="font-medium text-blue-900">
                      {rfqData.length} RFQ{rfqData.length !== 1 ? 's' : ''} ready for processing
                    </p>
                    <p className="text-sm text-blue-700">
                      Smart routing will automatically classify and quote each shipment
                    </p>
                  </div>
                </div>
                
                <button
                  onClick={handleProcessRFQs}
                  disabled={!canProcess}
                  className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                    canProcess
                      ? 'bg-green-600 hover:bg-green-700 text-white shadow-md hover:shadow-lg'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <Play className="h-5 w-5" />
                  <span>Process RFQs</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Processing Status */}
      {rfqProcessor.processingStatus.isProcessing && (
        <ProcessingStatus
          total={rfqProcessor.processingStatus.totalSteps}
          completed={rfqProcessor.processingStatus.currentStep}
          success={rfqProcessor.results.filter(r => r.status === 'success').length}
          errors={rfqProcessor.results.filter(r => r.status === 'error').length}
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
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <BarChart3 className="h-5 w-5 mr-2 text-green-600" />
                Processing Results
              </h3>
              
              <div className="flex items-center space-x-4">
                {/* Auto-save indicator */}
                {lastSavedBatch && (
                  <div className="flex items-center space-x-2 text-green-600 bg-green-50 px-3 py-1 rounded-full">
                    <Save className="h-4 w-4" />
                    <span className="text-sm font-medium">Auto-saved</span>
                  </div>
                )}
                
                <button
                  onClick={handleExportResults}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Download className="h-4 w-4" />
                  <span>Export Results</span>
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-blue-600">{rfqProcessor.results.length}</div>
                <div className="text-sm text-blue-700">Total RFQs</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-green-600">
                  {rfqProcessor.results.filter(r => r.status === 'success').length}
                </div>
                <div className="text-sm text-green-700">Successful</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {rfqProcessor.results.reduce((sum, r) => sum + r.quotes.length, 0)}
                </div>
                <div className="text-sm text-purple-700">Total Quotes</div>
              </div>
              <div className="bg-orange-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {rfqProcessor.results.filter(r => r.status === 'error').length}
                </div>
                <div className="text-sm text-orange-700">Errors</div>
              </div>
            </div>
          </div>

          {/* Detailed Results Table */}
          <ResultsTable
            results={rfqProcessor.results}
            onExport={handleExportResults}
            onPriceUpdate={handlePriceUpdate}
          />
        </div>
      )}

      {/* Error Display */}
      {rfqProcessor.processingStatus.error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2 text-red-700">
            <XCircle className="h-5 w-5" />
            <span className="font-medium">Processing Error:</span>
          </div>
          <p className="text-red-600 mt-1">{rfqProcessor.processingStatus.error}</p>
        </div>
      )}
    </div>
  );
};