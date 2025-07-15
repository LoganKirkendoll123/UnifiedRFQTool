import React, { useState, useEffect } from 'react';
import { 
  Zap, 
  MapPin, 
  Package, 
  Plus, 
  Trash2, 
  Users,
  Building2,
  Truck,
  Loader,
  AlertCircle,
  CheckCircle,
  Upload,
  Save,
  FileText,
  RefreshCw,
  Filter,
  Search,
  Calendar,
  TrendingUp,
  TrendingDown,
  Download,
  History
} from 'lucide-react';
import { Project44APIClient, FreshXAPIClient } from '../utils/apiClient';
import { RFQRow, PricingSettings, QuoteWithPricing, LineItemData } from '../types';
import { CustomerSelection } from './CustomerSelection';
import { CarrierSelection } from './CarrierSelection';
import { PricingSettingsComponent } from './PricingSettings';
import { ResultsTable } from './ResultsTable';
import { FileUpload } from './FileUpload';
import { parseCSV, parseXLSX } from '../utils/fileParser';
import { validCommodityTypes } from '../utils/fileParser';
import { useRFQProcessor } from '../hooks/useRFQProcessor';
import { useCarrierManagement } from '../hooks/useCarrierManagement';
import { supabase } from '../utils/supabase';
import * as XLSX from 'xlsx';

interface UnifiedRFQToolProps {
  project44Client: Project44APIClient | null;
  freshxClient: FreshXAPIClient | null;
  initialPricingSettings: PricingSettings;
  initialSelectedCustomer?: string;
}

type InputSource = 'csv' | 'manual' | 'history' | 'past-rfq';
type CarrierMode = 'single' | 'multiple';
type CustomerMode = 'single' | 'all' | 'specific';

interface ManualRFQFormData {
  fromDate: string;
  fromZip: string;
  toZip: string;
  pallets: number;
  grossWeight: number;
  isStackable: boolean;
  isReefer: boolean;
  temperature?: 'AMBIENT' | 'CHILLED' | 'FROZEN';
  commodity?: string;
  isFoodGrade?: boolean;
  freightClass?: string;
  commodityDescription?: string;
  originCity?: string;
  originState?: string;
  destinationCity?: string;
  destinationState?: string;
  lineItems: LineItemData[];
}

interface HistoricalShipment {
  id: number;
  customer_name: string;
  origin_zip: string;
  destination_zip: string;
  pallets: number;
  weight: number;
  carrier_name?: string;
  quoted_rate?: number;
  shipment_date: string;
}

interface PastRFQBatch {
  id: string;
  batch_name: string;
  customer_name?: string;
  created_at: string;
  shipment_count: number;
  rfq_data: RFQRow[];
}

export const UnifiedRFQTool: React.FC<UnifiedRFQToolProps> = ({
  project44Client,
  freshxClient,
  initialPricingSettings,
  initialSelectedCustomer
}) => {
  // Input configuration
  const [inputSource, setInputSource] = useState<InputSource>('csv');
  const [carrierMode, setCarrierMode] = useState<CarrierMode>('multiple');
  const [customerMode, setCustomerMode] = useState<CustomerMode>('single');
  const [compareWithPastRFQ, setCompareWithPastRFQ] = useState(false);
  
  // Data state
  const [rfqData, setRfqData] = useState<RFQRow[]>([]);
  const [manualFormData, setManualFormData] = useState<ManualRFQFormData>({
    fromDate: new Date().toISOString().split('T')[0],
    fromZip: '',
    toZip: '',
    pallets: 1,
    grossWeight: 1000,
    isStackable: false,
    isReefer: false,
    freightClass: '70',
    lineItems: []
  });
  const [historicalShipments, setHistoricalShipments] = useState<HistoricalShipment[]>([]);
  const [selectedHistoricalShipments, setSelectedHistoricalShipments] = useState<number[]>([]);
  const [pastRFQBatches, setPastRFQBatches] = useState<PastRFQBatch[]>([]);
  const [selectedPastRFQBatch, setSelectedPastRFQBatch] = useState<string>('');
  const [pastRFQData, setPastRFQData] = useState<RFQRow[]>([]);
  
  // Filters
  const [customerFilter, setCustomerFilter] = useState('');
  const [dateRangeFilter, setDateRangeFilter] = useState({ start: '', end: '' });
  const [carrierFilter, setCarrierFilter] = useState('');
  
  // Error state
  const [fileError, setFileError] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [formError, setFormError] = useState<string>('');
  
  // Local state for pricing settings and customer selection
  const [pricingSettings, setPricingSettings] = useState<PricingSettings>(initialPricingSettings);
  const [selectedCustomer, setSelectedCustomer] = useState<string>(initialSelectedCustomer || '');
  
  const updatePricingSettings = (newSettings: PricingSettings) => {
    setPricingSettings(newSettings);
  };
  
  const updateSelectedCustomer = (customer: string) => {
    setSelectedCustomer(customer);
  };
  
  const carrierManagement = useCarrierManagement({ project44Client });
  
  const rfqProcessor = useRFQProcessor({ 
    project44Client, 
    freshxClient 
  });
  
  // Single carrier selection (for single carrier mode)
  const [selectedSingleCarrier, setSelectedSingleCarrier] = useState<string>('');


  
  
  // Load historical data
  useEffect(() => {
    if (inputSource === 'history') {
      loadHistoricalShipments();
    } else if (inputSource === 'past-rfq') {
      loadPastRFQBatches();
    }
  }, [inputSource, customerFilter, dateRangeFilter, carrierFilter]);
  
  const loadHistoricalShipments = async () => {
    try {
      let query = supabase.from('Shipments').select('*');
      
      if (customerFilter) {
        query = query.eq('Customer', customerFilter);
      }
      
      if (dateRangeFilter.start) {
        const startTimestamp = new Date(dateRangeFilter.start).getTime();
        query = query.gte('Scheduled Pickup Date', startTimestamp);
      }
      
      if (dateRangeFilter.end) {
        const endTimestamp = new Date(dateRangeFilter.end).getTime();
        query = query.lte('Scheduled Pickup Date', endTimestamp);
      }
      
      if (carrierFilter) {
        query = query.or(`Booked Carrier.eq.${carrierFilter},Quoted Carrier.eq.${carrierFilter}`);
      }
      
      const { data, error } = await query.order('Scheduled Pickup Date', { ascending: false });
      
      if (error) {
        console.error('Error loading historical shipments:', error);
        return;
      }
      
      // Transform to our internal format
      const shipments: HistoricalShipment[] = data.map(s => ({
        id: s['Invoice #'],
        customer_name: s.Customer || '',
        origin_zip: s.Zip || '',
        destination_zip: s.Zip_1 || '',
        pallets: s['Tot Packages'] || 1,
        weight: parseInt(s['Tot Weight']?.replace(/[^\d]/g, '') || '0'),
        carrier_name: s['Booked Carrier'] || s['Quoted Carrier'],
        quoted_rate: parseFloat(String(s.Revenue || '').replace(/[^\d.]/g, '') || '0'),
        shipment_date: s['Scheduled Pickup Date'] || ''
      }));
      
      setHistoricalShipments(shipments);
    } catch (error) {
      console.error('Failed to load historical shipments:', error);
    }
  };
  
  const loadPastRFQBatches = async () => {
    try {
      let query = supabase.from('mass_rfq_batches').select('id, batch_name, customer_name, created_at, shipment_count, rfq_data');
      
      if (customerFilter) {
        query = query.eq('customer_name', customerFilter);
      }
      
      if (dateRangeFilter.start) {
        query = query.gte('created_at', dateRangeFilter.start);
      }
      
      if (dateRangeFilter.end) {
        query = query.lte('created_at', dateRangeFilter.end);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false }).limit(50);
      
      if (error) {
        console.error('Error loading past RFQ batches:', error);
        return;
      }
      
      setPastRFQBatches(data);
    } catch (error) {
      console.error('Failed to load past RFQ batches:', error);
    }
  };
  
  const loadPastRFQData = async (batchId: string) => {
    try {
      const { data, error } = await supabase
        .from('mass_rfq_batches')
        .select('rfq_data')
        .eq('id', batchId)
        .single();
      
      if (error) {
        console.error('Error loading past RFQ data:', error);
        return;
      }
      
      if (data && data.rfq_data) {
        setPastRFQData(data.rfq_data);
      }
    } catch (error) {
      console.error('Failed to load past RFQ data:', error);
    }
  };
  
  const handleFileSelect = async (file: File) => {
    setFileError('');
    try {
      console.log('📁 Processing file:', file.name);
      let data: RFQRow[];
      
      if (file.name.endsWith('.csv')) {
        data = await parseCSV(file, true);
      } else {
        data = await parseXLSX(file, true);
      }
      
      setRfqData(data);
      console.log(`✅ Parsed ${data.length} RFQ rows`);
      
      // Reset results when new file is loaded
      rfqProcessor.clearResults();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to parse file';
      setFileError(errorMessage);
      console.error('❌ File parsing error:', error);
    }
  };
  
  const handleManualFormChange = (field: keyof ManualRFQFormData, value: any) => {
    setManualFormData(prev => ({ ...prev, [field]: value }));
  };
  
  const addLineItem = () => {
    const newItem: LineItemData = {
      id: manualFormData.lineItems.length + 1,
      description: '',
      totalWeight: 0,
      freightClass: '70',
      packageLength: 48,
      packageWidth: 40,
      packageHeight: 48,
      packageType: 'PLT',
      totalPackages: 1,
      totalPieces: 1,
      stackable: false
    };
    setManualFormData(prev => ({
      ...prev,
      lineItems: [...prev.lineItems, newItem]
    }));
  };
  
  const updateLineItem = (index: number, updates: Partial<LineItemData>) => {
    setManualFormData(prev => ({
      ...prev,
      lineItems: prev.lineItems.map((item, i) => 
        i === index ? { ...item, ...updates } : item
      )
    }));
  };
  
  const removeLineItem = (index: number) => {
    setManualFormData(prev => ({
      ...prev,
      lineItems: prev.lineItems.filter((_, i) => i !== index)
    }));
  };
  
  const validateManualForm = (): string[] => {
    return rfqProcessor.validateRFQ({
      ...manualFormData,
      accessorial: []
    });
  };
  
  const handleHistoricalShipmentSelect = (id: number, selected: boolean) => {
    setSelectedHistoricalShipments(prev => {
      if (selected) {
        return [...prev, id];
      } else {
        return prev.filter(shipId => shipId !== id);
      }
    });
  };
  
  const handleSelectAllHistoricalShipments = (selected: boolean) => {
    if (selected) {
      setSelectedHistoricalShipments(historicalShipments.map(s => s.id));
    } else {
      setSelectedHistoricalShipments([]);
    }
  };
  
  const handlePastRFQBatchSelect = (batchId: string) => {
    setSelectedPastRFQBatch(batchId);
    loadPastRFQData(batchId);
  };
  
  const convertHistoricalShipmentsToRFQs = (): RFQRow[] => {
    return selectedHistoricalShipments.map(id => {
      const shipment = historicalShipments.find(s => s.id === id);
      if (!shipment) return null;
      
      return {
        fromDate: shipment.shipment_date || new Date().toISOString().split('T')[0],
        fromZip: shipment.origin_zip,
        toZip: shipment.destination_zip,
        pallets: shipment.pallets,
        grossWeight: shipment.weight,
        isStackable: false,
        isReefer: false,
        accessorial: []
      };
    }).filter(Boolean) as RFQRow[];
  };
  
  const convertManualFormToRFQ = (): RFQRow => {
    return {
      ...manualFormData,
      commodity: manualFormData.commodity && validCommodityTypes.has(manualFormData.commodity.toUpperCase()) 
        ? manualFormData.commodity.toUpperCase() as RFQRow['commodity'] 
        : undefined,
      accessorial: []
    };
  };
  
  const prepareRFQData = (): RFQRow[] => {
    switch (inputSource) {
      case 'csv':
        return rfqData;
      case 'manual':
        return [convertManualFormToRFQ()];
      case 'history':
        return convertHistoricalShipmentsToRFQs();
      case 'past-rfq':
        return pastRFQData;
      default:
        return [];
    }
  };
  
  const getSelectedCarriers = () => {
    if (carrierMode === 'single') {
      // For single carrier mode, create an object with just the selected carrier
      if (!selectedSingleCarrier) return {};
      
      return { [selectedSingleCarrier]: true };
    } else {
      // For multiple carrier mode, use the carrier management selection
      return carrierManagement.selectedCarriers;
    }
  };
  
  const getCustomersForProcessing = (): string[] => {
    switch (customerMode) {
      case 'single':
        return selectedCustomer ? [selectedCustomer] : [];
      case 'all':
        return []; // Empty array means all customers
      case 'specific':
        return specificCustomers;
      default:
        return selectedCustomer ? [selectedCustomer] : [];
    }
  };
  
  const processRFQs = async () => {
    const data = prepareRFQData();
    
    if (data.length === 0) {
      setFormError('No RFQ data to process');
      return;
    }
    
    // Validate data
    if (inputSource === 'manual') {
      const errors = validateManualForm();
      if (errors.length > 0) {
        setFormError(errors.join(', '));
        return;
      }
    }
    
    const selectedCarriers = getSelectedCarriers();
    const customers = getCustomersForProcessing();
    
    // If comparing with past RFQ, we need to do special processing
    if (compareWithPastRFQ && inputSource === 'past-rfq') {
      // TODO: Implement comparison logic
      console.log('Comparing with past RFQ...');
    } else {
      // Standard processing
      await rfqProcessor.processMultipleRFQs(data, {
        selectedCarriers,
        pricingSettings,
        selectedCustomer: customers[0] || '' // Use first customer or empty string
      });
    }
  };
  
  const handlePriceUpdate = (resultIndex: number, quoteId: number, newPrice: number) => {
    rfqProcessor.updateQuotePricing(
      resultIndex, 
      quoteId, 
      newPrice, 
      { 
        pricingSettings, 
        selectedCustomer 
      }
    );
  };
  const handleSaveResults = async () => {
    if (rfqProcessor.results.length === 0) {
      alert('No results to save. Please process some RFQs first.');
      return;
    }

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const batchName = `${activeMode.charAt(0).toUpperCase() + activeMode.slice(1)} RFQ Batch - ${new Date().toLocaleDateString()}`;
      const summary = calculateBatchSummary(rfqProcessor.results);
      
      const batch = {
        batch_name: batchName,
        customer_name: selectedCustomer || undefined,
        shipment_count: rfqData.length,
        total_quotes_received: summary.total_quotes_received,
        best_total_price: summary.best_total_price,
        total_profit: summary.total_profit,
        pricing_settings: pricingSettings,
        selected_carriers: carrierManagement.selectedCarriers,
        rfq_data: rfqData,
        results_data: rfqProcessor.results,
        created_by: 'unified_rfq_tool'
      };

      await saveRFQBatch(batch);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save batch:', error);
      alert('Failed to save results. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };
  
  const exportResults = () => {
    if (rfqProcessor.results.length === 0) return;

    const exportData = rfqProcessor.results.flatMap(result => {
      const smartResult = result as any;
      
      return result.quotes.map(quote => {
        const quoteWithPricing = quote as QuoteWithPricing;
        const quoteWithMode = quote as any;
        
        return {
          'RFQ Number': result.rowIndex + 1,
          'Routing Decision': smartResult.quotingDecision?.replace('project44-', '').toUpperCase() || 'STANDARD',
          'Quote Type': quoteWithMode.quoteModeLabel || 'Standard LTL',
          'Routing Reason': smartResult.quotingReason || 'Standard LTL processing',
          'Origin ZIP': result.originalData.fromZip,
          'Destination ZIP': result.originalData.toZip,
          'Pallets': result.originalData.pallets,
          'Weight (lbs)': result.originalData.grossWeight,
          'Is Reefer': result.originalData.isReefer ? 'TRUE' : 'FALSE',
          'Temperature': result.originalData.temperature || 'AMBIENT',
          'Pickup Date': result.originalData.fromDate,
          'Carrier Name': quote.carrier.name,
          'Carrier SCAC': quote.carrier.scac || '',
          'Carrier MC': quote.carrier.mcNumber || '',
          'Service Level': quote.serviceLevel?.description || quote.serviceLevel?.code || '',
          'Transit Days': quote.transitDays || '',
          'Carrier Rate': quoteWithPricing.carrierTotalRate || 0,
          'Customer Price': quoteWithPricing.customerPrice || 0,
          'Profit Margin': quoteWithPricing.profit || 0,
          'Profit %': quoteWithPricing.carrierTotalRate > 0 ? 
            ((quoteWithPricing.profit / quoteWithPricing.carrierTotalRate) * 100).toFixed(1) + '%' : '0%',
          'Processing Status': result.status.toUpperCase(),
          'Error Message': result.error || ''
        };
      });
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Smart Quoting Results');
    
    // Set column widths for better readability
    const colWidths = [
      { wch: 12 }, // RFQ Number
      { wch: 15 }, // Routing Decision
      { wch: 15 }, // Quote Type
      { wch: 40 }, // Routing Reason
      { wch: 12 }, // Origin ZIP
      { wch: 12 }, // Destination ZIP
      { wch: 10 }, // Pallets
      { wch: 12 }, // Weight
      { wch: 10 }, // Is Reefer
      { wch: 12 }, // Temperature
      { wch: 12 }, // Pickup Date
      { wch: 25 }, // Carrier Name
      { wch: 12 }, // Carrier SCAC
      { wch: 12 }, // Carrier MC
      { wch: 20 }, // Service Level
      { wch: 12 }, // Transit Days
      { wch: 15 }, // Carrier Rate
      { wch: 15 }, // Customer Price
      { wch: 15 }, // Profit Margin
      { wch: 10 }, // Profit %
      { wch: 15 }, // Processing Status
      { wch: 30 }  // Error Message
    ];
    
    ws['!cols'] = colWidths;
    
    const fileName = `freight-quotes-${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };
  
  // Render input source selection
  const renderInputSourceSelection = () => (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Input Source</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <button
          onClick={() => setInputSource('csv')}
          className={`flex flex-col items-center p-4 rounded-lg border-2 transition-all ${
            inputSource === 'csv' 
              ? 'border-blue-500 bg-blue-50' 
              : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
          }`}
        >
          <Upload className={`h-8 w-8 mb-2 ${inputSource === 'csv' ? 'text-blue-500' : 'text-gray-500'}`} />
          <span className={`font-medium ${inputSource === 'csv' ? 'text-blue-700' : 'text-gray-700'}`}>
            Upload CSV/Excel
          </span>
          <span className="text-xs text-gray-500 mt-1">Import from file</span>
        </button>
        
        <button
          onClick={() => setInputSource('manual')}
          className={`flex flex-col items-center p-4 rounded-lg border-2 transition-all ${
            inputSource === 'manual' 
              ? 'border-green-500 bg-green-50' 
              : 'border-gray-200 hover:border-green-300 hover:bg-green-50'
          }`}
        >
          <Plus className={`h-8 w-8 mb-2 ${inputSource === 'manual' ? 'text-green-500' : 'text-gray-500'}`} />
          <span className={`font-medium ${inputSource === 'manual' ? 'text-green-700' : 'text-gray-700'}`}>
            Manual Entry
          </span>
          <span className="text-xs text-gray-500 mt-1">Create single RFQ</span>
        </button>
        
        <button
          onClick={() => setInputSource('history')}
          className={`flex flex-col items-center p-4 rounded-lg border-2 transition-all ${
            inputSource === 'history' 
              ? 'border-purple-500 bg-purple-50' 
              : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50'
          }`}
        >
          <History className={`h-8 w-8 mb-2 ${inputSource === 'history' ? 'text-purple-500' : 'text-gray-500'}`} />
          <span className={`font-medium ${inputSource === 'history' ? 'text-purple-700' : 'text-gray-700'}`}>
            Shipment History
          </span>
          <span className="text-xs text-gray-500 mt-1">From database</span>
        </button>
        
        <button
          onClick={() => setInputSource('past-rfq')}
          className={`flex flex-col items-center p-4 rounded-lg border-2 transition-all ${
            inputSource === 'past-rfq' 
              ? 'border-orange-500 bg-orange-50' 
              : 'border-gray-200 hover:border-orange-300 hover:bg-orange-50'
          }`}
        >
          <FileText className={`h-8 w-8 mb-2 ${inputSource === 'past-rfq' ? 'text-orange-500' : 'text-gray-500'}`} />
          <span className={`font-medium ${inputSource === 'past-rfq' ? 'text-orange-700' : 'text-gray-700'}`}>
            Past RFQ Batch
          </span>
          <span className="text-xs text-gray-500 mt-1">Reuse previous RFQs</span>
        </button>
      </div>
    </div>
  );
  
  // Render carrier mode selection
  const renderCarrierModeSelection = () => (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Carrier Selection Mode</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={() => setCarrierMode('single')}
          className={`flex flex-col items-center p-4 rounded-lg border-2 transition-all ${
            carrierMode === 'single' 
              ? 'border-blue-500 bg-blue-50' 
              : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
          }`}
        >
          <Truck className={`h-8 w-8 mb-2 ${carrierMode === 'single' ? 'text-blue-500' : 'text-gray-500'}`} />
          <span className={`font-medium ${carrierMode === 'single' ? 'text-blue-700' : 'text-gray-700'}`}>
            Single Carrier
          </span>
          <span className="text-xs text-gray-500 mt-1">Quote with one carrier</span>
        </button>
        
        <button
          onClick={() => setCarrierMode('multiple')}
          className={`flex flex-col items-center p-4 rounded-lg border-2 transition-all ${
            carrierMode === 'multiple' 
              ? 'border-green-500 bg-green-50' 
              : 'border-gray-200 hover:border-green-300 hover:bg-green-50'
          }`}
        >
          <Users className={`h-8 w-8 mb-2 ${carrierMode === 'multiple' ? 'text-green-500' : 'text-gray-500'}`} />
          <span className={`font-medium ${carrierMode === 'multiple' ? 'text-green-700' : 'text-gray-700'}`}>
            Multiple Carriers
          </span>
          <span className="text-xs text-gray-500 mt-1">Compare across carriers</span>
        </button>
      </div>
    </div>
  );
  
  // Render customer mode selection
  const renderCustomerModeSelection = () => (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Customer Selection Mode</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={() => setCustomerMode('single')}
          className={`flex flex-col items-center p-4 rounded-lg border-2 transition-all ${
            customerMode === 'single' 
              ? 'border-blue-500 bg-blue-50' 
              : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
          }`}
        >
          <Building2 className={`h-8 w-8 mb-2 ${customerMode === 'single' ? 'text-blue-500' : 'text-gray-500'}`} />
          <span className={`font-medium ${customerMode === 'single' ? 'text-blue-700' : 'text-gray-700'}`}>
            Single Customer
          </span>
          <span className="text-xs text-gray-500 mt-1">Apply one customer's margins</span>
        </button>
        
        <button
          onClick={() => setCustomerMode('all')}
          className={`flex flex-col items-center p-4 rounded-lg border-2 transition-all ${
            customerMode === 'all' 
              ? 'border-green-500 bg-green-50' 
              : 'border-gray-200 hover:border-green-300 hover:bg-green-50'
          }`}
        >
          <Users className={`h-8 w-8 mb-2 ${customerMode === 'all' ? 'text-green-500' : 'text-gray-500'}`} />
          <span className={`font-medium ${customerMode === 'all' ? 'text-green-700' : 'text-gray-700'}`}>
            All Customers
          </span>
          <span className="text-xs text-gray-500 mt-1">Analyze entire customer base</span>
        </button>
        
        <button
          onClick={() => setCustomerMode('specific')}
          className={`flex flex-col items-center p-4 rounded-lg border-2 transition-all ${
            customerMode === 'specific' 
              ? 'border-purple-500 bg-purple-50' 
              : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50'
          }`}
        >
          <Filter className={`h-8 w-8 mb-2 ${customerMode === 'specific' ? 'text-purple-500' : 'text-gray-500'}`} />
          <span className={`font-medium ${customerMode === 'specific' ? 'text-purple-700' : 'text-gray-700'}`}>
            Specific Customers
          </span>
          <span className="text-xs text-gray-500 mt-1">Select multiple customers</span>
        </button>
      </div>
      
      {inputSource === 'past-rfq' && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={compareWithPastRFQ}
              onChange={(e) => setCompareWithPastRFQ(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">
              Compare with past RFQ to determine new customer margins
            </span>
          </label>
          <p className="text-xs text-gray-500 mt-1 ml-6">
            This will calculate new margins needed to maintain the same revenue as the past RFQ
          </p>
        </div>
      )}
    </div>
  );
  
  // Render CSV upload input
  const renderCSVUpload = () => (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Upload RFQ Data</h3>
      
      <FileUpload
        onFileSelect={handleFileSelect}
        error={fileError}
        isProcessing={rfqProcessor.processingStatus.isProcessing}
      />
      
      {rfqData.length > 0 && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center space-x-2 text-green-800">
            <CheckCircle className="h-5 w-5" />
            <span className="font-medium">
              {rfqData.length} RFQ{rfqData.length !== 1 ? 's' : ''} loaded successfully
            </span>
          </div>
          <p className="text-sm text-green-700 mt-1 ml-7">
            Ready for processing with smart routing
          </p>
        </div>
      )}
    </div>
  );
  
  // Render manual RFQ form
  const renderManualRFQForm = () => (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Create Manual RFQ</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Pickup Date</label>
          <input
            type="date"
            value={manualFormData.fromDate}
            onChange={(e) => handleManualFormChange('fromDate', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Pallets</label>
          <input
            type="number"
            min="1"
            max="100"
            value={manualFormData.pallets}
            onChange={(e) => handleManualFormChange('pallets', parseInt(e.target.value) || 1)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Origin ZIP</label>
          <input
            type="text"
            value={manualFormData.fromZip}
            onChange={(e) => handleManualFormChange('fromZip', e.target.value)}
            placeholder="60607"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Destination ZIP</label>
          <input
            type="text"
            value={manualFormData.toZip}
            onChange={(e) => handleManualFormChange('toZip', e.target.value)}
            placeholder="30033"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Gross Weight (lbs)</label>
          <input
            type="number"
            min="1"
            max="100000"
            value={manualFormData.grossWeight}
            onChange={(e) => handleManualFormChange('grossWeight', parseInt(e.target.value) || 1000)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Freight Class</label>
          <input
            type="text"
            value={manualFormData.freightClass || ''}
            onChange={(e) => handleManualFormChange('freightClass', e.target.value)}
            placeholder="70"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      
      <div className="mt-4 space-y-3">
        <div className="flex items-center space-x-4">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={manualFormData.isStackable}
              onChange={(e) => handleManualFormChange('isStackable', e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Stackable</span>
          </label>
          
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={manualFormData.isReefer}
              onChange={(e) => handleManualFormChange('isReefer', e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Reefer (Route to FreshX)</span>
          </label>
        </div>
        
        {manualFormData.isReefer && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Temperature</label>
              <select
                value={manualFormData.temperature}
                onChange={(e) => handleManualFormChange('temperature', e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value="AMBIENT">Ambient</option>
                <option value="CHILLED">Chilled</option>
                <option value="FROZEN">Frozen</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Commodity</label>
              <input
                type="text"
                value={manualFormData.commodity || ''}
                onChange={(e) => handleManualFormChange('commodity', e.target.value)}
                placeholder="FOODSTUFFS"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}
      </div>
      
      {/* Line Items */}
      <div className="mt-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium text-gray-700">Line Items (Optional)</h4>
          <button
            onClick={addLineItem}
            className="flex items-center space-x-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            <Plus className="h-3 w-3" />
            <span>Add Item</span>
          </button>
        </div>
        
        {manualFormData.lineItems.length === 0 ? (
          <p className="text-xs text-gray-500">
            No line items added. The system will use default dimensions based on pallets and weight.
          </p>
        ) : (
          <div className="space-y-3">
            {manualFormData.lineItems.map((item, index) => (
              <div key={item.id} className="border border-gray-200 rounded p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-700">Item {index + 1}</span>
                  <button
                    onClick={() => removeLineItem(index)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2">
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => updateLineItem(index, { description: e.target.value })}
                      placeholder="Description"
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                    />
                  </div>
                  
                  <div>
                    <input
                      type="number"
                      value={item.totalWeight}
                      onChange={(e) => updateLineItem(index, { totalWeight: parseInt(e.target.value) || 0 })}
                      placeholder="Weight (lbs)"
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                    />
                  </div>
                  
                  <div>
                    <input
                      type="text"
                      value={item.freightClass}
                      onChange={(e) => updateLineItem(index, { freightClass: e.target.value })}
                      placeholder="Freight Class"
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                    />
                  </div>
                  
                  <div>
                    <input
                      type="number"
                      value={item.packageLength}
                      onChange={(e) => updateLineItem(index, { packageLength: parseInt(e.target.value) || 0 })}
                      placeholder="Length (in)"
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                    />
                  </div>
                  
                  <div>
                    <input
                      type="number"
                      value={item.packageWidth}
                      onChange={(e) => updateLineItem(index, { packageWidth: parseInt(e.target.value) || 0 })}
                      placeholder="Width (in)"
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                    />
                  </div>
                  
                  <div>
                    <input
                      type="number"
                      value={item.packageHeight}
                      onChange={(e) => updateLineItem(index, { packageHeight: parseInt(e.target.value) || 0 })}
                      placeholder="Height (in)"
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                    />
                  </div>
                  
                  <div>
                    <label className="flex items-center space-x-1">
                      <input
                        type="checkbox"
                        checked={item.stackable}
                        onChange={(e) => updateLineItem(index, { stackable: e.target.checked })}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-3 w-3"
                      />
                      <span className="text-xs text-gray-700">Stackable</span>
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {formError && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center space-x-2 text-red-700">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">{formError}</span>
          </div>
        </div>
      )}
    </div>
  );
  
  // Render historical shipments selection
  const renderHistoricalShipments = () => (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Historical Shipments</h3>
      
      {/* Filters */}
      <div className="mb-4 p-4 bg-gray-50 rounded-lg">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
            <input
              type="text"
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              placeholder="Filter by customer..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={dateRangeFilter.start}
              onChange={(e) => setDateRangeFilter(prev => ({ ...prev, start: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={dateRangeFilter.end}
              onChange={(e) => setDateRangeFilter(prev => ({ ...prev, end: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Carrier</label>
            <input
              type="text"
              value={carrierFilter}
              onChange={(e) => setCarrierFilter(e.target.value)}
              placeholder="Filter by carrier..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        
        <div className="flex justify-end mt-3">
          <button
            onClick={() => {
              setCustomerFilter('');
              setDateRangeFilter({ start: '', end: '' });
              setCarrierFilter('');
            }}
            className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            Clear Filters
          </button>
        </div>
      </div>
      
      {/* Shipments Table */}
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={selectedHistoricalShipments.length === historicalShipments.length && historicalShipments.length > 0}
                    onChange={(e) => handleSelectAllHistoricalShipments(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Select</span>
                </label>
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Route</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Carrier</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rate</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {historicalShipments.map((shipment) => (
              <tr key={shipment.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={selectedHistoricalShipments.includes(shipment.id)}
                    onChange={(e) => handleHistoricalShipmentSelect(shipment.id, e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{shipment.shipment_date}</td>
                <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">{shipment.customer_name}</td>
                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                  <div className="flex items-center space-x-1">
                    <MapPin className="h-3 w-3 text-gray-400" />
                    <span>{shipment.origin_zip} → {shipment.destination_zip}</span>
                  </div>
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                  <div className="flex items-center space-x-1">
                    <Package className="h-3 w-3 text-gray-400" />
                    <span>{shipment.pallets} pallets, {shipment.weight.toLocaleString()} lbs</span>
                  </div>
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{shipment.carrier_name || '—'}</td>
                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                  {shipment.quoted_rate ? `$${shipment.quoted_rate.toLocaleString()}` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {historicalShipments.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p>No historical shipments found matching your filters</p>
        </div>
      )}
      
      {selectedHistoricalShipments.length > 0 && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center space-x-2 text-blue-800">
            <CheckCircle className="h-4 w-4" />
            <span className="font-medium">
              {selectedHistoricalShipments.length} shipment{selectedHistoricalShipments.length !== 1 ? 's' : ''} selected
            </span>
          </div>
        </div>
      )}
    </div>
  );
  
  // Render past RFQ batches selection
  const renderPastRFQBatches = () => (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Past RFQ Batch</h3>
      
      {/* Filters */}
      <div className="mb-4 p-4 bg-gray-50 rounded-lg">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
            <input
              type="text"
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              placeholder="Filter by customer..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={dateRangeFilter.start}
              onChange={(e) => setDateRangeFilter(prev => ({ ...prev, start: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={dateRangeFilter.end}
              onChange={(e) => setDateRangeFilter(prev => ({ ...prev, end: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        
        <div className="flex justify-end mt-3">
          <button
            onClick={() => {
              setCustomerFilter('');
              setDateRangeFilter({ start: '', end: '' });
            }}
            className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            Clear Filters
          </button>
        </div>
      </div>
      
      {/* RFQ Batches */}
      <div className="space-y-3">
        {pastRFQBatches.map((batch) => (
          <div 
            key={batch.id}
            onClick={() => handlePastRFQBatchSelect(batch.id)}
            className={`p-4 border rounded-lg cursor-pointer transition-all ${
              selectedPastRFQBatch === batch.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-gray-900">{batch.batch_name}</h4>
                <div className="text-sm text-gray-600 mt-1">
                  {batch.customer_name && (
                    <div className="flex items-center space-x-1">
                      <Building2 className="h-3 w-3" />
                      <span>{batch.customer_name}</span>
                    </div>
                  )}
                  <div className="flex items-center space-x-1 mt-1">
                    <Calendar className="h-3 w-3" />
                    <span>{new Date(batch.created_at).toLocaleDateString()}</span>
                    <span className="mx-1">•</span>
                    <Package className="h-3 w-3" />
                    <span>{batch.shipment_count} shipments</span>
                  </div>
                </div>
              </div>
              
              {selectedPastRFQBatch === batch.id && (
                <CheckCircle className="h-5 w-5 text-blue-500" />
              )}
            </div>
          </div>
        ))}
      </div>
      
      {pastRFQBatches.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p>No past RFQ batches found matching your filters</p>
        </div>
      )}
      
      {selectedPastRFQBatch && pastRFQData.length > 0 && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center space-x-2 text-blue-800">
            <CheckCircle className="h-4 w-4" />
            <span className="font-medium">
              {pastRFQData.length} RFQ{pastRFQData.length !== 1 ? 's' : ''} loaded from selected batch
            </span>
          </div>
        </div>
      )}
    </div>
  );
  
  // Render carrier selection
  const renderCarrierSelection = () => {
    if (carrierMode === 'single') {
      // Single carrier dropdown
      return (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Carrier</h3>
          
          <div className="relative">
            <select
              value={selectedSingleCarrier}
              onChange={(e) => setSelectedSingleCarrier(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 appearance-none"
            >
              <option value="">Select a carrier...</option>
              {carrierManagement.carrierGroups.flatMap(group => 
                group.carriers.map(carrier => (
                  <option key={carrier.id} value={carrier.id}>
                    {carrier.name} {carrier.scac ? `(${carrier.scac})` : ''}
                  </option>
                ))
              )}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
              <Truck className="h-5 w-5 text-gray-400" />
            </div>
          </div>
          
          {!carrierManagement.carriersLoaded && (
            <button
              onClick={carrierManagement.loadCarriers}
              disabled={carrierManagement.isLoadingCarriers}
              className="mt-4 w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              {carrierManagement.isLoadingCarriers ? (
                <>
                  <Loader className="h-4 w-4 animate-spin" />
                  <span>Loading Carriers...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  <span>Load Carriers</span>
                </>
              )}
            </button>
          )}
          
          {selectedSingleCarrier && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center space-x-2 text-blue-800">
                <CheckCircle className="h-4 w-4" />
                <span className="font-medium">
                  Carrier selected: {carrierManagement.carrierGroups.flatMap(g => g.carriers).find(c => c.id === selectedSingleCarrier)?.name}
                </span>
              </div>
            </div>
          )}
        </div>
      );
    } else {
      // Multiple carrier selection
      return (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Select Multiple Carriers</h3>
          </div>
          
          <div className="p-6">
            {!carrierManagement.carriersLoaded && !carrierManagement.isLoadingCarriers && (
              <button
                onClick={carrierManagement.loadCarriers}
                className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Truck className="h-5 w-5" />
                <span>Load Carrier Network</span>
              </button>
            )}
            
            {(carrierManagement.carriersLoaded || carrierManagement.isLoadingCarriers) && (
              <CarrierSelection
                carrierGroups={carrierManagement.carrierGroups}
                selectedCarriers={carrierManagement.selectedCarriers}
                onToggleCarrier={carrierManagement.handleCarrierToggle}
                onSelectAll={carrierManagement.handleSelectAll}
                onSelectAllInGroup={carrierManagement.handleSelectAllInGroup}
                isLoading={carrierManagement.isLoadingCarriers}
              />
            )}
          </div>
        </div>
      );
    }
  };
  
  // Render customer selection
  const renderCustomerSelection = () => {
    if (customerMode === 'single') {
      // Single customer selection
      return (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Customer</h3>
          
          <CustomerSelection
            selectedCustomer={selectedCustomer}
            onCustomerChange={updateSelectedCustomer}
          />
        </div>
      );
    } else if (customerMode === 'specific') {
      // Specific customers selection
      return (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Specific Customers</h3>
          
          <div className="mb-4">
            <div className="flex items-center space-x-2 mb-2">
              <Search className="h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search customers..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg">
              {/* This would be populated with customer checkboxes */}
              <div className="p-4 text-center text-gray-500">
                <p>Customer selection will be implemented here</p>
              </div>
            </div>
          </div>
          
          <div className="flex justify-between">
            <button className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300">
              Clear All
            </button>
            <button className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">
              Select All
            </button>
          </div>
        </div>
      );
    } else {
      // All customers (no UI needed)
      return (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">All Customers Selected</h3>
          
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center space-x-2 text-blue-800">
              <Users className="h-5 w-5" />
              <div>
                <p className="font-medium">Processing for all customers</p>
                <p className="text-sm mt-1">
                  The system will analyze all customers in the database and apply appropriate margins
                </p>
              </div>
              
              {rfqProcessor.results.length > 0 && (
                <button
                  onClick={handleSaveResults}
                  disabled={isSaving}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                    saveSuccess 
                      ? 'bg-green-600 text-white' 
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isSaving ? (
                    <Loader className="h-4 w-4 animate-spin" />
                  ) : saveSuccess ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  <span>
                    {isSaving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save Results'}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }
  };
  
  // Render pricing settings
  const renderPricingSettings = () => (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <PricingSettingsComponent
        settings={pricingSettings}
        onSettingsChange={updatePricingSettings}
        selectedCustomer={selectedCustomer}
        onCustomerChange={updateSelectedCustomer}
      />
    </div>
  );
  
  // Render process button
  const renderProcessButton = () => {
    const isReadyToProcess = () => {
      switch (inputSource) {
        case 'csv':
          return rfqData.length > 0;
        case 'manual':
          return manualFormData.fromZip && manualFormData.toZip;
        case 'history':
          return selectedHistoricalShipments.length > 0;
        case 'past-rfq':
          return pastRFQData.length > 0;
        default:
          return false;
      }
    };
    
    const getButtonText = () => {
      if (rfqProcessor.processingStatus.isProcessing) {
        return 'Processing...';
      }
      
      const inputText = {
        'csv': 'File',
        'manual': 'Manual RFQ',
        'history': 'Historical Shipments',
        'past-rfq': 'Past RFQ Batch'
      }[inputSource];
      
      return `Process ${inputText}`;
    };
    
    return (
      <div className="bg-white rounded-lg shadow-md p-6 text-center">
        <button
          onClick={processRFQs}
          disabled={!isReadyToProcess() || rfqProcessor.processingStatus.isProcessing}
          className={`inline-flex items-center space-x-3 px-8 py-4 font-semibold rounded-xl transition-all duration-200 text-lg shadow-lg ${
            !isReadyToProcess() || rfqProcessor.processingStatus.isProcessing
              ? 'bg-gray-400 cursor-not-allowed text-white'
              : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white hover:shadow-xl'
          }`}
        >
          {rfqProcessor.processingStatus.isProcessing ? (
            <>
              <Loader className="h-6 w-6 animate-spin" />
              <span>Processing...</span>
            </>
          ) : (
            <>
              <Zap className="h-6 w-6" />
              <span>{getButtonText()}</span>
            </>
          )}
        </button>
        
        <p className="mt-3 text-sm text-gray-500">
          {rfqProcessor.processingStatus.isProcessing
            ? `Processing ${rfqProcessor.processingStatus.currentStep} of ${rfqProcessor.processingStatus.totalSteps}`
            : 'Smart routing will automatically classify each shipment'}
        </p>
      </div>
    );
  };
  
  // Render results
  const renderResults = () => {
    if (rfqProcessor.results.length === 0) {
      return null;
    }
    
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">Processing Results</h3>
              <p className="text-sm text-gray-600 mt-1">
                {rfqProcessor.results.length} RFQ{rfqProcessor.results.length !== 1 ? 's' : ''} processed with smart routing
              </p>
            </div>
            
            <button
              onClick={exportResults}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Download className="h-4 w-4" />
              <span>Export Results</span>
            </button>
          </div>
        </div>
        
        <ResultsTable
          results={rfqProcessor.results}
          onExport={exportResults}
          onPriceUpdate={handlePriceUpdate}
        />
      </div>
    );
  };
  
  // Render comparison results (for past RFQ comparison)
  const renderComparisonResults = () => {
    if (!compareWithPastRFQ || inputSource !== 'past-rfq') {
      return null;
    }
    
    // This would show the comparison between past and current RFQs
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Margin Impact Analysis</h3>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Original Revenue</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">New Cost</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Required Margin</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Change</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Impact</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              <tr className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm font-medium text-gray-900">Sample Customer</td>
                <td className="px-6 py-4 text-sm text-gray-900">$5,000</td>
                <td className="px-6 py-4 text-sm text-gray-900">$4,200</td>
                <td className="px-6 py-4 text-sm text-gray-900">16.0%</td>
                <td className="px-6 py-4 text-sm">
                  <div className="flex items-center space-x-1 text-green-600">
                    <TrendingUp className="h-4 w-4" />
                    <span>+1.0%</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">Modest margin improvement</td>
              </tr>
              <tr className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm font-medium text-gray-900">Another Customer</td>
                <td className="px-6 py-4 text-sm text-gray-900">$8,500</td>
                <td className="px-6 py-4 text-sm text-gray-900">$7,500</td>
                <td className="px-6 py-4 text-sm text-gray-900">11.8%</td>
                <td className="px-6 py-4 text-sm">
                  <div className="flex items-center space-x-1 text-red-600">
                    <TrendingDown className="h-4 w-4" />
                    <span>-3.2%</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">Margin compression - review pricing</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };
  
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-3">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-3 rounded-xl shadow-lg">
            <Zap className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Unified Multi-Mode RFQ Tool</h1>
            <p className="text-sm text-gray-600">
              Comprehensive freight quoting across multiple modes, carriers, and customers
            </p>
          </div>
        </div>
      </div>
      
      {/* Configuration Section */}
      <div className="space-y-6">
        {/* Step 1: Input Source */}
        {renderInputSourceSelection()}
        
        {/* Step 2: Input-specific UI */}
        {inputSource === 'csv' && renderCSVUpload()}
        {inputSource === 'manual' && renderManualRFQForm()}
        {inputSource === 'history' && renderHistoricalShipments()}
        {inputSource === 'past-rfq' && renderPastRFQBatches()}
        
        {/* Step 3: Carrier Mode */}
        {renderCarrierModeSelection()}
        
        {/* Step 4: Carrier Selection */}
        {renderCarrierSelection()}
        
        {/* Step 5: Customer Mode */}
        {renderCustomerModeSelection()}
        
        {/* Step 6: Customer Selection */}
        {renderCustomerSelection()}
        
        {/* Step 7: Pricing Settings */}
        {renderPricingSettings()}
        
        {/* Step 8: Process Button */}
        {renderProcessButton()}
      </div>
      
      {/* Results Section */}
      {renderResults()}
      
      {/* Comparison Results (for past RFQ comparison) */}
      {renderComparisonResults()}
    </div>
  );
};