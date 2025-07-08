import React, { useState, useEffect } from 'react';
import { 
  Calculator,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Building2,
  Target,
  ArrowRight,
  BarChart3,
  CheckCircle,
  AlertTriangle,
  Info,
  Loader,
  RefreshCw,
  Save,
  Award,
  Package,
  MapPin,
  Truck
} from 'lucide-react';
import { Project44APIClient, FreshXAPIClient } from '../utils/apiClient';
import { formatCurrency } from '../utils/pricingCalculator';
import { PricingSettings, RFQRow } from '../types';
import { supabase } from '../utils/supabase';
import { RFQProcessor } from '../utils/rfqProcessor';

interface MarginAnalysisModeProps {
  project44Client: Project44APIClient | null;
  freshxClient: FreshXAPIClient | null;
  pricingSettings: PricingSettings;
  selectedCustomer: string;
  onMarginRecommendation: (customer: string, carrier: string, recommendedMargin: number) => void;
}

interface ShipmentRecord {
  invoice_number: string;
  customer: string;
  origin_city: string;
  origin_state: string;
  origin_zip: string;
  destination_city: string;
  destination_state: string;
  destination_zip: string;
  tot_packages: number;
  tot_weight: string;
  max_freight_class: string;
  booked_carrier: string;
  quoted_carrier: string;
  revenue: string;
  carrier_quote: string;
  carrier_expense: string;
  profit: string;
  scac: string;
  scheduled_pickup_date: string;
}

interface MarginAnalysisResult {
  shipment: ShipmentRecord;
  rfq: RFQRow;
  currentMarketRates: any[];
  historicalRate: number;
  historicalRevenue: number;
  historicalProfit: number;
  bestCurrentRate: number;
  potentialSavings: number;
  recommendedMargin: number;
  marginOpportunity: number;
}

export const MarginAnalysisMode: React.FC<MarginAnalysisModeProps> = ({
  project44Client,
  freshxClient,
  pricingSettings,
  selectedCustomer,
  onMarginRecommendation
}) => {
  const [customers, setCustomers] = useState<string[]>([]);
  const [selectedAnalysisCustomer, setSelectedAnalysisCustomer] = useState<string>('');
  const [shipmentHistory, setShipmentHistory] = useState<ShipmentRecord[]>([]);
  const [analysisResults, setAnalysisResults] = useState<MarginAnalysisResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, item: '' });
  const [overallStats, setOverallStats] = useState({
    totalShipments: 0,
    avgHistoricalMargin: 0,
    avgRecommendedMargin: 0,
    totalMarginOpportunity: 0,
    avgPotentialSavings: 0
  });

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    if (selectedAnalysisCustomer) {
      loadShipmentHistory();
    }
  }, [selectedAnalysisCustomer]);

  const loadCustomers = async () => {
    try {
      console.log('🔍 Loading customers from Shipments table...');
      
      const { data, error } = await supabase
        .from('Shipments')
        .select('Customer')
        .not('Customer', 'is', null);
      
      if (error) throw error;
      
      const uniqueCustomers = [...new Set(data.map(d => d.Customer).filter(Boolean))].sort();
      setCustomers(uniqueCustomers);
      console.log(`✅ Loaded ${uniqueCustomers.length} customers from shipment history`);
    } catch (error) {
      console.error('❌ Failed to load customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadShipmentHistory = async () => {
    if (!selectedAnalysisCustomer) return;

    setLoading(true);
    try {
      console.log(`📋 Loading shipment history for customer: ${selectedAnalysisCustomer}`);
      
      const { data, error } = await supabase
        .from('Shipments')
        .select(`
          "Invoice #",
          Customer,
          "Origin City",
          State,
          Zip,
          "Destination City",
          "State_1",
          "Zip_1",
          "Tot Packages",
          "Tot Weight",
          "Max Freight Class",
          "Booked Carrier",
          "Quoted Carrier",
          Revenue,
          "Carrier Quote",
          "Carrier Expense",
          Profit,
          SCAC,
          "Scheduled Pickup Date"
        `)
        .eq('Customer', selectedAnalysisCustomer)
        .not('Zip', 'is', null)
        .not('Zip_1', 'is', null)
        .not('Tot Packages', 'is', null)
        .not('Tot Weight', 'is', null)
        .limit(50); // Limit for analysis
      
      if (error) throw error;
      
      // Convert to our format
      const shipments: ShipmentRecord[] = data.map(d => ({
        invoice_number: d['Invoice #']?.toString() || '',
        customer: d.Customer || '',
        origin_city: d['Origin City'] || '',
        origin_state: d.State || '',
        origin_zip: d.Zip?.toString().padStart(5, '0') || '',
        destination_city: d['Destination City'] || '',
        destination_state: d.State_1 || '',
        destination_zip: d.Zip_1?.toString().padStart(5, '0') || '',
        tot_packages: parseInt(d['Tot Packages']?.toString() || '0'),
        tot_weight: d['Tot Weight']?.toString() || '0',
        max_freight_class: d['Max Freight Class']?.toString() || '',
        booked_carrier: d['Booked Carrier'] || '',
        quoted_carrier: d['Quoted Carrier'] || '',
        revenue: d.Revenue?.toString() || '0',
        carrier_quote: d['Carrier Quote']?.toString() || '0',
        carrier_expense: d['Carrier Expense']?.toString() || '0',
        profit: d.Profit?.toString() || '0',
        scac: d.SCAC || '',
        scheduled_pickup_date: d['Scheduled Pickup Date'] || ''
      }));
      
      // Filter valid shipments
      const validShipments = shipments.filter(s => 
        s.origin_zip.length === 5 && 
        s.destination_zip.length === 5 && 
        s.tot_packages > 0 &&
        parseFloat(s.tot_weight.replace(/[^\d.]/g, '')) > 0
      );
      
      setShipmentHistory(validShipments);
      console.log(`✅ Loaded ${validShipments.length} valid shipments for analysis`);
    } catch (error) {
      console.error('❌ Failed to load shipment history:', error);
    } finally {
      setLoading(false);
    }
  };

  const convertShipmentToRFQ = (shipment: ShipmentRecord): RFQRow => {
    const weight = parseFloat(shipment.tot_weight.replace(/[^\d.]/g, '')) || 1000;
    const packages = shipment.tot_packages || 1;
    
    // Estimate pallets (typically 1 pallet = 1-4 packages depending on type)
    const estimatedPallets = Math.max(1, Math.ceil(packages / 3));
    
    // Use future date for RFQ
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);
    
    return {
      fromDate: futureDate.toISOString().split('T')[0],
      fromZip: shipment.origin_zip,
      toZip: shipment.destination_zip,
      pallets: estimatedPallets,
      grossWeight: weight,
      isStackable: true,
      isReefer: false, // Historical data assumed to be dry freight
      accessorial: [],
      freightClass: shipment.max_freight_class || '70',
      packageType: 'PLT',
      totalPackages: packages
    };
  };

  const runMarginAnalysis = async () => {
    if (!project44Client || shipmentHistory.length === 0) return;

    setAnalyzing(true);
    setProgress({ current: 0, total: shipmentHistory.length, item: '' });
    setAnalysisResults([]);

    try {
      console.log(`🧮 Starting margin analysis for ${shipmentHistory.length} historical shipments...`);
      
      const processor = new RFQProcessor(project44Client, freshxClient);
      const results: MarginAnalysisResult[] = [];
      
      for (let i = 0; i < shipmentHistory.length; i++) {
        const shipment = shipmentHistory[i];
        setProgress({ 
          current: i + 1, 
          total: shipmentHistory.length, 
          item: `${shipment.origin_zip} → ${shipment.destination_zip}` 
        });
        
        try {
          // Convert to RFQ format
          const rfq = convertShipmentToRFQ(shipment);
          
          // Get current market rates
          const rfqResult = await processor.processSingleRFQ(rfq, {
            selectedCarriers: {}, // Use all available carriers
            pricingSettings,
            selectedCustomer: selectedAnalysisCustomer
          }, i);
          
          // Parse historical data
          const historicalRevenue = parseFloat(shipment.revenue.replace(/[^\d.]/g, '')) || 0;
          const historicalRate = parseFloat(shipment.carrier_quote.replace(/[^\d.]/g, '')) || 0;
          const historicalProfit = parseFloat(shipment.profit.replace(/[^\d.]/g, '')) || 0;
          
          if (rfqResult.quotes.length > 0 && historicalRate > 0) {
            // Find best current rate
            const bestCurrentQuote = rfqResult.quotes.reduce((best, current) => 
              current.carrierTotalRate < best.carrierTotalRate ? current : best
            );
            
            const potentialSavings = historicalRate - bestCurrentQuote.carrierTotalRate;
            
            // Calculate recommended margin based on savings opportunity
            let recommendedMargin = 25; // Default 25%
            if (potentialSavings > 0) {
              // If we can save money on carrier costs, we can either:
              // 1. Pass savings to customer (lower margin %)
              // 2. Keep same customer price (higher margin %)
              // 3. Split the savings
              
              const currentMarginPercent = historicalRevenue > 0 ? (historicalProfit / historicalRevenue) * 100 : 0;
              const potentialMarginWithSavings = historicalRevenue > 0 ? 
                ((historicalRevenue - bestCurrentQuote.carrierTotalRate) / historicalRevenue) * 100 : 0;
              
              // Recommend margin that splits the savings benefit
              recommendedMargin = Math.min(35, Math.max(20, (currentMarginPercent + potentialMarginWithSavings) / 2));
            }
            
            const marginOpportunity = potentialSavings > 0 ? potentialSavings * 0.5 : 0; // 50% of savings as opportunity
            
            results.push({
              shipment,
              rfq,
              currentMarketRates: rfqResult.quotes,
              historicalRate,
              historicalRevenue,
              historicalProfit,
              bestCurrentRate: bestCurrentQuote.carrierTotalRate,
              potentialSavings,
              recommendedMargin,
              marginOpportunity
            });
          }
        } catch (error) {
          console.warn(`⚠️ Failed to analyze shipment ${i + 1}:`, error);
        }
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      setAnalysisResults(results);
      
      // Calculate overall statistics
      if (results.length > 0) {
        const totalShipments = results.length;
        const avgHistoricalMargin = results.reduce((sum, r) => 
          sum + (r.historicalRevenue > 0 ? (r.historicalProfit / r.historicalRevenue) * 100 : 0), 0
        ) / totalShipments;
        const avgRecommendedMargin = results.reduce((sum, r) => sum + r.recommendedMargin, 0) / totalShipments;
        const totalMarginOpportunity = results.reduce((sum, r) => sum + r.marginOpportunity, 0);
        const avgPotentialSavings = results.reduce((sum, r) => sum + Math.max(0, r.potentialSavings), 0) / totalShipments;
        
        setOverallStats({
          totalShipments,
          avgHistoricalMargin,
          avgRecommendedMargin,
          totalMarginOpportunity,
          avgPotentialSavings
        });
      }
      
      console.log(`✅ Margin analysis completed: ${results.length} shipments analyzed`);
      
    } catch (error) {
      console.error('❌ Margin analysis failed:', error);
    } finally {
      setAnalyzing(false);
      setProgress({ current: 0, total: 0, item: '' });
    }
  };

  const saveMarginRecommendations = () => {
    // Group results by carrier and calculate average recommended margin
    const carrierMargins = new Map<string, number[]>();
    
    analysisResults.forEach(result => {
      result.currentMarketRates.forEach(quote => {
        const carrierName = quote.carrier.name;
        if (!carrierMargins.has(carrierName)) {
          carrierMargins.set(carrierName, []);
        }
        carrierMargins.get(carrierName)!.push(result.recommendedMargin);
      });
    });
    
    // Calculate average and save recommendations
    carrierMargins.forEach((margins, carrierName) => {
      const avgMargin = margins.reduce((sum, margin) => sum + margin, 0) / margins.length;
      onMarginRecommendation(selectedAnalysisCustomer, carrierName, avgMargin);
    });
    
    console.log(`✅ Saved margin recommendations for ${carrierMargins.size} carriers`);
  };

  return (
    <div className="space-y-6">
      {/* Customer Selection */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Customer Lane History Analysis</h3>
        <p className="text-sm text-gray-600 mb-4">
          Select a customer to analyze their historical shipment data against current market rates to determine optimal margins.
        </p>
        
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader className="h-6 w-6 text-blue-500 animate-spin" />
            <span className="ml-2 text-gray-600">Loading customers...</span>
          </div>
        ) : customers.length === 0 ? (
          <div className="text-center py-8">
            <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
            <p className="text-gray-600">No customer shipment history found in database.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Customer</label>
              <select
                value={selectedAnalysisCustomer}
                onChange={(e) => setSelectedAnalysisCustomer(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Choose a customer...</option>
                {customers.map((customer) => (
                  <option key={customer} value={customer}>
                    {customer}
                  </option>
                ))}
              </select>
            </div>
            
            {selectedAnalysisCustomer && shipmentHistory.length > 0 && (
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium text-blue-900">Shipment History Loaded</h4>
                    <p className="text-sm text-blue-700 mt-1">
                      {shipmentHistory.length} historical shipments ready for analysis
                    </p>
                  </div>
                  <button
                    onClick={runMarginAnalysis}
                    disabled={analyzing || !project44Client}
                    className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    {analyzing ? (
                      <>
                        <Loader className="h-4 w-4 animate-spin" />
                        <span>Analyzing...</span>
                      </>
                    ) : (
                      <>
                        <Calculator className="h-4 w-4" />
                        <span>Run Margin Analysis</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Progress */}
      {analyzing && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center space-x-3 mb-4">
            <Loader className="h-5 w-5 text-blue-600 animate-spin" />
            <div className="flex-1">
              <div className="text-sm font-medium text-blue-900">
                Analyzing shipment {progress.current} of {progress.total}
              </div>
              <div className="text-xs text-blue-700">{progress.item}</div>
              <div className="w-full bg-blue-200 rounded-full h-2 mt-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ 
                    width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` 
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {analysisResults.length > 0 && (
        <>
          {/* Overall Statistics */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Margin Analysis Results</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Historical vs current market comparison for {selectedAnalysisCustomer}
                </p>
              </div>
              
              <button
                onClick={saveMarginRecommendations}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Save className="h-4 w-4" />
                <span>Save Recommendations</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-blue-600">{overallStats.totalShipments}</div>
                <div className="text-sm text-blue-700">Shipments Analyzed</div>
                <div className="text-xs text-blue-600">Historical vs current rates</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-green-600">{overallStats.avgHistoricalMargin.toFixed(1)}%</div>
                <div className="text-sm text-green-700">Avg Historical Margin</div>
                <div className="text-xs text-green-600">Based on actual shipments</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-purple-600">{overallStats.avgRecommendedMargin.toFixed(1)}%</div>
                <div className="text-sm text-purple-700">Recommended Margin</div>
                <div className="text-xs text-purple-600">Optimized for current market</div>
              </div>
              <div className="bg-orange-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-orange-600">{formatCurrency(overallStats.avgPotentialSavings)}</div>
                <div className="text-sm text-orange-700">Avg Savings Opportunity</div>
                <div className="text-xs text-orange-600">Per shipment potential</div>
              </div>
            </div>
          </div>

          {/* Detailed Results */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Shipment-by-Shipment Analysis</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Route</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Historical Rate</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Current Best Rate</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Potential Savings</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Historical Margin</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recommended Margin</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Opportunity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {analysisResults.map((result, index) => {
                    const historicalMargin = result.historicalRevenue > 0 ? 
                      (result.historicalProfit / result.historicalRevenue) * 100 : 0;
                    
                    return (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            <MapPin className="h-4 w-4 text-gray-400" />
                            <span className="font-medium text-gray-900">
                              {result.shipment.origin_zip} → {result.shipment.destination_zip}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500">
                            {result.rfq.pallets} pallets, {result.rfq.grossWeight.toLocaleString()} lbs
                          </div>
                        </td>
                        
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="font-medium text-gray-900">{formatCurrency(result.historicalRate)}</div>
                          <div className="text-xs text-gray-500">{result.shipment.booked_carrier}</div>
                        </td>
                        
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="font-medium text-green-600">{formatCurrency(result.bestCurrentRate)}</div>
                          <div className="text-xs text-gray-500">{result.currentMarketRates.length} quotes</div>
                        </td>
                        
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className={`flex items-center space-x-1 font-medium ${
                            result.potentialSavings > 0 ? 'text-green-600' : 
                            result.potentialSavings < 0 ? 'text-red-600' : 'text-gray-600'
                          }`}>
                            {result.potentialSavings > 0 ? (
                              <TrendingDown className="h-4 w-4" />
                            ) : result.potentialSavings < 0 ? (
                              <TrendingUp className="h-4 w-4" />
                            ) : null}
                            <span>{formatCurrency(Math.abs(result.potentialSavings))}</span>
                          </div>
                        </td>
                        
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="font-medium text-blue-600">{historicalMargin.toFixed(1)}%</div>
                          <div className="text-xs text-gray-500">{formatCurrency(result.historicalProfit)} profit</div>
                        </td>
                        
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="font-medium text-purple-600">{result.recommendedMargin.toFixed(1)}%</div>
                          <div className={`text-xs ${
                            result.recommendedMargin > historicalMargin ? 'text-green-600' : 
                            result.recommendedMargin < historicalMargin ? 'text-red-600' : 'text-gray-500'
                          }`}>
                            {result.recommendedMargin > historicalMargin ? '+' : ''}
                            {(result.recommendedMargin - historicalMargin).toFixed(1)}% vs historical
                          </div>
                        </td>
                        
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="font-medium text-orange-600">{formatCurrency(result.marginOpportunity)}</div>
                          <div className="text-xs text-gray-500">per shipment</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};