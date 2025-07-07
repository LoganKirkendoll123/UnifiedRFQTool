import React, { useState } from 'react';
import { 
  Truck, 
  Award, 
  Shield, 
  Clock, 
  TrendingUp, 
  ChevronDown, 
  ChevronUp,
  Star,
  Package,
  MapPin,
  Calendar,
  Zap,
  Info
} from 'lucide-react';
import { QuoteWithPricing } from '../types';
import { formatCurrency } from '../utils/pricingCalculator';
import { QuotePricingCard } from './QuotePricingCard';

interface CarrierCardProps {
  carrierCode: string;
  carrierName: string;
  carrierInfo: {
    scac?: string;
    mcNumber?: string;
    dotNumber?: string;
  };
  quotes: QuoteWithPricing[];
  onPriceUpdate: (quoteId: number, newPrice: number) => void;
  shipmentInfo: {
    fromZip: string;
    toZip: string;
    weight: number;
    pallets: number;
    pickupDate: string;
  };
}

interface CarrierCardsProps {
  quotes: QuoteWithPricing[];
  onPriceUpdate: (quoteId: number, newPrice: number) => void;
  shipmentInfo: {
    fromZip: string;
    toZip: string;
    weight: number;
    pallets: number;
    pickupDate: string;
  };
}

const CarrierCard: React.FC<CarrierCardProps> = ({ 
  carrierCode,
  carrierName, 
  carrierInfo,
  quotes, 
  onPriceUpdate, 
  shipmentInfo 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedServiceLevel, setSelectedServiceLevel] = useState<string | null>(null);
  
  // Group quotes by service level code, keeping only the cheapest for each
  const serviceGroups = quotes.reduce((groups, quote) => {
    const serviceCode = quote.serviceLevel?.code || 'STD';
    const serviceDescription = quote.serviceLevel?.description || 'Standard Service';
    
    if (!groups[serviceCode] || quote.customerPrice < groups[serviceCode].quote.customerPrice) {
      groups[serviceCode] = {
        quote,
        serviceDescription
      };
    }
    
    return groups;
  }, {} as Record<string, { quote: QuoteWithPricing; serviceDescription: string }>);
  
  // Sort service levels by price (cheapest first)
  const sortedServiceLevels = Object.entries(serviceGroups).sort(([, a], [, b]) => 
    a.quote.customerPrice - b.quote.customerPrice
  );
  
  const bestQuote = sortedServiceLevels[0]?.[1].quote;
  const worstQuote = sortedServiceLevels[sortedServiceLevels.length - 1]?.[1].quote;
  
  // Calculate carrier statistics
  const avgPrice = quotes.reduce((sum, q) => sum + q.customerPrice, 0) / quotes.length;
  const avgProfit = quotes.reduce((sum, q) => sum + q.profit, 0) / quotes.length;
  const avgTransitDays = quotes
    .filter(q => q.transitDays)
    .reduce((sum, q) => sum + (q.transitDays || 0), 0) / quotes.filter(q => q.transitDays).length;
  
  const getServiceLevelIcon = (serviceCode?: string) => {
    if (!serviceCode) return Clock;
    
    if (serviceCode.includes('GUARANTEED') || serviceCode.includes('GTD')) return Shield;
    if (serviceCode.includes('EXPEDITED') || serviceCode.includes('PRIORITY') || serviceCode.includes('URGENT')) return Zap;
    if (serviceCode.includes('ECONOMY') || serviceCode.includes('DEFERRED')) return Clock;
    return Truck;
  };
  
  const getServiceLevelColor = (serviceCode?: string) => {
    if (!serviceCode) return 'text-gray-500';
    
    if (serviceCode.includes('GUARANTEED') || serviceCode.includes('GTD')) return 'text-green-600';
    if (serviceCode.includes('EXPEDITED') || serviceCode.includes('PRIORITY') || serviceCode.includes('URGENT')) return 'text-orange-600';
    if (serviceCode.includes('ECONOMY') || serviceCode.includes('DEFERRED')) return 'text-purple-600';
    return 'text-blue-600';
  };

  const handleServiceLevelClick = (serviceCode: string) => {
    setSelectedServiceLevel(selectedServiceLevel === serviceCode ? null : serviceCode);
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden hover:shadow-xl transition-all duration-200">
      {/* Carrier Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="bg-blue-600 p-3 rounded-lg">
              <Truck className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">{carrierName}</h3>
              <div className="flex items-center space-x-4 mt-1">
                <div className="flex items-center space-x-1 text-sm text-gray-600">
                  <Award className="h-4 w-4" />
                  <span>Code: {carrierCode}</span>
                </div>
                {carrierInfo.scac && (
                  <div className="flex items-center space-x-1 text-sm text-gray-600">
                    <Shield className="h-4 w-4" />
                    <span>SCAC: {carrierInfo.scac}</span>
                  </div>
                )}
                {carrierInfo.mcNumber && (
                  <div className="flex items-center space-x-1 text-sm text-gray-600">
                    <TrendingUp className="h-4 w-4" />
                    <span>MC: {carrierInfo.mcNumber}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="text-right">
            <div className="flex items-center space-x-2 mb-1">
              <Star className="h-5 w-5 text-yellow-500" />
              <span className="text-sm font-medium text-gray-600">
                {sortedServiceLevels.length} service level{sortedServiceLevels.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="text-sm text-gray-500">
              {quotes.length} total quote{quotes.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{formatCurrency(bestQuote.customerPrice)}</div>
            <div className="text-xs text-gray-500">Best Price</div>
            {bestQuote.serviceLevel && (
              <div className={`text-xs font-medium mt-1 ${getServiceLevelColor(bestQuote.serviceLevel.code)}`}>
                {bestQuote.serviceLevel.code}
              </div>
            )}
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{formatCurrency(avgPrice)}</div>
            <div className="text-xs text-gray-500">Avg Price</div>
            <div className="text-xs text-gray-600 mt-1">
              Range: {formatCurrency(worstQuote.customerPrice - bestQuote.customerPrice)}
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{formatCurrency(avgProfit)}</div>
            <div className="text-xs text-gray-500">Avg Profit</div>
            <div className="text-xs text-gray-600 mt-1">
              Best: {formatCurrency(bestQuote.profit)}
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {avgTransitDays ? `${avgTransitDays.toFixed(1)}` : 'N/A'}
            </div>
            <div className="text-xs text-gray-500">Avg Transit Days</div>
            {bestQuote.transitDays && (
              <div className="text-xs text-gray-600 mt-1">
                Best: {bestQuote.transitDays} days
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Service Level Summary */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-gray-700">Available Service Levels</h4>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center space-x-2 text-sm text-blue-600 hover:text-blue-700 transition-colors"
          >
            <span>{isExpanded ? 'Hide' : 'Show'} Details</span>
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        </div>
        
        <div className="space-y-2">
          {sortedServiceLevels.map(([serviceCode, { quote, serviceDescription }], index) => {
            const ServiceIcon = getServiceLevelIcon(serviceCode);
            const isLowestPrice = index === 0;
            const isSelected = selectedServiceLevel === serviceCode;
            
            return (
              <div key={serviceCode} className="space-y-2">
                <div
                  onClick={() => handleServiceLevelClick(serviceCode)}
                  className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                    isSelected 
                      ? 'border-blue-500 bg-blue-50 shadow-sm' 
                      : isLowestPrice 
                        ? 'border-green-500 bg-green-50 shadow-sm hover:bg-green-100' 
                        : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <ServiceIcon className={`h-4 w-4 ${getServiceLevelColor(serviceCode)}`} />
                    <div>
                      <div className={`font-medium ${isLowestPrice ? 'text-green-800' : isSelected ? 'text-blue-800' : 'text-gray-800'}`}>
                        {serviceDescription}
                      </div>
                      <div className={`text-xs ${isLowestPrice ? 'text-green-600' : isSelected ? 'text-blue-600' : 'text-gray-600'}`}>
                        Code: {serviceCode}
                        {quote.transitDays && ` • ${quote.transitDays} day${quote.transitDays !== 1 ? 's' : ''}`}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <div className="text-right">
                      <div className={`text-lg font-bold ${isLowestPrice ? 'text-green-600' : isSelected ? 'text-blue-600' : 'text-gray-900'}`}>
                        {formatCurrency(quote.customerPrice)}
                      </div>
                      <div className={`text-xs ${isLowestPrice ? 'text-green-600' : isSelected ? 'text-blue-600' : 'text-gray-500'}`}>
                        Profit: {formatCurrency(quote.profit)}
                      </div>
                    </div>
                    {isLowestPrice && (
                      <div className="bg-green-500 text-white text-xs px-2 py-0.5 rounded-full font-medium">
                        BEST
                      </div>
                    )}
                    <ChevronDown className={`h-4 w-4 transition-transform ${isSelected ? 'rotate-180' : ''}`} />
                  </div>
                </div>
                
                {/* Detailed Quote View */}
                {isSelected && (
                  <div className="ml-4 pl-4 border-l-2 border-blue-200">
                    <QuotePricingCard
                      quote={quote}
                      onPriceUpdate={onPriceUpdate}
                      isExpanded={true}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Shipment Details */}
      <div className="px-6 py-4 bg-blue-50 border-b border-gray-200">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="flex items-center space-x-2">
            <MapPin className="h-4 w-4 text-blue-600" />
            <span className="text-gray-700">
              {shipmentInfo.fromZip} → {shipmentInfo.toZip}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <Package className="h-4 w-4 text-blue-600" />
            <span className="text-gray-700">
              {shipmentInfo.pallets} pallets
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <Package className="h-4 w-4 text-blue-600" />
            <span className="text-gray-700">
              {shipmentInfo.weight.toLocaleString()} lbs
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4 text-blue-600" />
            <span className="text-gray-700">
              {shipmentInfo.pickupDate}
            </span>
          </div>
        </div>
      </div>

      {/* Expanded All Quotes View */}
      {isExpanded && (
        <div className="px-6 py-4">
          <div className="flex items-center space-x-2 mb-4">
            <Info className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-gray-700">
              All {quotes.length} quotes from {carrierName}
            </span>
          </div>
          <div className="space-y-4">
            {quotes.map((quote) => (
              <QuotePricingCard
                key={quote.quoteId}
                quote={quote}
                onPriceUpdate={onPriceUpdate}
                isExpanded={false}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export const CarrierCards: React.FC<CarrierCardsProps> = ({ 
  quotes, 
  onPriceUpdate, 
  shipmentInfo 
}) => {
  // Group quotes by carrierCode, fallback to carrier name
  const carrierGroups = quotes.reduce((groups, quote) => {
    const carrierKey = quote.carrierCode || quote.carrier.name;
    const carrierName = quote.carrier.name;
    
    if (!groups[carrierKey]) {
      groups[carrierKey] = {
        carrierCode: quote.carrierCode || carrierKey,
        name: carrierName,
        info: {
          scac: quote.carrier.scac || quote.carrierCode,
          mcNumber: quote.carrier.mcNumber,
          dotNumber: quote.carrier.dotNumber
        },
        quotes: []
      };
    }
    
    groups[carrierKey].quotes.push(quote);
    return groups;
  }, {} as Record<string, {
    carrierCode: string;
    name: string;
    info: {
      scac?: string;
      mcNumber?: string;
      dotNumber?: string;
    };
    quotes: QuoteWithPricing[];
  }>);

  // Sort carriers by their best quote price
  const sortedCarriers = Object.entries(carrierGroups).sort(([, groupA], [, groupB]) => {
    const bestPriceA = Math.min(...groupA.quotes.map(q => q.customerPrice));
    const bestPriceB = Math.min(...groupB.quotes.map(q => q.customerPrice));
    return bestPriceA - bestPriceB;
  });

  if (quotes.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-8 text-center">
        <Truck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Quotes Available</h3>
        <p className="text-gray-600">No carrier quotes found for this shipment.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Carrier Comparison</h2>
            <p className="text-sm text-gray-600 mt-1">
              {sortedCarriers.length} carrier{sortedCarriers.length !== 1 ? 's' : ''} • 
              {quotes.length} total quote{quotes.length !== 1 ? 's' : ''} • 
              Best price: {formatCurrency(Math.min(...quotes.map(q => q.customerPrice)))}
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(Math.min(...quotes.map(q => q.customerPrice)))}
            </div>
            <div className="text-sm text-gray-500">Lowest Quote</div>
          </div>
        </div>
      </div>

      {/* Carrier Cards */}
      <div className="space-y-6">
        {sortedCarriers.map(([carrierKey, carrierGroup], index) => (
          <div key={carrierKey} className="relative">
            {index === 0 && (
              <div className="absolute -top-2 -right-2 z-10">
                <div className="bg-green-500 text-white text-xs px-3 py-1 rounded-full font-bold shadow-lg">
                  BEST PRICE
                </div>
              </div>
            )}
            <CarrierCard
              carrierCode={carrierGroup.carrierCode}
              carrierName={carrierGroup.name}
              carrierInfo={carrierGroup.info}
              quotes={carrierGroup.quotes}
              onPriceUpdate={onPriceUpdate}
              shipmentInfo={shipmentInfo}
            />
          </div>
        ))}
      </div>
    </div>
  );
};