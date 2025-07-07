import React, { useState } from 'react';
import { Settings, DollarSign, Percent, Calculator, Users, Building2 } from 'lucide-react';
import { PricingSettings } from '../types';
import { CustomerSelection } from './CustomerSelection';

interface PricingSettingsProps {
  settings: PricingSettings;
  onSettingsChange: (settings: PricingSettings) => void;
  selectedCustomer: string;
  onCustomerChange: (customer: string) => void;
  showAsCard?: boolean;
}

export const PricingSettingsComponent: React.FC<PricingSettingsProps> = ({ 
  settings, 
  onSettingsChange,
  selectedCustomer,
  onCustomerChange,
  showAsCard = true
}) => {
  const [isExpanded, setIsExpanded] = useState(!showAsCard); // Always expanded when not showing as card

  const handleMarkupChange = (value: number) => {
    onSettingsChange({
      ...settings,
      markupPercentage: value
    });
  };

  const handleMinimumProfitChange = (value: number) => {
    onSettingsChange({
      ...settings,
      minimumProfit: value
    });
  };

  const handleMarkupTypeChange = (type: 'percentage' | 'fixed') => {
    onSettingsChange({
      ...settings,
      markupType: type
    });
  };

  const handleUsesCustomerMarginsChange = (usesCustomerMargins: boolean) => {
    onSettingsChange({
      ...settings,
      usesCustomerMargins
    });
  };

  const handleFallbackMarginChange = (value: number) => {
    onSettingsChange({
      ...settings,
      fallbackMarkupPercentage: value
    });
  };

  const content = (
    <div className="space-y-6">
      {/* Customer Selection */}
      <div>
        <CustomerSelection
          selectedCustomer={selectedCustomer}
          onCustomerChange={onCustomerChange}
        />
      </div>

      {/* Margin Type Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Margin Application Method
        </label>
        <div className="flex space-x-4">
          <button
            onClick={() => handleUsesCustomerMarginsChange(false)}
            className={`flex items-center space-x-2 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
              !settings.usesCustomerMargins
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Calculator className="h-5 w-5" />
            <span>Use Flat Margin</span>
          </button>
          <button
            onClick={() => handleUsesCustomerMarginsChange(true)}
            className={`flex items-center space-x-2 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
              settings.usesCustomerMargins
                ? 'bg-green-600 text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Users className="h-5 w-5" />
            <span>Use Customer Margins</span>
          </button>
        </div>
        <p className="text-sm text-gray-600 mt-2">
          {settings.usesCustomerMargins 
            ? 'Apply customer-specific margins from CustomerCarriers database with fallback for unmatched carriers'
            : 'Apply the same flat margin to all quotes regardless of customer or carrier'
          }
        </p>
      </div>

      {/* Markup Type Selection */}
      <div className={settings.usesCustomerMargins ? 'opacity-50' : ''}>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          {settings.usesCustomerMargins ? 'Fallback Markup Type' : 'Markup Type'}
        </label>
        <div className="flex space-x-4">
          <button
            onClick={() => handleMarkupTypeChange('percentage')}
            disabled={settings.usesCustomerMargins}
            className={`flex items-center space-x-2 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
              settings.markupType === 'percentage'
                ? 'bg-green-600 text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            } ${settings.usesCustomerMargins ? 'cursor-not-allowed' : ''}`}
          >
            <Percent className="h-5 w-5" />
            <span>Percentage</span>
          </button>
          <button
            onClick={() => handleMarkupTypeChange('fixed')}
            disabled={settings.usesCustomerMargins}
            className={`flex items-center space-x-2 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
              settings.markupType === 'fixed'
                ? 'bg-green-600 text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            } ${settings.usesCustomerMargins ? 'cursor-not-allowed' : ''}`}
          >
            <DollarSign className="h-5 w-5" />
            <span>Fixed Amount</span>
          </button>
        </div>
        {settings.usesCustomerMargins && (
          <p className="text-xs text-gray-500 mt-1">
            This setting is used as fallback when customer margins are not found
          </p>
        )}
      </div>

      {/* Primary Markup Value or Fallback */}
      <div className={settings.usesCustomerMargins ? 'opacity-50' : ''}>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          <Calculator className="inline h-4 w-4 mr-1" />
          {settings.usesCustomerMargins 
            ? (settings.markupType === 'percentage' ? 'Fallback Markup Percentage' : 'Fallback Fixed Markup Amount')
            : (settings.markupType === 'percentage' ? 'Markup Percentage' : 'Fixed Markup Amount')
          }
        </label>
        <div className="relative">
          <input
            type="number"
            min="0"
            step={settings.markupType === 'percentage' ? '0.1' : '1'}
            value={settings.markupPercentage}
            onChange={(e) => handleMarkupChange(parseFloat(e.target.value) || 0)}
            disabled={settings.usesCustomerMargins}
            className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200"
            placeholder={settings.markupType === 'percentage' ? '15.0' : '500'}
          />
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
            {settings.markupType === 'percentage' ? '%' : '$'}
          </div>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          {settings.usesCustomerMargins 
            ? (settings.markupType === 'percentage' 
                ? 'Fallback percentage markup when customer margins not found'
                : 'Fallback fixed amount when customer margins not found')
            : (settings.markupType === 'percentage' 
                ? 'Percentage markup applied to carrier rates'
                : 'Fixed dollar amount added to carrier rates')
          }
        </p>
      </div>

      {/* Customer Margins Fallback (only shown when using customer margins) */}
      {settings.usesCustomerMargins && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <DollarSign className="inline h-4 w-4 mr-1" />
            Fallback Margin for Unmatched Carriers & Reefer
          </label>
          <div className="relative">
            <input
              type="number"
              min="0"
              step="0.1"
              value={settings.fallbackMarkupPercentage || 23}
              onChange={(e) => handleFallbackMarginChange(parseFloat(e.target.value) || 23)}
              className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200"
              placeholder="23.0"
            />
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
              %
            </div>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Applied when no customer-carrier match is found and for all FreshX reefer shipments
          </p>
        </div>
      )}

      {/* Minimum Profit */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          <DollarSign className="inline h-4 w-4 mr-1" />
          Minimum Profit per Shipment
        </label>
        <div className="relative">
          <input
            type="number"
            min="0"
            step="1"
            value={settings.minimumProfit}
            onChange={(e) => handleMinimumProfitChange(parseFloat(e.target.value) || 0)}
            className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200"
            placeholder="100"
          />
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
            $
          </div>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          Minimum profit margin that must be maintained on each shipment
        </p>
      </div>

      {/* Example Calculation */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Example Calculation</h4>
        {settings.usesCustomerMargins ? (
          <div className="text-sm text-gray-600 space-y-1">
            <div>Carrier Rate: $1,000</div>
            <div>Customer: {selectedCustomer || 'No customer selected'}</div>
            <div>
              Customer Margin: {selectedCustomer ? 'Lookup from database' : 'N/A'}
            </div>
            <div>
              Fallback Margin ({settings.fallbackMarkupPercentage || 23}%): $
              {(1000 / (1 - (settings.fallbackMarkupPercentage || 23) / 100) - 1000).toFixed(0)}
            </div>
            <div className="border-t pt-1 font-medium">
              Customer Price: $
              {Math.max(1000 / (1 - (settings.fallbackMarkupPercentage || 23) / 100), 1000 + settings.minimumProfit).toFixed(0)}
            </div>
            <div className="text-green-600">
              Profit: $
              {Math.max((1000 / (1 - (settings.fallbackMarkupPercentage || 23) / 100) - 1000), settings.minimumProfit).toFixed(0)}
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-600 space-y-1">
            <div>Carrier Rate: $1,000</div>
            <div>
              {settings.markupType === 'percentage' 
                ? `Markup (${settings.markupPercentage}%): $${(1000 / (1 - settings.markupPercentage / 100) - 1000).toFixed(0)}`
                : `Fixed Markup: $${settings.markupPercentage}`
              }
            </div>
            <div className="border-t pt-1 font-medium">
              Customer Price: $
              {settings.markupType === 'percentage' 
                ? Math.max(1000 / (1 - settings.markupPercentage / 100), 1000 + settings.minimumProfit).toFixed(0)
                : Math.max(1000 + settings.markupPercentage, 1000 + settings.minimumProfit).toFixed(0)
              }
            </div>
            <div className="text-green-600">
              Profit: $
              {settings.markupType === 'percentage' 
                ? Math.max((1000 / (1 - settings.markupPercentage / 100) - 1000), settings.minimumProfit).toFixed(0)
                : Math.max(settings.markupPercentage, settings.minimumProfit).toFixed(0)
              }
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (!showAsCard) {
    return content;
  }

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      <div 
        className="px-6 py-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-green-600 p-2 rounded-lg">
              <Settings className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Pricing Settings</h3>
              <p className="text-sm text-gray-600">
                {settings.usesCustomerMargins 
                  ? `Customer margins • Fallback: ${settings.fallbackMarkupPercentage || 23}%`
                  : (settings.markupType === 'percentage' ? `${settings.markupPercentage}% markup` : `$${settings.markupPercentage} fixed markup`)
                } • Min profit: ${settings.minimumProfit}
              </p>
            </div>
          </div>
          <button className="text-gray-400 hover:text-gray-600">
            {isExpanded ? '−' : '+'}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="px-6 py-6">
          {content}
        </div>
      )}
    </div>
  );
};