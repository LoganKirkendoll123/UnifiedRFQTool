import React, { useState, useEffect } from 'react';
import { CarrierSelection } from './components/CarrierSelection';
import { PricingSettingsComponent } from './components/PricingSettings';
import { ProcessingStatus } from './components/ProcessingStatus';
import { ResultsTable } from './components/ResultsTable';
import { ApiKeyInput } from './components/ApiKeyInput';
import { FileUpload } from './components/FileUpload';
import { TemplateDownload } from './components/TemplateDownload';
import { UnifiedRFQTool } from './components/UnifiedRFQTool';
import { parseCSV, parseXLSX } from './utils/fileParser';
import { Project44APIClient, FreshXAPIClient } from './utils/apiClient';
import { 
  RFQRow, 
  PricingSettings,
  ProcessingResult,
  QuoteWithPricing,
  Project44OAuthConfig,
} from './types';
import { 
  saveProject44Config, 
  loadProject44Config,
  saveFreshXApiKey,
  loadFreshXApiKey,
  saveSelectedCarriers,
  loadSelectedCarriers,
  savePricingSettings,
  loadPricingSettings
} from './utils/credentialStorage';
import { clearMarginCache } from './utils/pricingCalculator';
import { useRFQProcessor } from './hooks/useRFQProcessor';
import { useCarrierManagement } from './hooks/useCarrierManagement';
import { PastBatchManager } from './components/PastBatchManager';
import { MarginAnalysisMode } from './components/MarginAnalysisMode';
import { 
  Truck, 
  Upload, 
  Settings, 
  BarChart3, 
  FileText, 
  AlertCircle,
  CheckCircle,
  Loader,
  RefreshCw,
  Users,
  Play,
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
  Calculator
} from 'lucide-react';
import * as XLSX from 'xlsx';

function App() {
  // Core state
  const [rfqData, setRfqData] = useState<RFQRow[]>([]);
  
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
  
  const [pricingSettings, setPricingSettings] = useState<PricingSettings>({
    markupPercentage: 15,
    minimumProfit: 100,
    markupType: 'percentage',
    usesCustomerMargins: false,
    fallbackMarkupPercentage: 23
  });
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  
  // UI state
  const [activeTab, setActiveTab] = useState<'unified' | 'batches' | 'margin-analysis'>('unified');
  const [fileError, setFileError] = useState<string>('');
  
  // API clients - store as instance variables to maintain token state
  const [project44Client, setProject44Client] = useState<Project44APIClient | null>(null);
  const [freshxClient, setFreshxClient] = useState<FreshXAPIClient | null>(null);

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
      // Create client instance with saved config
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
    
    // Load pricing settings
    const savedPricing = loadPricingSettings();
    if (savedPricing) {
      console.log('✅ Loaded saved pricing settings');
      setPricingSettings(savedPricing);
    }
  }, []);

  const handleProject44ConfigChange = (config: Project44OAuthConfig) => {
    console.log('🔧 Project44 config updated, creating new client...');
    setProject44Config(config);
    saveProject44Config(config);
    
    // Create new client instance with updated config
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
    
    // Create new client instance with updated key
    const client = new FreshXAPIClient(apiKey);
    setFreshxClient(client);
  };

  const handleFreshXValidation = (isValid: boolean) => {
    console.log('🔍 FreshX validation result:', isValid);
    setIsFreshXValid(isValid);
  };


  const handlePricingSettingsChange = (settings: PricingSettings) => {
    setPricingSettings(settings);
    savePricingSettings(settings);
  };

  const handleCustomerChange = (customer: string) => {
    setSelectedCustomer(customer);
    // Clear margin cache when customer changes
    clearMarginCache();
    console.log(`👤 Customer changed to: ${customer || 'None'}`);
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Professional Header */}
      <header className="bg-white shadow-lg border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center space-x-4">
              <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-3 rounded-xl shadow-lg">
                <DollarSign className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
                  FreightIQ Pro
                </h1>
                <p className="text-sm text-slate-600 font-medium">Enterprise Freight Quoting Platform</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-6">
              {/* Enterprise Badge */}
              <div className="flex items-center space-x-3 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl px-4 py-2 border border-emerald-200">
                <div className="flex items-center space-x-2">
                  <Shield className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-semibold text-emerald-800">Enterprise Edition</span>
                </div>
                <div className="h-4 w-px bg-emerald-300"></div>
                <div className="flex items-center space-x-1">
                  <Star className="h-4 w-4 text-amber-500 fill-current" />
                  <span className="text-xs font-medium text-slate-600">Automated</span>
                </div>
              </div>
              
              {/* Connection Status */}
              <div className="flex items-center space-x-4 bg-slate-50 rounded-lg px-4 py-2 border">
                <div className="flex items-center space-x-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${isProject44Valid ? 'bg-emerald-500 shadow-emerald-500/50 shadow-lg' : 'bg-red-400'}`} />
                  <span className="text-sm font-medium text-slate-700">Project44</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${isFreshXValid ? 'bg-emerald-500 shadow-emerald-500/50 shadow-lg' : 'bg-red-400'}`} />
                  <span className="text-sm font-medium text-slate-700">FreshX</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Smart Quoting Hero Banner */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3">
                <DollarSign className="h-8 w-8 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Automated Freight Quoting Engine</h2>
                <p className="text-blue-100 mt-1">
                  Automatically quotes shipments across optimal networks: <strong>FreshX</strong> for reefer, 
                  <strong>Project44</strong> for LTL/VLTL based on intelligent classification
                </p>
              </div>
            </div>
            <div className="hidden lg:flex items-center space-x-6 text-white">
              <div className="text-center">
                <div className="text-2xl font-bold">99.9%</div>
                <div className="text-sm text-blue-100">Uptime</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">50+</div>
                <div className="text-sm text-blue-100">Carriers</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">24/7</div>
                <div className="text-sm text-blue-100">Support</div>
              </div>
            </div>
          </div>
        </div>
      </div>


      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Configuration Status Banner */}
        {(!isProject44Valid || !isFreshXValid) && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <p className="font-medium mb-2">⚠️ API Configuration Required</p>
                <div className="space-y-1 text-xs">
                  {!isProject44Valid && (
                    <p>• <strong>Project44:</strong> Configure your OAuth Client ID and Client Secret to load carriers and get LTL quotes</p>
                  )}
                  {!isFreshXValid && (
                    <p>• <strong>FreshX:</strong> Configure your API key to get refrigerated freight quotes</p>
                  )}
                  <p className="mt-2 text-amber-700">
                    <strong>Note:</strong> The app will work with limited functionality until these APIs are configured.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="flex space-x-8">
              <button
                onClick={() => setActiveTab('unified')}
                className={`flex items-center space-x-2 py-4 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'unified'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Play className="h-4 w-4" />
                <span>Smart Quoting</span>
              </button>
              
              <button
                onClick={() => setActiveTab('batches')}
                className={`flex items-center space-x-2 py-4 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'batches'
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <BarChart3 className="h-4 w-4" />
                <span>Batch History & Analytics</span>
              </button>
              
              <button
                onClick={() => setActiveTab('margin-analysis')}
                className={`flex items-center space-x-2 py-4 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'margin-analysis'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Calculator className="h-4 w-4" />
                <span>Margin Analysis</span>
              </button>
            </nav>
          </div>
        </div>

          {activeTab === 'unified' && (
            <UnifiedRFQTool
              project44Client={project44Client}
              freshxClient={freshxClient}
              initialPricingSettings={pricingSettings}
              initialSelectedCustomer={selectedCustomer}
            />
          )}
          
          {activeTab === 'batches' && (
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="bg-purple-600 p-2 rounded-lg">
                    <BarChart3 className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">Batch History & Analytics</h2>
                    <p className="text-sm text-gray-600">
                      View past RFQ batches, reprocess with current settings, and analyze market changes
                    </p>
                  </div>
                </div>
              </div>
              
              <PastBatchManager
                project44Client={project44Client}
                freshxClient={freshxClient}
                onClose={() => {}} // Not needed since it's not a modal
                pricingSettings={pricingSettings}
                selectedCustomer={selectedCustomer}
                onBatchSettingsLoad={(customer, carriers, settings) => {
                  // Auto-switch to unified tab and load settings
                  setSelectedCustomer(customer);
                  carrierManagement.setSelectedCarriers(carriers);
                  setPricingSettings(settings);
                  setActiveTab('unified');
                }}
              />
            </div>
          )}
          
          {activeTab === 'margin-analysis' && (
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="bg-green-600 p-2 rounded-lg">
                    <Calculator className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">Customer-Carrier Margin Analysis</h2>
                    <p className="text-sm text-gray-600">
                      Select a past batch, reprocess with current settings, and determine optimal margins per customer per carrier
                    </p>
                  </div>
                </div>
              </div>
              
              <MarginAnalysisMode
                project44Client={project44Client}
                freshxClient={freshxClient}
                rfqProcessor={rfqProcessor}
                pricingSettings={pricingSettings}
                selectedCustomer={selectedCustomer}
                onMarginRecommendation={(customer, carrier, recommendedMargin) => {
                  console.log(`💰 Margin recommendation: ${customer} + ${carrier} = ${recommendedMargin}%`);
                }}
              />
            </div>
          )}

      </main>
    </div>
  );
}

export default App;