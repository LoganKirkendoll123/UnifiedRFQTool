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
  FileText,
  Trash2,
  Package,
  Clock,
  Download,
  ArrowRight,
  Percent,
  RefreshCw,
  Zap,
  Calendar,
  Filter,
  Building2,
  ChevronDown
} from 'lucide-react';
import { Project44APIClient, FreshXAPIClient, CarrierGroup, Carrier } from '../utils/apiClient';
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
  carrierUsage: { [carrierName: string]: number };
}

export const MarginAnalysisMode: React.FC<MarginAnalysisModeProps> = ({
  project44Client,
  freshxClient,
  pricingSettings,
  selectedCustomer,
  onMarginRecommendation
}) => {
  // Project44 carrier group and carrier selection
  const [carrierGroups, setCarrierGroups] = useState<CarrierGroup[]>([]);
  const [selectedCarrierGroup, setSelectedCarrierGroup] = useState<string>('');
  const [groupCarriers, setGroupCarriers] = useState<Carrier[]>([]);
  const [selectedCarrier, setSelectedCarrier] = useState<string>('');
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [loadingCarriers, setLoadingCarriers] = useState(false);
  
  const [marginAnalyses, setMarginAnalyses] = useState<CustomerMarginAnalysis[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, item: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'customer' | 'revenue' | 'margin' | 'impact'>('revenue');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Saved analyses state
  const [savedAnalyses, setSavedAnalyses] = useState<any[]>([]);
  const [loadingSavedAnalyses, setLoadingSavedAnalyses] = useState(false);
  const [showSavedAnalyses, setShowSavedAnalyses] = useState(false);
  
  // Date filter state
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - 1); // Default to 1 year ago
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Add retry logic for database operations
  const retryWithBackoff = async (fn: () => Promise<any>, maxRetries = 3, baseDelay = 1000) => {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        
        const delay = baseDelay * Math.pow(2, i) + Math.random() * 1000;
        console.log(`⏳ Retry ${i + 1}/${maxRetries} after ${delay.toFixed(0)}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  };

  // Load carrier groups from Project44
  useEffect(() => {
    loadCarrierGroups();
  }, [project44Client]);

  // Load carriers when group is selected
  useEffect(() => {
    if (selectedCarrierGroup) {
      loadCarriersFromGroup();
    } else {
      setGroupCarriers([]);
      setSelectedCarrier('');
    }
  }, [selectedCarrierGroup, project44Client]);

  // Load saved analyses
  useEffect(() => {
    loadSavedAnalyses();
  }, []);

  const loadSavedAnalyses = async () => {
    if (!project44Client) {
      console.log('⚠️ Project44 client not available for loading saved analyses');
      return;
    }

    try {
      setLoadingSavedAnalyses(true);
      console.log('📋 Loading saved margin analyses...');
      
      const analyses = await project44Client.getMarginAnalyses();
      setSavedAnalyses(analyses);
      
      console.log(`✅ Loaded ${analyses.length} saved analyses`);
    } catch (error) {
      console.error('❌ Failed to load saved analyses:', error);
      setSavedAnalyses([]);
    } finally {
      setLoadingSavedAnalyses(false);
    }
  };

  const loadCarrierGroups = async () => {
    if (!project44Client) return;

    setLoadingGroups(true);
    try {
      console.log('🏢 Loading carrier groups from Project44...');
      const groups = await project44Client.getAvailableCarriersByGroup(false, false);
      setCarrierGroups(groups);
      console.log(`✅ Loaded ${groups.length} carrier groups`);
    } catch (error) {
      console.error('❌ Failed to load carrier groups:', error);
    } finally {
      setLoadingGroups(false);
    }
  };

  const loadCarriersFromGroup = async () => {
    if (!project44Client || !selectedCarrierGroup) return;

    setLoadingCarriers(true);
    try {
      console.log(`🚛 Loading carriers from group: ${selectedCarrierGroup}`);
      
      // Find the selected group
      const selectedGroup = carrierGroups.find(g => g.groupCode === selectedCarrierGroup);
      if (!selectedGroup) {
        console.error('❌ Selected carrier group not found');
        return;
      }

      // Get unique carriers from the group
      const uniqueCarriers = new Map<string, Carrier>();
      selectedGroup.carriers.forEach(carrier => {
        if (!uniqueCarriers.has(carrier.id)) {
          uniqueCarriers.set(carrier.id, carrier);
        }
      });

      const carriers = Array.from(uniqueCarriers.values());
      setGroupCarriers(carriers);
      console.log(`✅ Loaded ${carriers.length} carriers from group ${selectedGroup.groupName}`);
    } catch (error) {
      console.error('❌ Failed to load carriers from group:', error);
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
      
      // Convert Excel serial date to JavaScript date
      const convertFromExcelSerial = (serial: number): string => {
        const excelEpoch = new Date('1900-01-01');
        // Subtract 2 to account for Excel's leap year bug
        const date = new Date(excelEpoch.getTime() + (serial - 2) * 24 * 60 * 60 * 1000);
        return date.toISOString().split('T')[0];
      };

      // Create pickup date (use scheduled pickup date or default to today)
      const pickupDate = shipment['Scheduled Pickup Date'] ? 
        convertFromExcelSerial(shipment['Scheduled Pickup Date']) :
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

  // Save analysis to database - simple version with just name and JSON payload
  const saveAnalysis = async (analysisName: string) => {
    if (marginAnalyses.length === 0) {
      console.error('❌ Cannot save analysis - no analysis results');
      return;
    }

    try {
      const { error } = await supabase
        .from('margin_analyses')
        .insert({
          analysis_name: analysisName,
          carrier_group_code: selectedCarrierGroup || '',
          carrier_group_name: selectedGroupName || '',
          selected_carrier_id: selectedCarrier || '',
          selected_carrier_name: selectedCarrierName || '',
          selected_carrier_scac: groupCarriers.find(c => c.id === selectedCarrier)?.scac || '',
          start_date: startDate,
          end_date: endDate,
          analysis_results: marginAnalyses, // This is the JSON payload
          created_by: 'margin-analysis-user'
        });

      if (error) {
        throw error;
      }

      console.log(`✅ Saved margin analysis: ${analysisName}`);
      
      // Reload saved analyses
      await loadSavedAnalyses();
      
    } catch (error) {
      console.error('❌ Failed to save analysis:', error);
      alert(`Failed to save analysis: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Load saved analysis
  const loadSavedAnalysis = async (analysis: any) => {
    try {
      console.log(`📋 Loading saved analysis: ${analysis.analysis_name}`);
      
      // Load the analysis results from the JSON payload
      setMarginAnalyses(analysis.analysis_results || []);
      
      console.log(`✅ Loaded analysis with ${analysis.analysis_results?.length || 0} results`);
    } catch (error) {
      console.error('❌ Failed to load saved analysis:', error);
      alert(`Failed to load analysis: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Delete saved analysis
  const deleteSavedAnalysis = async (analysisId: string) => {
    if (!confirm('Are you sure you want to delete this analysis?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('margin_analyses')
        .delete()
        .eq('id', analysisId);

      if (error) {
        throw error;
      }

      console.log(`✅ Deleted margin analysis: ${analysisId}`);
      
      // Reload saved analyses
      await loadSavedAnalyses();
      
    } catch (error) {
      console.error('❌ Failed to delete analysis:', error);
      alert(`Failed to delete analysis: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const runMarginAnalysis = async () => {
    if (!selectedCarrierGroup || !selectedCarrier) {
      alert('Please select both a carrier group and a specific carrier');
      return;
    }

    if (!project44Client) {
      alert('Project44 client not available. Please configure your API credentials.');
      return;
    }

    if (!startDate || !endDate) {
      alert('Please select both start and end dates');
      return;
    }

    // Get the SCAC of the selected carrier
    const selectedCarrierInfo = groupCarriers.find(c => c.id === selectedCarrier);
    const selectedCarrierSCAC = selectedCarrierInfo?.scac;
    
    if (!selectedCarrierSCAC) {
      alert('Selected carrier does not have a SCAC code. Please select a different carrier.');
      return;
    }

    // Convert JavaScript dates to Excel serial numbers
    const convertToExcelSerial = (dateString: string): number => {
      const date = new Date(dateString);
      // Excel epoch is January 1, 1900, but we need to account for Excel's leap year bug
      const excelEpoch = new Date('1899-12-30'); // Use Dec 30, 1899 to account for Excel's bug
      const diffTime = date.getTime() - excelEpoch.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      return diffDays;
    };

    setLoading(true);
    setMarginAnalyses([]);
    setProgress({ current: 0, total: 0, item: 'Loading all customers...' });

    try {
      console.log(`🔍 Running comprehensive margin analysis for all customers (${startDate} to ${endDate})`);
      console.log(`📊 Using carrier group: ${selectedCarrierGroup}, carrier: ${selectedCarrier}`);

      // Convert dates to Excel serial numbers (int8 format used in Shipments table)
      const startDateSerial = convertToExcelSerial(startDate);
      const endDateSerial = convertToExcelSerial(endDate);
      
      console.log(`📅 Date range: ${startDate} (serial: ${startDateSerial}) to ${endDate} (serial: ${endDateSerial})`);

      // First, get all unique customers who have shipments with the selected carrier's SCAC
      let allCustomers: string[] = [];
      let from = 0;
      const batchSize = 500; // Reduced batch size
      let hasMore = true;
      
      while (hasMore) {
        console.log(`👥 Loading customers batch: records ${from}-${from + batchSize - 1} for SCAC ${selectedCarrierSCAC}`);
        
        const { data, error } = await retryWithBackoff(async () => {
          return await supabase
            .from('Shipments')
            .select('Customer')
            .not('Customer', 'is', null)
            .eq('SCAC', selectedCarrierSCAC)
            .gte('"Scheduled Pickup Date"', startDateSerial)
            .lte('"Scheduled Pickup Date"', endDateSerial)
            .range(from, from + batchSize - 1);
        });
        
        if (error) {
          console.error(`❌ Failed to load customers batch ${from}-${from + batchSize - 1}:`, error);
          throw error;
        }
        
        if (data && data.length > 0) {
          const customers = data.map(d => d.Customer).filter(Boolean);
          allCustomers = [...allCustomers, ...customers];
          console.log(`👥 Loaded customers batch: ${customers.length} records with SCAC ${selectedCarrierSCAC} (total loaded: ${allCustomers.length})`);
          from += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
        
        // Longer delay between customer batches
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      // Get unique customers
      const uniqueCustomers = [...new Set(allCustomers)].sort();
      console.log(`✅ Found ${uniqueCustomers.length} unique customers with SCAC ${selectedCarrierSCAC} in date range`);
      
      if (uniqueCustomers.length === 0) {
        alert(`No customers found with shipments using carrier SCAC ${selectedCarrierSCAC} in the selected date range (${startDate} to ${endDate}). Please try a different date range or carrier.`);
        return;
      }

      setProgress({ current: 0, total: uniqueCustomers.length, item: 'Analyzing customers...' });

      // Create RFQ processor
      const processor = new RFQProcessor(project44Client, freshxClient);

      const analyses: CustomerMarginAnalysis[] = [];
      let processedCount = 0;

      // Analyze each customer
      for (const customerName of uniqueCustomers) {
        processedCount++;
        setProgress({ 
          current: processedCount, 
          total: uniqueCustomers.length, 
          item: `Processing ${customerName}...` 
        });

        // Load shipments for this customer with the selected carrier's SCAC in the date range
        let customerShipments: any[] = [];
        let customerFrom = 0;
        const customerBatchSize = 200; // Smaller batch size for individual customers
        let customerHasMore = true;
        
        while (customerHasMore) {
          const { data, error } = await retryWithBackoff(async () => {
            return await supabase
              .from('Shipments')
              .select('*')
              .eq('Customer', customerName)
              .eq('SCAC', selectedCarrierSCAC)
              .gte('"Scheduled Pickup Date"', startDateSerial)
              .lte('"Scheduled Pickup Date"', endDateSerial)
              .not('Zip', 'is', null)
              .not('Zip_1', 'is', null)
              .gt('Revenue', 0)
              .gt('"Carrier Expense"', 0)
              .range(customerFrom, customerFrom + customerBatchSize - 1);
          });
          
          if (error) {
            console.error(`❌ Failed to load shipments for ${customerName}:`, error);
            break;
          }
          
          if (data && data.length > 0) {
            customerShipments = [...customerShipments, ...data];
            customerFrom += customerBatchSize;
            customerHasMore = data.length === customerBatchSize;
          } else {
            customerHasMore = false;
          }
          
          // Longer delay between customer shipment batches
          await new Promise(resolve => setTimeout(resolve, 200));
        }

        if (customerShipments.length === 0) {
          console.log(`⚠️ No valid shipments found for ${customerName} with SCAC ${selectedCarrierSCAC} in date range ${startDate} to ${endDate}`);
          continue;
        }
        
        console.log(`✅ Found ${customerShipments.length} shipments for ${customerName} with SCAC ${selectedCarrierSCAC}`);

        // Calculate original totals
        let originalRevenue = 0;
        let originalCarrierCost = 0;
        const carrierUsage: { [carrierName: string]: number } = {};

        customerShipments.forEach(shipment => {
          const revenue = parseFloat(shipment.Revenue) || 0;
          const carrierCost = parseFloat(shipment['Carrier Expense']) || 0;
          const carrierName = shipment['Booked Carrier'] || shipment['Quoted Carrier'];
          
          originalRevenue += revenue;
          originalCarrierCost += carrierCost;
          
          if (carrierName) {
            carrierUsage[carrierName] = (carrierUsage[carrierName] || 0) + 1;
          }
        });

        if (originalRevenue <= 0 || originalCarrierCost <= 0) {
          console.log(`⚠️ Invalid revenue/cost data for ${customerName}`);
          continue;
        }

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
          console.warn(`❌ No valid RFQs created for ${customerName}`);
          continue;
        }

        // Process RFQs through Project44 using the selected carrier group
        let totalNewCarrierCost = 0;
        let totalNewQuotes = 0;

        try {
          console.log(`🚛 Processing ${rfqs.length} RFQs for ${customerName} using carrier group ${selectedCarrierGroup} (comparing to SCAC ${selectedCarrierSCAC})`);
          
          // Use the selected carrier group for processing
          const results = await processor.processRFQsForAccountGroup(rfqs, selectedCarrierGroup, {
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
            sampleShipments: rfqs,
            carrierUsage
          });

          console.log(`✅ Processed ${customerName}: ${customerShipments.length} shipments with SCAC ${selectedCarrierSCAC}, ${totalNewQuotes} quotes, ${marginAdjustment.toFixed(1)}% margin adjustment`);

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
            sampleShipments: [],
            carrierUsage
          });
        }

        // Small delay between customers
        await new Promise(resolve => setTimeout(resolve, 250));
      }

      // Sort analyses by revenue impact (highest first)
      analyses.sort((a, b) => Math.abs(b.revenueImpact) - Math.abs(a.revenueImpact));
      
      setMarginAnalyses(analyses);
      console.log(`✅ Completed comprehensive margin analysis for ${analyses.length} customers using carrier group ${selectedCarrierGroup} (SCAC ${selectedCarrierSCAC})`);

      // Prompt to save analysis
      if (analyses.length > 0) {
        const analysisName = prompt(
          `Analysis complete! Save this analysis?\n\nEnter a name for this analysis:`,
          `${selectedGroupName} - ${selectedCarrierName} - ${startDate} to ${endDate}`
        );
        
        if (analysisName) {
          await saveAnalysis(analysisName);
        }
      }

    } catch (error) {
      console.error('❌ Failed to run margin analysis:', error);
      alert(`Failed to run margin analysis: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`);
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

    const selectedGroupName = carrierGroups.find(g => g.groupCode === selectedCarrierGroup)?.groupName || selectedCarrierGroup;
    const selectedCarrierName = groupCarriers.find(c => c.id === selectedCarrier)?.name || selectedCarrier;
    const selectedCarrierSCAC = groupCarriers.find(c => c.id === selectedCarrier)?.scac || 'Unknown';

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
      'Status',
      'Top Carrier Used',
      'Date Range',
      'Carrier Group Used',
      'Reference Carrier',
      'Reference Carrier SCAC'
    ];

    const csvData = marginAnalyses.map(analysis => {
      const topCarrier = Object.entries(analysis.carrierUsage)
        .sort(([,a], [,b]) => b - a)[0]?.[0] || 'Unknown';
      
      return [
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
        analysis.status,
        topCarrier,
        `${startDate} to ${endDate}`,
        selectedGroupName,
        selectedCarrierName,
        selectedCarrierSCAC
      ];
    });

    const csvContent = [csvHeaders, ...csvData]
      .map(row => row.join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `margin-analysis-${selectedCarrierSCAC}-${startDate}-to-${endDate}-${Date.now()}.csv`;
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

  const selectedGroupName = carrierGroups.find(g => g.groupCode === selectedCarrierGroup)?.groupName;
  const selectedCarrierName = groupCarriers.find(c => c.id === selectedCarrier)?.name;

  return (
    <div className="space-y-6">
      {/* Saved Analyses Section */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="bg-purple-600 p-2 rounded-lg">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Saved Margin Analyses</h3>
              <p className="text-sm text-gray-600">
                View and load previously saved margin analysis results
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowSavedAnalyses(!showSavedAnalyses)}
            className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${showSavedAnalyses ? 'rotate-180' : ''}`} />
            <span>{showSavedAnalyses ? 'Hide' : 'Show'} Saved Analyses</span>
          </button>
        </div>

        {showSavedAnalyses && (
          <div className="space-y-4">
            {loadingSavedAnalyses ? (
              <div className="flex items-center space-x-2 p-4">
                <Loader className="h-4 w-4 animate-spin text-purple-500" />
                <span className="text-gray-600">Loading saved analyses...</span>
              </div>
            ) : savedAnalyses.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>No saved analyses found. Run an analysis to save results.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {savedAnalyses.map((analysis) => (
                  <div key={analysis.id} className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 mb-2">{analysis.analysis_name}</h4>
                        <div className="space-y-1 text-sm text-gray-600">
                          <div>Carrier: {analysis.selected_carrier_name} ({analysis.selected_carrier_scac})</div>
                          <div>Group: {analysis.carrier_group_name}</div>
                          <div>Date Range: {analysis.start_date} to {analysis.end_date}</div>
                          <div>Customers: {analysis.total_customers}</div>
                          <div>Revenue Impact: {formatCurrency(analysis.total_revenue_impact)}</div>
                        </div>
                        <div className="mt-2 text-xs text-gray-500">
                          Created: {new Date(analysis.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex flex-col space-y-2 ml-4">
                        <button
                          onClick={() => loadSavedAnalysis(analysis)}
                          className="flex items-center space-x-1 px-3 py-1 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors text-sm"
                        >
                          <ArrowRight className="h-3 w-3" />
                          <span>Load</span>
                        </button>
                        <button
                          onClick={() => deleteSavedAnalysis(analysis.id)}
                          className="flex items-center space-x-1 px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm"
                        >
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                    
                    {/* Summary Stats */}
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-white rounded p-2">
                        <div className="text-red-600 font-medium">{analysis.customers_requiring_increase}</div>
                        <div className="text-gray-500">Need Increase</div>
                      </div>
                      <div className="bg-white rounded p-2">
                        <div className="text-green-600 font-medium">{analysis.customers_maintaining_margins}</div>
                        <div className="text-gray-500">Maintain</div>
                      </div>
                      <div className="bg-white rounded p-2">
                        <div className="text-blue-600 font-medium">{analysis.customers_allowing_decrease}</div>
                        <div className="text-gray-500">Allow Decrease</div>
                      </div>
                      <div className="bg-white rounded p-2">
                        <div className="text-gray-600 font-medium">{analysis.customers_no_quotes}</div>
                        <div className="text-gray-500">No Quotes</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-3 mb-4">
          <div className="bg-green-600 p-2 rounded-lg">
            <RefreshCw className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Comprehensive Customer Margin Analysis</h2>
            <p className="text-sm text-gray-600">
              Analyze ALL customers with date filtering - reprocess historical shipments through Project44 carrier groups to determine required margin adjustments
            </p>
          </div>
        </div>

        {/* Date Filter */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <div className="flex items-center space-x-3 mb-3">
            <Calendar className="h-5 w-5 text-blue-600" />
            <span className="text-sm font-medium text-blue-900">Date Range Filter</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-blue-700 mb-2">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-blue-700 mb-2">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="mt-2 text-xs text-blue-600">
            Analyzing shipments from {startDate} to {endDate}
          </div>
        </div>

        {/* Project44 Carrier Group and Carrier Selection */}
        <div className="space-y-4">
          {/* Carrier Group Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Building2 className="inline h-4 w-4 mr-1" />
              Project44 Carrier Group
            </label>
            {loadingGroups ? (
              <div className="flex items-center space-x-2 p-3 border rounded-lg">
                <Loader className="h-4 w-4 animate-spin text-blue-500" />
                <span className="text-sm text-gray-600">Loading carrier groups from Project44...</span>
              </div>
            ) : (
              <select
                value={selectedCarrierGroup}
                onChange={(e) => {
                  setSelectedCarrierGroup(e.target.value);
                  setSelectedCarrier(''); // Reset carrier selection
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select a carrier group...</option>
                {carrierGroups.map((group) => (
                  <option key={group.groupCode} value={group.groupCode}>
                    {group.groupName} ({group.carriers.length} carriers)
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Carrier Selection */}
          {selectedCarrierGroup && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Truck className="inline h-4 w-4 mr-1" />
                Carrier from {selectedGroupName}
              </label>
              {loadingCarriers ? (
                <div className="flex items-center space-x-2 p-3 border rounded-lg">
                  <Loader className="h-4 w-4 animate-spin text-blue-500" />
                  <span className="text-sm text-gray-600">Loading carriers from group...</span>
                </div>
              ) : (
                <select
                  value={selectedCarrier}
                  onChange={(e) => setSelectedCarrier(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="">Select a carrier...</option>
                  {groupCarriers.map((carrier) => (
                    <option key={carrier.id} value={carrier.id}>
                      {carrier.name} {carrier.scac && `(${carrier.scac})`}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Analysis Info */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <Zap className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium mb-2">Comprehensive Analysis Process:</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>Analyzes ALL customers in the selected date range</li>
                  <li>Filters ALL shipments to only include those with the selected carrier's SCAC</li>
                  <li>Loads ALL shipments for each customer with the selected carrier's SCAC</li>
                  <li>Processes through Project44 API using the selected carrier group</li>
                  <li>Compares historical costs vs current market costs for each customer</li>
                  <li>Calculates required margin adjustments to maintain revenue levels</li>
                  <li>Provides customer-specific recommendations based on their usage patterns</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Analysis Button */}
        <div className="mt-6 flex items-center space-x-4">
          <button
            onClick={runMarginAnalysis}
            disabled={!selectedCarrierGroup || !selectedCarrier || loading || !project44Client || !startDate || !endDate}
            className="flex items-center space-x-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <>
                <Loader className="h-4 w-4 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <Users className="h-4 w-4" />
                <span>Analyze ALL Customers</span>
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

          {marginAnalyses.length > 0 && (
            <button
              onClick={() => {
                const analysisName = prompt(
                  'Enter a name for this analysis:',
                  `${selectedGroupName} - ${selectedCarrierName} - ${startDate} to ${endDate}`
                );
                if (analysisName) {
                  saveAnalysis(analysisName);
                }
              }}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Package className="h-4 w-4" />
              <span>Save Analysis</span>
            </button>
          )}
        </div>

        {/* Selected Configuration Display */}
        {selectedCarrierGroup && selectedCarrier && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center space-x-2 text-green-800 text-sm">
              <CheckCircle className="h-4 w-4" />
              <span>
                Ready to analyze with carrier group: <strong>{selectedGroupName}</strong> using carrier: <strong>{selectedCarrierName}</strong> (SCAC: <strong>{groupCarriers.find(c => c.id === selectedCarrier)?.scac || 'Unknown'}</strong>)
              </span>
            </div>
          </div>
        )}

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

      {/* Saved Analyses */}
      {savedAnalyses.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Saved Analyses</h3>
          {loadingSavedAnalyses ? (
            <div className="flex justify-center">
              <Loader className="h-6 w-6 animate-spin text-blue-500" />
            </div>
          ) : (
            <div className="space-y-3">
              {savedAnalyses.map((analysis) => (
                <div key={analysis.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <div className="font-medium text-gray-900">{analysis.analysis_name}</div>
                    <div className="text-sm text-gray-500">
                      Created {new Date(analysis.created_at).toLocaleDateString()} • 
                      {analysis.analysis_results?.length || 0} customers analyzed
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => loadSavedAnalysis(analysis)}
                      className="flex items-center space-x-2 px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
                    >
                      <FileText className="h-3 w-3" />
                      <span>Load</span>
                    </button>
                    <button
                      onClick={() => deleteSavedAnalysis(analysis.id)}
                      className="flex items-center space-x-2 px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm"
                    >
                      <Trash2 className="h-3 w-3" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {marginAnalyses.length > 0 && (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Comprehensive Margin Analysis Results
                </h3>
                <p className="text-sm text-gray-600">
                  {marginAnalyses.length} customers analyzed using {selectedGroupName} carrier group with SCAC {groupCarriers.find(c => c.id === selectedCarrier)?.scac} ({startDate} to {endDate})
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revenue</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cost Change</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Original → Required</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Adjustment</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Impact</th>
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
                      {analysis.originalMarginPercent.toFixed(1)}% → {analysis.requiredMarginPercent.toFixed(1)}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm font-medium ${
                        analysis.marginAdjustment > 0 ? 'text-red-600' : 
                        analysis.marginAdjustment < 0 ? 'text-blue-600' : 'text-gray-600'
                      }`}>
                        {analysis.marginAdjustment > 0 ? '+' : ''}{analysis.marginAdjustment.toFixed(1)}%
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(analysis.revenueImpact)}
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
      {!loading && marginAnalyses.length === 0 && selectedCarrierGroup && selectedCarrier && (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <div className="flex items-center justify-center mb-4">
            <AlertTriangle className="h-12 w-12 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Analysis Results</h3>
          <p className="text-gray-600">
            No customers found with shipments in the selected date range ({startDate} to {endDate}) using carrier SCAC {groupCarriers.find(c => c.id === selectedCarrier)?.scac} from group {selectedGroupName}.
            Try adjusting your date range or selecting a different carrier group.
          </p>
        </div>
      )}
    </div>
  );
};