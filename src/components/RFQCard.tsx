import React, { useState } from 'react';
import { ChevronDown, ChevronUp, MapPin, Package, Clock, Thermometer, XCircle, CheckCircle, Truck, BarChart3, TrendingUp, TrendingDown } from 'lucide-react';
import { ProcessingResult } from '../types';
import { CarrierCards } from './CarrierCards';
import { formatCurrency } from '../utils/pricingCalculator';

interface RFQCardProps {
  result: ProcessingResult;
  onPriceUpdate: (quoteId: number, newPrice: number) => void;
}

export const RFQCard: React.FC<RFQCardProps> = ({ result, onPriceUpdate }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeMode, setActiveMode] = useState<'volume' | 'standard' | 'all'>('all');

  const getStatusIcon = () => {
    switch (result.status) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = () => {
    switch (result.status) {
      case 'success':
        return 'border-green-200 bg-green-50';
      case 'error':
        return 'border-red-200 bg-red-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  // Get the best quote across all carriers for this RFQ
  const bestQuote = result.quotes.length > 0 
    ? result.quotes.reduce((best, current) => {
        const bestPrice = (best as any).customerPrice || (best.baseRate + best.fuelSurcharge + best.premiumsAndDiscounts);
        const currentPrice = (current as any).customerPrice || (current.baseRate + current.fuelSurcharge + current.premiumsAndDiscounts);
        return currentPrice < bestPrice ? current : best;
      })
    : null;

  // Group quotes by carrier for summary stats
  const carrierGroups = result.quotes.reduce((groups, quote) => {
    const carrierKey = quote.carrierCode || quote.carrier.name;
    if (!groups[carrierKey]) {
      groups[carrierKey] = [];
    }
    groups[carrierKey].push(quote);
    return groups;
  }, {} as Record<string, typeof result.quotes>);

  const uniqueCarrierCount = Object.keys(carrierGroups).length;
  
  // Check if this is a dual-mode result (VLTL with both Volume and Standard quotes)
  const isDualMode = (result as any).quotingDecision === 'project44-dual';
  const hasVolumeQuotes = result.quotes.some(q => (q as any).quoteMode === 'volume');
  const hasStandardQuotes = result.quotes.some(q => (q as any).quoteMode === 'standard');
  
  // Filter quotes based on active mode
  const getFilteredQuotes = () => {
    if (!isDualMode || activeMode === 'all') {
      return result.quotes;
    }
    return result.quotes.filter(q => (q as any).quoteMode === activeMode);
  };
  
  const filteredQuotes = getFilteredQuotes();
  
  // Get best quote from filtered quotes
  const filteredBestQuote = filteredQuotes.length > 0 
    ? filteredQuotes.reduce((best, current) => {
        const bestPrice = (best as any).customerPrice || (best.baseRate + best.fuelSurcharge + best.premiumsAndDiscounts);
        const currentPrice = (current as any).customerPrice || (current.baseRate + current.fuelSurcharge + current.premiumsAndDiscounts);
        return currentPrice < bestPrice ? current : best;
      })
    : null;
  
  // Calculate mode comparison stats for dual mode
  const getModeStats = () => {
    if (!isDualMode) return null;
    
    const volumeQuotes = result.quotes.filter(q => (q as any).quoteMode === 'volume');
    const standardQuotes = result.quotes.filter(q => (q as any).quoteMode === 'standard');
    
    const volumeBest = volumeQuotes.length > 0 ? Math.min(...volumeQuotes.map(q => 
      (q as any).customerPrice || (q.baseRate + q.fuelSurcharge + q.premiumsAndDiscounts)
    )) : null;
    
    const standardBest = standardQuotes.length > 0 ? Math.min(...standardQuotes.map(q => 
      (q as any).customerPrice || (q.baseRate + q.fuelSurcharge + q.premiumsAndDiscounts)
    )) : null;
    
    return {
      volumeQuotes: volumeQuotes.length,
      standardQuotes: standardQuotes.length,
      volumeBest,
      standardBest,
      savings: volumeBest && standardBest ? standardBest - volumeBest : null
    };
  };
  
  const modeStats = getModeStats();

  return (
    <div className={`bg-white rounded-lg shadow-md border ${getStatusColor()} overflow-hidden`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {getStatusIcon()}
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                RFQ #{result.rowIndex + 1}
                {isDualMode && (
                  <span className="ml-2 text-sm bg-purple-100 text-purple-800 px-2 py-1 rounded-full">
                    Dual Mode Comparison
                  </span>
                )}
              </h3>
              <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
                <div className="flex items-center space-x-1">
                  <MapPin className="h-4 w-4" />
                  <span>{result.originalData.fromZip} → {result.originalData.toZip}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Package className="h-4 w-4" />
                  <span>{result.originalData.pallets} pallets, {result.originalData.grossWeight.toLocaleString()} lbs</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Clock className="h-4 w-4" />
                  <span>{result.originalData.fromDate}</span>
                </div>
                {result.originalData.temperature && (
                  <div className="flex items-center space-x-1">
                    <Thermometer className="h-4 w-4" />
                    <span>{result.originalData.temperature}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="text-right">
            {filteredBestQuote ? (
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency((filteredBestQuote as any).customerPrice || (filteredBestQuote.baseRate + filteredBestQuote.fuelSurcharge + filteredBestQuote.premiumsAndDiscounts))}
                </div>
                <div className="text-sm text-gray-500">
                  {activeMode === 'all' ? 'Best Price' : `Best ${activeMode === 'volume' ? 'Volume LTL' : 'Standard LTL'}`}
                </div>
                {(filteredBestQuote as any).customerPrice && (
                  <div className="text-sm text-green-600">
                    Profit: {formatCurrency((filteredBestQuote as any).profit || 0)}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-gray-500">No quotes</div>
            )}
          </div>
        </div>

        {result.error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center space-x-2 text-red-700">
              <XCircle className="h-4 w-4" />
              <span className="text-sm">{result.error}</span>
            </div>
          </div>
        )}
      </div>

      {/* Dual Mode Controls and Stats */}
      {isDualMode && (
        <div className="p-4 bg-purple-50 border-b border-purple-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <BarChart3 className="h-4 w-4 text-purple-600" />
              <span className="text-sm font-medium text-purple-900">Mode Comparison</span>
            </div>
            
            {/* Mode Filter Buttons */}
            <div className="flex items-center space-x-1 bg-white rounded-lg p-1">
              <button
                onClick={() => setActiveMode('all')}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  activeMode === 'all' 
                    ? 'bg-purple-600 text-white' 
                    : 'text-purple-600 hover:bg-purple-100'
                }`}
              >
                All Quotes
              </button>
              <button
                onClick={() => setActiveMode('volume')}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  activeMode === 'volume' 
                    ? 'bg-purple-600 text-white' 
                    : 'text-purple-600 hover:bg-purple-100'
                }`}
              >
                Volume LTL ({modeStats?.volumeQuotes || 0})
              </button>
              <button
                onClick={() => setActiveMode('standard')}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  activeMode === 'standard' 
                    ? 'bg-purple-600 text-white' 
                    : 'text-purple-600 hover:bg-purple-100'
                }`}
              >
                Standard LTL ({modeStats?.standardQuotes || 0})
              </button>
            </div>
          </div>
          
          {/* Comparison Stats */}
          {modeStats && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-lg p-3 border border-purple-200">
                <div className="text-sm text-purple-600 mb-1">Volume LTL Best</div>
                <div className="text-lg font-bold text-purple-900">
                  {modeStats.volumeBest ? formatCurrency(modeStats.volumeBest) : 'No quotes'}
                </div>
              </div>
              
              <div className="bg-white rounded-lg p-3 border border-purple-200">
                <div className="text-sm text-purple-600 mb-1">Standard LTL Best</div>
                <div className="text-lg font-bold text-purple-900">
                  {modeStats.standardBest ? formatCurrency(modeStats.standardBest) : 'No quotes'}
                </div>
              </div>
              
              <div className="bg-white rounded-lg p-3 border border-purple-200">
                <div className="text-sm text-purple-600 mb-1 flex items-center space-x-1">
                  {modeStats.savings && modeStats.savings > 0 ? (
                    <TrendingDown className="h-3 w-3 text-green-600" />
                  ) : modeStats.savings && modeStats.savings < 0 ? (
                    <TrendingUp className="h-3 w-3 text-red-600" />
                  ) : null}
                  <span>Volume LTL Savings</span>
                </div>
                <div className={`text-lg font-bold ${
                  modeStats.savings && modeStats.savings > 0 ? 'text-green-600' :
                  modeStats.savings && modeStats.savings < 0 ? 'text-red-600' :
                  'text-gray-500'
                }`}>
                  {modeStats.savings ? 
                    (modeStats.savings > 0 ? `+${formatCurrency(modeStats.savings)}` : formatCurrency(modeStats.savings)) :
                    'No comparison'
                  }
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quote Summary */}
      {filteredQuotes.length > 0 && (
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Truck className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium text-gray-700">
                {filteredQuotes.length} quote{filteredQuotes.length !== 1 ? 's' : ''} 
                {isDualMode && activeMode !== 'all' && (
                  <span className="text-purple-600"> ({activeMode === 'volume' ? 'Volume LTL' : 'Standard LTL'})</span>
                )}
                {!isDualMode || activeMode === 'all' ? ` from ${uniqueCarrierCount} carrier${uniqueCarrierCount !== 1 ? 's' : ''}` : ''}
              </span>
            </div>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center space-x-2 text-sm text-blue-600 hover:text-blue-700 transition-colors"
            >
              <span>{isExpanded ? 'Hide' : 'Show'} Carrier Details</span>
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      )}

      {/* Expanded Carrier Details */}
      {isExpanded && filteredQuotes.length > 0 && (
        <div className="p-6">
          <CarrierCards
            quotes={filteredQuotes as any}
            onPriceUpdate={onPriceUpdate}
            shipmentInfo={{
              fromZip: result.originalData.fromZip,
              toZip: result.originalData.toZip,
              weight: result.originalData.grossWeight,
              pallets: result.originalData.pallets,
              pickupDate: result.originalData.fromDate
            }}
          />
        </div>
      )}
    </div>
  );
};