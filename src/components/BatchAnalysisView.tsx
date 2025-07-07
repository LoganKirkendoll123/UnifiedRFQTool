import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft,
  Save,
  Eye,
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
  analysisId?: string; // If loading a saved analysis
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
}

export const BatchAnalysisView: React.FC<BatchAnalysisViewProps> = ({
  batch,
  requests,
  responses,
  newResponses,
  analysisId,
  onBack
}) => {
  const [expandedShipments, setExpandedShipments] = useState<Set<string>>(new Set());
  const [shipmentAnalyses, setShipmentAnalyses] = useState<ShipmentAnalysis[]>([]);
  const [overallStats, setOverallStats] = useState({
    betterPricingCount: 0,
    worsePricingCount: 0,
    unchangedCount: 0,
    avgPriceChange: 0,
    totalPriceDifference: 0
  });

  // Load saved analysis if analysisId is provided
  useEffect(() => {
    calculateAnalyses();
  }, [requests, responses, newResponses, analysisId]);

  // Helper function to extract pricing from BatchResponse (including from raw_response)
  const extractPricingFromResponse = (response: BatchResponse): { carrierRate: number; customerPrice: number; profit: number; transitDays?: number } => {
    let carrierTotalRate = response.carrier_total_rate || 0;
    let customerPrice = response.customer_price || 0;
    let profit = response.profit || 0;
    let transitDays = response.transit_days || undefined;
    
    if (response.raw_response) {
      // Extract from Project44 raw response if database values are missing
      if (response.raw_response.rateQuoteDetail?.total && carrierTotalRate <= 0) {
        carrierTotalRate = response.raw_response.rateQuoteDetail.total;
      }
      
      // Extract transit days from raw response if not in database
      if (!transitDays && response.raw_response.transitDays) {
        transitDays = response.raw_response.transitDays;
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
      carrierRate: carrierTotalRate,
      customerPrice,
      profit,
      transitDays
    };
  };
  // Convert BatchResponse to QuoteWithPricing format for CarrierCards
  const convertBatchResponseToQuote = (response: BatchResponse): QuoteWithPricing => {
    const relatedRequest = requests.find(r => r.id === response.request_id);
    
    // Use the helper function to extract pricing
    const extractedPricing = extractPricingFromResponse(response);
    let carrierTotalRate = extractedPricing.carrierRate;
    let customerPrice = extractedPricing.customerPrice;
    let profit = extractedPricing.profit;
    let baseRate = 0;
    let fuelSurcharge = 0;
    let premiumsAndDiscounts = 0;
    
    if (response.raw_response) {
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
      transitDays: extractedPricing.transitDays,
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
      
      // Use the helper function to get actual pricing instead of raw database values
      const originalBestPrice = originalQuotes.length > 0 
        ? Math.min(...originalQuotes.map(q => extractPricingFromResponse(q).customerPrice)) 
        : 0;
      
      const newBestPrice = newQuotes.length > 0 
        ? Math.min(...newQuotes.map(q => extractPricingFromResponse(q).customerPrice)) 
        : undefined;
      
      const costDifference = newBestPrice !== undefined ? newBestPrice - originalBestPrice : undefined;
      const costDifferencePercent = originalBestPrice > 0 && costDifference !== undefined 
        ? (costDifference / originalBestPrice) * 100 
        : undefined;


      return {
        request,
        originalQuotes,
        newQuotes,
        originalBestPrice,
        newBestPrice,
        costDifference,
        costDifferencePercent
      };
    });

    // Calculate overall statistics if we have comparison data
    if (newResponses && newResponses.length > 0) {
      const betterPricingCount = analyses.filter(a => a.costDifference !== undefined && a.costDifference < 0).length;
      const worsePricingCount = analyses.filter(a => a.costDifference !== undefined && a.costDifference > 0).length;
      const unchangedCount = analyses.filter(a => a.costDifference !== undefined && Math.abs(a.costDifference) < 0.01).length;
      
      const totalOriginalValue = responses.reduce((sum, r) => sum + extractPricingFromResponse(r).customerPrice, 0);
      const totalNewValue = newResponses.reduce((sum, r) => sum + extractPricingFromResponse(r).customerPrice, 0);
      const totalPriceDifference = totalNewValue - totalOriginalValue;
      const avgPriceChange = totalOriginalValue > 0 ? (totalPriceDifference / totalOriginalValue) * 100 : 0;
      
      setOverallStats({
        betterPricingCount,
        worsePricingCount,
        unchangedCount,
        avgPriceChange,
        totalPriceDifference
      });
    }
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
      return 'border-green-200 bg-green-50';
    } else if (analysis.originalQuotes.length > 0) {
      return 'border-blue-200 bg-blue-50';
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


  const getChangeColor = (value: number) => {
    if (value > 0) return 'text-red-600';
    if (value < 0) return 'text-green-600';
    return 'text-gray-600';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={onBack}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="h-6 w-px bg-gray-300"></div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {batch.batch_name}
                {analysisId && (
                  <span className="ml-2 text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                    Saved Analysis
                  </span>
                )}
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Created by {batch.created_by} on {new Date(batch.created_at).toLocaleDateString()}
                {newResponses && newResponses.length > 0 && (
                  <span className="ml-2 text-green-600">
                    • Comparing with {newResponses.length} new quotes
                  </span>
                )}
                {analysisId && (
                  <span className="ml-2 text-blue-600">
                    • Viewing saved analysis
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Analysis Status */}
          {newResponses && newResponses.length > 0 && (
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1 text-green-600">
                <Eye className="h-4 w-4" />
                <span className="text-sm font-medium">
                  {analysisId ? 'Saved Analysis' : 'Live Comparison'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Batch Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-blue-50 rounded-lg p-3">
            <div className="text-2xl font-bold text-blue-600">{batch.total_rfqs}</div>
            <div className="text-sm text-blue-700">Total RFQs</div>
          </div>
          <div className="bg-green-50 rounded-lg p-3">
            <div className="text-2xl font-bold text-green-600">{responses.length}</div>
            <div className="text-sm text-green-700">Original Quotes</div>
          </div>
          <div className="bg-purple-50 rounded-lg p-3">
            <div className="text-2xl font-bold text-purple-600">{newResponses?.length || 0}</div>
            <div className="text-sm text-purple-700">Comparison Quotes</div>
          </div>
          <div className="bg-orange-50 rounded-lg p-3">
            <div className="text-2xl font-bold text-orange-600">
              {shipmentAnalyses.length}
            </div>
            <div className="text-sm text-orange-700">Shipments Analyzed</div>
          </div>
        </div>

        {/* Customer Margin Comparison Summary - Only show if comparing */}
        {newResponses && newResponses.length > 0 && (
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="text-lg font-semibold text-blue-900 mb-3">Margin Analysis Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{overallStats.betterPricingCount}</div>
                <div className="text-sm text-gray-600">Better Pricing</div>
                <div className="text-xs text-gray-500">Lower cost than original</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{overallStats.worsePricingCount}</div>
                <div className="text-sm text-gray-600">Higher Pricing</div>
                <div className="text-xs text-gray-500">Higher cost than original</div>
              </div>
              <div className="text-center">
                <div className={`text-2xl font-bold ${getChangeColor(overallStats.avgPriceChange)}`}>
                  {overallStats.avgPriceChange > 0 ? '+' : ''}{overallStats.avgPriceChange.toFixed(1)}%
                </div>
                <div className="text-sm text-gray-600">Avg Price Change</div>
                <div className="text-xs text-gray-500">Overall impact</div>
              </div>
            </div>
          </div>
        )}
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
                  {/* Show comparison stats if comparing */}
                  {analysis.newQuotes && analysis.newQuotes.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                      <div className="bg-blue-50 rounded-lg p-3">
                        <div className="text-sm text-blue-600 mb-1">Original Best Price</div>
                        <div className="text-lg font-bold text-blue-900">{formatCurrency(analysis.originalBestPrice)}</div>
                        <div className="text-xs text-blue-700">{analysis.originalQuotes.length} quotes</div>
                      </div>
                      
                      <div className="bg-green-50 rounded-lg p-3">
                        <div className="text-sm text-green-600 mb-1">New Best Price</div>
                        <div className="text-lg font-bold text-green-900">{formatCurrency(analysis.newBestPrice!)}</div>
                        <div className="text-xs text-green-700">{analysis.newQuotes.length} quotes</div>
                      </div>
                      
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
                      
                      <div className="bg-blue-50 rounded-lg p-3">
                        <div className="text-sm text-blue-600 mb-1">Quote Count</div>
                        <div className="text-lg font-bold text-blue-900">
                          {analysis.newQuotes.length} vs {analysis.originalQuotes.length}
                        </div>
                        <div className="text-xs text-blue-700">
                          New vs Original
                        </div>
                      </div>
                    </div>
                  )}
                  
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
        
        {/* Show message if no comparison data */}
        {(!newResponses || newResponses.length === 0) && (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <div className="flex items-center justify-center mb-4">
              <BarChart3 className="h-12 w-12 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Comparison Data</h3>
            <p className="text-gray-600 mb-4">
              To see margin analysis, reprocess this batch with "Compare with Current Settings"
            </p>
            <button
              onClick={onBack}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Back to Batch Manager
            </button>
          </div>
        )}
      </div>
    </div>
  );
};