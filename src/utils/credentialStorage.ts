import { Project44OAuthConfig } from '../types';

// Local storage keys
const STORAGE_KEYS = {
  PROJECT44_CONFIG: 'project44_config',
  FRESHX_API_KEY: 'freshx_api_key',
  SELECTED_CARRIERS: 'selected_carriers',
  PRICING_SETTINGS: 'pricing_settings',
  SELECTED_MODES: 'selected_modes'
};

// Save Project44 configuration to local storage
export const saveProject44Config = (config: Project44OAuthConfig): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.PROJECT44_CONFIG, JSON.stringify(config));
    console.log('✅ Project44 config saved to local storage');
  } catch (error) {
    console.error('❌ Failed to save Project44 config:', error);
  }
};

// Load Project44 configuration from local storage
export const loadProject44Config = (): Project44OAuthConfig | null => {
  try {
    const storedConfig = localStorage.getItem(STORAGE_KEYS.PROJECT44_CONFIG);
    if (!storedConfig) return null;
    
    const config = JSON.parse(storedConfig) as Project44OAuthConfig;
    console.log('✅ Project44 config loaded from local storage');
    return config;
  } catch (error) {
    console.error('❌ Failed to load Project44 config:', error);
    return null;
  }
};

// Save FreshX API key to local storage
export const saveFreshXApiKey = (apiKey: string): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.FRESHX_API_KEY, apiKey);
    console.log('✅ FreshX API key saved to local storage');
  } catch (error) {
    console.error('❌ Failed to save FreshX API key:', error);
  }
};

// Load FreshX API key from local storage
export const loadFreshXApiKey = (): string | null => {
  try {
    const apiKey = localStorage.getItem(STORAGE_KEYS.FRESHX_API_KEY);
    if (apiKey) {
      console.log('✅ FreshX API key loaded from local storage');
    }
    return apiKey;
  } catch (error) {
    console.error('❌ Failed to load FreshX API key:', error);
    return null;
  }
};

// Save selected carriers to local storage
export const saveSelectedCarriers = (carriers: { [carrierId: string]: boolean }): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.SELECTED_CARRIERS, JSON.stringify(carriers));
    console.log('✅ Selected carriers saved to local storage');
  } catch (error) {
    console.error('❌ Failed to save selected carriers:', error);
  }
};

// Load selected carriers from local storage
export const loadSelectedCarriers = (): { [carrierId: string]: boolean } | null => {
  try {
    const storedCarriers = localStorage.getItem(STORAGE_KEYS.SELECTED_CARRIERS);
    if (!storedCarriers) return null;
    
    const carriers = JSON.parse(storedCarriers) as { [carrierId: string]: boolean };
    console.log('✅ Selected carriers loaded from local storage');
    return carriers;
  } catch (error) {
    console.error('❌ Failed to load selected carriers:', error);
    return null;
  }
};

// Save pricing settings to local storage
export const savePricingSettings = (settings: any): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.PRICING_SETTINGS, JSON.stringify(settings));
    console.log('✅ Pricing settings saved to local storage');
  } catch (error) {
    console.error('❌ Failed to save pricing settings:', error);
  }
};

// Load pricing settings from local storage
export const loadPricingSettings = (): any | null => {
  try {
    const storedSettings = localStorage.getItem(STORAGE_KEYS.PRICING_SETTINGS);
    if (!storedSettings) return null;
    
    const settings = JSON.parse(storedSettings);
    console.log('✅ Pricing settings loaded from local storage');
    return settings;
  } catch (error) {
    console.error('❌ Failed to load pricing settings:', error);
    return null;
  }
};

// Save selected modes to local storage
export const saveSelectedModes = (modes: any): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.SELECTED_MODES, JSON.stringify(modes));
    console.log('✅ Selected modes saved to local storage');
  } catch (error) {
    console.error('❌ Failed to save selected modes:', error);
  }
};

// Load selected modes from local storage
export const loadSelectedModes = (): any | null => {
  try {
    const storedModes = localStorage.getItem(STORAGE_KEYS.SELECTED_MODES);
    if (!storedModes) return null;
    
    const modes = JSON.parse(storedModes);
    console.log('✅ Selected modes loaded from local storage');
    return modes;
  } catch (error) {
    console.error('❌ Failed to load selected modes:', error);
    return null;
  }
};

// Clear all stored credentials and settings
export const clearAllStoredData = (): void => {
  try {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
    console.log('✅ All stored data cleared');
  } catch (error) {
    console.error('❌ Failed to clear stored data:', error);
  }
};