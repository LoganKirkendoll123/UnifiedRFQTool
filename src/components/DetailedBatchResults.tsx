import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  MapPin,
  Package,
  Clock,
  Thermometer,
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Info,
  Users,
  Truck,
  Award,
  Calculator,
  Target,
  ArrowRight,
  Minus,
  Plus
} from 'lucide-react';
import { BatchData, BatchRequest, BatchResponse } from '../utils/apiClient';
import { formatCurrency } from '../utils/pricingCalculator';

interface DetailedBatchResultsProps {
  batch: BatchData;
  requests: BatchRequest[];
  responses: BatchResponse[];
  newResponses?: BatchResponse[];
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

export const DetailedBatchResults: React.FC<DetailedBatchResultsProps> = ({
  batch,
  requests,
  responses,
  newResponses
}) => {
  const [expandedShipments, setExpandedShipments] = useState<Set<string>>(new Set());
  const [analysisMode, setAnalysisMode] = useState<'overview' | 'detailed' | 'recommendations'>('overview');

  // Analyze each shipment
  const shipmentAnalyses: ShipmentAnalysis[] = requests.map(request => {
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
        ? ((originalBestPrice - (newBestPrice * 0.85)) / (newBestPrice * 0.85)) * 100 // Assume 15% base margin
        : 0,
      toMaximizeProfit: costDifference !== undefined && costDifference < 0
        ? 25 // Recommended higher margin when savings are available
        : 20, // Standard margin
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
    if (value === undefined) return <Minus className="h-4 w-4 text-gray-500" />;
    if (value > 0) return <TrendingUp className="h-4 w-4 text-red-500" />;
    if (value < 0) return <TrendingDown className="h-4 w-4 text-green-500" />;
    return <Minus className="h-4 w-4 text-gray-500" />;
  };

  const getTrendColor = (value: number | undefined, isPriceIncrease: boolean = true) => {
    if (value === undefined) return 'text-gray-500';
    if (isPriceIncrease) {
      return value > 0 ? 'text-red-600' : value < 0 ? 'text-green-600' : 'text-gray-600';
    } else {
      return value > 0 ? 'text-green-600' : value < 0 ? 'text-red-600' : 'text-gray-600';
    }
  };

  const renderShipmentOverview = (analysis: ShipmentAnalysis) => (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
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
  );

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

  const renderCarrierComparison = (analysis: ShipmentAnalysis) => {
    if (!analysis.newQuotes || analysis.newQuotes.length === 0) return null;
    
    return (
      <div className="bg-blue-50 rounded-lg p-4 mb-4">
        <h4 className="text-sm font-medium text-blue-700 mb-3 flex items-center space-x-2">
          <Truck className="h-4 w-4" />
          <span>Carrier Network Comparison</span>
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <div className="text-sm font-medium text-blue-700 mb-2">Original Carriers ({analysis.originalCarriers.length})</div>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {analysis.originalCarriers.map(carrier => (
                <div key={carrier} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                  {carrier}
                </div>
              ))}
            </div>
          </div>
          
          <div>
            <div className="text-sm font-medium text-blue-700 mb-2">New Carriers ({analysis.newCarriers?.length || 0})</div>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {analysis.newCarriers?.map(carrier => (
                <div key={carrier} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                  {carrier}
                </div>
              ))}
            </div>
          </div>
          
          <div className="space-y-2">
            {analysis.carrierComparison.carriersGained.length > 0 && (
              <div>
                <div className="text-sm font-medium text-green-700 mb-1 flex items-center space-x-1">
                  <Plus className="h-3 w-3" />
                  <span>Gained</span>
                </div>
                <div className="space-y-1">
                  {analysis.carrierComparison.carriersGained.map(carrier => (
                    <div key={carrier} className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                      {carrier}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {analysis.carrierComparison.carriersLost.length > 0 && (
              <div>
                <div className="text-sm font-medium text-red-700 mb-1 flex items-center space-x-1">
                  <Minus className="h-3 w-3" />
                  <span>Lost</span>
                </div>
                <div className="space-y-1">
                  {analysis.carrierComparison.carriersLost.map(carrier => (
                    <div key={carrier} className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                      {carrier}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderDetailedQuotes = (analysis: ShipmentAnalysis) => (
    <div className="space-y-4">
      {/* Original Quotes */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">Original Quotes ({analysis.originalQuotes.length})</h4>
        <div className="space-y-2">
          {analysis.originalQuotes.map(quote => (
            <div key={quote.id} className="bg-gray-50 rounded p-3">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-medium text-gray-900">{quote.carrier_name}</div>
                  <div className="text-sm text-gray-600">
                    {quote.service_level_description || 'Standard Service'}
                  </div>
                  {quote.transit_days && (
                    <div className="text-xs text-gray-500">{quote.transit_days} transit days</div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-gray-900">{formatCurrency(quote.customer_price)}</div>
                  <div className="text-sm text-green-600">Profit: {formatCurrency(quote.profit)}</div>
                  <div className="text-xs text-gray-500">{quote.applied_margin_percentage?.toFixed(1)}% margin</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* New Quotes */}
      {analysis.newQuotes && analysis.newQuotes.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">New Quotes ({analysis.newQuotes.length})</h4>
          <div className="space-y-2">
            {analysis.newQuotes.map(quote => (
              <div key={quote.id} className="bg-blue-50 rounded p-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium text-blue-900">{quote.carrier_name}</div>
                    <div className="text-sm text-blue-700">
                      {quote.service_level_description || 'Standard Service'}
                    </div>
                    {quote.transit_days && (
                      <div className="text-xs text-blue-600">{quote.transit_days} transit days</div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-blue-900">{formatCurrency(quote.customer_price)}</div>
                    <div className="text-sm text-green-600">Profit: {formatCurrency(quote.profit)}</div>
                    <div className="text-xs text-blue-600">{quote.applied_margin_percentage?.toFixed(1)}% margin</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Analysis Mode Selector */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Detailed Batch Analysis</h3>
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

        <div className="text-sm text-gray-600">
          Analyzing {shipmentAnalyses.length} shipment{shipmentAnalyses.length !== 1 ? 's' : ''} from batch: {batch.batch_name}
          {newResponses && newResponses.length > 0 && (
            <span className="ml-2 text-blue-600">
              • Comparing with {newResponses.length} new quotes
            </span>
          )}
        </div>
      </div>

      {/* Shipment-by-Shipment Analysis */}
      <div className="space-y-4">
        {shipmentAnalyses.map((analysis, index) => {
          const isExpanded = expandedShipments.has(analysis.request.id);
          
          return (
            <div key={analysis.request.id} className="bg-white rounded-lg shadow-md overflow-hidden">
              {/* Shipment Header */}
              <div 
                className="p-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => toggleShipment(analysis.request.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                      RFQ #{index + 1}
                    </div>
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
                  
                  <div className="flex items-center space-x-4">
                    {analysis.costDifference !== undefined && (
                      <div className={`flex items-center space-x-1 ${getTrendColor(analysis.costDifference)}`}>
                        {getTrendIcon(analysis.costDifference)}
                        <span className="text-sm font-medium">
                          {analysis.costDifference > 0 ? '+' : ''}{formatCurrency(analysis.costDifference)}
                        </span>
                      </div>
                    )}
                    
                    <div className="text-right">
                      <div className="text-lg font-bold text-gray-900">{formatCurrency(analysis.originalBestPrice)}</div>
                      <div className="text-sm text-gray-500">Original Best</div>
                    </div>
                    
                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-gray-400" />
                    )}
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="p-4">
                  {analysisMode === 'overview' && renderShipmentOverview(analysis)}
                  
                  {(analysisMode === 'detailed' || analysisMode === 'overview') && (
                    <>
                      {renderAccessorialComparison(analysis)}
                      {renderCarrierComparison(analysis)}
                    </>
                  )}
                  
                  {analysisMode === 'recommendations' && renderMarginRecommendations(analysis)}
                  
                  {analysisMode === 'detailed' && renderDetailedQuotes(analysis)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};