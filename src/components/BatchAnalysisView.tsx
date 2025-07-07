import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft,
  MapPin, 
  Package, 
  Clock, 
  Thermometer, 
  TrendingUp, 
  TrendingDown, 
  DollarSign,
  Target,
  Calculator,
  Truck,
  BarChart3,
  CheckCircle,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
  Plus,
  Minus,
  Users,
  Building2
} from 'lucide-react';
import { BatchData, BatchRequest, BatchResponse } from '../utils/apiClient';
import { formatCurrency } from '../utils/pricingCalculator';
import { CarrierCards } from './CarrierCards';
import { QuoteWithPricing } from '../types';

interface BatchAnalysisViewProps {
  batch: BatchData;
  requests: BatchRequest[];
  responses: BatchResponse[];
  newResponses?: BatchResponse[];
  onBack: () => void;
}

interface ShipmentAnalysis {
  request: BatchRequest;
  originalQuotes: BatchResponse[];
  newQuotes?: BatchResponse[];
  originalBestPrice: number;
  newBestPrice?: number;
  costDifference?: number;
  costDifferencePercent?: number;
  originalAccessorials: string[];
  newAccessorials?: string[];
  accessorialDifferences: {
    added: string[];
    removed: string[];
    unchanged: string[];
  };
  marginRecommendations: {
    toMatchOriginal: number;
    toMaximizeProfit: number;
    revenueImpact: number;
  };
  carrierComparison: {
    originalCarriers: string[];
    newCarriers?: string[];
    carriersLost: string[];
    carriersGained: string[];
  };
}

export const BatchAnalysisView: React.FC<BatchAnalysisViewProps> = ({
  batch,
  requests,
  responses,
  newResponses,
  onBack
}) => {
  const [expandedShipments, setExpandedShipments] = useState<Set<string>>(new Set());
  const [analysisMode, setAnalysisMode] = useState<'overview' | 'detailed' | 'recommendations'>('overview');
  const [shipmentAnalyses, setShipmentAnalyses] = useState<ShipmentAnalysis[]>([]);

  // Convert BatchResponse to QuoteWithPricing format for CarrierCards
  const convertBatchResponseToQuote = (response: BatchResponse): QuoteWithPricing => {
    const relatedRequest = requests.find(r => r.id === response.request_id);
    
    // Extract pricing from raw_response if available, fallback to database fields
    let carrierTotalRate = response.carrier_total_rate || 0;
    let customerPrice = response.customer_price || 0;
    let profit = response.profit || 0;
    let baseRate = 0;
    let fuelSurcharge = 0;
    let premiumsAndDiscounts = 0;
    
    if (response.raw_response) {
      // Extract from Project44 raw response
      if (response.raw_response.rateQuoteDetail?.total && carrierTotalRate <= 0) {
        carrierTotalRate = response.raw_response.rateQuoteDetail.total;
      }
      
      // Extract individual charges for better display
      if (response.raw_response.rateQuoteDetail?.charges) {
        const charges = response.raw_response.rateQuoteDetail.charges;
        
        charges.forEach((charge: any) => {
          const amount = charge.amount || 0;
          const code = charge.code || '';
          
          if (code.includes('BASE') || code.includes('LINE')) {
            baseRate += amount;
          } else if (code.includes('FUEL')) {
            fuelSurcharge += amount;
          } else {
            premiumsAndDiscounts += amount;
          }
        });
        
        // If we didn't categorize everything, put remainder in premiums
        const totalCategorized = baseRate + fuelSurcharge + premiumsAndDiscounts;
        if (totalCategorized < carrierTotalRate) {
          premiumsAndDiscounts += (carrierTotalRate - totalCategorized);
        }
      } else {
        // Fallback distribution if no detailed charges
        baseRate = carrierTotalRate * 0.7;
        fuelSurcharge = carrierTotalRate * 0.2;
        premiumsAndDiscounts = carrierTotalRate * 0.1;
      }
      
      // Calculate customer price if not available
      if (customerPrice <= 0 && carrierTotalRate > 0) {
        // Use applied margin percentage if available, otherwise 20% default
        const marginPercent = response.applied_margin_percentage || 20;
        customerPrice = carrierTotalRate / (1 - marginPercent / 100);
        profit = customerPrice - carrierTotalRate;
      }
    }
    
    return {
      quoteId: parseInt(response.quote_id) || 0,
      baseRate,
      fuelSurcharge,
      accessorial: response.raw_response?.accessorialServices || [],
      premiumsAndDiscounts,
      readyByDate: new Date(response.created_at || '').toLocaleDateString(),
      estimatedDeliveryDate: response.transit_days ? 
        new Date(Date.now() + response.transit_days * 24 * 60 * 60 * 1000).toLocaleDateString() : '',
      weight: relatedRequest?.gross_weight || 0,
      pallets: relatedRequest?.pallets || 0,
      stackable: false, // Not stored in database
      pickup: {
        city: '',  // Would need to be parsed from request
        state: '',
        zip: relatedRequest?.from_zip || ''
      },
      dropoff: {
        city: '',  // Would need to be parsed from request
        state: '',
        zip: relatedRequest?.to_zip || ''
      },
      submittedBy: 'Database',
      submissionDatetime: response.created_at || '',
      carrier: {
        name: response.carrier_name,
        mcNumber: '', // Not stored in database
        logo: '',
        scac: response.carrier_scac || response.carrier_code || '',
        dotNumber: '' // Not stored in database
      },
      carrierTotalRate,
      customerPrice,
      profit,
      markupApplied: response.markup_applied || (customerPrice - carrierTotalRate),
      isCustomPrice: response.is_custom_price || false,
      appliedMarginType: response.applied_margin_type as any,
      appliedMarginPercentage: response.applied_margin_percentage || 0,
      chargeBreakdown: {
        baseCharges: baseRate > 0 ? [{
          amount: baseRate,
          code: 'BASE',
          description: 'Base Rate'
        }] : [],
        fuelCharges: fuelSurcharge > 0 ? [{
          amount: fuelSurcharge,
          code: 'FUEL',
          description: 'Fuel Surcharge'
        }] : [],
        accessorialCharges: response.raw_response?.rateQuoteDetail?.charges?.filter((c: any) => 
          c.code && !['BASE', 'FUEL'].includes(c.code)
        ) || [],
        discountCharges: [],
        premiumCharges: premiumsAndDiscounts > 0 ? [{
          amount: premiumsAndDiscounts,
          code: 'PREMIUM',
          description: 'Premiums & Adjustments'
        }] : [],
        otherCharges: response.raw_response?.rateQuoteDetail?.charges || []
      },
      // Project44 specific fields
      capacityProviderIdentifier: undefined,
      rateQuoteDetail: {
        charges: response.raw_response?.rateQuoteDetail?.charges || [],
        subtotal: carrierTotalRate,
        total: carrierTotalRate
      },
      serviceLevel: response.service_level_code ? {
        code: response.service_level_code,
        description: response.service_level_description || ''
      } : undefined,
      transitDays: response.transit_days,
      carrierCode: response.carrier_code,
      id: response.id
    };
  };

  useEffect(() => {
    calculateAnalyses();
  }, [requests, responses, newResponses]);

  const calculateAnalyses = () => {
    const analyses: ShipmentAnalysis[] = requests.map(request => {
      const originalQuotes = responses.filter(r => r.request_id === request.id);
      const newQuotes = newResponses?.filter(r => r.request_id === request.id) || [];
      
      const originalBestPrice = originalQuotes.length > 0 
        ? Math.min(...originalQuotes.map(q => q.customer_price)) 
        : 0;
      
      const newBestPrice = newQuotes.length > 0 
        ? Math.min(...newQuotes.map(q => q.customer_price)) 
        : undefined;
      
      const costDifference = newBestPrice !== undefined ? newBestPrice - originalBestPrice : undefined;
      const costDifferencePercent = originalBestPrice > 0 && costDifference !== undefined 
        ? (costDifference / originalBestPrice) * 100 
        : undefined;

      // Extract accessorials
      const originalAccessorials = Array.from(new Set(
        originalQuotes.flatMap(q => 
          q.raw_response?.accessorialServices?.map((a: any) => a.code) || []
        )
      ));
      
      const newAccessorials = Array.from(new Set(
        newQuotes.flatMap(q => 
          q.raw_response?.accessorialServices?.map((a: any) => a.code) || []
        )
      ));

      const accessorialDifferences = {
        added: newAccessorials.filter(a => !originalAccessorials.includes(a)),
        removed: originalAccessorials.filter(a => !newAccessorials.includes(a)),
        unchanged: originalAccessorials.filter(a => newAccessorials.includes(a))
      };

      // Calculate margin recommendations
      const marginRecommendations = {
        toMatchOriginal: originalBestPrice > 0 && newBestPrice !== undefined
          ? ((originalBestPrice - (newBestPrice * 0.85)) / (newBestPrice * 0.85)) * 100
          : 0,
        toMaximizeProfit: costDifference !== undefined && costDifference < 0 ? 25 : 20,
        revenueImpact: costDifference !== undefined ? costDifference : 0
      };

      // Carrier comparison
      const originalCarriers = Array.from(new Set(originalQuotes.map(q => q.carrier_name)));
      const newCarriers = Array.from(new Set(newQuotes.map(q => q.carrier_name)));
      
      const carrierComparison = {
        originalCarriers,
        newCarriers,
        carriersLost: originalCarriers.filter(c => !newCarriers.includes(c)),
        carriersGained: newCarriers.filter(c => !originalCarriers.includes(c))
      };

      return {
        request,
        originalQuotes,
        newQuotes,
        originalBestPrice,
        newBestPrice,
        costDifference,
        costDifferencePercent,
        originalAccessorials,
        newAccessorials,
        accessorialDifferences,
        marginRecommendations,
        carrierComparison
      };
    });

    setShipmentAnalyses(analyses);
  };

  const toggleShipment = (requestId: string) => {
    const newExpanded = new Set(expandedShipments);
    if (newExpanded.has(requestId)) {
      newExpanded.delete(requestId);
    } else {
      newExpanded.add(requestId);
    }
    setExpandedShipments(newExpanded);
  };

  const getTrendIcon = (value: number | undefined) => {
    if (value === undefined) return null;
    if (value > 0) return <TrendingUp className="h-4 w-4 text-red-500" />;
    if (value < 0) return <TrendingDown className="h-4 w-4 text-green-500" />;
    return null;
  };

  const getTrendColor = (value: number | undefined, isPriceIncrease: boolean = true) => {
    if (value === undefined) return 'text-gray-500';
    if (isPriceIncrease) {
      return value > 0 ? 'text-red-600' : value < 0 ? 'text-green-600' : 'text-gray-600';
    } else {
      return value > 0 ? 'text-green-600' : value < 0 ? 'text-red-600' : 'text-gray-600';
    }
  };

  const getStatusColor = (analysis: ShipmentAnalysis) => {
    if (analysis.newQuotes && analysis.newQuotes.length > 0) {
      if (analysis.costDifference !== undefined && analysis.costDifference < 0) {
        return 'border-green-500 bg-green-50';
      } else if (analysis.costDifference !== undefined && analysis.costDifference > 0) {
        return 'border-red-500 bg-red-50';
      } else {
        return 'border-blue-500 bg-blue-50';
      }
    }
    return 'border-gray-200 bg-gray-50';
  };

  const renderComparisonBadges = (analysis: ShipmentAnalysis) => {
    if (!analysis.newQuotes || analysis.newQuotes.length === 0) return null;

    return (
      <div className="flex items-center space-x-2">
        {analysis.costDifference !== undefined && (
          <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-sm font-medium ${
            analysis.costDifference < 0 ? 'bg-green-100 text-green-800' :
            analysis.costDifference > 0 ? 'bg-red-100 text-red-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {getTrendIcon(analysis.costDifference)}
            <span>
              {analysis.costDifference > 0 ? '+' : ''}{formatCurrency(analysis.costDifference)}
            </span>
          </div>
        )}
        
        {analysis.costDifferencePercent !== undefined && Math.abs(analysis.costDifferencePercent) > 5 && (
          <div className={`px-2 py-1 rounded-full text-xs font-medium ${
            analysis.costDifferencePercent < 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {analysis.costDifferencePercent > 0 ? '+' : ''}{analysis.costDifferencePercent.toFixed(1)}%
          </div>
        )}
      </div>
    );
  };

  const renderAccessorialComparison = (analysis: ShipmentAnalysis) => {
    if (!analysis.newAccessorials) return null;
    
    return (
      <div className="bg-gray-50 rounded-lg p-4 mb-4">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Accessorial Services Comparison</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {analysis.accessorialDifferences.added.length > 0 && (
            <div>
              <div className="text-sm font-medium text-green-700 mb-2 flex items-center space-x-1">
                <Plus className="h-3 w-3" />
                <span>Added Services</span>
              </div>
              <div className="space-y-1">
                {analysis.accessorialDifferences.added.map(service => (
                  <div key={service} className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                    {service}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {analysis.accessorialDifferences.removed.length > 0 && (
            <div>
              <div className="text-sm font-medium text-red-700 mb-2 flex items-center space-x-1">
                <Minus className="h-3 w-3" />
                <span>Removed Services</span>
              </div>
              <div className="space-y-1">
                {analysis.accessorialDifferences.removed.map(service => (
                  <div key={service} className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                    {service}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {analysis.accessorialDifferences.unchanged.length > 0 && (
            <div>
              <div className="text-sm font-medium text-gray-700 mb-2">Unchanged Services</div>
              <div className="space-y-1">
                {analysis.accessorialDifferences.unchanged.map(service => (
                  <div key={service} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                    {service}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderMarginRecommendations = (analysis: ShipmentAnalysis) => (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
      <h4 className="text-sm font-medium text-yellow-800 mb-3 flex items-center space-x-2">
        <Calculator className="h-4 w-4" />
        <span>Margin Optimization Recommendations</span>
      </h4>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div>
            <div className="text-sm font-medium text-yellow-700">To Match Original Revenue:</div>
            <div className="text-lg font-bold text-yellow-900">
              {analysis.marginRecommendations.toMatchOriginal.toFixed(1)}%
            </div>
            <div className="text-xs text-yellow-600">
              Maintain customer pricing at original levels
            </div>
          </div>
          
          <div>
            <div className="text-sm font-medium text-yellow-700">To Maximize Profit:</div>
            <div className="text-lg font-bold text-yellow-900">
              {analysis.marginRecommendations.toMaximizeProfit.toFixed(1)}%
            </div>
            <div className="text-xs text-yellow-600">
              {analysis.costDifference !== undefined && analysis.costDifference < 0 
                ? 'Capitalize on cost savings' 
                : 'Standard profit optimization'}
            </div>
          </div>
        </div>
        
        <div className="space-y-3">
          <div>
            <div className="text-sm font-medium text-yellow-700">Revenue Impact:</div>
            <div className={`text-lg font-bold ${getTrendColor(analysis.marginRecommendations.revenueImpact, false)}`}>
              {analysis.marginRecommendations.revenueImpact > 0 ? '+' : ''}{formatCurrency(analysis.marginRecommendations.revenueImpact)}
            </div>
            <div className="text-xs text-yellow-600">
              Per shipment impact on revenue
            </div>
          </div>
          
          {analysis.costDifference !== undefined && analysis.costDifference < 0 && (
            <div className="bg-green-100 border border-green-200 rounded p-2">
              <div className="text-xs text-green-800 font-medium">💡 Opportunity</div>
              <div className="text-xs text-green-700 mt-1">
                Cost savings of {formatCurrency(Math.abs(analysis.costDifference))} can be used to:
                <br />• Reduce customer pricing to win more business
                <br />• Increase margin while maintaining competitive pricing
                <br />• Pass through partial savings while retaining profit
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <button
              onClick={onBack}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="h-6 w-px bg-gray-300"></div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{batch.batch_name}</h1>
              <p className="text-sm text-gray-600 mt-1">
                Created by {batch.created_by} on {new Date(batch.created_at).toLocaleDateString()}
                {newResponses && newResponses.length > 0 && (
                  <span className="ml-2 text-blue-600">
                    • Comparing with {newResponses.length} new quotes
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Analysis Mode Toggle */}
          <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setAnalysisMode('overview')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                analysisMode === 'overview' 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setAnalysisMode('detailed')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                analysisMode === 'detailed' 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Detailed
            </button>
            <button
              onClick={() => setAnalysisMode('recommendations')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                analysisMode === 'recommendations' 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Recommendations
            </button>
          </div>
        </div>

        {/* Batch Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 rounded-lg p-3">
            <div className="text-2xl font-bold text-blue-600">{batch.total_rfqs}</div>
            <div className="text-sm text-blue-700">Total RFQs</div>
          </div>
          <div className="bg-green-50 rounded-lg p-3">
            <div className="text-2xl font-bold text-green-600">{batch.total_quotes}</div>
            <div className="text-sm text-green-700">Total Quotes</div>
          </div>
          <div className="bg-purple-50 rounded-lg p-3">
            <div className="text-2xl font-bold text-purple-600">
              {batch.best_total_price > 0 ? formatCurrency(batch.best_total_price) : 'N/A'}
            </div>
            <div className="text-sm text-purple-700">Best Price</div>
          </div>
          <div className="bg-orange-50 rounded-lg p-3">
            <div className="text-2xl font-bold text-orange-600">
              {batch.total_profit > 0 ? formatCurrency(batch.total_profit) : 'N/A'}
            </div>
            <div className="text-sm text-orange-700">Total Profit</div>
          </div>
        </div>
      </div>

      {/* RFQ Cards with Analysis */}
      <div className="space-y-6">
        {shipmentAnalyses.map((analysis, index) => {
          const isExpanded = expandedShipments.has(analysis.request.id);
          
          return (
            <div key={analysis.request.id} className={`bg-white rounded-lg shadow-md border overflow-hidden ${getStatusColor(analysis)}`}>
              {/* Shipment Header - RFQ Card Style */}
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                      RFQ #{index + 1}
                    </div>
                    <div>
                      <div className="flex items-center space-x-4 text-sm text-gray-600">
                        <div className="flex items-center space-x-1">
                          <MapPin className="h-4 w-4" />
                          <span>{analysis.request.from_zip} → {analysis.request.to_zip}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Package className="h-4 w-4" />
                          <span>{analysis.request.pallets} pallets, {analysis.request.gross_weight.toLocaleString()} lbs</span>
                        </div>
                        {analysis.request.temperature && (
                          <div className="flex items-center space-x-1">
                            <Thermometer className="h-4 w-4" />
                            <span>{analysis.request.temperature}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    {/* Comparison Badges */}
                    {renderComparisonBadges(analysis)}
                    
                    {/* Price Display */}
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-600">
                        {formatCurrency(analysis.originalBestPrice)}
                      </div>
                      <div className="text-sm text-gray-500">
                        {analysis.newBestPrice !== undefined ? 'Original Best' : 'Best Price'}
                      </div>
                      {analysis.newBestPrice !== undefined && (
                        <div className={`text-lg font-medium ${getTrendColor(analysis.costDifference)}`}>
                          {formatCurrency(analysis.newBestPrice)}
                          <span className="text-xs ml-1">New Best</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Expand Button */}
                    <button
                      onClick={() => toggleShipment(analysis.request.id)}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-5 w-5" />
                      ) : (
                        <ChevronDown className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Quote Summary */}
              <div className="p-4 bg-gray-50 border-b border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <div className="text-sm text-gray-600">Original Quotes</div>
                    <div className="text-lg font-semibold text-gray-900">
                      {analysis.originalQuotes.length} carriers
                    </div>
                  </div>
                  
                  {analysis.newQuotes && (
                    <div>
                      <div className="text-sm text-gray-600">New Quotes</div>
                      <div className="text-lg font-semibold text-gray-900">
                        {analysis.newQuotes.length} carriers
                      </div>
                    </div>
                  )}
                  
                  <div>
                    <div className="text-sm text-gray-600">Quoting Decision</div>
                    <div className="text-lg font-semibold text-gray-900">
                      {analysis.request.quoting_decision.replace('project44-', '').toUpperCase()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="p-6">
                  {analysisMode === 'overview' && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                      <div className="bg-blue-50 rounded-lg p-3">
                        <div className="text-sm text-blue-600 mb-1">Original Best Price</div>
                        <div className="text-lg font-bold text-blue-900">{formatCurrency(analysis.originalBestPrice)}</div>
                        <div className="text-xs text-blue-700">{analysis.originalQuotes.length} quotes</div>
                      </div>
                      
                      {analysis.newBestPrice !== undefined && (
                        <div className="bg-green-50 rounded-lg p-3">
                          <div className="text-sm text-green-600 mb-1">New Best Price</div>
                          <div className="text-lg font-bold text-green-900">{formatCurrency(analysis.newBestPrice)}</div>
                          <div className="text-xs text-green-700">{analysis.newQuotes?.length || 0} quotes</div>
                        </div>
                      )}
                      
                      {analysis.costDifference !== undefined && (
                        <div className={`rounded-lg p-3 ${analysis.costDifference < 0 ? 'bg-green-50' : analysis.costDifference > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                          <div className="text-sm mb-1 flex items-center space-x-1">
                            {getTrendIcon(analysis.costDifference)}
                            <span className={getTrendColor(analysis.costDifference)}>Cost Change</span>
                          </div>
                          <div className={`text-lg font-bold ${getTrendColor(analysis.costDifference)}`}>
                            {analysis.costDifference > 0 ? '+' : ''}{formatCurrency(analysis.costDifference)}
                          </div>
                          <div className={`text-xs ${getTrendColor(analysis.costDifference)}`}>
                            {analysis.costDifferencePercent !== undefined && `${analysis.costDifferencePercent > 0 ? '+' : ''}${analysis.costDifferencePercent.toFixed(1)}%`}
                          </div>
                        </div>
                      )}
                      
                      <div className="bg-purple-50 rounded-lg p-3">
                        <div className="text-sm text-purple-600 mb-1">Margin Opportunity</div>
                        <div className="text-lg font-bold text-purple-900">
                          {analysis.marginRecommendations.toMaximizeProfit.toFixed(1)}%
                        </div>
                        <div className="text-xs text-purple-700">
                          {analysis.costDifference !== undefined && analysis.costDifference < 0 ? 'Savings available' : 'Standard margin'}
                        </div>
                      </div>
                    </div>
                  )}

                  {(analysisMode === 'detailed' || analysisMode === 'overview') && analysis.newQuotes && (
                    <>
                      {renderAccessorialComparison(analysis)}
                    </>
                  )}
                  
                  {analysisMode === 'recommendations' && renderMarginRecommendations(analysis)}
                  
                  {/* Carrier Cards */}
                  <div className="space-y-6">
                    {analysis.originalQuotes.length > 0 && (
                      <div>
                        <h4 className="text-lg font-semibold text-gray-900 mb-4">
                          Original Quotes ({analysis.originalQuotes.length})
                        </h4>
                        <CarrierCards
                          quotes={analysis.originalQuotes.map(convertBatchResponseToQuote)}
                          onPriceUpdate={() => {}} // Read-only for analysis
                          shipmentInfo={{
                            fromZip: analysis.request.from_zip,
                            toZip: analysis.request.to_zip,
                            weight: analysis.request.gross_weight,
                            pallets: analysis.request.pallets,
                            pickupDate: new Date(analysis.request.created_at || '').toLocaleDateString()
                          }}
                        />
                      </div>
                    )}

                    {analysis.newQuotes && analysis.newQuotes.length > 0 && (
                      <div>
                        <h4 className="text-lg font-semibold text-gray-900 mb-4">
                          New Quotes ({analysis.newQuotes.length})
                        </h4>
                        <CarrierCards
                          quotes={analysis.newQuotes.map(convertBatchResponseToQuote)}
                          onPriceUpdate={() => {}} // Read-only for analysis
                          shipmentInfo={{
                            fromZip: analysis.request.from_zip,
                            toZip: analysis.request.to_zip,
                            weight: analysis.request.gross_weight,
                            pallets: analysis.request.pallets,
                            pickupDate: new Date(analysis.request.created_at || '').toLocaleDateString()
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};