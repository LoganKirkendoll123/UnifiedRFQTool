import React, { useState } from 'react';
import { ProcessingResult } from '../types';
import { ChevronDown, ChevronUp, Download, Truck, MapPin, Package, Thermometer, Award, Shield, Clock, XCircle, Grid, List, Target, TrendingUp, TrendingDown } from 'lucide-react';
import { QuotePricingCard } from './QuotePricingCard';
import { RFQCard } from './RFQCard';
import { formatCurrency } from '../utils/pricingCalculator';

interface ResultsTableProps {
  results: ProcessingResult[];
  onExport: () => void;
  onPriceUpdate: (resultIndex: number, quoteId: number, newPrice: number) => void;
  serviceType?: 'standard' | 'volume' | 'ftl';
}

export const ResultsTable: React.FC<ResultsTableProps> = ({ 
  results, 
  onExport, 
  onPriceUpdate,
  serviceType
}) => {
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [sortBy, setSortBy] = useState<'index' | 'status' | 'quotes' | 'bestPrice' | 'mode'>('index');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [groupByShipment, setGroupByShipment] = useState(true);

  // Helper function to check if quote has customer price
  const hasCustomerPrice = (quote: any): boolean => {
    return quote != null && typeof quote === 'object' && 'customerPrice' in quote;
  };

  // Helper function to get best price - moved before useMemo
  const getBestPrice = (result: ProcessingResult): number => {
    if (result.quotes.length === 0) return Infinity;
    
    if (hasCustomerPrice(result.quotes[0])) {
      return Math.min(...result.quotes.map(q => (q as any).customerPrice));
    }
    
    return Math.min(...result.quotes.map(q => 
      q.baseRate + q.fuelSurcharge + q.premiumsAndDiscounts
    ));
  };

  // Check if this is multi-mode results
  const isMultiMode = results.some(r => (r as any).mode !== undefined);
  
  // Group results by shipment if multi-mode
  const groupedResults = React.useMemo(() => {
    if (!isMultiMode || !groupByShipment) {
      return results.map(r => ({ shipmentIndex: r.rowIndex, results: [r] }));
    }
    
    const groups = new Map<number, ProcessingResult[]>();
    results.forEach(result => {
      const shipmentIndex = result.rowIndex;
      if (!groups.has(shipmentIndex)) {
        groups.set(shipmentIndex, []);
      }
      groups.get(shipmentIndex)!.push(result);
    });
    
    return Array.from(groups.entries()).map(([shipmentIndex, results]) => ({
      shipmentIndex,
      results: results.sort((a, b) => {
        // Sort by competitive analysis if available
        const aResult = a as any;
        const bResult = b as any;
        
        if (aResult.competitiveAnalysis && bResult.competitiveAnalysis) {
          // Overall best first, then by mode rank
          if (aResult.competitiveAnalysis.isOverallBest !== bResult.competitiveAnalysis.isOverallBest) {
            return aResult.competitiveAnalysis.isOverallBest ? -1 : 1;
          }
          return aResult.competitiveAnalysis.modeRank - bResult.competitiveAnalysis.modeRank;
        }
        
        // Fallback to best price
        const aBestPrice = getBestPrice(a);
        const bBestPrice = getBestPrice(b);
        return aBestPrice - bBestPrice;
      })
    }));
  }, [results, isMultiMode, groupByShipment]);

  const toggleRow = (index: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedRows(newExpanded);
  };

  const sortedResults = [...groupedResults].sort((a, b) => {
    let aVal, bVal;
    switch (sortBy) {
      case 'index':
        aVal = a.shipmentIndex;
        bVal = b.shipmentIndex;
        break;
      case 'status':
        aVal = a.results[0].status;
        bVal = b.results[0].status;
        break;
      case 'quotes':
        aVal = a.results.reduce((sum, r) => sum + r.quotes.length, 0);
        bVal = b.results.reduce((sum, r) => sum + r.quotes.length, 0);
        break;
      case 'bestPrice':
        aVal = Math.min(...a.results.map(r => getBestPrice(r)));
        bVal = Math.min(...b.results.map(r => getBestPrice(r)));
        break;
      case 'mode':
        aVal = (a.results[0] as any).mode || 'standard';
        bVal = (b.results[0] as any).mode || 'standard';
        break;
      default:
        return 0;
    }
    
    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const getStatusBadge = (status: string) => {
    const badges = {
      pending: 'bg-gray-100 text-gray-700 border-gray-200',
      processing: 'bg-blue-100 text-blue-700 border-blue-200',
      success: 'bg-green-100 text-green-700 border-green-200',
      error: 'bg-red-100 text-red-700 border-red-200'
    };
    return badges[status as keyof typeof badges] || badges.pending;
  };

  const getBestQuote = (result: ProcessingResult) => {
    if (result.quotes.length === 0) return null;
    
    if (hasCustomerPrice(result.quotes[0])) {
      return result.quotes.reduce((best, current) => 
        (current as any).customerPrice < (best as any).customerPrice ? current : best
      );
    }
    
    return result.quotes.reduce((min, quote) => 
      (quote.baseRate + quote.fuelSurcharge + quote.premiumsAndDiscounts) < 
      (min.baseRate + min.fuelSurcharge + min.premiumsAndDiscounts) ? quote : min
    );
  };

  const handleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const getSortIcon = (column: typeof sortBy) => {
    if (sortBy !== column) return null;
    return sortOrder === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />;
  };

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case 'standard': return Truck;
      case 'project44-dual': return Package;
      case 'ftl': return Award;
      case 'freshx': return Thermometer;
      default: return Truck;
    }
  };

  const getModeColor = (mode: string) => {
    switch (mode) {
      case 'project44-standard': return 'blue';
      case 'project44-dual': return 'purple';
      case 'ftl': return 'orange';
      case 'freshx': return 'green';
      default: return 'gray';
    }
  };

  const getModeName = (mode: string) => {
    switch (mode) {
      case 'project44-standard': return 'Standard LTL';
      case 'project44-dual': return 'Dual Mode (VLTL)';
      case 'ftl': return 'Full Truckload';
      case 'freshx': return 'FreshX Reefer';
      default: return 'Unknown';
    }
  };

  const renderCompetitiveAnalysis = (result: any) => {
    if (!result.competitiveAnalysis) return null;
    
    const { isOverallBest, isBestInMode, savingsVsBest, modeRank } = result.competitiveAnalysis;
    
    return (
      <div className="mt-3 flex flex-wrap gap-2">
        {isOverallBest && (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <Award className="h-3 w-3 mr-1" />
            Overall Best
          </span>
        )}
        {isBestInMode && !isOverallBest && (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <Target className="h-3 w-3 mr-1" />
            Best in Mode
          </span>
        )}
        {modeRank <= 3 && !isOverallBest && (
          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
            modeRank === 1 ? 'bg-yellow-100 text-yellow-800' :
            modeRank === 2 ? 'bg-gray-100 text-gray-800' :
            'bg-orange-100 text-orange-800'
          }`}>
            #{modeRank} Mode Rank
          </span>
        )}
        {savingsVsBest !== 0 && (
          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
            savingsVsBest < 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {savingsVsBest < 0 ? (
              <TrendingDown className="h-3 w-3 mr-1" />
            ) : (
              <TrendingUp className="h-3 w-3 mr-1" />
            )}
            {savingsVsBest < 0 ? 'Saves' : 'Costs'} {formatCurrency(Math.abs(savingsVsBest))}
          </span>
        )}
      </div>
    );
  };

  const renderCardsView = () => {
    return (
      <div className="space-y-6">
        {sortedResults.map((group) => {
          // For single mode results, just show the RFQ card
          if (!isMultiMode || group.results.length === 1) {
            const result = group.results[0];
            return (
              <RFQCard
                key={group.shipmentIndex}
                result={result}
                onPriceUpdate={(quoteId, newPrice) => onPriceUpdate(group.shipmentIndex, quoteId, newPrice)}
              />
            );
          }

          // For multi-mode results, show grouped view
          const firstResult = group.results[0];
          
          return (
            <div key={group.shipmentIndex} className="space-y-4">
              {/* Shipment Header */}
              <div className="bg-white rounded-lg shadow-md p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      RFQ #{group.shipmentIndex + 1}
                      <span className="ml-2 text-sm text-gray-500">
                        ({group.results.length} mode{group.results.length !== 1 ? 's' : ''} tested)
                      </span>
                    </h3>
                    <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
                      <div className="flex items-center space-x-1">
                        <MapPin className="h-4 w-4" />
                        <span>{firstResult.originalData.fromZip} → {firstResult.originalData.toZip}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Package className="h-4 w-4" />
                        <span>{firstResult.originalData.pallets} pallets, {firstResult.originalData.grossWeight.toLocaleString()} lbs</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Clock className="h-4 w-4" />
                        <span>{firstResult.originalData.fromDate}</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Best Price Summary */}
                  {group.results.some(r => r.quotes.length > 0) && (
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-600">
                        {formatCurrency(Math.min(...group.results.map(r => getBestPrice(r)).filter(p => p !== Infinity)))}
                      </div>
                      <div className="text-sm text-gray-500">Best Price</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Mode Results */}
              {group.results.map((result, resultIndex) => (
                <RFQCard
                  key={`${group.shipmentIndex}-${resultIndex}`}
                  result={result}
                  onPriceUpdate={(quoteId, newPrice) => onPriceUpdate(group.shipmentIndex * 100 + resultIndex, quoteId, newPrice)}
                />
              ))}
            </div>
          );
        })}
      </div>
    );
  };

  const renderTableView = () => {
    return (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('index')}
              >
                <div className="flex items-center space-x-1">
                  <span>RFQ</span>
                  {getSortIcon('index')}
                </div>
              </th>
              {isMultiMode && (
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('mode')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Mode</span>
                    {getSortIcon('mode')}
                  </div>
                </th>
              )}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Route & Details
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('status')}
              >
                <div className="flex items-center space-x-1">
                  <span>Status</span>
                  {getSortIcon('status')}
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('quotes')}
              >
                <div className="flex items-center space-x-1">
                  <span>Quotes</span>
                  {getSortIcon('quotes')}
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('bestPrice')}
              >
                <div className="flex items-center space-x-1">
                  <span>Best Price</span>
                  {getSortIcon('bestPrice')}
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {results.length > 0 && results[0].quotes.length > 0 && hasCustomerPrice(results[0].quotes[0]) ? 'Competitive Analysis' : 'Carrier'}
              </th>
              <th className="w-12"></th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedResults.flatMap((group) => 
              group.results.map((result, resultIndex) => {
                const multiModeResult = result as any;
                const quotingDecision = multiModeResult.quotingDecision;
                const bestQuote = getBestQuote(result);
                const hasCustomerPricing = bestQuote && hasCustomerPrice(bestQuote);
                const displayIndex = isMultiMode ? `${group.shipmentIndex + 1}.${resultIndex + 1}` : `${group.shipmentIndex + 1}`;
                
                return (
                  <React.Fragment key={`${group.shipmentIndex}-${resultIndex}`}>
                    <tr className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        <div className="flex items-center space-x-2">
                          <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                            #{displayIndex}
                          </span>
                        </div>
                      </td>
                      {isMultiMode && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          {quotingDecision && (
                            <div className="flex items-center space-x-2">
                              {React.createElement(getModeIcon(quotingDecision), { 
                                className: `h-4 w-4 text-${getModeColor(quotingDecision)}-600` 
                              })}
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-${getModeColor(quotingDecision)}-100 text-${getModeColor(quotingDecision)}-800`}>
                                {getModeName(quotingDecision)}
                              </span>
                            </div>
                          )}
                        </td>
                      )}
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <MapPin className="h-4 w-4 text-gray-400" />
                            <span className="font-medium">{result.originalData.fromZip} → {result.originalData.toZip}</span>
                          </div>
                          <div className="flex items-center space-x-4 text-xs text-gray-500">
                            <div className="flex items-center space-x-1">
                              <Package className="h-3 w-3" />
                              <span>{result.originalData.pallets} pallets</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <span>{result.originalData.grossWeight.toLocaleString()} lbs</span>
                            </div>
                            {result.originalData.temperature && (
                              <div className="flex items-center space-x-1">
                                <Thermometer className="h-3 w-3" />
                                <span>{result.originalData.temperature}</span>
                              </div>
                            )}
                            <div className="flex items-center space-x-1">
                              <Clock className="h-3 w-3" />
                              <span>{result.originalData.fromDate}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusBadge(result.status)}`}>
                          {result.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">{result.quotes.length}</span>
                          <span className="text-gray-500">quote{result.quotes.length !== 1 ? 's' : ''}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {bestQuote ? (
                          <div className="font-bold text-lg text-green-600">
                            {hasCustomerPricing 
                              ? formatCurrency((bestQuote as any).customerPrice)
                              : formatCurrency(bestQuote.baseRate + bestQuote.fuelSurcharge + bestQuote.premiumsAndDiscounts)
                            }
                          </div>
                        ) : (
                          <span className="text-gray-400">No quotes</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {isMultiMode && multiModeResult.competitiveAnalysis ? (
                          <div className="space-y-1">
                            {renderCompetitiveAnalysis(multiModeResult)}
                          </div>
                        ) : hasCustomerPricing && bestQuote ? (
                          <div className="font-bold text-lg text-green-600">
                            {formatCurrency((bestQuote as any).profit)}
                          </div>
                        ) : bestQuote ? (
                          <div className="text-sm">
                            <div className="font-medium">{bestQuote.carrier.name}</div>
                            {bestQuote.carrier.scac && (
                              <div className="text-xs text-gray-500 flex items-center space-x-1">
                                <Award className="h-3 w-3" />
                                <span>{bestQuote.carrier.scac}</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {result.quotes.length > 0 && (
                          <button
                            onClick={() => toggleRow(group.shipmentIndex * 100 + resultIndex)}
                            className="text-blue-600 hover:text-blue-900 transition-colors"
                          >
                            {expandedRows.has(group.shipmentIndex * 100 + resultIndex) ? (
                              <ChevronUp className="h-5 w-5" />
                            ) : (
                              <ChevronDown className="h-5 w-5" />
                            )}
                          </button>
                        )}
                      </td>
                    </tr>
                    
                    {expandedRows.has(group.shipmentIndex * 100 + resultIndex) && result.quotes.length > 0 && (
                      <tr>
                        <td colSpan={isMultiMode ? 8 : 7} className="px-6 py-4 bg-gray-50">
                          <div className="space-y-4">
                            {hasCustomerPrice(result.quotes[0]) ? (
                              result.quotes.map((quote) => (
                                <QuotePricingCard
                                  key={quote.quoteId}
                                  quote={quote as any}
                                  onPriceUpdate={(quoteId, newPrice) => 
                                    onPriceUpdate(group.shipmentIndex * 100 + resultIndex, quoteId, newPrice)
                                  }
                                  isExpanded={true}
                                />
                              ))
                            ) : (
                              result.quotes.map((quote) => (
                                <div key={quote.quoteId} className="bg-white rounded-lg p-4 border border-gray-200">
                                  <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                      <div className="flex items-center space-x-3 mb-3">
                                        <Truck className="h-5 w-5 text-blue-500" />
                                        <span className="font-medium text-gray-900">{quote.carrier.name}</span>
                                        {quote.carrier.mcNumber && (
                                          <span className="text-sm text-gray-500 flex items-center space-x-1">
                                            <Shield className="h-3 w-3" />
                                            <span>MC: {quote.carrier.mcNumber}</span>
                                          </span>
                                        )}
                                        {quote.carrier.scac && (
                                          <span className="text-sm text-gray-500 flex items-center space-x-1">
                                            <Award className="h-3 w-3" />
                                            <span>SCAC: {quote.carrier.scac}</span>
                                          </span>
                                        )}
                                      </div>
                                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                        <div>
                                          <span className="text-gray-500">Base Rate:</span>
                                          <div className="font-medium">{formatCurrency(quote.baseRate)}</div>
                                        </div>
                                        <div>
                                          <span className="text-gray-500">Fuel Surcharge:</span>
                                          <div className="font-medium">{formatCurrency(quote.fuelSurcharge)}</div>
                                        </div>
                                        <div>
                                          <span className="text-gray-500">Ready By:</span>
                                          <div className="font-medium">{quote.readyByDate}</div>
                                        </div>
                                        <div>
                                          <span className="text-gray-500">Transit Days:</span>
                                          <div className="font-medium">{quote.transitDays || 'N/A'}</div>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="text-right ml-4">
                                      <div className="text-lg font-bold text-green-600">
                                        {formatCurrency(quote.baseRate + quote.fuelSurcharge + quote.premiumsAndDiscounts)}
                                      </div>
                                      <div className="text-sm text-gray-500">Total Rate</div>
                                    </div>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                    
                    {result.error && (
                      <tr>
                        <td colSpan={isMultiMode ? 8 : 7} className="px-6 py-2 bg-red-50">
                          <div className="text-sm text-red-700 flex items-center space-x-2">
                            <XCircle className="h-4 w-4" />
                            <span>{result.error}</span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">
            {isMultiMode ? 'Multi-Mode Competitive Results' : 'Processing Results'}
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            {isMultiMode ? (
              <>
                {groupedResults.length} shipment{groupedResults.length !== 1 ? 's' : ''} • 
                {results.length} total mode test{results.length !== 1 ? 's' : ''} • 
                {results.reduce((sum, r) => sum + r.quotes.length, 0)} total quotes received
              </>
            ) : (
              <>
                {results.length} RFQ{results.length !== 1 ? 's' : ''} processed • 
                {results.reduce((sum, r) => sum + r.quotes.length, 0)} total quotes received
              </>
            )}
          </p>
        </div>
        <div className="flex items-center space-x-4">
          {/* Multi-mode specific controls */}
          {isMultiMode && (
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="groupByShipment"
                checked={groupByShipment}
                onChange={(e) => setGroupByShipment(e.target.checked)}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <label htmlFor="groupByShipment" className="text-sm text-gray-700">
                Group by shipment
              </label>
            </div>
          )}
          
          {/* View Mode Toggle */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setViewMode('cards')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'cards'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Grid className="h-4 w-4" />
              <span>Cards</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'table'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <List className="h-4 w-4" />
              <span>Table</span>
            </button>
          </div>
          
          <button
            onClick={onExport}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Download className="h-4 w-4" />
            <span>Export Results</span>
          </button>
        </div>
      </div>

      <div className="p-6">
        {viewMode === 'cards' ? renderCardsView() : renderTableView()}
      </div>

      {results.length === 0 && (
        <div className="text-center py-12">
          <Truck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Results Yet</h3>
          <p className="text-gray-600">Process some RFQs to see results here.</p>
        </div>
      )}
    </div>
  );
};