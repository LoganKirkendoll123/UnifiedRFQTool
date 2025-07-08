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
  Truck,
  Play
} from 'lucide-react';
import { Project44APIClient, FreshXAPIClient, CarrierGroup } from '../utils/apiClient';
import { formatCurrency } from '../utils/pricingCalculator';
import { PricingSettings, RFQRow } from '../types';
import { supabase } from '../utils/supabase';
import { RFQProcessor } from '../utils/rfqProcessor';
import { CarrierSelection } from './CarrierSelection';

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

interface CustomerCarrierMarginResult {
  customer: string;
  carrierName: string;
  carrierScac?: string;
  shipmentsAnalyzed: number;
  avgHistoricalRate: number;
  avgCurrentRate: number;
  avgHistoricalMargin: number;
  recommendedMargin: number;
  avgPotentialSavings: number;
  totalOpportunity: number;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
}

export const MarginAnalysisMode: React.FC<MarginAnalysisModeProps> = ({
  project44Client,
  freshxClient,
  pricingSettings,
  selectedCustomer,
  onMarginRecommendation
}) => {
  const [customers, setCustomers] = useState<string[]>([]);
  const [carrierGroups, setCarrierGroups] = useState<CarrierGroup[]>([]);
  const [selectedCarriers, setSelectedCarriers] = useState<{ [carrierId: string]: boolean }>({});
  const [isLoadingCarriers, setIsLoadingCarriers] = useState(false);
  const [marginResults, setMarginResults] = useState<CustomerCarrierMarginResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, item: '' });
  const [overallStats, setOverallStats] = useState({
    totalCustomers: 0,
    totalCarriers: 0,
    totalCombinations: 0,
    avgMarginImprovement: 0,
    totalOpportunity: 0
  });

  useEffect(() => {
    loadCustomers();
    loadCarriers();
  }, []);

  const loadCustomers = async () => {
    try {
      console.log('🔍 Loading all customers from Shipments table...');
      
      const { data, error } = await supabase
        .from('Shipments')
        .select('Customer')
        .not('Customer', 'is', null);
      
      if (error) throw error;
      
      const uniqueCustomers = [...new Set(data.map(d => d.Customer).filter(Boolean))].sort();
      setCustomers(uniqueCustomers);
      console.log(`✅ Loaded ${uniqueCustomers.length} customers for margin analysis`);
    } catch (error) {
      console.error('❌ Failed to load customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCarriers = async () => {
    if (!project44Client) return;

    setIsLoadingCarriers(true);
    try {
      console.log('🚛 Loading carriers for margin analysis...');
      const groups = await project44Client.getAvailableCarriersByGroup(false, false);
      setCarrierGroups(groups);
      console.log(`✅ Loaded ${groups.length} carrier groups`);
    } catch (error) {
      console.error('❌ Failed to load carriers:', error);
      setCarrierGroups([]);
    } finally {
      setIsLoadingCarriers(false);
    }
  };

  const handleCarrierToggle = (carrierId: string, selected: boolean) => {
    setSelectedCarriers(prev => ({ ...prev, [carrierId]: selected }));
  };

  const handleSelectAll = (selected: boolean) => {
    const newSelection: { [carrierId: string]: boolean } = {};
    carrierGroups.forEach(group => {
      group.carriers.forEach(carrier => {
        newSelection[carrier.id] = selected;
      });
    });
    setSelectedCarriers(newSelection);
  };

  const handleSelectAllInGroup = (groupCode: string, selected: boolean) => {
    const group = carrierGroups.find(g => g.groupCode === groupCode);
    if (!group) return;
    
    setSelectedCarriers(prev => {
      const newSelection = { ...prev };
      group.carriers.forEach(carrier => {
        newSelection[carrier.id] = selected;
      });
      return newSelection;
    });
  };

  const getSelectedCarrierIds = () => {
    return Object.entries(selectedCarriers)
      .filter(([_, selected]) => selected)
      .map(([carrierId, _]) => carrierId);
  };

  const loadShipmentHistoryForCustomer = async (customer: string): Promise<ShipmentRecord[]> => {
    try {
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
        .eq('Customer', customer)
        .not('Zip', 'is', null)
        .not('Zip_1', 'is', null)
        .not('Tot Packages', 'is', null)
        .not('Tot Weight', 'is', null)
        .limit(25); // Limit per customer for performance
      
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
      return shipments.filter(s => 
        s.origin_zip.length === 5 && 
        s.destination_zip.length === 5 && 
        s.tot_packages > 0 &&
        parseFloat(s.tot_weight.replace(/[^\d.]/g, '')) > 0
      );
    } catch (error) {
      console.error(`❌ Failed to load shipment history for ${customer}:`, error);
      return [];
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
    const selectedCarrierIds = getSelectedCarrierIds();
    if (!project44Client || customers.length === 0 || selectedCarrierIds.length === 0) {
      console.warn('❌ Missing requirements for margin analysis');
      return;
    }

    setAnalyzing(true);
    setProgress({ current: 0, total: customers.length, item: '' });
    setMarginResults([]);

    try {
      console.log(`🧮 Starting comprehensive margin analysis for ${customers.length} customers and ${selectedCarrierIds.length} carriers...`);
      
      const processor = new RFQProcessor(project44Client, freshxClient);
      const allResults: CustomerCarrierMarginResult[] = [];
      
      for (let i = 0; i < customers.length; i++) {
        const customer = customers[i];
        setProgress({ 
          current: i + 1, 
          total: customers.length, 
          item: `Analyzing ${customer}...` 
        });
        
        try {
          // Load shipment history for this customer
          const shipmentHistory = await loadShipmentHistoryForCustomer(customer);
          
          if (shipmentHistory.length === 0) {
            console.log(`⚠️ No shipment history found for ${customer}`);
            continue;
          }
          
          console.log(`📋 Analyzing ${shipmentHistory.length} shipments for ${customer}`);
          
          // Group historical and current rates by carrier
          const carrierAnalysis = new Map<string, {
            carrierName: string;
            carrierScac?: string;
            historicalRates: number[];
            currentRates: number[];
            historicalMargins: number[];
            shipmentCount: number;
          }>();
          
          // Process each shipment
          for (const shipment of shipmentHistory) {
            try {
              const rfq = convertShipmentToRFQ(shipment);
              
              // Get current market rates for selected carriers only
              const rfqResult = await processor.processSingleRFQ(rfq, {
                selectedCarriers,
                pricingSettings,
                selectedCustomer: customer
              }, 0);
              
              const historicalRate = parseFloat(shipment.carrier_quote.replace(/[^\d.]/g, '')) || 0;
              const historicalRevenue = parseFloat(shipment.revenue.replace(/[^\d.]/g, '')) || 0;
              const historicalProfit = parseFloat(shipment.profit.replace(/[^\d.]/g, '')) || 0;
              const historicalMargin = historicalRevenue > 0 ? (historicalProfit / historicalRevenue) * 100 : 0;
              
              if (historicalRate > 0 && rfqResult.quotes.length > 0) {
                // Process each current quote
                rfqResult.quotes.forEach(quote => {
                  const carrierKey = `${quote.carrier.name}|${quote.carrier.scac || ''}`;
                  
                  if (!carrierAnalysis.has(carrierKey)) {
                    carrierAnalysis.set(carrierKey, {
                      carrierName: quote.carrier.name,
                      carrierScac: quote.carrier.scac,
                      historicalRates: [],
                      currentRates: [],
                      historicalMargins: [],
                      shipmentCount: 0
                    });
                  }
                  
                  const analysis = carrierAnalysis.get(carrierKey)!;
                  analysis.historicalRates.push(historicalRate);
                  analysis.currentRates.push(quote.carrierTotalRate);
                  analysis.historicalMargins.push(historicalMargin);
                  analysis.shipmentCount++;
                });
              }
              
              // Small delay between requests
              await new Promise(resolve => setTimeout(resolve, 150));
              
            } catch (error) {
              console.warn(`⚠️ Failed to analyze shipment for ${customer}:`, error);
            }
          }
          
          // Calculate recommendations for each customer-carrier combination
          carrierAnalysis.forEach((data, carrierKey) => {
            if (data.shipmentCount >= 2) { // Minimum 2 shipments for meaningful analysis
              const avgHistoricalRate = data.historicalRates.reduce((sum, rate) => sum + rate, 0) / data.historicalRates.length;
              const avgCurrentRate = data.currentRates.reduce((sum, rate) => sum + rate, 0) / data.currentRates.length;
              const avgHistoricalMargin = data.historicalMargins.reduce((sum, margin) => sum + margin, 0) / data.historicalMargins.length;
              const avgPotentialSavings = avgHistoricalRate - avgCurrentRate;
              
              // Calculate recommended margin based on savings opportunity
              let recommendedMargin = 25; // Default 25%
              let reasoning = 'Standard margin recommendation';
              let confidence: 'high' | 'medium' | 'low' = 'medium';
              
              if (data.shipmentCount >= 10) {
                confidence = 'high';
              } else if (data.shipmentCount >= 5) {
                confidence = 'medium';
              } else {
                confidence = 'low';
              }
              
              if (avgPotentialSavings > 100) {
                // Significant savings opportunity
                recommendedMargin = Math.min(35, avgHistoricalMargin + 5);
                reasoning = `High savings opportunity (${formatCurrency(avgPotentialSavings)}) - increase margin to capture value`;
              } else if (avgPotentialSavings > 0) {
                // Some savings available
                recommendedMargin = Math.min(30, avgHistoricalMargin + 2);
                reasoning = `Moderate savings available - slight margin increase recommended`;
              } else if (avgPotentialSavings < -100) {
                // Market rates higher than historical
                recommendedMargin = Math.max(18, avgHistoricalMargin - 3);
                reasoning = `Market rates increased - consider lower margin to remain competitive`;
              } else {
                // Rates similar
                recommendedMargin = Math.max(20, Math.min(28, avgHistoricalMargin));
                reasoning = `Market rates stable - maintain current margin strategy`;
              }
              
              const totalOpportunity = avgPotentialSavings > 0 ? avgPotentialSavings * data.shipmentCount * 0.5 : 0;
              
              allResults.push({
                customer,
                carrierName: data.carrierName,
                carrierScac: data.carrierScac,
                shipmentsAnalyzed: data.shipmentCount,
                avgHistoricalRate,
                avgCurrentRate,
                avgHistoricalMargin,
                recommendedMargin,
                avgPotentialSavings,
                totalOpportunity,
                confidence,
                reasoning
              });
            }
          });
          
        } catch (error) {
          console.error(`❌ Failed to analyze customer ${customer}:`, error);
        }
      }
      
      setMarginResults(allResults);
      
      // Calculate overall statistics
      if (allResults.length > 0) {
        const totalCustomers = new Set(allResults.map(r => r.customer)).size;
        const totalCarriers = new Set(allResults.map(r => r.carrierName)).size;
        const avgMarginImprovement = allResults.reduce((sum, r) => 
          sum + (r.recommendedMargin - r.avgHistoricalMargin), 0
        ) / allResults.length;
        const totalOpportunity = allResults.reduce((sum, r) => sum + r.totalOpportunity, 0);
        
        setOverallStats({
          totalCustomers,
          totalCarriers,
          totalCombinations: allResults.length,
          avgMarginImprovement,
          totalOpportunity
        });
      }
      
      console.log(`✅ Margin analysis completed: ${allResults.length} customer-carrier combinations analyzed`);
      
    } catch (error) {
      console.error('❌ Margin analysis failed:', error);
    } finally {
      setAnalyzing(false);
      setProgress({ current: 0, total: 0, item: '' });
    }
  };

  const saveAllMarginRecommendations = () => {
    // Save high-confidence recommendations
    const highValueRecommendations = marginResults.filter(r => 
      (r.confidence === 'high' || (r.confidence === 'medium' && r.totalOpportunity > 500)) &&
      r.shipmentsAnalyzed >= 3
    );
    
    highValueRecommendations.forEach(result => {
      onMarginRecommendation(result.customer, result.carrierName, result.recommendedMargin);
    });
    
    console.log(`✅ Saved ${highValueRecommendations.length} high-value margin recommendations`);
  };

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getMarginChangeColor = (historical: number, recommended: number) => {
    const diff = recommended - historical;
    if (diff > 1) return 'text-green-600';
    if (diff < -1) return 'text-red-600';
    return 'text-gray-600';
  };

  return (
    <div className="space-y-6">
      {/* Carrier Selection */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Carriers for Analysis</h3>
        <p className="text-sm text-gray-600 mb-4">
          Choose carriers to analyze margin opportunities across all customers. The system will compare historical shipment data against current market rates for selected carriers.
        </p>
        
        <CarrierSelection
          carrierGroups={carrierGroups}
          selectedCarriers={selectedCarriers}
          onToggleCarrier={handleCarrierToggle}
          onSelectAll={handleSelectAll}
          onSelectAllInGroup={handleSelectAllInGroup}
          isLoading={isLoadingCarriers}
        />
      </div>

      {/* Analysis Controls */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Comprehensive Margin Analysis</h3>
            <p className="text-sm text-gray-600 mt-1">
              Analyze {customers.length} customers against {Object.values(selectedCarriers).filter(Boolean).length} selected carriers
            </p>
          </div>
          
          <button
            onClick={runMarginAnalysis}
            disabled={analyzing || !project44Client || Object.values(selectedCarriers).filter(Boolean).length === 0}
            className="flex items-center space-x-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {analyzing ? (
              <>
                <Loader className="h-5 w-5 animate-spin" />
                <span>Analyzing...</span>
              </>
            ) : (
              <>
                <Play className="h-5 w-5" />
                <span>Run Comprehensive Analysis</span>
              </>
            )}
          </button>
        </div>

        {Object.values(selectedCarriers).filter(Boolean).length === 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center space-x-2 text-yellow-800">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium">
                Please select carriers above to run the analysis
              </span>
            </div>
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
                Processing customer {progress.current} of {progress.total}
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
      {marginResults.length > 0 && (
        <>
          {/* Overall Statistics */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Analysis Results</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Customer-carrier margin recommendations based on historical vs current market comparison
                </p>
              </div>
              
              <button
                onClick={saveAllMarginRecommendations}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Save className="h-4 w-4" />
                <span>Save High-Value Recommendations</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-blue-600">{overallStats.totalCustomers}</div>
                <div className="text-sm text-blue-700">Customers</div>
                <div className="text-xs text-blue-600">Analyzed</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-green-600">{overallStats.totalCarriers}</div>
                <div className="text-sm text-green-700">Carriers</div>
                <div className="text-xs text-green-600">Evaluated</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-purple-600">{overallStats.totalCombinations}</div>
                <div className="text-sm text-purple-700">Combinations</div>
                <div className="text-xs text-purple-600">Customer-Carrier pairs</div>
              </div>
              <div className="bg-orange-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-orange-600">
                  {overallStats.avgMarginImprovement > 0 ? '+' : ''}{overallStats.avgMarginImprovement.toFixed(1)}%
                </div>
                <div className="text-sm text-orange-700">Avg Margin Change</div>
                <div className="text-xs text-orange-600">Recommended vs Historical</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-green-600">{formatCurrency(overallStats.totalOpportunity)}</div>
                <div className="text-sm text-green-700">Total Opportunity</div>
                <div className="text-xs text-green-600">Across all combinations</div>
              </div>
            </div>
          </div>

          {/* Detailed Results Table */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Customer-Carrier Margin Recommendations</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Carrier</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Shipments</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Historical Margin</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recommended</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Opportunity</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Confidence</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reasoning</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {marginResults
                    .sort((a, b) => b.totalOpportunity - a.totalOpportunity)
                    .map((result, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">{result.customer}</div>
                      </td>
                      
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">{result.carrierName}</div>
                        {result.carrierScac && (
                          <div className="text-xs text-gray-500">SCAC: {result.carrierScac}</div>
                        )}
                      </td>
                      
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{result.shipmentsAnalyzed}</div>
                        <div className="text-xs text-gray-500">analyzed</div>
                      </td>
                      
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="font-medium text-blue-600">{result.avgHistoricalMargin.toFixed(1)}%</div>
                        <div className="text-xs text-gray-500">{formatCurrency(result.avgHistoricalRate)} avg rate</div>
                      </td>
                      
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className={`font-bold ${getMarginChangeColor(result.avgHistoricalMargin, result.recommendedMargin)}`}>
                          {result.recommendedMargin.toFixed(1)}%
                        </div>
                        <div className="text-xs text-gray-500">
                          {result.recommendedMargin > result.avgHistoricalMargin ? '+' : ''}
                          {(result.recommendedMargin - result.avgHistoricalMargin).toFixed(1)}% change
                        </div>
                      </td>
                      
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="font-bold text-green-600">{formatCurrency(result.totalOpportunity)}</div>
                        <div className="text-xs text-gray-500">
                          {formatCurrency(result.avgPotentialSavings)} avg savings
                        </div>
                      </td>
                      
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getConfidenceColor(result.confidence)}`}>
                          {result.confidence.toUpperCase()}
                        </span>
                      </td>
                      
                      <td className="px-4 py-4">
                        <div className="text-sm text-gray-600 max-w-xs">
                          {result.reasoning}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};