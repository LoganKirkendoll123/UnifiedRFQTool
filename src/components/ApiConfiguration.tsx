import React, { useState } from 'react';
import { Settings, Key, Shield, CheckCircle, AlertCircle, Save, Loader } from 'lucide-react';
import { ApiKeyInput } from './ApiKeyInput';
import { Project44OAuthConfig } from '../types';
import { 
  saveProject44Config, 
  saveFreshXApiKey, 
  loadProject44Config, 
  loadFreshXApiKey 
} from '../utils/credentialStorage';

interface ApiConfigurationProps {
  onProject44ConfigChange: (config: Project44OAuthConfig, isValid: boolean) => void;
  onFreshXKeyChange: (apiKey: string, isValid: boolean) => void;
  isExpanded?: boolean;
}

export const ApiConfiguration: React.FC<ApiConfigurationProps> = ({
  onProject44ConfigChange,
  onFreshXKeyChange,
  isExpanded = true
}) => {
  const [isConfigExpanded, setIsConfigExpanded] = useState(isExpanded);
  const [project44ClientId, setProject44ClientId] = useState(() => {
    const config = loadProject44Config();
    return config?.clientId || '';
  });
  const [freshxApiKey, setFreshxApiKey] = useState(() => {
    return loadFreshXApiKey() || '';
  });
  const [project44Valid, setProject44Valid] = useState(false);
  const [freshxValid, setFreshxValid] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  const handleProject44ConfigChange = (config: Project44OAuthConfig) => {
    setProject44ClientId(config.clientId);
    saveProject44Config(config);
    onProject44ConfigChange(config, project44Valid);
  };

  const handleProject44Validation = (isValid: boolean) => {
    setProject44Valid(isValid);
    const config = loadProject44Config();
    if (config) {
      onProject44ConfigChange(config, isValid);
    }
  };

  const handleFreshXKeyChange = (apiKey: string) => {
    setFreshxApiKey(apiKey);
    saveFreshXApiKey(apiKey);
    onFreshXKeyChange(apiKey, freshxValid);
  };

  const handleFreshXValidation = (isValid: boolean) => {
    setFreshxValid(isValid);
    onFreshXKeyChange(freshxApiKey, isValid);
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    setSaveMessage('');
    
    try {
      // Save Project44 config
      const project44Config = loadProject44Config();
      if (project44Config) {
        saveProject44Config(project44Config);
      }
      
      // Save FreshX API key
      if (freshxApiKey) {
        saveFreshXApiKey(freshxApiKey);
      }
      
      setSaveMessage('Configuration saved successfully!');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      setSaveMessage('Failed to save configuration');
      setTimeout(() => setSaveMessage(''), 5000);
    } finally {
      setIsSaving(false);
    }
  };

  const getConnectionStatus = () => {
    const project44Status = project44Valid;
    const freshxStatus = freshxValid;
    
    if (project44Status && freshxStatus) {
      return { status: 'all', message: 'All APIs configured and ready', color: 'text-green-600' };
    } else if (project44Status || freshxStatus) {
      return { status: 'partial', message: 'Some APIs configured', color: 'text-orange-600' };
    } else {
      return { status: 'none', message: 'API configuration required', color: 'text-red-600' };
    }
  };

  const connectionStatus = getConnectionStatus();

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      <div 
        className="px-6 py-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setIsConfigExpanded(!isConfigExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-2 rounded-lg">
              <Settings className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">API Configuration</h3>
              <p className={`text-sm ${connectionStatus.color}`}>
                {connectionStatus.message}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* Connection Status Indicators */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className={`w-2.5 h-2.5 rounded-full ${project44Valid ? 'bg-green-500 shadow-green-500/50 shadow-lg' : 'bg-red-400'}`} />
                <span className="text-sm font-medium text-gray-700">Project44</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className={`w-2.5 h-2.5 rounded-full ${freshxValid ? 'bg-green-500 shadow-green-500/50 shadow-lg' : 'bg-red-400'}`} />
                <span className="text-sm font-medium text-gray-700">FreshX</span>
              </div>
            </div>
            
            <button className="text-gray-400 hover:text-gray-600">
              {isConfigExpanded ? '−' : '+'}
            </button>
          </div>
        </div>
      </div>

      {isConfigExpanded && (
        <div className="px-6 py-6 space-y-6">
          {/* Configuration Status Banner */}
          <div className={`p-4 rounded-lg border ${
            connectionStatus.status === 'all' 
              ? 'bg-green-50 border-green-200' 
              : connectionStatus.status === 'partial'
                ? 'bg-orange-50 border-orange-200'
                : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-start space-x-3">
              {connectionStatus.status === 'all' ? (
                <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
              )}
              <div className="text-sm">
                <p className={`font-medium mb-2 ${
                  connectionStatus.status === 'all' ? 'text-green-800' : 'text-orange-800'
                }`}>
                  {connectionStatus.status === 'all' 
                    ? '✅ API Configuration Complete'
                    : '⚠️ API Configuration Required'
                  }
                </p>
                <div className={`text-xs space-y-1 ${
                  connectionStatus.status === 'all' ? 'text-green-700' : 'text-orange-700'
                }`}>
                  {!project44Valid && (
                    <p>• <strong>Project44:</strong> Configure OAuth Client ID and Client Secret</p>
                  )}
                  {!freshxValid && (
                    <p>• <strong>FreshX:</strong> Configure API key for refrigerated freight quotes</p>
                  )}
                  {connectionStatus.status === 'all' && (
                    <p>Both APIs are configured and ready for production use.</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Project44 Configuration */}
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <Shield className="h-5 w-5 text-blue-600" />
              <h4 className="text-lg font-medium text-gray-900">Project44 API</h4>
              <span className="text-sm text-gray-500">• LTL & Volume LTL Quotes</span>
            </div>
            
            <ApiKeyInput
              value={project44ClientId}
              onChange={setProject44ClientId}
              placeholder="Enter your Project44 Client ID"
              onValidation={handleProject44Validation}
              isProject44={true}
              onOAuthConfigChange={handleProject44ConfigChange}
            />
          </div>

          {/* FreshX Configuration */}
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <Key className="h-5 w-5 text-green-600" />
              <h4 className="text-lg font-medium text-gray-900">FreshX API</h4>
              <span className="text-sm text-gray-500">• Refrigerated Freight Quotes</span>
            </div>
            
            <ApiKeyInput
              value={freshxApiKey}
              onChange={handleFreshXKeyChange}
              placeholder="Enter your FreshX API key"
              onValidation={handleFreshXValidation}
              isProject44={false}
            />
          </div>

          {/* Save Configuration Button */}
          <div className="pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Configuration is automatically saved when you enter valid credentials
              </div>
              
              <div className="flex items-center space-x-3">
                {saveMessage && (
                  <div className={`flex items-center space-x-2 text-sm ${
                    saveMessage.includes('success') ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {saveMessage.includes('success') ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <AlertCircle className="h-4 w-4" />
                    )}
                    <span>{saveMessage}</span>
                  </div>
                )}
                
                <button
                  onClick={handleSaveAll}
                  disabled={isSaving}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {isSaving ? (
                    <Loader className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  <span>{isSaving ? 'Saving...' : 'Save Configuration'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Getting Started Guide */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h5 className="text-sm font-medium text-blue-900 mb-2">🚀 Getting Started:</h5>
            <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
              <li>Configure your Project44 OAuth credentials (Client ID & Secret)</li>
              <li>Add your FreshX API key for refrigerated freight</li>
              <li>Both APIs will be automatically validated and saved</li>
              <li>Start processing RFQs with smart routing capabilities</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
};