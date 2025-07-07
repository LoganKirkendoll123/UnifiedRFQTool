import React, { useState, useEffect } from 'react';
import { 
  Calculator, 
  TrendingUp, 
  Users, 
  Truck,
  Play,
  Download,
  Loader,
  AlertCircle,
  CheckCircle,
  Info,
  DollarSign,
  Target,
  BarChart3,
  RefreshCw,
  Shield,
  TrendingUp as TrendingUpIcon,
  Clock,
  Calendar,
  Filter,
  Search,
  X
} from 'lucide-react';
import { Project44APIClient, CarrierGroup } from '../utils/apiClient';
import { loadProject44Config } from '../utils/credentialStorage';
import { formatCurrency } from '../utils/pricingCalculator';
import { RFQRow } from '../types';
import { supabase } from '../utils/supabase';

interface MarginAnalysisResult {
  customerName: string;
  shipmentResults: ShipmentResult[];
  // Per-customer totals
  totalTargetCost: number;
  totalCompetitorCost: number;
  totalTargetPrice: number;
  recommendedMargin: number;
  shipmentCount: number;
}

interface ShipmentResult {
  targetCarrierRate: number;
  competitorRates: Array<{
    carrierId: string;
    carrierName: string;
    rate: number;
    margin: number;
    customerPrice: number;
  }>;
  competitorRatesWithoutOutliers: Array<{
    carrierId: string;
    carrierName: string;
    rate: number;
    margin: number;
    customerPrice: number;
  }>;
  averageCompetitorCostWithoutOutliers: number;
  averageCompetitorPriceWithoutOutliers: number;
}

interface ShipmentData {
  "Invoice #": number;
  "Customer": string;
  "Zip": string;
  "Zip_1": string;
  "Tot Packages": number;
  "Tot Weight": string;
  "Scheduled Pickup Date": string;
  "Service Level": string;
  "Booked Carrier": string;
  "Quoted Carrier": string;
  "Revenue": string;
  "Carrier Expense": string;
}

interface CustomerCarrierMargin {
  "InternalName": string;
  "P44CarrierCode": string;
  "Percentage": string;
}

// Batch processing configuration
const BATCH_SIZE = 50; // Process 10 shipments concurrently
const BATCH_DELAY = 500; // 6 second delay between batches (600 requests/minute = 10 requests/second)

export const MarginAnalysisTools: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [carrierGroups, setCarrierGroups] = useState<CarrierGroup[]>([]);
  const [selectedTargetGroup, setSelectedTargetGroup] = useState('');
  const [selectedTargetCarrier, setSelectedTargetCarrier] = useState('');
  const [selectedCompetitorGroup, setSelectedCompetitorGroup] = useState('');
  const [selectedCompetitorCarriers, setSelectedCompetitorCarriers] = useState<string[]>([]);
  const [results, setResults] = useState<MarginAnalysisResult[]>([]);
  const [error, setError] = useState<string>('');
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [project44Client, setProject44Client] = useState<Project44APIClient | null>(null);
  const [isCarriersLoading, setIsCarriersLoading] = useState(false);
  
  // Date range and customer filtering with search
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [availableCustomers, setAvailableCustomers] = useState<string[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<string[]>([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [shipmentData, setShipmentData] = useState<ShipmentData[]>([]);
  const [isLoadingShipments, setIsLoadingShipments] = useState(false);

  // Customer carrier margins
  const [customerCarrierMargins, setCustomerCarrierMargins] = useState<CustomerCarrierMargin[]>([]);

  useEffect(() => {
    initializeClient();
    loadCustomers();
    loadCustomerCarrierMargins();
    
    // Set default date range to last 30 days
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    
    setEndDate(endDate.toISOString().split('T')[0]);
    setStartDate(startDate.toISOString().split('T')[0]);
  }, []);

  // Filter customers based on search term
  useEffect(() => {
    if (customerSearchTerm.trim() === '') {
      setFilteredCustomers(availableCustomers.slice(0, 50)); // Show first 50 when no search
    } else {
      const filtered = availableCustomers.filter(customer =>
        customer.toLowerCase().includes(customerSearchTerm.toLowerCase())
      ).slice(0, 50); // Limit to 50 results
      setFilteredCustomers(filtered);
    }
  }, [customerSearchTerm, availableCustomers]);

  const initializeClient = async () => {
    const config = loadProject44Config();
    if (config) {
      const client = new Project44APIClient(config);
      setProject44Client(client);
      await loadCarrierGroups(client);
    } else {
      setError('Project44 configuration not found. Please configure your API credentials first.');
    }
  };

  const loadCarrierGroups = async (client: Project44APIClient) => {
    try {
      setIsCarriersLoading(true);
      setProcessingStatus('Loading carrier groups...');
      
      // Load all carrier groups (both standard and volume)
      const groups = await client.getAvailableCarriersByGroup(false, false);
      setCarrierGroups(groups);
      
      console.log(`✅ Loaded ${groups.length} carrier groups for margin analysis`);
      setProcessingStatus(`Loaded ${groups.length} carrier groups`);
    } catch (error) {
      console.error('❌ Failed to load carrier groups:', error);
      setError(`Failed to load carrier groups: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsCarriersLoading(false);
    }
  };

  const loadCustomers = async () => {
    try {
      // Load ALL customers without limit
      const { data, error } = await supabase
        .from('Shipments')
        .select('"Customer"')
        .not('"Customer"', 'is', null)
        .order('"Customer"');
      
      if (error) {
        console.error('Error loading customers:', error);
        return;
      }
      
      const uniqueCustomers = [...new Set(data?.map(s => s.Customer).filter(Boolean))];
      setAvailableCustomers(uniqueCustomers);
      console.log(`✅ Loaded ${uniqueCustomers.length} customers`);
    } catch (err) {
      console.error('Failed to load customers:', err);
    }
  };

  const loadCustomerCarrierMargins = async () => {
    try {
      // Load ALL customer carrier margins without limit
      const { data, error } = await supabase
        .from('CustomerCarriers')
        .select('"InternalName", "P44CarrierCode", "Percentage"')
        .not('"InternalName"', 'is', null)
        .not('"P44CarrierCode"', 'is', null)
        .not('"Percentage"', 'is', null);
      
      if (error) {
        console.error('Error loading customer carrier margins:', error);
        return;
      }
      
      setCustomerCarrierMargins(data || []);
      console.log(`✅ Loaded ${data?.length || 0} customer carrier margin configurations`);
    } catch (err) {
      console.error('Failed to load customer carrier margins:', err);
    }
  };

  const loadShipmentData = async () => {
    if (!startDate || !endDate) {
      setError('Please select both start and end dates');
      return;
    }

    try {
      setIsLoadingShipments(true);
      setProcessingStatus('Loading shipment data from database...');
      
      let query = supabase
        .from('Shipments')
        .select(`
          "Invoice #",
          "Customer",
          "Zip",
          "Zip_1",
          "Tot Packages",
          "Tot Weight",
          "Scheduled Pickup Date",
          "Service Level",
          "Booked Carrier",
          "Quoted Carrier",
          "Revenue",
          "Carrier Expense"
        `)
        .gte('"Scheduled Pickup Date"', startDate)
        .lte('"Scheduled Pickup Date"', endDate)
        .not('"Customer"', 'is', null)
        .not('"Zip"', 'is', null)
        .not('"Zip_1"', 'is', null)
        .not('"Tot Packages"', 'is', null)
        .not('"Tot Weight"', 'is', null);

      if (selectedCustomer) {
        query = query.eq('"Customer"', selectedCustomer);
      }

      const { data, error } = await query.order('"Scheduled Pickup Date"', { ascending: false });
      
      if (error) {
        throw error;
      }
      
      setShipmentData(data || []);
      setProcessingStatus(`Loaded ${data?.length || 0} shipments from database`);
      console.log(`✅ Loaded ${data?.length || 0} shipments for analysis`);
      
    } catch (err) {
      console.error('Failed to load shipment data:', err);
      setError(`Failed to load shipment data: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoadingShipments(false);
    }
  };

  const getCarriersInGroup = (groupCode: string): Array<{id: string, name: string}> => {
    const group = carrierGroups.find(g => g.groupCode === groupCode);
    return group ? group.carriers : [];
  };

  const handleCompetitorCarrierToggle = (carrierId: string) => {
    setSelectedCompetitorCarriers(prev => 
      prev.includes(carrierId) 
        ? prev.filter(id => id !== carrierId)
        : [...prev, carrierId]
    );
  };

  const handleSelectAllCompetitors = () => {
    const allCarriers = getCarriersInGroup(selectedCompetitorGroup).map(c => c.id);
    setSelectedCompetitorCarriers(allCarriers);
  };

  const handleClearAllCompetitors = () => {
    setSelectedCompetitorCarriers([]);
  };

  const convertShipmentToRFQ = (shipment: ShipmentData): RFQRow => {
    // Parse weight - handle string format like "2,500 lbs"
    const weightStr = shipment["Tot Weight"]?.toString() || '0';
    const weightMatch = weightStr.match(/[\d,]+/);
    const weight = weightMatch ? parseInt(weightMatch[0].replace(/,/g, '')) : 0;
    
    // Use pallets from Tot Packages, default to 1 if not available
    const pallets = shipment["Tot Packages"] || 1;
    
    return {
      fromDate: shipment["Scheduled Pickup Date"] || new Date().toISOString().split('T')[0],
      fromZip: shipment["Zip"] || '',
      toZip: shipment["Zip_1"] || '',
      pallets: pallets,
      grossWeight: weight,
      isStackable: false,
      accessorial: [],
      isReefer: false,
      freightClass: '70', // Default freight class
      // Include service level from historical data
      requestedServiceLevels: shipment["Service Level"] ? [shipment["Service Level"]] : undefined
    };
  };

  // UPDATED: New outlier removal logic that only removes high-end outliers if they're 50% above average
  // AND only if they're less than the target carrier's cost
  const removeHighEndOutliers = (rates: number[], targetRate: number): number[] => {
    if (rates.length < 4) {
      console.log(`⚠️ Not enough data points (${rates.length}) for outlier removal, keeping all rates`);
      return rates;
    }
    
    // Sort rates from lowest to highest
    let sortedRates = [...rates].sort((a, b) => a - b);
    console.log(`📊 Starting outlier removal with ${sortedRates.length} rates:`, sortedRates.map(r => formatCurrency(r)));
    
    let removedCount = 0;
    
    // Keep removing the most expensive rate if it's more than 50% above the average of the remaining rates
    // AND only if it's less than the target carrier's cost
    while (sortedRates.length >= 4) { // Need at least 4 rates to continue
      const mostExpensive = sortedRates[sortedRates.length - 1];
      const remainingRates = sortedRates.slice(0, -1); // All rates except the most expensive
      const averageWithoutMostExpensive = remainingRates.reduce((sum, rate) => sum + rate, 0) / remainingRates.length;
      
      // Check if the most expensive is more than 50% above the average
      const threshold = averageWithoutMostExpensive * 1.5; // 50% above average
      
      console.log(`🔍 Checking most expensive: ${formatCurrency(mostExpensive)} vs threshold: ${formatCurrency(threshold)} (avg: ${formatCurrency(averageWithoutMostExpensive)})`);
      console.log(`🔍 Target carrier rate: ${formatCurrency(targetRate)}`);
      
      // UPDATED: Only remove if it's an outlier AND less than the target carrier's cost
      if (mostExpensive > threshold && mostExpensive < targetRate) {
        // Remove the outlier
        sortedRates = remainingRates;
        removedCount++;
        console.log(`❌ Removed outlier: ${formatCurrency(mostExpensive)} (${((mostExpensive / averageWithoutMostExpensive - 1) * 100).toFixed(1)}% above average, less than target rate)`);
      } else {
        // No more outliers to remove or outlier is higher than target rate
        if (mostExpensive > threshold) {
          console.log(`⚠️ Potential outlier ${formatCurrency(mostExpensive)} not removed because it's higher than target rate ${formatCurrency(targetRate)}`);
        } else {
          console.log(`✅ No more outliers: ${formatCurrency(mostExpensive)} is within 50% of average`);
        }
        break;
      }
    }
    
    console.log(`📊 Outlier removal complete: removed ${removedCount} high-end outliers, ${sortedRates.length} rates remaining`);
    console.log(`📊 Final rates:`, sortedRates.map(r => formatCurrency(r)));
    
    return sortedRates;
  };

  // Function to get customer margin for a specific carrier with case-insensitive matching
  const getCustomerMarginForCarrier = (customerName: string, carrierCode: string): number => {
    // Normalize both customer name and carrier code for comparison
    const normalizedCustomer = customerName.trim().toUpperCase();
    const normalizedCarrierCode = carrierCode.trim().toUpperCase();
    
    const margin = customerCarrierMargins.find(
      m => m["InternalName"]?.trim().toUpperCase() === normalizedCustomer && 
           m["P44CarrierCode"]?.trim().toUpperCase() === normalizedCarrierCode
    );
    
    const marginValue = margin ? parseFloat(margin["Percentage"] || '15') : 15;
    
    console.log(`🔍 Margin lookup for ${normalizedCustomer} + ${normalizedCarrierCode}: ${marginValue}%`, {
      found: !!margin,
      marginRecord: margin
    });
    
    return marginValue;
  };

  // NEW: Process a single shipment (for concurrent processing)
  const processShipment = async (shipment: ShipmentData, index: number): Promise<{
    customerName: string;
    shipmentResult: ShipmentResult | null;
    error?: string;
  }> => {
    const customerName = shipment["Customer"];
    
    try {
      console.log(`📦 Processing shipment ${index + 1}: ${shipment["Zip"]} → ${shipment["Zip_1"]} for ${customerName}`);

      // Convert shipment to RFQ format
      const rfqData = convertShipmentToRFQ(shipment);
      
      // Skip if essential data is missing
      if (!rfqData.fromZip || !rfqData.toZip || rfqData.grossWeight === 0) {
        console.warn(`⚠️ Skipping shipment ${index + 1} - missing essential data`);
        return { customerName, shipmentResult: null };
      }

      // STEP 1: Get target carrier rate
      const targetRates = await project44Client!.getQuotes(rfqData, [selectedTargetCarrier], false, false, false);
      
      if (targetRates.length === 0) {
        console.warn(`⚠️ No rate from target carrier ${selectedTargetCarrier} for shipment ${index + 1}`);
        return { customerName, shipmentResult: null };
      }

      const targetRate = targetRates[0].baseRate + targetRates[0].fuelSurcharge + targetRates[0].premiumsAndDiscounts;
      console.log(`🎯 STEP 1 - Target carrier rate: ${formatCurrency(targetRate)}`);

      // STEP 2: Get competitor rates
      let competitorQuotes;
      
      if (selectedCompetitorCarriers.length === 0) {
        // Use entire group
        console.log(`📊 Getting quotes for entire group ${selectedCompetitorGroup}`);
        competitorQuotes = await project44Client!.getQuotesForAccountGroup(
          rfqData, 
          selectedCompetitorGroup, 
          false, 
          false, 
          false
        );
      } else {
        // Use specific carriers
        console.log(`📊 Getting quotes for ${selectedCompetitorCarriers.length} specific carriers in group ${selectedCompetitorGroup}`);
        
        competitorQuotes = await project44Client!.getQuotes(
          rfqData, 
          selectedCompetitorCarriers, 
          false, 
          false, 
          false
        );
      }
      
      console.log(`📊 STEP 2 - Got ${competitorQuotes.length} competitor quotes`);
      
      if (competitorQuotes.length === 0) {
        console.warn(`⚠️ No competitor quotes for shipment ${index + 1}`);
        return { customerName, shipmentResult: null };
      }
      
      // STEP 3: Remove invalid competitor costs (already done by API filtering)
      const competitorRates = competitorQuotes.map(quote => {
        const rate = quote.baseRate + quote.fuelSurcharge + quote.premiumsAndDiscounts;
        const carrierCode = quote.carrierCode || quote.carrier.name;
        
        // Get the specific customer margin for this carrier
        const margin = getCustomerMarginForCarrier(customerName, carrierCode);
        
        // Calculate customer price using correct formula: cost / (1 - margin)
        const customerPrice = rate / (1 - margin / 100);
        
        return {
          carrierId: carrierCode,
          carrierName: quote.carrier.name,
          rate: rate,
          margin: margin,
          customerPrice: customerPrice
        };
      });
      
      console.log(`📊 STEP 3 - ${competitorRates.length} valid competitor rates`);
      
      // STEP 4: Remove outliers using the specified method
      const competitorCosts = competitorRates.map(cr => cr.rate);
      const costsWithoutOutliers = removeHighEndOutliers(competitorCosts, targetRate);
      
      // Filter competitor rates to only include those without outliers
      const competitorRatesWithoutOutliers = competitorRates.filter(cr => 
        costsWithoutOutliers.includes(cr.rate)
      );
      
      console.log(`📊 STEP 4 - Removed ${competitorRates.length - competitorRatesWithoutOutliers.length} high-end outliers`);
      
      if (competitorRatesWithoutOutliers.length === 0) {
        console.warn(`⚠️ No competitor rates remaining after outlier removal for shipment ${index + 1}`);
        return { customerName, shipmentResult: null };
      }
      
      // STEP 5: Calculate average competitor cost and price
      const averageCompetitorCostWithoutOutliers = costsWithoutOutliers.reduce((sum, cost) => sum + cost, 0) / costsWithoutOutliers.length;
      const averageCompetitorPriceWithoutOutliers = competitorRatesWithoutOutliers.reduce((sum, cr) => sum + cr.customerPrice, 0) / competitorRatesWithoutOutliers.length;
      
      console.log(`📊 STEP 5 - Average competitor cost: ${formatCurrency(averageCompetitorCostWithoutOutliers)}, Average competitor price: ${formatCurrency(averageCompetitorPriceWithoutOutliers)}`);
      
      // Create shipment result
      const shipmentResult: ShipmentResult = {
        targetCarrierRate: targetRate,
        competitorRates: competitorRates,
        competitorRatesWithoutOutliers: competitorRatesWithoutOutliers,
        averageCompetitorCostWithoutOutliers: averageCompetitorCostWithoutOutliers,
        averageCompetitorPriceWithoutOutliers: averageCompetitorPriceWithoutOutliers
      };
      
      return { customerName, shipmentResult };
      
    } catch (error) {
      console.error(`❌ Failed to process shipment ${index + 1}:`, error);
      return { 
        customerName, 
        shipmentResult: null, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  };

  // NEW: Process shipments in concurrent batches
  const runMarginAnalysis = async () => {
    if (!project44Client || !selectedTargetGroup || !selectedTargetCarrier || !selectedCompetitorGroup) {
      setError('Please select target carrier group, target carrier, and competitor group');
      return;
    }

    if (shipmentData.length === 0) {
      setError('No shipment data loaded. Please load shipments first.');
      return;
    }

    setIsLoading(true);
    setError('');
    setResults([]);
    
    try {
      console.log(`🧠 Starting Concurrent Smart Quoting RFQ processing: ${shipmentData.length} RFQs, ${BATCH_SIZE} concurrent requests`);

      const customerResults: {[key: string]: MarginAnalysisResult} = {};
      
      // Process shipments in batches
      const totalBatches = Math.ceil(shipmentData.length / BATCH_SIZE);
      
      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const batchStart = batchIndex * BATCH_SIZE;
        const batchEnd = Math.min(batchStart + BATCH_SIZE, shipmentData.length);
        const batchShipments = shipmentData.slice(batchStart, batchEnd);
        
        setProcessingStatus(`Processing batch ${batchIndex + 1} of ${totalBatches} (${batchShipments.length} shipments concurrently)...`);
        console.log(`🚀 Processing batch ${batchIndex + 1}/${totalBatches}: shipments ${batchStart + 1}-${batchEnd}`);
        
        // Process all shipments in this batch concurrently
        const batchPromises = batchShipments.map((shipment, index) => 
          processShipment(shipment, batchStart + index)
        );
        
        const batchResults = await Promise.all(batchPromises);
        
        // Process results from this batch
        batchResults.forEach(({ customerName, shipmentResult, error }) => {
          if (error) {
            console.warn(`⚠️ Shipment processing error: ${error}`);
            return;
          }
          
          if (!shipmentResult) {
            return; // Skip shipments with no valid results
          }
          
          // Add to or update customer results
          if (!customerResults[customerName]) {
            customerResults[customerName] = {
              customerName,
              shipmentResults: [shipmentResult],
              totalTargetCost: shipmentResult.targetCarrierRate,
              totalCompetitorCost: shipmentResult.averageCompetitorCostWithoutOutliers,
              totalTargetPrice: shipmentResult.averageCompetitorPriceWithoutOutliers,
              recommendedMargin: 0, // Will be calculated later
              shipmentCount: 1
            };
          } else {
            // Add to existing customer
            const existing = customerResults[customerName];
            existing.shipmentResults.push(shipmentResult);
            existing.totalTargetCost += shipmentResult.targetCarrierRate;
            existing.totalCompetitorCost += shipmentResult.averageCompetitorCostWithoutOutliers;
            existing.totalTargetPrice += shipmentResult.averageCompetitorPriceWithoutOutliers;
            existing.shipmentCount++;
          }
        });
        
        console.log(`✅ Completed batch ${batchIndex + 1}/${totalBatches}`);
        
        // Add delay between batches to respect rate limits (except for the last batch)
        if (batchIndex < totalBatches - 1) {
          setProcessingStatus(`Waiting ${BATCH_DELAY/1000} seconds before next batch to respect rate limits...`);
          console.log(`⏱️ Waiting ${BATCH_DELAY/1000} seconds before next batch...`);
          await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
        }
      }

      // FINAL STEP: Calculate recommended margin per customer using the specified formula
      Object.values(customerResults).forEach(customerResult => {
        // Calculate recommended margin: ((Sum of Price) - (Sum of Cost)) / (Sum of Price)
        const recommendedMargin = customerResult.totalTargetPrice > 0 ? 
          ((customerResult.totalTargetPrice - customerResult.totalCompetitorCost) / customerResult.totalTargetPrice) * 100 : 0;
        
        customerResult.recommendedMargin = recommendedMargin;
        
        console.log(`💰 Final calculation for ${customerResult.customerName}:`, {
          totalTargetCost: formatCurrency(customerResult.totalTargetCost),
          totalCompetitorCost: formatCurrency(customerResult.totalCompetitorCost),
          totalTargetPrice: formatCurrency(customerResult.totalTargetPrice),
          recommendedMargin: `${recommendedMargin.toFixed(1)}%`,
          formula: `((${formatCurrency(customerResult.totalTargetPrice)} - ${formatCurrency(customerResult.totalCompetitorCost)}) / ${formatCurrency(customerResult.totalTargetPrice)}) * 100 = ${recommendedMargin.toFixed(1)}%`
        });
      });

      // Convert customer results to array
      const finalResults = Object.values(customerResults);
      setResults(finalResults);
      
      if (finalResults.length === 0) {
        setProcessingStatus('Analysis complete, but no valid results were found.');
      } else {
        setProcessingStatus(`🚀 Concurrent analysis complete! Processed ${finalResults.length} customers with competitor data using ${BATCH_SIZE} concurrent requests per batch.`);
      }
      
      console.log(`✅ Concurrent margin analysis complete: ${finalResults.length} results`);
      
    } catch (error) {
      console.error('❌ Margin analysis failed:', error);
      setError(`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setProcessingStatus('Analysis failed');
    } finally {
      setIsLoading(false);
    }
  };

  const exportResults = () => {
    if (results.length === 0) return;
    
    // Create CSV content
    const headers = [
      'Customer Name',
      'Total Target Cost',
      'Total Competitor Cost',
      'Total Target Price',
      'Recommended Margin %',
      'Shipment Count'
    ];
    
    const csvContent = [
      headers.join(','),
      ...results.map(result => [
        result.customerName,
        result.totalTargetCost.toFixed(2),
        result.totalCompetitorCost.toFixed(2),
        result.totalTargetPrice.toFixed(2),
        result.recommendedMargin.toFixed(2),
        result.shipmentCount
      ].join(','))
    ].join('\n');
    
    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `concurrent-margin-analysis-${selectedCustomer || 'all-customers'}-${startDate}-to-${endDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCustomerSelect = (customer: string) => {
    setSelectedCustomer(customer);
    setCustomerSearchTerm(customer);
    setShowCustomerDropdown(false);
  };

  const clearCustomerSelection = () => {
    setSelectedCustomer('');
    setCustomerSearchTerm('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-3">
          <div className="bg-purple-600 p-2 rounded-lg">
            <Calculator className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Concurrent Margin Discovery</h1>
            <p className="text-sm text-gray-600">
              High-speed concurrent processing: {BATCH_SIZE} requests per batch, {BATCH_DELAY/1000}s between batches (600 req/min limit)
            </p>
          </div>
        </div>
      </div>

      {/* Performance Info */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <Shield className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-green-800">
            <p className="font-medium mb-2">🚀 Concurrent Processing Optimization:</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div>
                <strong>Batch Size:</strong> {BATCH_SIZE} concurrent requests
              </div>
              <div>
                <strong>Rate Limit:</strong> 600 requests/minute (P44 limit)
              </div>
              <div>
                <strong>Batch Delay:</strong> {BATCH_DELAY/1000} seconds between batches
              </div>
              <div>
                <strong>Speed Improvement:</strong> ~{BATCH_SIZE}x faster than sequential
              </div>
              <div>
                <strong>Estimated Time:</strong> {shipmentData.length > 0 ? `~${Math.ceil((shipmentData.length / BATCH_SIZE) * (BATCH_DELAY/1000) / 60)} minutes` : 'Load data first'}
              </div>
              <div>
                <strong>Memory Efficient:</strong> Processes in controlled batches
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Date Range and Customer Filter */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Shipment Data Filters</h2>
          <button
            onClick={loadShipmentData}
            disabled={isLoadingShipments || !startDate || !endDate}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isLoadingShipments ? (
              <Loader className="h-4 w-4 animate-spin" />
            ) : (
              <Filter className="h-4 w-4" />
            )}
            <span>Load Shipments</span>
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Start Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="inline h-4 w-4 mr-1" />
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="inline h-4 w-4 mr-1" />
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* Customer Search */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Users className="inline h-4 w-4 mr-1" />
              Customer (Optional) - {availableCustomers.length} total
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={customerSearchTerm}
                onChange={(e) => {
                  setCustomerSearchTerm(e.target.value);
                  setShowCustomerDropdown(true);
                }}
                onFocus={() => setShowCustomerDropdown(true)}
                placeholder="Search customers..."
                className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
              />
              {selectedCustomer && (
                <button
                  onClick={clearCustomerSelection}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            
            {/* Customer Dropdown */}
            {showCustomerDropdown && filteredCustomers.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                {filteredCustomers.map((customer) => (
                  <button
                    key={customer}
                    onClick={() => handleCustomerSelect(customer)}
                    className="w-full text-left px-4 py-2 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
                  >
                    {customer}
                  </button>
                ))}
                {filteredCustomers.length === 50 && (
                  <div className="px-4 py-2 text-sm text-gray-500 border-t">
                    Showing first 50 results. Type to search more specifically.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Shipment Data Status */}
        {shipmentData.length > 0 && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="text-green-800 font-medium">
                Loaded {shipmentData.length} shipments from {startDate} to {endDate}
                {selectedCustomer && ` for ${selectedCustomer}`}
              </span>
            </div>
          </div>
        )}

        {/* Customer Carrier Margins Status */}
        {customerCarrierMargins.length > 0 && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <Info className="h-5 w-5 text-blue-600" />
              <span className="text-blue-800 font-medium">
                Using {customerCarrierMargins.length} customer-carrier margin configurations with case-insensitive matching
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Configuration */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Analysis Configuration</h2>
          
          <button
            onClick={() => loadCarrierGroups(project44Client!)}
            disabled={isCarriersLoading || !project44Client}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isCarriersLoading ? (
              <Loader className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span>Refresh Carrier Groups</span>
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Target Carrier Group */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Target Carrier Group
            </label>
            <select
              value={selectedTargetGroup}
              onChange={(e) => {
                setSelectedTargetGroup(e.target.value);
                setSelectedTargetCarrier(''); // Reset carrier selection
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
              disabled={isCarriersLoading}
            >
              <option value="">Select target group...</option>
              {carrierGroups.map(group => (
                <option key={group.groupCode} value={group.groupCode}>
                  {group.groupName} ({group.carriers.length} carriers)
                </option>
              ))}
            </select>
          </div>

          {/* Target Carrier */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Target Carrier
            </label>
            <select
              value={selectedTargetCarrier}
              onChange={(e) => setSelectedTargetCarrier(e.target.value)}
              disabled={!selectedTargetGroup || isCarriersLoading}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100"
            >
              <option value="">Select target carrier...</option>
              {getCarriersInGroup(selectedTargetGroup).map(carrier => (
                <option key={carrier.id} value={carrier.id}>
                  {carrier.name}
                </option>
              ))}
            </select>
          </div>

          {/* Competitor Group */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Competitor Group
            </label>
            <select
              value={selectedCompetitorGroup}
              onChange={(e) => {
                setSelectedCompetitorGroup(e.target.value);
                setSelectedCompetitorCarriers([]); // Reset carrier selection
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
              disabled={isCarriersLoading}
            >
              <option value="">Select competitor group...</option>
              {carrierGroups
                .filter(group => group.groupCode !== selectedTargetGroup)
                .map(group => (
                  <option key={group.groupCode} value={group.groupCode}>
                    {group.groupName} ({group.carriers.length} carriers)
                  </option>
                ))}
            </select>
          </div>
        </div>

        {/* Competitor Carrier Selection */}
        {selectedCompetitorGroup && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-md font-medium text-gray-900">
                Competitor Carriers ({selectedCompetitorCarriers.length} selected)
              </h3>
              <div className="flex space-x-2">
                <button
                  onClick={handleSelectAllCompetitors}
                  className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                >
                  Select All
                </button>
                <button
                  onClick={handleClearAllCompetitors}
                  className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                >
                  Clear All
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-4">
              {getCarriersInGroup(selectedCompetitorGroup).map(carrier => (
                <label key={carrier.id} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedCompetitorCarriers.includes(carrier.id)}
                    onChange={() => handleCompetitorCarrierToggle(carrier.id)}
                    className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-sm text-gray-700 truncate" title={carrier.name}>
                    {carrier.name}
                  </span>
                </label>
              ))}
            </div>
            
            <div className="mt-2 text-sm text-gray-600">
              {selectedCompetitorCarriers.length === 0 ? (
                <span className="text-blue-600 font-medium">
                  ✨ No carriers selected - will use ENTIRE group (recommended for comprehensive analysis)
                </span>
              ) : (
                <span>
                  Selected {selectedCompetitorCarriers.length} specific carriers for targeted analysis
                </span>
              )}
            </div>
          </div>
        )}

        {/* Analysis Info */}
        {selectedTargetGroup && selectedCompetitorGroup && shipmentData.length > 0 && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start space-x-2">
              <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-2">🚀 Concurrent Processing Configuration:</p>
                <div className="space-y-2 text-xs">
                  <div><strong>Per Shipment:</strong></div>
                  <div>1. Get Target Rate</div>
                  <div>2. Get Competitor Costs</div>
                  <div>3. Remove Invalid Costs</div>
                  <div>4. Remove Outliers (50% threshold, only if less than target rate)</div>
                  <div>5. Markup Remaining Rates: Rate/(1-Margin)</div>
                  <div>6. Store Average Competitor Cost and Price</div>
                  <div className="mt-2"><strong>Per Customer:</strong></div>
                  <div>1. Sum all Target Rates</div>
                  <div>2. Sum all Average Competitor Costs</div>
                  <div>3. Sum all Average Competitor Prices</div>
                  <div>4. Calculate: <strong>((Sum Price - Sum Cost) / Sum Price) × 100</strong></div>
                  <div className="mt-2 p-2 bg-blue-100 rounded">
                    <div>Target: <strong>{getCarriersInGroup(selectedTargetGroup).find(c => c.id === selectedTargetCarrier)?.name || 'Not selected'}</strong></div>
                    <div>Competitors: {selectedCompetitorCarriers.length === 0 ? (
                      <strong>Entire group</strong>
                    ) : (
                      <strong>{selectedCompetitorCarriers.length} specific carriers</strong>
                    )} from {carrierGroups.find(g => g.groupCode === selectedCompetitorGroup)?.groupName}</div>
                    <div>Shipments: <strong>{shipmentData.length}</strong> from {startDate} to {endDate}</div>
                    <div>Concurrent Processing: <strong>{BATCH_SIZE} requests per batch</strong></div>
                    <div>Estimated Time: <strong>~{Math.ceil((shipmentData.length / BATCH_SIZE) * (BATCH_DELAY/1000) / 60)} minutes</strong></div>
                    {selectedCustomer && <div>Customer: <strong>{selectedCustomer}</strong></div>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Run Analysis Button */}
        <div className="mt-6">
          <button
            onClick={runMarginAnalysis}
            disabled={isLoading || !selectedTargetGroup || !selectedTargetCarrier || !selectedCompetitorGroup || shipmentData.length === 0}
            className="flex items-center space-x-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <Loader className="h-5 w-5 animate-spin" />
            ) : (
              <Play className="h-5 w-5" />
            )}
            <span>{isLoading ? 'Processing Concurrently...' : 'Run Concurrent Margin Analysis'}</span>
          </button>
          
          {shipmentData.length === 0 && (
            <p className="text-sm text-gray-500 mt-2">
              Please load shipment data first using the "Load Shipments" button above.
            </p>
          )}
        </div>
      </div>

      {/* Processing Status */}
      {(isLoading || processingStatus) && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center space-x-3">
            {isLoading && <Loader className="h-5 w-5 animate-spin text-blue-500" />}
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Concurrent Processing Status</h3>
              <p className="text-sm text-gray-600">{processingStatus}</p>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <span className="text-red-800">{error}</span>
          </div>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold text-gray-800">Concurrent Margin Analysis Results</h3>
              <p className="text-sm text-gray-600 mt-1">
                {results.length} customer{results.length !== 1 ? 's' : ''} analyzed using concurrent processing: ((Sum Price - Sum Cost) / Sum Price) × 100
              </p>
            </div>
            <button
              onClick={exportResults}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Download className="h-4 w-4" />
              <span>Export Results</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Target Cost</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Competitor Cost</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Target Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recommended Margin</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Shipments</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {results.map((result, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {result.customerName}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {formatCurrency(result.totalTargetCost)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {formatCurrency(result.totalCompetitorCost)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {formatCurrency(result.totalTargetPrice)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        result.recommendedMargin > 15 ? 'bg-green-100 text-green-800' :
                        result.recommendedMargin > 10 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {result.recommendedMargin.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {result.shipmentCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Summary Statistics */}
      {results.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Target Cost</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(results.reduce((sum, r) => sum + r.totalTargetCost, 0) / results.reduce((sum, r) => sum + r.shipmentCount, 0))}
                </p>
              </div>
              <Target className="h-8 w-8 text-blue-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Recommended Margin</p>
                <p className="text-2xl font-bold text-gray-900">
                  {(results.reduce((sum, r) => sum + r.recommendedMargin, 0) / results.length).toFixed(1)}%
                </p>
              </div>
              <TrendingUpIcon className="h-8 w-8 text-green-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Target Price</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(results.reduce((sum, r) => sum + r.totalTargetPrice, 0) / results.reduce((sum, r) => sum + r.shipmentCount, 0))}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-purple-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Shipments</p>
                <p className="text-2xl font-bold text-gray-900">
                  {results.reduce((sum, r) => sum + r.shipmentCount, 0)}
                </p>
              </div>
              <BarChart3 className="h-8 w-8 text-orange-500" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};