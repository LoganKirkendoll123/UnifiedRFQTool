import { useState, useCallback } from 'react';
import { PricingSettings } from '../types';
import { savePricingSettings, loadPricingSettings } from '../utils/credentialStorage';

const DEFAULT_PRICING_SETTINGS: PricingSettings = {
  markupPercentage: 15,
  minimumProfit: 100,
  markupType: 'percentage',
  usesCustomerMargins: false,
  fallbackMarkupPercentage: 23
};

export const usePricingSettings = (initialSettings?: PricingSettings) => {
  const [pricingSettings, setPricingSettings] = useState<PricingSettings>(() => {
    if (initialSettings) return initialSettings;
    const saved = loadPricingSettings();
    return saved || DEFAULT_PRICING_SETTINGS;
  });

  const [selectedCustomer, setSelectedCustomer] = useState<string>('');

  const updatePricingSettings = useCallback((settings: PricingSettings) => {
    setPricingSettings(settings);
    savePricingSettings(settings);
  }, []);

  const updateSelectedCustomer = useCallback((customer: string) => {
    setSelectedCustomer(customer);
  }, []);

  return {
    pricingSettings,
    selectedCustomer,
    updatePricingSettings,
    updateSelectedCustomer
  };
};