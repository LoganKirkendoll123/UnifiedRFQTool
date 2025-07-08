import React, { useState, useEffect } from 'react';
import { 
  Calculator, 
  Search, 
  Truck, 
  Users, 
  TrendingUp, 
  TrendingDown, 
  DollarSign,
  Target,
  AlertTriangle,
  CheckCircle,
  Loader,
  BarChart3,
  Package,
  Clock,
  Download,
  ArrowRight,
  Percent,
  RefreshCw,
  Zap
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
  onMarginRecommendation?: (customer: string, carrier: string, recommendedMargin: number) => void;
}

interface CarrierOption {
  name: string;
  scac?: string;
  shipmentCount: number;
  totalRevenue: number;
  customers: string[];
}

interface CustomerMarginAnalysis {
  customerName: string;
  originalShipments: number;
  originalRevenue: number;
  originalCarrierCost: number;
  originalMarginPercent: number;
  newCarrierCost: number;
  newQuoteCount: number;
  requiredMarginPercent: number;
  marginAdjustment: number;
  revenueImpact: number;
  costDifference: number;
  costDifferencePercent: number;
  status: 'maintains_revenue' | 'requires_increase' | 'allows_decrease' | 'no_quotes';
  sampleShipments: any[];
}

export const MarginAnalysisMode: React.FC<MarginAnalysisModeProps> = ({
  project44Client,
  freshxClient,
  pricingSettings,
  selectedCustomer,
  onMarginRecommendation
}) => {
  const [carriers, setCarriers] = useState<CarrierOption[]>([]);
  const [selectedCarrier, setSelectedCarrier] = useState<string>('');
  const [marginAnalyses, setMarginAnalyses] = useState<CustomerMarginAnalysis[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingCarriers, setLoadingCarriers] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, item: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'customer' | 'revenue' | 'margin' | 'impact'>('revenue');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    loadCarriersFromShipments();
  }, []);

  const loadCarriersFromShipments = async () => {
    setLoadingCarriers(true);
    try {
      console.log('📊 Loading carriers from Shipments table...');
      
      // Load all shipments in batches to get carrier data
      let allShipments: any[] = [];
      let from = 0;
      const batchSize = 1000;
      let hasMore = true;
      
      while (hasMore) {
        console.log(`📋 Loading shipments batch: records ${from}-${from + batchSize - 1}`);
        
        const { data, error } = await supabase
          .from('Shipments')
          .select('Customer, "Booked Carrier", "Quoted Carrier", Revenue, "Carrier Expense", SCAC')
          .not('Customer', 'is', null)
          .not('Booked Carrier', 'is', null)
          .gt('Revenue', 0)
          .range(from, from + batchSize - 1);
        
        if (error) {
          throw error;
        }
        
        if (data && data.length > 0) {
          allShipments = [...allShipments, ...data];
          console.log(`📋 Loaded shipments batch: ${data.length} records (total loaded: ${allShipments.length})`);
          from += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
        
        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log(`✅ Loaded ${allShipments.length} shipments total`);

      // Group by carrier (prefer Booked Carrier, fallback to Quoted Carrier)
      const carrierGroups = new Map<string, {
        name: string;
        scac?: string;
        shipments: any[];
        customers: Set<string>;
        totalRevenue: number;
      }>();

      allShipments.forEach(shipment => {
        const carrierName = shipment['Booked Carrier'] || shipment['Quoted Carrier'];
        const customer = shipment.Customer;
        const revenue = parseFloat(shipment.Revenue) || 0;
        const scac = shipment.SCAC;

        if (!carrierName || !customer || revenue <= 0) return;

        if (!carrierGroups.has(carrierName)) {
          carrierGroups.set(carrierName, {
            name: carrierName,
            scac: scac || undefined,
            shipments: [],
            customers: new Set(),
            totalRevenue: 0
          });
        }

        const group = carrierGroups.get(carrierName)!;
        group.shipments.push(shipment);
        group.customers.add(customer);
        group.totalRevenue += revenue;
      });

      // Convert to CarrierOption array and sort by revenue
      const carrierOptions: CarrierOption[] = Array.from(carrierGroups.values())
        .map(group => ({
          name: group.name,
          scac: group.scac,
          shipmentCount: group.shipments.length,
          totalRevenue: group.totalRevenue,
          customers: Array.from(group.customers)
        }))
        .sort((a, b) => b.totalRevenue - a.totalRevenue);

      setCarriers(carrierOptions);
      console.log(`✅ Processed ${carrierOptions.length} unique carriers`);
      
    } catch (error) {
      console.error('❌ Failed to load carriers:', error);
    } finally {
      setLoadingCarriers(false);
    }
  };

  const convertShipmentToRFQ = (shipment: any): RFQRow | null => {
    try {
      // Extract origin and destination zips from shipment data
      const originZip = (shipment.Zip || '').toString().substring(0, 5);
      const destinationZip = (shipment.Zip_1 || '').toString().substring(0, 5);
      
      if (!originZip || !destinationZip || originZip.length !== 5 || destinationZip.length !== 5) {
        console.warn('Invalid ZIP codes in shipment:', { originZip, destinationZip });
        return null;
      }

      // Extract shipment details
      const pallets = parseInt(shipment['Tot Packages']) || 1;
      const grossWeight = parseFloat(shipment['Tot Weight']) || 1000;
      const freightClass = shipment['Max Freight Class'] ? shipment['Max Freight Class'].toString() : '70';
      
      // Determine if it's a reefer shipment (based on commodity or other indicators)
      const commodity = (shipment.Commodities || '').toLowerCase();
      const isReefer = commodity.includes('refrigerat') || commodity.includes('frozen') || commodity.includes('chilled');
      
      // Create pickup date (use scheduled pickup date or default to today)
      const pickupDate = shipment['Scheduled Pickup Date'] ? 
        new Date(shipment['Scheduled Pickup Date']).toISOString().split('T')[0] :
        new Date().toISOString().split('T')[0];

      const rfq: RFQRow = {
        fromDate: pickupDate,
        fromZip: originZip,
        toZip: destinationZip,
        pallets,
        grossWeight,
        isStackable: true, // Default assumption
        isReefer,
        freightClass,
        accessorial: [], // Could parse from shipment data if available
        commodityDescription: shipment.Commodities || 'General Freight',
        packageType: 'PLT',
        totalPackages: pallets,
        weightUnit: 'LB',
        lengthUnit: 'IN',
        preferredCurrency: 'USD',
        paymentTerms: 'PREPAID'
      };

      return rfq;
    } catch (error) {
      console.error('❌ Failed to convert shipment to RFQ:', error);
      return null;
    }
  };

  const runMarginAnalysis = async () => {
    if (!selectedCarrier) {
      alert('Please select a carrier to analyze');
      return;
    }

    if (!project44Client) {
      alert('Project44 client not available. Please configure your API credentials.');
      return;
    }

    setLoading(true);
    setMarginAnalyses([]);
    setProgress({ current: 0, total: 0, item: 'Loading shipments...' });

    try {
      console.log(`🔍 Running real market analysis for carrier: ${selectedCarrier}`);

      // Load all shipments for the selected carrier
      let allShipments: any[] = [];
      let from = 0;
      const batchSize = 1000;
      let hasMore = true;
      
      while (hasMore) {
        const { data, error } = await supabase
          .from('Shipments')
          .select('*')
          .or(`"Booked Carrier".eq.${selectedCarrier},"Quoted Carrier".eq.${selectedCarrier}`)
          .not('Customer', 'is', null)
          .not('Zip', 'is', null)
          .not('Zip_1', 'is', null)
          .gt('Revenue', 0)
          .gt('"Carrier Expense"', 0)
          .range(from, from + batchSize - 1);
        
        if (error) {
          throw error;
        }
        
        if (data && data.length > 0) {
          allShipments = [...allShipments, ...data];
          setProgress({ 
            current: allShipments.length, 
            total: allShipments.length + 1000, // Estimate
            item: `Loading ${selectedCarrier} shipments...` 
          });
          from += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
        
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      console.log(`✅ Loaded ${allShipments.length} shipments for ${selectedCarrier}`);

      // Group shipments by customer
      const customerGroups = new Map<string, any[]>();
      allShipments.forEach(shipment => {
        const customer = shipment.Customer;
        if (!customerGroups.has(customer)) {
          customerGroups.set(customer, []);
        }
        customerGroups.get(customer)!.push(shipment);
      });

      console.log(`📊 Analyzing ${customerGroups.size} customers`);
      setProgress({ current: 0, total: customerGroups.size, item: 'Converting and processing shipments...' });

      // Create RFQ processor
      const processor = new RFQProcessor(project44Client, freshxClient);

      const analyses: CustomerMarginAnalysis[] = [];
      let processedCount = 0;

      // Analyze each customer
      for (const [customerName, customerShipments] of customerGroups) {
        processedCount++;
        setProgress({ 
          current: processedCount, 
          total: customerGroups.size, 
          item: `Processing ${customerName} (${customerShipments.length} shipments)...` 
        });

        // Calculate original totals
        let originalRevenue = 0;
        let originalCarrierCost = 0;

        customerShipments.forEach(shipment => {
          originalRevenue += parseFloat(shipment.Revenue) || 0;
          originalCarrierCost += parseFloat(shipment['Carrier Expense']) || 0;
        });

        if (originalRevenue <= 0 || originalCarrierCost <= 0) continue;

        const originalMarginPercent = ((originalRevenue - originalCarrierCost) / originalRevenue) * 100;

        // Convert sample shipments to RFQ format (limit to 5 for performance)
        const sampleShipments = customerShipments.slice(0, 5);
        const rfqs: RFQRow[] = [];
        
        for (const shipment of sampleShipments) {
          const rfq = convertShipmentToRFQ(shipment);
          if (rfq) {
            rfqs.push(rfq);
          }
        }

        if (rfqs.length === 0) {
          console.warn(`No valid RFQs created for ${customerName}`);
          continue;
        }

        // Process RFQs through Project44 to get current market rates
        let totalNewCarrierCost = 0;
        let totalNewQuotes = 0;

        try {
          const results = await processor.processMultipleRFQs(rfqs, {
            selectedCarriers: {}, // Will use account group
            pricingSettings,
            selectedCustomer: customerName,
            batchName: `Margin Analysis - ${customerName}`,
            createdBy: 'margin-analysis'
          });

          // Calculate new carrier costs from quotes
          results.forEach(result => {
            if (result.status === 'success' && result.quotes.length > 0) {
              // Find the best quote (lowest carrier cost)
              const bestQuote = result.quotes.reduce((best, current) => 
                current.carrierTotalRate < best.carrierTotalRate ? current : best
              );
              
              totalNewCarrierCost += bestQuote.carrierTotalRate;
              totalNewQuotes++;
            }
          });

          // Scale up the costs based on the sample size
          const scaleFactor = customerShipments.length / sampleShipments.length;
          const estimatedNewCarrierCost = totalNewCarrierCost * scaleFactor;

          // Calculate required margin to maintain same revenue
          const requiredMargin = originalRevenue - estimatedNewCarrierCost;
          const requiredMarginPercent = (requiredMargin / originalRevenue) * 100;

          // Calculate adjustments
          const marginAdjustment = requiredMarginPercent - originalMarginPercent;
          const revenueImpact = estimatedNewCarrierCost - originalCarrierCost;
          const costDifference = estimatedNewCarrierCost - originalCarrierCost;
          const costDifferencePercent = originalCarrierCost > 0 ? (costDifference / originalCarrierCost) * 100 : 0;

          // Determine status
          let status: CustomerMarginAnalysis['status'] = 'maintains_revenue';
          if (totalNewQuotes === 0) {
            status = 'no_quotes';
          } else if (marginAdjustment > 2) {
            status = 'requires_increase';
          } else if (marginAdjustment < -2) {
            status = 'allows_decrease';
          }

          analyses.push({
            customerName,
            originalShipments: customerShipments.length,
            originalRevenue,
            originalCarrierCost,
            originalMarginPercent,
            newCarrierCost: estimatedNewCarrierCost,
            newQuoteCount: totalNewQuotes,
            requiredMarginPercent,
            marginAdjustment,
            revenueImpact,
            costDifference,
            costDifferencePercent,
            status,
            sampleShipments: rfqs
          });

          console.log(`✅ Processed ${customerName}: ${totalNewQuotes} quotes, ${marginAdjustment.toFixed(1)}% margin adjustment`);

        } catch (error) {
          console.error(`❌ Failed to process ${customerName}:`, error);
          
          // Add failed analysis
          analyses.push({
            customerName,
            originalShipments: customerShipments.length,
            originalRevenue,
            originalCarrierCost,
            originalMarginPercent,
            newCarrierCost: 0,
            newQuoteCount: 0,
            requiredMarginPercent: 0,
            marginAdjustment: 0,
            revenueImpact: 0,
            costDifference: 0,
            costDifferencePercent: 0,
            status: 'no_quotes',
            sampleShipments: []
          });
        }

        // Small delay between customers
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Sort analyses by revenue impact (highest first)
      analyses.sort((a, b) => Math.abs(b.revenueImpact) - Math.abs(a.revenueImpact));
      
      setMarginAnalyses(analyses);
      console.log(`✅ Completed real market analysis for ${analyses.length} customers`);

    } catch (error) {
      console.error('❌ Failed to run margin analysis:', error);
      alert('Failed to run margin analysis. Please try again.');
    } finally {
      setLoading(false);
      setProgress({ current: 0, total: 0, item: '' });
    }
  };

  const filteredAndSortedAnalyses = marginAnalyses
    .filter(analysis => 
      searchTerm === '' || 
      analysis.customerName.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      let aVal, bVal;
      
      switch (sortBy) {
        case 'customer':
          aVal = a.customerName.toLowerCase();
          bVal = b.customerName.toLowerCase();
          break;
        case 'revenue':
          aVal = a.originalRevenue;
          bVal = b.originalRevenue;
          break;
        case 'margin':
          aVal = a.marginAdjustment;
          bVal = b.marginAdjustment;
          break;
        case 'impact':
          aVal = Math.abs(a.revenueImpact);
          bVal = Math.abs(b.revenueImpact);
          break;
        default:
          return 0;
      }
      
      if (sortOrder === 'asc') {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      } else {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      }
    });

  const exportResults = () => {
    if (marginAnalyses.length === 0) return;

    const csvHeaders = [
      'Customer',
      'Original Shipments',
      'Original Revenue',
      'Original Carrier Cost',
      'Original Margin %',
      'New Carrier Cost (Est)',
      'New Quotes Count',
      'Required Margin %',
      'Margin Adjustment',
      'Revenue Impact',
      'Cost Difference',
      'Cost Difference %',
      'Status'
    ];

    const csvData = marginAnalyses.map(analysis => [
      analysis.customerName,
      analysis.originalShipments,
      analysis.originalRevenue.toFixed(2),
      analysis.originalCarrierCost.toFixed(2),
      analysis.originalMarginPercent.toFixed(2),
      analysis.newCarrierCost.toFixed(2),
      analysis.newQuoteCount,
      analysis.requiredMarginPercent.toFixed(2),
      analysis.marginAdjustment.toFixed(2),
      analysis.revenueImpact.toFixed(2),
      analysis.costDifference.toFixed(2),
      analysis.costDifferencePercent.toFixed(2),
      analysis.status
    ]);

    const csvContent = [csvHeaders, ...csvData]
      .map(row => row.join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `real-market-analysis-${selectedCarrier}-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getStatusIcon = (status: CustomerMarginAnalysis['status']) => {
    switch (status) {
      case 'maintains_revenue':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'requires_increase':
        return <TrendingUp className="h-4 w-4 text-red-500" />;
      case 'allows_decrease':
        return <TrendingDown className="h-4 w-4 text-blue-500" />;
      case 'no_quotes':
        return <AlertTriangle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: CustomerMarginAnalysis['status']) => {
    switch (status) {
      case 'maintains_revenue':
        return 'text-green-600';
      case 'requires_increase':
        return 'text-red-600';
      case 'allows_decrease':
        return 'text-blue-600';
      case 'no_quotes':
        return 'text-gray-600';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-3 mb-4">
          <div className="bg-green-600 p-2 rounded-lg">
            <RefreshCw className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Real Market Rate Impact Analysis</h2>
            <p className="text-sm text-gray-600">
              Reprocess historical shipments through Project44 to get current market rates and determine required margin adjustments
            </p>
          </div>
        </div>

        {/* Carrier Selection */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Truck className="inline h-4 w-4 mr-1" />
              Select Carrier to Analyze
            </label>
            {loadingCarriers ? (
              <div className="flex items-center space-x-2 p-3 border rounded-lg">
                <Loader className="h-4 w-4 animate-spin text-blue-500" />
                <span className="text-sm text-gray-600">Loading carriers from shipments...</span>
              </div>
            ) : (
              <select
                value={selectedCarrier}
                onChange={(e) => setSelectedCarrier(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="">Choose a carrier...</option>
                {carriers.map((carrier) => (
                  <option key={carrier.name} value={carrier.name}>
                    {carrier.name} ({carrier.shipmentCount} shipments, {formatCurrency(carrier.totalRevenue)} revenue)
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Analysis Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <Zap className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-2">Real Market Analysis Process:</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>Loads historical shipments for selected carrier from database</li>
                  <li>Converts shipments to RFQ format with current routing rules</li>
                  <li>Processes sample shipments through Project44 API for current market rates</li>
                  <li>Compares historical costs vs current market costs</li>
                  <li>Calculates required margin adjustments to maintain revenue</li>
                  <li>Provides actionable recommendations per customer</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Analysis Button */}
        <div className="mt-6 flex items-center space-x-4">
          <button
            onClick={runMarginAnalysis}
            disabled={!selectedCarrier || loading || !project44Client}
            className="flex items-center space-x-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <>
                <Loader className="h-4 w-4 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                <span>Run Real Market Analysis</span>
              </>
            )}
          </button>

          {marginAnalyses.length > 0 && (
            <button
              onClick={exportResults}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Download className="h-4 w-4" />
              <span>Export Results</span>
            </button>
          )}
        </div>

        {/* Progress Bar */}
        {loading && progress.total > 0 && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center space-x-3 mb-2">
              <Loader className="h-4 w-4 text-blue-600 animate-spin" />
              <span className="text-sm font-medium text-blue-900">{progress.item}</span>
              <span className="text-sm text-blue-700">({progress.current}/{progress.total})</span>
            </div>
            <div className="w-full bg-blue-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      {marginAnalyses.length > 0 && (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Real Market Analysis Results: {selectedCarrier}
                </h3>
                <p className="text-sm text-gray-600">
                  {marginAnalyses.length} customers analyzed using current Project44 rates
                </p>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search customers..."
                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
                
                <select
                  value={`${sortBy}-${sortOrder}`}
                  onChange={(e) => {
                    const [field, order] = e.target.value.split('-');
                    setSortBy(field as any);
                    setSortOrder(order as any);
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="revenue-desc">Revenue (High to Low)</option>
                  <option value="revenue-asc">Revenue (Low to High)</option>
                  <option value="margin-desc">Margin Adjustment (High to Low)</option>
                  <option value="margin-asc">Margin Adjustment (Low to High)</option>
                  <option value="impact-desc">Impact (High to Low)</option>
                  <option value="customer-asc">Customer (A-Z)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {marginAnalyses.filter(a => a.status === 'requires_increase').length}
                </div>
                <div className="text-sm text-gray-600">Require Margin Increase</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {marginAnalyses.filter(a => a.status === 'maintains_revenue').length}
                </div>
                <div className="text-sm text-gray-600">Maintain Current Margins</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {marginAnalyses.filter(a => a.status === 'allows_decrease').length}
                </div>
                <div className="text-sm text-gray-600">Allow Margin Decrease</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-600">
                  {marginAnalyses.filter(a => a.status === 'no_quotes').length}
                </div>
                <div className="text-sm text-gray-600">No Current Quotes</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {formatCurrency(marginAnalyses.reduce((sum, a) => sum + a.revenueImpact, 0))}
                </div>
                <div className="text-sm text-gray-600">Total Revenue Impact</div>
              </div>
            </div>
          </div>

          {/* Results Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Shipments</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Original Revenue</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cost Change</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Original Margin</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Required Margin</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Adjustment</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredAndSortedAnalyses.map((analysis) => (
                  <tr key={analysis.customerName} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{analysis.customerName}</div>
                      <div className="text-xs text-gray-500">{analysis.newQuoteCount} quotes processed</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {analysis.originalShipments}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(analysis.originalRevenue)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm ${analysis.costDifferencePercent > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {analysis.costDifferencePercent > 0 ? '+' : ''}{analysis.costDifferencePercent.toFixed(1)}%
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatCurrency(analysis.costDifference)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {analysis.originalMarginPercent.toFixed(1)}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {analysis.requiredMarginPercent.toFixed(1)}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm font-medium ${
                        analysis.marginAdjustment > 0 ? 'text-red-600' : 
                        analysis.marginAdjustment < 0 ? 'text-blue-600' : 'text-gray-600'
                      }`}>
                        {analysis.marginAdjustment > 0 ? '+' : ''}{analysis.marginAdjustment.toFixed(1)}%
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`flex items-center space-x-2 ${getStatusColor(analysis.status)}`}>
                        {getStatusIcon(analysis.status)}
                        <span className="text-sm capitalize">
                          {analysis.status.replace('_', ' ')}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* No Results State */}
      {!loading && marginAnalyses.length === 0 && selectedCarrier && (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <div className="flex items-center justify-center mb-4">
            <AlertTriangle className="h-12 w-12 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Analysis Results</h3>
          <p className="text-gray-600">
            No processable shipment data found for {selectedCarrier}. Please select a different carrier or check your data.
          </p>
        </div>
      )}
    </div>
  );
};