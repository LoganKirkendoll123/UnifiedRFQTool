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
  Calendar,
  AlertCircle,
  Package,
  MapPin,
  Truck,
  Play,
  XCircle
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
  const [error, setError] = useState<string>('');
  const [connectionError, setConnectionError] = useState<string>('');
  const [reprocessing, setReprocessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, item: '' });
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [analysisError, setAnalysisError] = useState<string>('');
  const [overallStats, setOverallStats] = useState({
    dateRange: '',
    totalShipments: 0,
    totalCustomers: 0,
    totalCarriers: 0,
    totalCombinations: 0,
    avgMarginImprovement: 0,
    totalOpportunity: 0
  });

  // Date range state
  const [dateRange, setDateRange] = useState({
    startDate: (() => {
      const date = new Date();
      date.setMonth(date.getMonth() - 12); // Default to last 12 months
      return date.toISOString().split('T')[0];
    })(),
    endDate: (() => {
      const date = new Date();
      date.setDate(date.getDate() - 1); // Yesterday to avoid today's incomplete data
      return date.toISOString().split('T')[0];
    })()
  });

  useEffect(() => {
    loadCustomers();
    loadCarriers();
  }, []);

  const loadCustomers = async () => {
    setConnectionError('');
    try {
      console.log('🔍 Loading ALL customers from Shipments table in batches...');
      
      // Load all customers in batches of 1000
      let allCustomers: any[] = [];
      let from = 0;
      const batchSize = 1000;
      let hasMore = true;
      
      while (hasMore) {
        const { data, error } = await supabase
          .from('Shipments')
          .select('Customer')
          .not('Customer', 'is', null)
          .range(from, from + batchSize - 1);
        
        if (error) {
          console.error('❌ Supabase query error:', error);
          setConnectionError(`Database connection error: ${error.message}. Please check your Supabase configuration.`);
          setCustomers([]);
          return;
        }
        
        if (data && data.length > 0) {
          allCustomers = [...allCustomers, ...data];
          from += batchSize;
          hasMore = data.length === batchSize; // Continue if we got a full batch
          console.log(`📋 Loaded customer batch: ${data.length} customers (total: ${allCustomers.length})`);
        } else {
          hasMore = false;
        }
      }
      
      if (!allCustomers || allCustomers.length === 0) {
        setConnectionError('Shipments table is empty or contains no valid customer records. Please ensure your historical shipment data is loaded into the Shipments table.');
        setCustomers([]);
        return;
      }
      
      const uniqueCustomers = [...new Set(allCustomers.map(d => d.Customer).filter(Boolean))].sort();
      setCustomers(uniqueCustomers);
      
      if (uniqueCustomers.length === 0) {
        setConnectionError('Shipments table is empty or contains no valid customer records. Please ensure your historical shipment data is loaded into the Shipments table.');
      }
      
      console.log(`✅ Loaded ${uniqueCustomers.length} unique customers from ${allCustomers.length} total records`);
    } catch (error) {
      console.error('❌ Failed to load customers:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setConnectionError(`Failed to connect to database: ${errorMessage}. Please check your Supabase connection and try again.`);
      setCustomers([]);
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
      console.log(`📅 Loading shipment history for ${customer} from ${dateRange.startDate} to ${dateRange.endDate}`);
      
      // Convert date range to 5-digit Excel serial format
      const convertToExcelSerial = (dateString: string): number => {
        const date = new Date(dateString);
        // Excel epoch starts January 1, 1900, but JavaScript starts January 1, 1970
        // There are 25567 days between 1900-01-01 and 1970-01-01
        const excelEpoch = new Date(1900, 0, 1);
        const daysDiff = Math.floor((date.getTime() - excelEpoch.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        return daysDiff;
      };
      
      const startSerial = convertToExcelSerial(dateRange.startDate);
      const endSerial = convertToExcelSerial(dateRange.endDate);
      
      console.log(`📊 Date conversion: ${dateRange.startDate} (${startSerial}) to ${dateRange.endDate} (${endSerial})`);
      
      // First, let's find the exact customer name in the database (case-insensitive)
      const { data: customerCheck, error: customerError } = await supabase
        .from('Shipments')
        .select('Customer')
        .not('Customer', 'is', null)
        .limit(1000); // Get a reasonable sample to find matching customers
      
      if (customerError) {
        throw customerError;
      }
      
      // Find the exact database customer name that matches (case-insensitive, trimmed)
      const exactCustomerName = customerCheck?.find(row => 
        row.Customer?.trim().toUpperCase() === customer.trim().toUpperCase()
      )?.Customer;
      
      if (!exactCustomerName) {
        console.log(`❌ No exact customer match found for "${customer}"`);
        console.log(`Available customers sample:`, customerCheck?.slice(0, 5).map(c => `"${c.Customer}"`));
        return [];
      }
      
      console.log(`✅ Found exact customer match: "${exactCustomerName}" for search term "${customer}"`);
      
      // First, check total records for this customer without date filtering
      const { data: totalRecords, error: totalError } = await supabase
        .from('Shipments')
        .select('count', { count: 'exact' })
        .eq('Customer', exactCustomerName)
        .not('Zip', 'is', null);
      
      if (totalError) {
        console.error(`❌ Error counting total records for ${customer}:`, totalError);
      } else {
        console.log(`📊 Total shipments for ${customer} (no date filter): ${totalRecords?.length || 0}`);
      }
      
      // Check sample of pickup dates to understand format
      const { data: datesSample, error: datesError } = await supabase
        .from('Shipments')
        .select('"Scheduled Pickup Date", "Actual Pickup Date"')
        .eq('Customer', customer)
        .not('"Scheduled Pickup Date"', 'is', null)
        .limit(5);
      
      if (!datesError && datesSample && datesSample.length > 0) {
        console.log(`📅 Sample pickup dates for ${customer}:`, datesSample.map(d => ({
          scheduled: d['Scheduled Pickup Date'],
          scheduledType: typeof d['Scheduled Pickup Date'],
          scheduledAsDate: d['Scheduled Pickup Date'] ? new Date(d['Scheduled Pickup Date']).toISOString() : null,
          actual: d['Actual Pickup Date'],
          actualType: typeof d['Actual Pickup Date']
        })));
      }
      
      // Convert date range to timestamps for comparison
      let startTimestamp: number | null = null;
      let endTimestamp: number | null = null;
      
      if (dateRange.startDate) {
        startTimestamp = new Date(dateRange.startDate).getTime();
        console.log(`📅 Start date filter: ${dateRange.startDate} → ${startTimestamp} (${new Date(startTimestamp).toISOString()})`);
      }
      
      if (dateRange.endDate) {
        endTimestamp = new Date(dateRange.endDate).getTime();
        console.log(`📅 End date filter: ${dateRange.endDate} → ${endTimestamp} (${new Date(endTimestamp).toISOString()})`);
      }
      
      let query = supabase
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
        .limit(50);
      
      // Add date range filtering using 5-digit serial dates
      if (startTimestamp) {
        query = query.gte('"Scheduled Pickup Date"', startSerial);
      }
      if (endTimestamp) {
        query = query.lte('"Scheduled Pickup Date"', endSerial);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      console.log(`📋 Query result: ${data?.length || 0} shipments found for ${customer}`);
      
      // Debug: Show sample pickup dates
      if (data && data.length > 0) {
        const sampleDates = data.slice(0, 3).map(d => d['Scheduled Pickup Date']).filter(Boolean);
        console.log(`📅 Sample pickup dates from database:`, sampleDates);
        console.log(`📊 Date range comparison: Filtering for ${startSerial} to ${endSerial}`);
      }
      
      console.log(`📋 Query returned ${data?.length || 0} shipments for ${customer} with date filtering`);
      
      // If we got no results with date filtering, try without date filtering to see if there are any records
      if (!data || data.length === 0) {
        console.log(`⚠️ No shipments found with date filtering, trying without date filter...`);
        
        const { data: unfiltered, error: unfilteredError } = await supabase
          .from('Shipments')
          .select(`
            "Invoice #",
            Customer,
            "Scheduled Pickup Date"
          `)
          .eq('Customer', customer)
          .not('Zip', 'is', null)
          .not('Zip_1', 'is', null)
          .limit(10);
        
        if (!unfilteredError && unfiltered && unfiltered.length > 0) {
          console.log(`📋 Found ${unfiltered.length} shipments WITHOUT date filtering. Sample dates:`, 
            unfiltered.map(s => ({
              invoice: s['Invoice #'],
              pickupDate: s['Scheduled Pickup Date'],
              pickupDateAsDate: s['Scheduled Pickup Date'] ? new Date(s['Scheduled Pickup Date']).toISOString() : null
            }))
          );
        } else {
          console.log(`❌ No shipments found even without date filtering for ${customer}`);
        }
      }
      
      // Convert to our format
      const shipments: ShipmentRecord[] = (data || []).map(d => ({
        invoice_number: d['Invoice #']?.toString() || '',
        customer: exactCustomerName, // Use the exact customer name from database
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
      
      console.log(`📋 Filtered to ${validShipments.length} valid shipments for ${customer} (from ${shipments.length} total records)`);
      
      return validShipments;
      
      // Additional debugging
      if (shipments.length === 0 && data && data.length > 0) {
        console.log(`⚠️ All ${data.length} shipments were filtered out during validation`);
        console.log('📊 Sample raw data:', data.slice(0, 2));
      }
      
      return shipments;
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
    console.log('🎯 Starting margin analysis...');
    setError('');
    
    // Validation with user feedback
    const selectedCarrierIds = getSelectedCarrierIds();
    
    if (!project44Client) {
      const errorMsg = 'Project44 client not available. Please configure your Project44 API credentials.';
      setError(errorMsg);
      console.error('❌', errorMsg);
      return;
    }
    
    // Check for connection errors first
    if (connectionError) {
      setError(connectionError);
      return;
    }
    
    if (customers.length === 0) {
      const errorMsg = 'No customers available for analysis. Please ensure your Shipments table contains historical data with customer information.';
      setError(errorMsg);
      console.error('❌', errorMsg);
      return;
    }
    
    if (selectedCarrierIds.length === 0) {
      const errorMsg = 'No carriers selected. Please select at least one carrier above.';
      setError(errorMsg);
      console.error('❌', errorMsg);
      return;
    }

    console.log(`✅ Validation passed: ${customers.length} customers, ${selectedCarrierIds.length} carriers`);

    setReprocessing(true);
    setProgress({ current: 0, total: 0, item: '' });
    setAnalysisComplete(false);
    setAnalysisError('');

    try {
      console.log(`🧮 Starting comprehensive margin analysis for ${customers.length} customers and ${selectedCarrierIds.length} carriers...`);
      
      const processor = new RFQProcessor(project44Client, freshxClient);
      const allResults: CustomerCarrierMarginResult[] = [];
      
      let totalShipmentsProcessed = 0;
      
      for (let i = 0; i < customers.length; i++) {
        const customer = customers[i];
        setProgress({ 
          current: i + 1, 
          total: customers.length, 
          item: `Analyzing ${customer}...` 
        });
        
        try {
          console.log(`🔍 Processing customer ${i + 1}/${customers.length}: ${customer}`);
          
          // Load shipment history for this customer
          setProgress({ 
            current: i + 1, 
            total: customers.length, 
            item: `${customer}: Loading shipment history...` 
          });
          
          const shipmentHistory = await loadShipmentHistoryForCustomer(customer);
          
          if (shipmentHistory.length === 0) {
            console.log(`⚠️ No shipment history found for ${customer} in date range ${dateRange.startDate} to ${dateRange.endDate}`);
            continue;
          }
          
          totalShipmentsProcessed += shipmentHistory.length;
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
          for (let shipmentIdx = 0; shipmentIdx < shipmentHistory.length; shipmentIdx++) {
            const shipment = shipmentHistory[shipmentIdx];
            
            // Update progress for individual shipment
            setProgress({ 
              current: i + 1, 
              total: customers.length, 
              item: `${customer}: Processing shipment ${shipmentIdx + 1}/${shipmentHistory.length} (Invoice: ${shipment.invoice_number})` 
            });
            
            try {
              console.log(`📦 Processing shipment ${shipmentIdx + 1}/${shipmentHistory.length} for ${customer}: Invoice ${shipment.invoice_number}`);
              
              // Convert shipment to RFQ format
              const rfq = convertShipmentToRFQ(shipment);
              console.log(`🔄 Converted shipment to RFQ: ${rfq.fromZip} → ${rfq.toZip}, ${rfq.pallets} pallets, ${rfq.grossWeight} lbs`);
              
              // Validate the RFQ before processing
              const validationErrors = processor.validateRFQ ? processor.validateRFQ(rfq) : [];
              if (validationErrors.length > 0) {
                console.warn(`⚠️ RFQ validation errors for shipment ${shipmentIdx + 1}:`, validationErrors);
                continue; // Skip invalid RFQs
              }
              
              // Get current market rates for selected carriers only
              console.log(`📞 Making RFQ API call for shipment ${shipmentIdx + 1}...`);
              const rfqResult = await processor.processSingleRFQ(rfq, {
                selectedCarriers,
                pricingSettings,
                selectedCustomer: customer
              }, shipmentIdx);
              
              console.log(`📊 RFQ API call completed for shipment ${shipmentIdx + 1}: ${rfqResult.quotes.length} quotes received, status: ${rfqResult.status}`);
              
              // Log detailed RFQ result
              if (rfqResult.error) {
                console.error(`❌ RFQ processing error for shipment ${shipmentIdx + 1}:`, rfqResult.error);
                continue;
              }
              
              if (rfqResult.quotes.length === 0) {
                console.log(`⚠️ No quotes received for shipment ${shipmentIdx + 1} (${rfq.fromZip} → ${rfq.toZip})`);
                continue;
              }
              
              const historicalRate = parseFloat(shipment.carrier_quote.replace(/[^\d.]/g, '')) || 0;
              const historicalRevenue = parseFloat(shipment.revenue.replace(/[^\d.]/g, '')) || 0;
              const historicalProfit = parseFloat(shipment.profit.replace(/[^\d.]/g, '')) || 0;
              const historicalMargin = historicalRevenue > 0 ? (historicalProfit / historicalRevenue) * 100 : 0;
              
              console.log(`💰 Historical data for shipment ${shipmentIdx + 1}: Rate=${formatCurrency(historicalRate)}, Revenue=${formatCurrency(historicalRevenue)}, Profit=${formatCurrency(historicalProfit)}, Margin=${historicalMargin.toFixed(1)}%`);
              
              if (historicalRate > 0 && rfqResult.quotes.length > 0) {
                // SCAC Matching: Only compare quotes from the same carrier as the historical shipment
                const historicalSCAC = shipment.scac?.trim().toUpperCase();
                console.log(`🔍 Looking for SCAC matches for: ${historicalSCAC}`);
                
                if (historicalSCAC) {
                  // Find current quotes that match the historical carrier's SCAC
                  const matchingQuotes = rfqResult.quotes.filter(quote => {
                    const currentSCAC = (quote.carrier.scac || quote.carrierCode)?.trim().toUpperCase();
                    console.log(`   Comparing: Historical=${historicalSCAC} vs Current=${currentSCAC} (${quote.carrier.name})`);
                    return currentSCAC === historicalSCAC;
                  });
                  
                  console.log(`🎯 Found ${matchingQuotes.length} matching quotes for SCAC ${historicalSCAC}`);
                  
                  console.log(`🔍 SCAC Matching for ${customer}: Historical=${historicalSCAC}, Found ${matchingQuotes.length} matching current quotes`);
                  
                  // Process only matching quotes (same carrier, historical vs current)
                  matchingQuotes.forEach(quote => {
                    const carrierKey = `${quote.carrier.name}|${historicalSCAC}`;
                    
                    if (!carrierAnalysis.has(carrierKey)) {
                      carrierAnalysis.set(carrierKey, {
                        carrierName: quote.carrier.name,
                        carrierScac: historicalSCAC,
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
                    
                    console.log(`✅ Added comparison data: ${quote.carrier.name} (${historicalSCAC})`);
                    console.log(`   Historical: ${formatCurrency(historicalRate)}, Current: ${formatCurrency(quote.carrierTotalRate)}`);
                  });
                } else {
                  console.warn(`⚠️ No SCAC found for shipment ${shipmentIdx + 1} (Invoice: ${shipment.invoice_number}) - skipping`);
                }
              } else {
                console.log(`⚠️ Skipping shipment ${shipmentIdx + 1}: Historical rate = ${formatCurrency(historicalRate)}, Current quotes = ${rfqResult.quotes.length}`);
              }
              
              // Small delay between individual shipment requests
              await new Promise(resolve => setTimeout(resolve, 150));
              
            } catch (error) {
              console.error(`❌ Failed to analyze shipment ${shipmentIdx + 1} for ${customer}:`, error);
              console.error(`   Shipment details:`, {
                invoice: shipment.invoice_number,
                route: `${shipment.origin_zip} → ${shipment.destination_zip}`,
                weight: shipment.tot_weight,
                packages: shipment.tot_packages
              });
            }
          }
          
          // Calculate recommendations for each customer-carrier combination
          setProgress({ 
            current: i + 1, 
            total: customers.length, 
            item: `Calculating recommendations for ${customer}...` 
          });
          
          console.log(`📊 SCAC Analysis Summary for ${customer}:`);
          console.log(`   • Total shipments processed: ${shipmentHistory.length}`);
          console.log(`   • Customer-carrier combinations with SCAC matches: ${carrierAnalysis.size}`);
          
          carrierAnalysis.forEach((data, carrierKey) => {
            if (data.shipmentCount >= 1) { // Minimum 1 shipment for analysis
              console.log(`   • ${data.carrierName} (${data.carrierScac}): ${data.shipmentCount} matched shipments`);
              
              const avgHistoricalRate = data.historicalRates.reduce((sum, rate) => sum + rate, 0) / data.historicalRates.length;
              const avgCurrentRate = data.currentRates.reduce((sum, rate) => sum + rate, 0) / data.currentRates.length;
              const avgHistoricalMargin = data.historicalMargins.reduce((sum, margin) => sum + margin, 0) / data.historicalMargins.length;
              const avgPotentialSavings = avgHistoricalRate - avgCurrentRate;
              
              // Calculate recommended margin based on savings opportunity
              let recommendedMargin = 25; // Default 25%
              let reasoning = 'Standard margin recommendation';
              let confidence: 'high' | 'medium' | 'low' = 'medium';
              
              if (data.shipmentCount >= 5) {
                confidence = 'high';
              } else if (data.shipmentCount >= 2) {
                confidence = 'medium';
              } else {
                confidence = 'low';
              }
              
              if (avgPotentialSavings > 100) {
                // Significant savings opportunity
                recommendedMargin = Math.min(35, avgHistoricalMargin + 5);
                reasoning = `Same carrier now ${formatCurrency(avgPotentialSavings)} cheaper - increase margin to capture savings while remaining competitive`;
              } else if (avgPotentialSavings > 0) {
                // Some savings available
                recommendedMargin = Math.min(30, avgHistoricalMargin + 2);
                reasoning = `Carrier rates ${formatCurrency(avgPotentialSavings)} lower than historical - moderate margin increase opportunity`;
              } else if (avgPotentialSavings < -100) {
                // Market rates higher than historical
                recommendedMargin = Math.max(18, avgHistoricalMargin - 3);
                reasoning = `Same carrier now ${formatCurrency(Math.abs(avgPotentialSavings))} more expensive - reduce margin to maintain competitiveness`;
              } else {
                // Rates similar
                recommendedMargin = Math.max(20, Math.min(28, avgHistoricalMargin));
                reasoning = `Carrier pricing stable vs historical - maintain current margin strategy with minor optimization`;
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
              
              console.log(`📊 Generated recommendation: ${data.carrierName} - ${recommendedMargin.toFixed(1)}% margin (${confidence} confidence)`);
            }
          });
          
        } catch (error) {
          const errorMsg = `Failed to analyze customer ${customer}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          console.error(`❌ ${errorMsg}`, error);
          setProgress({ 
            current: i + 1, 
            total: customers.length, 
            item: `Error with ${customer}: ${errorMsg}` 
          });
          // Continue with next customer instead of failing completely
        }
      }
      
      console.log(`🏁 Margin analysis completed: Generated ${allResults.length} recommendations from ${totalShipmentsProcessed} total shipments`);
      
      console.log(`✅ Margin analysis completed: ${allResults.length} new responses for comparison`);
      
      // Mark analysis as complete and show results
      setAnalysisComplete(true);
      
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
          dateRange: `${dateRange.startDate} to ${dateRange.endDate}`,
          totalShipments: totalShipmentsProcessed,
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
      const errorMessage = error instanceof Error ? error.message : 'Analysis failed';
      setAnalysisError(errorMessage);
      setAnalysisComplete(false);
    } finally {
      setReprocessing(false);
      setProgress({ current: 0, total: 0, item: '' });
    }
  };

  const setPresetDateRange = (preset: string) => {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - 1); // Yesterday
    const startDate = new Date();
    
    switch (preset) {
      case '3months':
        startDate.setMonth(startDate.getMonth() - 3);
        break;
      case '6months':
        startDate.setMonth(startDate.getMonth() - 6);
        break;
      case '12months':
        startDate.setMonth(startDate.getMonth() - 12);
        break;
      case '24months':
        startDate.setMonth(startDate.getMonth() - 24);
        break;
    }
    
    setDateRange({
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    });
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
      {/* Analysis Error Display */}
      {analysisError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <XCircle className="h-5 w-5 text-red-600" />
            <div>
              <p className="font-medium text-red-900">Analysis Failed</p>
              <p className="text-sm text-red-700 mt-1">{analysisError}</p>
            </div>
          </div>
        </div>
      )}

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

      {/* Date Range Selection */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-3 mb-4">
          <div className="bg-purple-600 p-2 rounded-lg">
            <Calendar className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Historical Data Date Range</h3>
            <p className="text-sm text-gray-600">
              Select the time period for historical shipment analysis. More recent data provides better market relevance.
            </p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Preset Buttons */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Quick Select</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setPresetDateRange('3months')}
                className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Last 3 Months
              </button>
              <button
                onClick={() => setPresetDateRange('6months')}
                className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Last 6 Months
              </button>
              <button
                onClick={() => setPresetDateRange('12months')}
                className="px-3 py-2 text-sm bg-blue-100 text-blue-800 border border-blue-300 rounded-md hover:bg-blue-200 transition-colors"
              >
                Last 12 Months
              </button>
              <button
                onClick={() => setPresetDateRange('24months')}
                className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Last 24 Months
              </button>
            </div>
          </div>
          
          {/* Custom Date Range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Custom Date Range</label>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Start Date</label>
                <input
                  type="date"
                  value={dateRange.startDate}
                  onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">End Date</label>
                <input
                  type="date"
                  value={dateRange.endDate}
                  onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
          <div className="flex items-center space-x-2 text-purple-800">
            <Info className="h-4 w-4" />
            <span className="text-sm">
              Selected range: <strong>{dateRange.startDate}</strong> to <strong>{dateRange.endDate}</strong>
              {(() => {
                const start = new Date(dateRange.startDate);
                const end = new Date(dateRange.endDate);
                const diffTime = Math.abs(end.getTime() - start.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                const diffMonths = Math.round(diffDays / 30);
                return ` (${diffMonths} month${diffMonths !== 1 ? 's' : ''}, ${diffDays} days)`;
              })()}
            </span>
          </div>
        </div>
      </div>

      {/* Analysis Controls */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Comprehensive Margin Analysis</h3>
            <p className="text-sm text-gray-600 mt-1">
              {loading ? 'Loading customers...' : 
               connectionError ? 'Database connection issue' :
               `Analyze ${customers.length} customers against ${Object.values(selectedCarriers).filter(Boolean).length} selected carriers`}
            </p>
          </div>
          
          <button
            onClick={runMarginAnalysis}
            disabled={analyzing || !project44Client || Object.values(selectedCarriers).filter(Boolean).length === 0 || connectionError || customers.length === 0}
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

        {/* Connection Error */}
        {connectionError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <div className="flex items-start space-x-2 text-red-800">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-medium">Database Connection Issue</div>
                <div className="text-sm mt-1">{connectionError}</div>
                <button
                  onClick={loadCustomers}
                  className="mt-2 text-xs bg-red-100 hover:bg-red-200 text-red-800 px-2 py-1 rounded transition-colors"
                >
                  Retry Connection
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Loading State */}
        {loading && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <div className="flex items-center space-x-2 text-blue-800">
              <Loader className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading customer data from Shipments table...</span>
            </div>
          </div>
        )}
        
        {/* No customers but no error */}
        {!loading && !connectionError && customers.length === 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <div className="flex items-center space-x-2 text-yellow-800">
              <AlertTriangle className="h-4 w-4" />
              <div>
                <div className="text-sm font-medium">No Customer Data Available</div>
                <div className="text-sm mt-1">
                  The Shipments table appears to be empty or contains no customer records. 
                  To use margin analysis, please ensure your historical shipment data is loaded into the Shipments table.
                </div>
              </div>
            </div>
          </div>
        )}

        {Object.values(selectedCarriers).filter(Boolean).length === 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <div className="flex items-center space-x-2 text-yellow-800">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium">
                Please select carriers above to run the analysis
              </span>
            </div>
          </div>
        )}
        
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <div className="flex items-start space-x-2 text-red-800">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-medium">Analysis Error</div>
                <div className="text-sm mt-1">{error}</div>
              </div>
            </div>
          </div>
        )}
        
        {!connectionError && !loading && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">Analysis Process:</p>
            <ol className="list-decimal list-inside space-y-1 text-xs">
              <li>Load historical shipment data for each customer in selected date range</li>
              <li>Convert historical shipments to RFQs and get current market rates</li>
              <li>Match historical carriers to current quotes by SCAC code</li>
              <li>Compare historical vs current rates for the same carriers</li>
              <li>Generate margin recommendations based on price differences</li>
            </ol>
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
                Analysis Progress: {progress.current} of {progress.total} customers
              </div>
              <div className="text-xs text-blue-700">
                Date range: {dateRange.startDate} to {dateRange.endDate}
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

      {/* Analysis Results - Only show when analysis is complete AND we have results */}
      {analysisComplete && marginResults.length > 0 && (
        <div className="space-y-6">
          {/* Analysis Complete Banner */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="font-medium text-green-900">Margin Analysis Complete!</p>
                <p className="text-sm text-green-700 mt-1">
                  Processed {overallStats.totalShipments} shipments vs {marginResults.length} customer-carrier combinations
                </p>
              </div>
            </div>
          </div>

          {/* SCAC Matching Summary */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-blue-600 p-2 rounded-lg">
                <Truck className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">SCAC Matching Analysis</h3>
                <p className="text-sm text-gray-600">
                  Historical carrier rates compared to current market rates from the same carriers (matched by SCAC)
                </p>
              </div>
            </div>
            
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-green-800">
                  <p className="font-medium mb-2">✅ SCAC Matching Enabled</p>
                  <div className="space-y-1 text-xs">
                    <p>• Historical shipments are matched to current quotes by carrier SCAC code</p>
                    <p>• Only comparing the same carrier's historical vs current pricing</p>
                    <p>• This ensures true apples-to-apples margin analysis</p>
                    <p>• Results show genuine carrier-specific margin opportunities</p>
                  </div>
                  <div className="mt-3 p-2 bg-green-100 rounded border">
                    <p className="font-medium text-green-900 text-sm">Example Analysis:</p>
                    <p className="text-xs text-green-800">
                      Customer ABC + Carrier XYZ (SCAC: ABCD): Historical avg $1,200 → Current market $1,100 = $100 savings opportunity
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

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

            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-blue-600">{overallStats.totalShipments.toLocaleString()}</div>
                <div className="text-sm text-blue-700">Shipments</div>
                <div className="text-xs text-blue-600">{overallStats.dateRange}</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-blue-600">{overallStats.totalCustomers}</div>
                <div className="text-sm text-blue-700">Customers</div>
                <div className="text-xs text-blue-600">Analyzed</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-green-600">{overallStats.totalCarriers}</div>
                <div className="text-sm text-green-700">Carriers</div>
                <div className="text-xs text-green-600">Evaluated</div>
              </div>
              <div className="bg-indigo-50 rounded-lg p-4">
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
        </div>
      )}

      {/* No Results Message */}
      {analysisComplete && marginResults.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            <div>
              <p className="font-medium text-yellow-900">Analysis Complete - No New Quotes</p>
              <p className="text-sm text-yellow-700 mt-1">
                The analysis completed successfully but no new quotes were received. This could be due to:
              </p>
              <ul className="text-sm text-yellow-700 mt-2 list-disc list-inside">
                <li>No carriers responded during the analysis timeframe</li>
                <li>All carriers were unavailable for the selected routes</li>
                <li>API connection issues during processing</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};