import React, { useState } from 'react';
import { Edit3, Check, X, Truck, ChevronDown, ChevronUp, Info, DollarSign, Users, Calculator, Building2 } from 'lucide-react';
import { QuoteWithPricing } from '../types';
import { formatCurrency, formatProfit, formatChargeDescription } from '../utils/pricingCalculator';

interface QuotePricingCardProps {
  quote: QuoteWithPricing;
  onPriceUpdate: (quoteId: number, newPrice: number) => void;
  isExpanded?: boolean;
}

export const QuotePricingCard: React.FC<QuotePricingCardProps> = ({ 
  quote, 
  onPriceUpdate,
  isExpanded = false 
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editPrice, setEditPrice] = useState(quote.customerPrice.toString());
  const [showChargeDetails, setShowChargeDetails] = useState(false);

  const handleSavePrice = () => {
    const newPrice = parseFloat(editPrice);
    if (!isNaN(newPrice) && newPrice > 0) {
      onPriceUpdate(quote.quoteId, newPrice);
      setIsEditing(false);
    }
  };

  const handleCancelEdit = () => {
    setEditPrice(quote.customerPrice.toString());
    setIsEditing(false);
  };

  const profitMargin = quote.carrierTotalRate > 0 ? (quote.profit / quote.carrierTotalRate) * 100 : 0;

  // Get all charges from Project44 response
  const allCharges = quote.rateQuoteDetail?.charges || [];
  const hasDetailedCharges = allCharges.length > 0;

  // Check if this is a FreshX quote
  const isFreshXQuote = quote.submittedBy === 'FreshX' || quote.temperature;

  // Get margin type icon and color
  const getMarginTypeIcon = () => {
    switch (quote.appliedMarginType) {
      case 'customer': return Users;
      case 'fallback': return Building2;
      default: return Calculator;
    }
  };

  const getMarginTypeColor = () => {
    switch (quote.appliedMarginType) {
      case 'customer': return 'text-green-600';
      case 'fallback': return 'text-orange-600';
      default: return 'text-blue-600';
    }
  };

  const getMarginTypeLabel = () => {
    switch (quote.appliedMarginType) {
      case 'customer': return 'Customer Margin';
      case 'fallback': return 'Fallback Margin';
      default: return 'Flat Margin';
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-all duration-200">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-100 p-2 rounded-lg">
              <DollarSign className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-medium text-gray-900">Quote #{quote.quoteId}</span>
                {quote.serviceLevel && (
                  <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                    {quote.serviceLevel.code}
                  </span>
                )}
              </div>
              <div className="text-sm text-gray-600 mt-1">
                {quote.serviceLevel?.description || 'Standard Service'}
                {quote.transitDays && (
                  <span className="ml-2">• {quote.transitDays} day{quote.transitDays !== 1 ? 's' : ''}</span>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            {quote.isCustomPrice && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                Custom Price
              </span>
            )}
            <div className="text-right">
              <div className="text-lg font-bold text-green-600">
                {formatCurrency(quote.customerPrice)}
              </div>
              <div className="text-sm text-gray-500">Customer Price</div>
            </div>
          </div>
        </div>
      </div>

      {/* Pricing Details */}
      <div className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* Project44 Rate Summary */}
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-700">
                {isFreshXQuote ? 'FreshX Rate Details' : 'Project44 Rate Details'}
              </h4>
              {!isFreshXQuote && hasDetailedCharges && (
                <button
                  onClick={() => setShowChargeDetails(!showChargeDetails)}
                  className="text-blue-600 hover:text-blue-700 transition-colors"
                >
                  {showChargeDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              )}
            </div>
            
            {isFreshXQuote ? (
              // FreshX: Show baseRate + fuelSurcharge + premiums breakdown
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span className="text-xs">Base Rate:</span>
                  <span className="text-xs font-medium">{formatCurrency(quote.baseRate || 0)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span className="text-xs">Fuel Surcharge:</span>
                  <span className="text-xs font-medium">{formatCurrency(quote.fuelSurcharge || 0)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span className="text-xs">Temperature Control & Accessorials:</span>
                  <span className="text-xs font-medium">{formatCurrency(quote.premiumsAndDiscounts || 0)}</span>
                </div>
                <div className="border-t pt-2 flex justify-between font-bold">
                  <span>Total:</span>
                  <span>{formatCurrency(quote.carrierTotalRate)}</span>
                </div>
              </div>
            ) : showChargeDetails && hasDetailedCharges ? (
              // Project44: Show detailed charge breakdown
              <div className="space-y-2 text-sm">
                {allCharges.map((charge, index) => (
                  <div key={index} className="flex justify-between text-gray-600">
                    <span className="text-xs">{formatChargeDescription(charge)}</span>
                    <span className="text-xs font-medium">{formatCurrency(charge.amount || 0)}</span>
                  </div>
                ))}
                <div className="border-t pt-2 flex justify-between font-bold">
                  <span>Total:</span>
                  <span>{formatCurrency(quote.carrierTotalRate)}</span>
                </div>
              </div>
            ) : (
              // Project44: Show summary or fallback
              <div className="space-y-1 text-sm">
                {hasDetailedCharges ? (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Number of Charges:</span>
                    <span className="font-medium">{allCharges.length}</span>
                  </div>
                ) : (
                  <div className="text-center text-gray-500 text-xs">
                    No detailed charge breakdown available
                  </div>
                )}
                <div className="border-t pt-1 flex justify-between">
                  <span className="font-medium text-gray-700">Carrier Total:</span>
                  <span className="font-bold">{formatCurrency(quote.carrierTotalRate)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Pricing & Profit */}
          <div className="bg-green-50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-700">Your Pricing</h4>
              <div className="flex items-center space-x-2">
                {quote.appliedMarginType && (
                  <div className={`flex items-center space-x-1 text-xs ${getMarginTypeColor()}`}>
                    {React.createElement(getMarginTypeIcon(), { className: 'h-3 w-3' })}
                    <span>Margin %</span>
                  </div>
                )}
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-blue-600 hover:text-blue-700 transition-colors"
                >
                  <Edit3 className="h-4 w-4" />
                </button>
              </div>
            </div>
            
            {isEditing ? (
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter custom price"
                  />
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={handleSavePrice}
                    className="flex items-center space-x-1 px-3 py-1 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 transition-colors"
                  >
                    <Check className="h-3 w-3" />
                    <span>Save</span>
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="flex items-center space-x-1 px-3 py-1 bg-gray-500 text-white rounded-md text-sm hover:bg-gray-600 transition-colors"
                  >
                    <X className="h-3 w-3" />
                    <span>Cancel</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Customer Price:</span>
                  <span className="font-bold text-green-600">{formatCurrency(quote.customerPrice)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Your Profit:</span>
                  <span className="font-bold text-green-600">{formatProfit(quote.profit)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Margin %:</span>
                    <span className={`font-medium ${getMarginTypeColor()}`}>
                      {quote.appliedMarginPercentage.toFixed(1)}%
                    </span>
                  </div>
              </div>
            )}
          </div>
        </div>

        {/* Additional Quote Details (if expanded) */}
        {isExpanded && (
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Quote Details</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Quote ID:</span>
                <div className="font-medium">{quote.id || quote.quoteId}</div>
              </div>
              <div>
                <span className="text-gray-500">Carrier Code:</span>
                <div className="font-medium">{quote.carrierCode || 'N/A'}</div>
              </div>
              {quote.contractId && (
                <div>
                  <span className="text-gray-500">Contract:</span>
                  <div className="font-medium text-xs">{quote.contractId}</div>
                </div>
              )}
              {quote.laneType && (
                <div>
                  <span className="text-gray-500">Lane Type:</span>
                  <div className="font-medium">{quote.laneType}</div>
                </div>
              )}
              {quote.quoteExpirationDateTime && (
                <div>
                  <span className="text-gray-500">Expires:</span>
                  <div className="font-medium text-xs">
                    {new Date(quote.quoteExpirationDateTime).toLocaleDateString()}
                  </div>
                </div>
              )}
              {quote.deliveryDateTime && (
                <div>
                  <span className="text-gray-500">Delivery:</span>
                  <div className="font-medium text-xs">
                    {new Date(quote.deliveryDateTime).toLocaleDateString()}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};