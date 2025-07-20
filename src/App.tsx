import { useState, useEffect } from 'react';
import { UnifiedRFQTool } from './components/UnifiedRFQTool';
import { ApiConfiguration } from './components/ApiConfiguration';
import { Project44APIClient, FreshXAPIClient } from './utils/apiClient';
import { 
  PricingSettings,
  Project44OAuthConfig,
} from './types';
import { 
  loadProject44Config,
  loadFreshXApiKey,
  loadSelectedCarriers,
  loadPricingSettings
} from './utils/credentialStorage';
import { useCarrierManagement } from './hooks/useCarrierManagement';
import { 
  AlertCircle,
  DollarSign,
  Shield,
  Star,
} from 'lucide-react';

function App() {
  // API configuration
  const [, setProject44Config] = useState<Project44OAuthConfig>({
    oauthUrl: '/api/v4/oauth2/token',
    basicUser: '',
    basicPassword: '',
    clientId: '',
    clientSecret: '',
    ratingApiUrl: '/api/v4/ltl/quotes/rates/query'
  });
  const [, setFreshxApiKey] = useState('');
  const [isProject44Valid, setIsProject44Valid] = useState(false);
  const [isFreshXValid, setIsFreshXValid] = useState(false);
  
  const [pricingSettings, setPricingSettings] = useState<PricingSettings>({
    markupPercentage: 15,
    minimumProfit: 100,
    markupType: 'percentage',
    usesCustomerMargins: false,
    fallbackMarkupPercentage: 23
  });
  const [selectedCustomer] = useState<string>('');
  
  // UI state
  // API clients - store as instance variables to maintain token state
  const [project44Client, setProject44Client] = useState<Project44APIClient | null>(null);
  const [freshxClient, setFreshxClient] = useState<FreshXAPIClient | null>(null);
  
  // Handle API configuration changes
  const handleProject44ConfigChange = (config: Project44OAuthConfig, isValid: boolean) => {
    if (isValid) {
      const client = new Project44APIClient(config);
      setProject44Client(client);
      setIsProject44Valid(true);
      
      // Auto-load carriers when valid configuration is provided
      setTimeout(() => {
        carrierManagement.loadCarriers();
      }, 500); // Small delay to ensure client is fully initialized
    } else {
      setProject44Client(null);
      setIsProject44Valid(false);
      
      // Clear carriers when configuration becomes invalid
      carrierManagement.setSelectedCarriers({});
    }
  };
  
  const handleFreshXKeyChange = (apiKey: string, isValid: boolean) => {
    if (isValid && apiKey) {
      const client = new FreshXAPIClient(apiKey);
      setFreshxClient(client);
      setIsFreshXValid(true);
    } else {
      setFreshxClient(null);
      setIsFreshXValid(false);
    }
  };

  // Use consolidated hooks
  const carrierManagement = useCarrierManagement({ project44Client });
  
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
      
      // Auto-load carriers for saved valid configuration
      setTimeout(() => {
        carrierManagement.loadCarriers();
      }, 1000); // Delay to ensure client is ready
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

  // Listen for API test events to reload carriers
  useEffect(() => {
    const handleApiTested = (event: CustomEvent) => {
      if (event.detail.success && project44Client) {
        console.log('🔄 API test successful, reloading carriers...');
        setTimeout(() => {
          carrierManagement.loadCarriers();
        }, 500);
      }
    };

    window.addEventListener('project44ApiTested', handleApiTested as EventListener);
    
    return () => {
      window.removeEventListener('project44ApiTested', handleApiTested as EventListener);
    };
  }, [project44Client, carrierManagement]);

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
        {/* API Configuration Panel */}
        <div className="mb-8">
          <ApiConfiguration
            onProject44ConfigChange={handleProject44ConfigChange}
            onFreshXKeyChange={handleFreshXKeyChange}
            isExpanded={!isProject44Valid || !isFreshXValid}
          />
        </div>
        
        {/* Configuration Status Banner */}
        {(!isProject44Valid || !isFreshXValid) && (
          <div className="mb-8 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <p className="font-medium mb-2">⚠️ Complete API Configuration Above</p>
                <div className="space-y-1 text-xs">
                  {!isProject44Valid && (
                    <p>• <strong>Project44:</strong> Configure your OAuth Client ID and Client Secret to load carriers and get LTL quotes</p>
                  )}
                  {!isFreshXValid && (
                    <p>• <strong>FreshX:</strong> Configure your API key to get refrigerated freight quotes</p>
                  )}
                  <p className="mt-2 text-amber-700">
                    <strong>Note:</strong> Configure the APIs above to unlock full functionality.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Unified RFQ Tool - Main Interface */}
        <UnifiedRFQTool
          project44Client={project44Client}
          freshxClient={freshxClient}
          initialPricingSettings={pricingSettings}
          initialSelectedCustomer={selectedCustomer}
        />

      </main>
    </div>
  );
}

export default App;