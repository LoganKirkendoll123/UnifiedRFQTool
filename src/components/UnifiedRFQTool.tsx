import React, { useState, useEffect, useCallback } from 'react';
import { 
  Upload, 
  Play, 
  Settings, 
  BarChart3, 
  FileText, 
  AlertCircle,
  CheckCircle,
  Loader,
  RefreshCw,
  Users,
  ArrowRight,
  Brain,
  Zap,
  Target,
  Shield,
  TrendingUp,
  Clock,
  DollarSign,
  Award,
  Star,
  Sparkles,
  Building2,
  Globe,
  Layers,
  History,
  Save,
  Download
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
import { 
  RFQRow, 
  PricingSettings,
  Project44OAuthConfig,
} from '../types';
import { 
  saveProject44Config, 
  loadProject44Config,
  saveFreshXApiKey,
  loadFreshXApiKey,
  saveSelectedCarriers,
  loadSelectedCarriers,
  savePricingSettings,
  loadPricingSettings
} from '../utils/credentialStorage';
import { clearMarginCache } from '../utils/pricingCalculator';
import { Project44APIClient, FreshXAPIClient } from '../utils/apiClient';
import { ApiKeyInput } from './ApiKeyInput';
import { 
  loadRFQBatch, 
  updateRFQBatch, 
  generateBatchName,
  saveRFQBatch
} from '../utils/rfqStorage';
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
  
  // UI state
  const [activeTab, setActiveTab] = useState<'upload' | 'settings' | 'carriers' | 'results'>('upload');
  const [fileError, setFileError] = useState<string>('');
  const [showPastRFQSelector, setShowPastRFQSelector] = useState(false);
  const [pastRFQData, setPastRFQData] = useState<RFQRow[]>([]);
  const [currentBatchName, setCurrentBatchName] = useState<string>('');
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
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

  // Use consolidated hooks
  const carrierManagement = useCarrierManagement({ project44Client });
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
      setIsProject44Valid(true);
    }
    
    // Load FreshX API key
    const savedFreshXKey = loadFreshXApiKey();
    if (savedFreshXKey) {
      console.log('✅ Loaded saved FreshX API key');
      setFreshxApiKey(savedFreshXKey);
      setIsFreshXValid(true);
    }
    
    // Load selected carriers
    const savedCarriers = loadSelectedCarriers();
    if (savedCarriers) {
      console.log('✅ Loaded saved carrier selection');
      carrierManagement.setSelectedCarriers(savedCarriers);
    }
    
    // Load pricing settings
    const savedPricing = loadPricingSettings();
    if (savedPricing) {
      console.log('✅ Loaded saved pricing settings');
      setPricingSettings(savedPricing);
    }
  }, []);

  const handleProject44ConfigChange = (config: Project44OAuthConfig) => {
    console.log('🔧 Project44 config updated');
    setProject44Config(config);
    saveProject44Config(config);
  };

  const handleProject44Validation = (isValid: boolean) => {
    console.log('🔍 Project44 validation result:', isValid);
    setIsProject44Valid(isValid);
  };

  const handleFreshXKeyChange = (apiKey: string) => {
    console.log('🔧 FreshX API key updated');
    setFreshxApiKey(apiKey);
    saveFreshXApiKey(apiKey);
  };

  const handleFreshXValidation = (isValid: boolean) => {
    console.log('🔍 FreshX validation result:', isValid);
    setIsFreshXValid(isValid);
  };

  const handlePricingSettingsChange = (settings: PricingSettings) => {
    setPricingSettings(settings);
    savePricingSettings(settings);
    setHasUnsavedChanges(true);
  };

  const handleCustomerChange = (customer: string) => {
    setSelectedCustomer(customer);
    clearMarginCache();
    setHasUnsavedChanges(true);
    console.log(`👤 Customer changed to: ${customer || 'None'}`);
  };

  const handleFileSelect = async (file: File) => {
    setFileError('');
    try {
      console.log('📁 Processing file:', file.name);
      
      let data: RFQRow[];
      if (file.name.toLowerCase().endsWith('.csv')) {
        data = await parseCSV(file, true);
      } else {
        data = await parseXLSX(file, true);
      }
      
      console.log(`✅ Parsed ${data.length} RFQ rows from file`);
      setRfqData(data);
      setPastRFQData([]); // Clear past RFQ data when new file is uploaded
      setCurrentBatchName('');
      setCurrentBatchId(null);
      setHasUnsavedChanges(false);
      setActiveTab('settings');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to parse file';
      console.error('❌ File parsing error:', errorMsg);
      setFileError(errorMsg);
    }
  };

  const handleProcessRFQs = async () => {
    if (rfqData.length === 0 && pastRFQData.length === 0) {
      setFileError('Please upload RFQ data or select a past RFQ batch first');
      return;
    }

    const dataToProcess = rfqData.length > 0 ? rfqData : pastRFQData;
    const selectedCarrierIds = carrierManagement.getSelectedCarrierIds();

    if (selectedCarrierIds.length === 0) {
      setFileError('Please select at least one carrier');
      setActiveTab('carriers');
      return;
    }

    try {
      console.log('🚀 Starting RFQ processing...');
      setActiveTab('results');
      
      // Generate batch name if not already set
      let batchName = currentBatchName;
      if (!batchName) {
        batchName = generateBatchName(dataToProcess, selectedCustomer);
        setCurrentBatchName(batchName);
      }

      // Process RFQs with real-time saving
      await rfqProcessor.processMultipleRFQs(
        dataToProcess,
        {
          selectedCarriers: carrierManagement.selectedCarriers,
          pricingSettings,
          selectedCustomer
        },
        batchName // Pass batch name for real-time saving
      );

      setHasUnsavedChanges(false);
      console.log('✅ RFQ processing completed with real-time saving');
    } catch (error) {
      console.error('❌ RFQ processing failed:', error);
      setFileError(error instanceof Error ? error.message : 'Processing failed');
    }
  };

  const handlePastRFQBatchSelect = async (batchId: string) => {
    try {
      console.log('📥 Loading past RFQ batch:', batchId);
      setShowPastRFQSelector(false);
      
      // Load the batch data
      const batchData = await loadRFQBatch(batchId);
      if (!batchData) {
        console.warn('⚠️ Batch not found, clearing selection');
        setPastRFQData([]);
        setCurrentBatchName('');
        setCurrentBatchId(null);
        return;
      }

      // Set the RFQ data
      setPastRFQData(batchData.rfq_data);
      setRfqData([]); // Clear current RFQ data
      setCurrentBatchName(batchData.batch_name);
      setCurrentBatchId(batchData.id);
      
      // Load the settings from the batch
      setPricingSettings(batchData.pricing_settings);
      setSelectedCustomer(batchData.customer_name || '');
      carrierManagement.setSelectedCarriers(batchData.selected_carriers);
      
      // Load past results if available
      if (batchData.results_data && batchData.results_data.length > 0) {
        console.log('📊 Loading past results...');
        await rfqProcessor.loadPastRFQResults(batchId);
        setActiveTab('results');
      } else {
        setActiveTab('settings');
      }
      
      setHasUnsavedChanges(false);
      console.log('✅ Past RFQ batch loaded successfully');
    } catch (error) {
      console.error('❌ Failed to load past RFQ batch:', error);
      setPastRFQData([]);
      setCurrentBatchName('');
      setCurrentBatchId(null);
      setFileError('Failed to load past RFQ data. Please try again.');
    }
  };

  const handleSaveCurrentBatch = async () => {
    if (rfqProcessor.results.length === 0) {
      setFileError('No results to save');
      return;
    }

    try {
      console.log('💾 Saving current batch...');
      
      const dataToSave = rfqData.length > 0 ? rfqData : pastRFQData;
      let batchName = currentBatchName;
      
      if (!batchName) {
        batchName = generateBatchName(dataToSave, selectedCustomer);
        setCurrentBatchName(batchName);
      }

      if (currentBatchId) {
        // Update existing batch
        await updateRFQBatch(
          currentBatchId,
          rfqProcessor.results,
          pricingSettings,
          carrierManagement.selectedCarriers,
          selectedCustomer
        );
        console.log('✅ Batch updated successfully');
      } else {
        // Save new batch
        const batchId = await saveRFQBatch(
          batchName,
          dataToSave,
          rfqProcessor.results,
          pricingSettings,
          carrierManagement.selectedCarriers,
          selectedCustomer
        );
        setCurrentBatchId(batchId);
        console.log('✅ New batch saved successfully');
      }
      
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('❌ Failed to save batch:', error);
      setFileError('Failed to save batch. Please try again.');
    }
  };

  const handleExportResults = () => {
    if (rfqProcessor.results.length === 0) {
      setFileError('No results to export');
      return;
    }

    try {
      console.log('📤 Exporting results to Excel...');
      
      // Prepare data for export
      const exportData = rfqProcessor.results.flatMap(result => 
        result.quotes.map(quote => ({
          'RFQ #': result.rowIndex + 1,
          'From ZIP': result.originalData.fromZip,
          'To ZIP': result.originalData.toZip,
          'Pallets': result.originalData.pallets,
          'Weight': result.originalData.grossWeight,
          'Quoting Decision': result.quotingDecision,
          'Carrier': quote.carrier.name,
          'Service Level': quote.serviceLevel?.description || 'Standard',
          'Transit Days': quote.transitDays || 'N/A',
          'Carrier Rate': quote.carrierTotalRate,
          'Customer Price': (quote as any).customerPrice || 0,
          'Profit': (quote as any).profit || 0,
          'Margin %': (quote as any).appliedMarginPercentage?.toFixed(1) || '0.0',
          'Margin Type': (quote as any).appliedMarginType || 'flat'
        }))
      );

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);
      
      // Set column widths
      const colWidths = [
        { wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 10 },
        { wch: 20 }, { wch: 25 }, { wch: 15 }, { wch: 12 }, { wch: 12 },
        { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 12 }
      ];
      ws['!cols'] = colWidths;
      
      XLSX.utils.book_append_sheet(wb, ws, 'RFQ Results');
      
      // Generate filename
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
      const filename = `rfq-results-${timestamp}.xlsx`;
      
      // Download file
      XLSX.writeFile(wb, filename);
      console.log('✅ Results exported successfully');
    } catch (error) {
      console.error('❌ Export failed:', error);
      setFileError('Failed to export results. Please try again.');
    }
  };

  const handleUpdateQuotePricing = (resultIndex: number, quoteId: number, newPrice: number) => {
    rfqProcessor.updateQuotePricing(resultIndex, quoteId, newPrice, {
      pricingSettings,
      selectedCustomer
    });
    setHasUnsavedChanges(true);
  };

  const getTabIcon = (tab: string) => {
    switch (tab) {
      case 'upload': return Upload;
      case 'settings': return Settings;
      case 'carriers': return Users;
      case 'results': return BarChart3;
      default: return FileText;
    }
  };

  const getTabColor = (tab: string) => {
    if (activeTab === tab) return 'bg-blue-600 text-white';
    
    // Show completion status
    switch (tab) {
      case 'upload':
        return (rfqData.length > 0 || pastRFQData.length > 0) ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600';
      case 'settings':
        return 'bg-gray-100 text-gray-600';
      case 'carriers':
        return carrierManagement.getSelectedCarrierCount() > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600';
      case 'results':
        return rfqProcessor.results.length > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  const canProcess = (rfqData.length > 0 || pastRFQData.length > 0) && 
                    carrierManagement.getSelectedCarrierCount() > 0 && 
                    !rfqProcessor.processingStatus.isProcessing;

  return (
    <div className="space-y-6">
      {/* Header with Smart Routing Info */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-3 rounded-xl">
              <Brain className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Smart Multi-Mode RFQ Processor</h2>
              <p className="text-gray-600">Intelligent routing: FreshX for reefer, Project44 for LTL/VLTL</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            {currentBatchName && (
              <div className="text-right">
                <div className="text-sm font-medium text-gray-900">{currentBatchName}</div>
                <div className="text-xs text-gray-500">
                  {hasUnsavedChanges ? 'Unsaved changes' : 'Saved'}
                </div>
              </div>
            )}
            
            <button
              onClick={() => setShowPastRFQSelector(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <History className="h-4 w-4" />
              <span>Past RFQs</span>
            </button>
          </div>
        </div>

        {/* Smart Routing Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <Zap className="h-5 w-5 text-blue-600" />
              <div>
                <div className="font-medium text-blue-900">Smart Classification</div>
                <div className="text-sm text-blue-700">isReefer field controls routing decisions</div>
              </div>
            </div>
          </div>
          
          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <Target className="h-5 w-5 text-green-600" />
              <div>
                <div className="font-medium text-green-900">Dual-Mode Comparison</div>
                <div className="text-sm text-green-700">VLTL shipments get both Volume & Standard quotes</div>
              </div>
            </div>
          </div>
          
          <div className="bg-purple-50 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <Shield className="h-5 w-5 text-purple-600" />
              <div>
                <div className="font-medium text-purple-900">Real-time Saving</div>
                <div className="text-sm text-purple-700">Results saved automatically during processing</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="flex border-b border-gray-200">
          {[
            { id: 'upload', label: 'Upload Data', count: rfqData.length + pastRFQData.length },
            { id: 'settings', label: 'Pricing Settings' },
            { id: 'carriers', label: 'Select Carriers', count: carrierManagement.getSelectedCarrierCount() },
            { id: 'results', label: 'Results', count: rfqProcessor.results.length }
          ].map((tab) => {
            const Icon = getTabIcon(tab.id);
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 px-6 py-4 font-medium transition-colors ${getTabColor(tab.id)}`}
              >
                <Icon className="h-5 w-5" />
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="bg-white bg-opacity-20 px-2 py-1 rounded-full text-xs">
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'upload' && (
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Upload RFQ Data</h3>
                <p className="text-gray-600 mb-6">
                  Upload a CSV or Excel file with your RFQ data, or select from past RFQ batches
                </p>
              </div>

              {(rfqData.length > 0 || pastRFQData.length > 0) ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                    <div>
                      <h4 className="font-medium text-green-900">
                        {pastRFQData.length > 0 ? 'Past RFQ Data Loaded' : 'File Uploaded Successfully'}
                      </h4>
                      <p className="text-green-700">
                        {pastRFQData.length > 0 
                          ? `${pastRFQData.length} RFQs loaded from: ${currentBatchName}`
                          : `${rfqData.length} RFQs ready for processing`
                        }
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <button
                      onClick={() => setActiveTab('settings')}
                      className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <ArrowRight className="h-4 w-4" />
                      <span>Continue to Settings</span>
                    </button>
                    
                    <button
                      onClick={() => {
                        setRfqData([]);
                        setPastRFQData([]);
                        setCurrentBatchName('');
                        setCurrentBatchId(null);
                        setHasUnsavedChanges(false);
                        rfqProcessor.clearResults();
                      }}
                      className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                    >
                      Upload Different File
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <FileUpload
                    onFileSelect={handleFileSelect}
                    error={fileError}
                    isProcessing={rfqProcessor.processingStatus.isProcessing}
                  />
                  
                  <div className="text-center">
                    <div className="text-gray-500 mb-4">or</div>
                    <button
                      onClick={() => setShowPastRFQSelector(true)}
                      className="flex items-center space-x-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors mx-auto"
                    >
                      <History className="h-5 w-5" />
                      <span>Select from Past RFQs</span>
                    </button>
                  </div>
                  
                  <TemplateDownload isProject44={true} />
                </div>
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Configure Pricing Settings</h3>
                <p className="text-gray-600">
                  Set your pricing strategy and customer-specific margins
                </p>
              </div>

              <PricingSettingsComponent
                settings={pricingSettings}
                onSettingsChange={handlePricingSettingsChange}
                selectedCustomer={selectedCustomer}
                onCustomerChange={handleCustomerChange}
                showAsCard={false}
              />

              <div className="flex justify-between">
                <button
                  onClick={() => setActiveTab('upload')}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  ← Back to Upload
                </button>
                <button
                  onClick={() => setActiveTab('carriers')}
                  className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <span>Continue to Carriers</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {activeTab === 'carriers' && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Select Carriers</h3>
                <p className="text-gray-600">
                  Choose which carriers to include in your RFQ
                </p>
              </div>

              {!isProject44Valid ? (
                <div className="space-y-6">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-amber-800">
                        <p className="font-medium mb-2">Project44 Configuration Required</p>
                        <p>Please configure your Project44 OAuth credentials to load carriers and get LTL quotes.</p>
                      </div>
                    </div>
                  </div>

                  <ApiKeyInput
                    value={project44Config.clientId}
                    onChange={(clientId) => handleProject44ConfigChange({ ...project44Config, clientId })}
                    onValidation={handleProject44Validation}
                    isProject44={true}
                    onOAuthConfigChange={handleProject44ConfigChange}
                  />
                </div>
              ) : (
                <CarrierSelection
                  carrierGroups={carrierManagement.carrierGroups}
                  selectedCarriers={carrierManagement.selectedCarriers}
                  onToggleCarrier={carrierManagement.handleCarrierToggle}
                  onSelectAll={carrierManagement.handleSelectAll}
                  onSelectAllInGroup={carrierManagement.handleSelectAllInGroup}
                  isLoading={carrierManagement.isLoadingCarriers}
                />
              )}

              <div className="flex justify-between">
                <button
                  onClick={() => setActiveTab('settings')}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  ← Back to Settings
                </button>
                <button
                  onClick={handleProcessRFQs}
                  disabled={!canProcess}
                  className={`flex items-center space-x-2 px-6 py-2 rounded-lg font-medium transition-colors ${
                    canProcess
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <Play className="h-4 w-4" />
                  <span>Process RFQs</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'results' && (
            <div className="space-y-6">
              {rfqProcessor.processingStatus.isProcessing ? (
                <ProcessingStatus
                  total={rfqProcessor.processingStatus.totalSteps}
                  completed={rfqProcessor.processingStatus.currentStep}
                  success={rfqProcessor.results.filter(r => r.status === 'success').length}
                  errors={rfqProcessor.results.filter(r => r.status === 'error').length}
                  isProcessing={rfqProcessor.processingStatus.isProcessing}
                  currentCarrier={rfqProcessor.processingStatus.currentItem}
                />
              ) : rfqProcessor.results.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Processing Results</h3>
                      <p className="text-gray-600">
                        {rfqProcessor.results.length} RFQ{rfqProcessor.results.length !== 1 ? 's' : ''} processed
                      </p>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      {hasUnsavedChanges && (
                        <button
                          onClick={handleSaveCurrentBatch}
                          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          <Save className="h-4 w-4" />
                          <span>Save Batch</span>
                        </button>
                      )}
                      
                      <button
                        onClick={handleExportResults}
                        className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                      >
                        <Download className="h-4 w-4" />
                        <span>Export Results</span>
                      </button>
                    </div>
                  </div>

                  <ResultsTable
                    results={rfqProcessor.results}
                    onExport={handleExportResults}
                    onPriceUpdate={handleUpdateQuotePricing}
                  />
                </div>
              ) : (
                <div className="text-center py-12">
                  <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Results Yet</h3>
                  <p className="text-gray-600 mb-6">
                    Upload RFQ data and process quotes to see results here
                  </p>
                  <button
                    onClick={() => setActiveTab('upload')}
                    className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors mx-auto"
                  >
                    <Upload className="h-4 w-4" />
                    <span>Upload RFQ Data</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* FreshX Configuration (if needed) */}
      {!isFreshXValid && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">FreshX Configuration (Optional)</h3>
            <p className="text-gray-600">
              Configure FreshX API to get refrigerated freight quotes for reefer shipments
            </p>
          </div>
          
          <ApiKeyInput
            value={freshxApiKey}
            onChange={handleFreshXKeyChange}
            onValidation={handleFreshXValidation}
            placeholder="Enter your FreshX API key"
          />
        </div>
      )}

      {/* Past RFQ Selector Modal */}
      <PastRFQSelector
        isVisible={showPastRFQSelector}
        onSelectBatch={handlePastRFQBatchSelect}
        onClose={() => setShowPastRFQSelector(false)}
      />
    </div>
  );
};