import * as XLSX from 'xlsx';
import { RFQRow } from '../types';

// Project44 LTL/VLTL accessorial options
const PROJECT44_ACCESSORIALS = [
  // Pickup Accessorial Services
  { code: 'AIRPU', label: 'Airport Pickup' },
  { code: 'APPTPU', label: 'Pickup Appointment' },
  { code: 'CAMPPU', label: 'Camp Pickup' },
  { code: 'CFSPU', label: 'Container Freight Station Pickup' },
  { code: 'CHRCPU', label: 'Church Pickup' },
  { code: 'CLUBPU', label: 'Country Club Pickup' },
  { code: 'CNVPU', label: 'Convention/Tradeshow Pickup' },
  { code: 'CONPU', label: 'Construction Site Pickup' },
  { code: 'DOCKPU', label: 'Dock Pickup' },
  { code: 'EDUPU', label: 'School Pickup' },
  { code: 'FARMPU', label: 'Farm Pickup' },
  { code: 'GOVPU', label: 'Government Site Pickup' },
  { code: 'GROPU', label: 'Grocery Warehouse Pickup' },
  { code: 'HOSPU', label: 'Hospital Pickup' },
  { code: 'HOTLPU', label: 'Hotel Pickup' },
  { code: 'INPU', label: 'Inside Pickup' },
  { code: 'LGPU', label: 'Liftgate Pickup' },
  { code: 'LTDPU', label: 'Limited Access Pickup' },
  { code: 'MILPU', label: 'Military Installation Pickup' },
  { code: 'MINEPU', label: 'Mine Site Pickup' },
  { code: 'NARPU', label: 'Native American Reservation Pickup' },
  { code: 'NBPU', label: 'Non-Business Hours Pickup' },
  { code: 'NURSPU', label: 'Nursing Home Pickup' },
  { code: 'PARKPU', label: 'Fair/Amusement/Park Pickup' },
  { code: 'PIERPU', label: 'Pier Pickup' },
  { code: 'PRISPU', label: 'Prison Pickup' },
  { code: 'RESPU', label: 'Residential Pickup' },
  { code: 'SATPU', label: 'Saturday Pickup' },
  { code: 'SORTPU', label: 'Sort/Segregate Pickup' },
  { code: 'SSTORPU', label: 'Self-Storage Pickup' },
  { code: 'UTLPU', label: 'Utility Site Pickup' },

  // Delivery Accessorial Services
  { code: 'AIRDEL', label: 'Airport Delivery' },
  { code: 'CAMPDEL', label: 'Camp Delivery' },
  { code: 'CFSDEL', label: 'Container Freight Station Delivery' },
  { code: 'CHRCDEL', label: 'Church Delivery' },
  { code: 'CLUBDEL', label: 'Country Club Delivery' },
  { code: 'CNVDEL', label: 'Convention/Tradeshow Delivery' },
  { code: 'CONDEL', label: 'Construction Site Delivery' },
  { code: 'DCDEL', label: 'Distribution Center Delivery' },
  { code: 'DOCKDEL', label: 'Dock Delivery' },
  { code: 'EDUDEL', label: 'School Delivery' },
  { code: 'FARMDEL', label: 'Farm Delivery' },
  { code: 'GOVDEL', label: 'Government Site Delivery' },
  { code: 'GRODEL', label: 'Grocery Warehouse Delivery' },
  { code: 'HDAYDEL', label: 'Holiday Delivery' },
  { code: 'HOSDEL', label: 'Hospital Delivery' },
  { code: 'HOTLDEL', label: 'Hotel Delivery' },
  { code: 'INDEL', label: 'Inside Delivery' },
  { code: 'INEDEL', label: 'Inside Delivery - With Elevator' },
  { code: 'INGDEL', label: 'Inside Delivery - Ground Floor' },
  { code: 'INNEDEL', label: 'Inside Delivery - No Elevator' },
  { code: 'MALLDEL', label: 'Mall Delivery' },
  { code: 'MILDEL', label: 'Military Installation Delivery' },
  { code: 'MINEDEL', label: 'Mine Site Delivery' },
  { code: 'NARDEL', label: 'Native American Reservation Delivery' },
  { code: 'NBDEL', label: 'Non-Business Hours Delivery' },
  { code: 'NCDEL', label: 'Non-Commercial Delivery' },
  { code: 'NOTIFY', label: 'Delivery Notification' },
  { code: 'NURSDEL', label: 'Nursing Home Delivery' },
  { code: 'PARKDEL', label: 'Fair/Amusement/Park Delivery' },
  { code: 'PIERDEL', label: 'Pier Delivery' },
  { code: 'PRISDEL', label: 'Prison Delivery' },
  { code: 'RESDEL', label: 'Residential Delivery' },
  { code: 'RSRTDEL', label: 'Resort Delivery' },
  { code: 'SATDEL', label: 'Saturday Delivery' },
  { code: 'SORTDEL', label: 'Sort/Segregate Delivery' },
  { code: 'SSTORDEL', label: 'Self-Storage Delivery' },
  { code: 'SUNDEL', label: 'Sunday Delivery' },
  { code: 'UTLDEL', label: 'Utility Site Delivery' },
  { code: 'WEDEL', label: 'Weekend Delivery' }
];

export const generateUnifiedSmartTemplate = (): ArrayBuffer => {
  const workbook = XLSX.utils.book_new();
  
  // Create comprehensive headers - REMOVED legacy dimension fields, using ONLY itemized approach
  const baseHeaders = [
    // Core required fields
    'fromDate',
    'fromZip', 
    'toZip',
    'pallets',
    'grossWeight',
    'isStackable',
    'isReefer',
    
    // Enhanced shipment details (NO packageLength/Width/Height here)
    'temperature',
    'commodity',
    'isFoodGrade',
    'freightClass',
    'nmfcCode',
    'nmfcSubCode',
    'commodityDescription',
    'commodityType',
    'packageType',
    'totalPackages',
    'totalPieces',
    'lengthUnit',
    'weightUnit',
    'totalValue',
    'insuranceAmount',
    'harmonizedCode',
    'countryOfManufacture',
    
    // Hazmat information
    'hazmat',
    'hazmatClass',
    'hazmatIdNumber',
    'hazmatPackingGroup',
    'hazmatProperShippingName',
    'emergencyContactName',
    'emergencyContactPhone',
    'emergencyContactCompany',
    
    // Timing and delivery windows
    'deliveryDate',
    'deliveryStartTime',
    'deliveryEndTime',
    'pickupStartTime',
    'pickupEndTime',
    
    // Address details
    'originAddressLines',
    'originCity',
    'originState',
    'originCountry',
    'destinationAddressLines',
    'destinationCity',
    'destinationState',
    'destinationCountry',
    
    // Contact information
    'pickupContactName',
    'pickupContactPhone',
    'pickupContactEmail',
    'pickupCompanyName',
    'deliveryContactName',
    'deliveryContactPhone',
    'deliveryContactEmail',
    'deliveryCompanyName',
    
    // API configuration
    'preferredCurrency',
    'paymentTerms',
    'direction',
    'preferredSystemOfMeasurement',
    'allowUnacceptedAccessorials',
    'fetchAllGuaranteed',
    'fetchAllInsideDelivery',
    'fetchAllServiceLevels',
    'enableUnitConversion',
    'fallBackToDefaultAccountGroup',
    'apiTimeout',
    'totalLinearFeet',
    
    // Multi-item support - up to 5 items with different dimensions
    // Item 1
    'item1_description',
    'item1_totalWeight',
    'item1_freightClass',
    'item1_packageLength',
    'item1_packageWidth',
    'item1_packageHeight',
    'item1_packageType',
    'item1_totalPackages',
    'item1_stackable',
    'item1_nmfcItemCode',
    'item1_totalValue',
    
    // Item 2
    'item2_description',
    'item2_totalWeight',
    'item2_freightClass',
    'item2_packageLength',
    'item2_packageWidth',
    'item2_packageHeight',
    'item2_packageType',
    'item2_totalPackages',
    'item2_stackable',
    'item2_nmfcItemCode',
    'item2_totalValue',
    
    // Item 3
    'item3_description',
    'item3_totalWeight',
    'item3_freightClass',
    'item3_packageLength',
    'item3_packageWidth',
    'item3_packageHeight',
    'item3_packageType',
    'item3_totalPackages',
    'item3_stackable',
    'item3_nmfcItemCode',
    'item3_totalValue',
    
    // Item 4
    'item4_description',
    'item4_totalWeight',
    'item4_freightClass',
    'item4_packageLength',
    'item4_packageWidth',
    'item4_packageHeight',
    'item4_packageType',
    'item4_totalPackages',
    'item4_stackable',
    'item4_nmfcItemCode',
    'item4_totalValue',
    
    // Item 5
    'item5_description',
    'item5_totalWeight',
    'item5_freightClass',
    'item5_packageLength',
    'item5_packageWidth',
    'item5_packageHeight',
    'item5_packageType',
    'item5_totalPackages',
    'item5_stackable',
    'item5_nmfcItemCode',
    'item5_totalValue'
  ];
  
  // Add each Project44 accessorial as its own column
  const accessorialHeaders = PROJECT44_ACCESSORIALS.map(acc => acc.code);
  const allHeaders = [...baseHeaders, ...accessorialHeaders];
  
  // Comprehensive sample data showing all 3 routing modes
  const sampleData = [
    // Row 1: MODE 1 - FreshX Reefer (isReefer=TRUE)
    [
      '2025-02-15', '60607', '30033', 3, 2500, false, true,
      'CHILLED', 'FOODSTUFFS', true, '70', '', '', 'Refrigerated Food Products', 'FOOD', 'PLT', 3, 3, 'IN', 'LB', 8000, 0, '', 'US',
      false, '', '', '', '', '', '', '',
      '', '', '', '', '',
      '', 'Chicago', 'IL', 'US', '', 'Atlanta', 'GA', 'US',
      '', '', '', '', '', '', '', '',
      'USD', 'PREPAID', 'SHIPPER', 'IMPERIAL', true, true, true, true, true, true, 30, 0,
      // Single reefer item - routed to FreshX
      'Chilled Dairy Products', 2500, '70', 48, 40, 48, 'PLT', 3, false, '', 8000,
      // Items 2-5 empty
      '', '', '', '', '', '', '', '', '', '', '',
      '', '', '', '', '', '', '', '', '', '', '',
      '', '', '', '', '', '', '', '', '', '', '',
      '', '', '', '', '', '', '', '', '', '', '',
      ...PROJECT44_ACCESSORIALS.map(acc => 
        ['LGPU', 'NOTIFY'].includes(acc.code) ? true : false
      )
    ],
    // Row 2: MODE 2 - Project44 Standard LTL (isReefer=FALSE, small shipment)
    [
      '2025-02-16', '90210', '10001', 5, 4500, true, false,
      'AMBIENT', '', false, '85', '123456', '01', 'Small Electronics', 'ELECTRONICS', 'PLT', 5, 10, 'IN', 'LB', 12000, 1200, 'HTS123456', 'US',
      false, '', '', '', '', '', '', '',
      '2025-02-17', '08:00', '17:00', '09:00', '16:00',
      '123 Main St', 'Beverly Hills', 'CA', 'US', '456 Broadway', 'New York', 'NY', 'US',
      'John Smith', '555-123-4567', 'john@company.com', 'Shipper Corp', 'Jane Doe', '555-987-6543', 'jane@receiver.com', 'Receiver Inc',
      'USD', 'PREPAID', 'SHIPPER', 'IMPERIAL', true, true, true, true, true, true, 45, 30,
      // Small electronics - routed to Project44 Standard LTL only
      'Computer Equipment', 2500, '85', 48, 40, 60, 'PLT', 3, true, '123456', 8000,
      'Network Components', 2000, '92.5', 36, 24, 36, 'BOX', 2, false, '234567', 4000,
      // Items 3-5 empty
      '', '', '', '', '', '', '', '', '', '', '',
      '', '', '', '', '', '', '', '', '', '', '',
      '', '', '', '', '', '', '', '', '', '', '',
      ...PROJECT44_ACCESSORIALS.map(acc => 
        ['LGPU', 'NOTIFY'].includes(acc.code) ? true : false
      )
    ],
    // Row 3: MODE 3 - Project44 Volume LTL/Dual Mode (isReefer=FALSE, large shipment)
    [
      '2025-02-17', '10001', '90210', 15, 22000, true, false,
      'AMBIENT', '', false, '125', '654321', '02', 'Heavy Machinery', 'INDUSTRIAL', 'PLT', 15, 15, 'IN', 'LB', 35000, 3500, 'MACH789', 'US',
      false, '', '', '', '', '', '', '',
      '2025-02-18', '06:00', '18:00', '07:00', '15:00',
      '789 Industrial Blvd', 'New York', 'NY', 'US', '321 Factory Ave', 'Los Angeles', 'CA', 'US',
      'Industrial Manager', '555-HEAVY-123', 'heavy@industrial.com', 'Heavy Industries', 'Warehouse Supervisor', '555-WAREHOUSE-456', 'warehouse@factory.com', 'Factory Inc',
      'USD', 'COLLECT', 'CONSIGNEE', 'IMPERIAL', true, true, true, true, true, true, 60, 0,
      // Large industrial shipment - routed to both Volume LTL AND Standard LTL for comparison
      'Heavy Equipment Base', 12000, '125', 72, 60, 84, 'PLT', 8, true, '654321', 20000,
      'Machine Components', 6000, '100', 48, 40, 60, 'CRATE', 4, true, '765432', 10000,
      'Steel Framework', 4000, '150', 96, 48, 36, 'PLT', 3, false, '876543', 5000,
      // Items 4-5 empty
      '', '', '', '', '', '', '', '', '', '', '',
      '', '', '', '', '', '', '', '', '', '', '',
      ...PROJECT44_ACCESSORIALS.map(acc => 
        ['LGPU', 'NOTIFY', 'APPTPU'].includes(acc.code) ? true : false
      )
    ],
    // Row 4: Additional FreshX Reefer Example (Frozen)
    [
      '2025-02-18', '77001', '30309', 8, 12000, true, true,
      'FROZEN', 'FROZEN_SEAFOOD', true, '70', '789012', '03', 'Frozen Seafood Products', 'SEAFOOD', 'PLT', 8, 8, 'IN', 'LB', 25000, 2500, 'SEAFOOD123', 'US',
      false, '', '', '', '', '', '', '',
      '2025-02-19', '07:00', '19:00', '06:00', '18:00',
      '1000 Seafood Processing', 'Houston', 'TX', 'US', '2000 Restaurant Supply', 'Atlanta', 'GA', 'US',
      'Cold Storage Manager', '555-COLD-123', 'cold@seafood.com', 'Seafood Processing Co', 'Restaurant Buyer', '555-RESTAURANT-456', 'buyer@supply.com', 'Restaurant Supply Inc',
      'USD', 'PREPAID', 'SHIPPER', 'IMPERIAL', true, true, true, true, true, true, 40, 22,
      // Frozen seafood - routed to FreshX
      'Frozen Fish Fillets', 6000, '70', 48, 40, 24, 'PLT', 4, true, '789012', 15000,
      'Frozen Shrimp', 4000, '70', 36, 24, 18, 'PLT', 2, true, '890123', 8000,
      'Ice Packs', 2000, '70', 24, 18, 12, 'PLT', 2, false, '901234', 2000,
      // Items 4-5 empty
      '', '', '', '', '', '', '', '', '', '', '',
      '', '', '', '', '', '', '', '', '', '', '',
      ...PROJECT44_ACCESSORIALS.map(acc => 
        ['LGPU', 'NOTIFY'].includes(acc.code) ? true : false
      )
    ],
    // Row 5: Additional Project44 Standard LTL Example
    [
      '2025-02-19', '94102', '02101', 2, 1800, false, false,
      'AMBIENT', '', false, '50', '345678', '04', 'Precision Electronics', 'ELECTRONICS', 'PLT', 2, 2, 'IN', 'LB', 50000, 5000, 'ELEC789', 'US',
      false, '', '', '', '', '', '', '',
      '', '', '', '', '',
      '500 Tech Way', 'San Francisco', 'CA', 'US', '100 Innovation Dr', 'Boston', 'MA', 'US',
      'Tech Shipper', '555-TECH-456', 'tech@silicon.com', 'Silicon Valley Tech', 'Innovation Receiver', '555-INNOV-789', 'receive@innovation.com', 'Innovation Labs',
      'USD', 'PREPAID', 'SHIPPER', 'IMPERIAL', true, true, true, true, true, true, 30, 0,
      // Small high-value electronics - routed to Project44 Standard LTL only
      'Precision Instruments', 1800, '50', 36, 24, 24, 'CRATE', 2, false, '345678', 50000,
      // Items 2-5 empty
      '', '', '', '', '', '', '', '', '', '', '',
      '', '', '', '', '', '', '', '', '', '', '',
      '', '', '', '', '', '', '', '', '', '', '',
      '', '', '', '', '', '', '', '', '', '', '',
      ...PROJECT44_ACCESSORIALS.map(acc => 
        ['LGPU', 'RESDEL', 'NOTIFY'].includes(acc.code) ? true : false
      )
    ],
    // Row 6: Additional Project44 Volume LTL/Dual Mode Example
    [
      '2025-02-20', '33101', '98101', 18, 28000, true, false,
      'AMBIENT', '', false, '92.5', '111222', '05', 'Bulk Consumer Goods', 'CONSUMER', 'PLT', 18, 36, 'IN', 'LB', 45000, 4500, 'CONSUMER456', 'US',
      false, '', '', '', '', '', '', '',
      '2025-02-21', '08:00', '20:00', '06:00', '18:00',
      '3000 Warehouse Dr', 'Miami', 'FL', 'US', '4000 Distribution Ave', 'Seattle', 'WA', 'US',
      'Warehouse Manager', '555-WAREHOUSE-789', 'warehouse@consumer.com', 'Consumer Goods Co', 'Distribution Manager', '555-DISTRIBUTION-012', 'distribution@retail.com', 'Retail Distribution Inc',
      'USD', 'PREPAID', 'SHIPPER', 'IMPERIAL', true, true, true, true, true, true, 50, 40,
      // Large consumer goods shipment - routed to both Volume LTL AND Standard LTL for comparison
      'Household Appliances', 15000, '92.5', 60, 48, 72, 'PLT', 10, true, '111222', 25000,
      'Furniture Components', 8000, '100', 72, 36, 48, 'PLT', 5, false, '222333', 12000,
      'Electronics Accessories', 5000, '85', 48, 40, 36, 'PLT', 3, true, '333444', 8000,
      // Items 4-5 empty
      '', '', '', '', '', '', '', '', '', '', '',
      '', '', '', '', '', '', '', '', '', '', '',
      ...PROJECT44_ACCESSORIALS.map(acc => 
        ['LGPU', 'NOTIFY', 'RESDEL'].includes(acc.code) ? true : false
      )
    ]
  ];
  
  // Create main worksheet
  const mainWsData = [allHeaders, ...sampleData];
  const mainWs = XLSX.utils.aoa_to_sheet(mainWsData);
  
  // Set column widths - base columns get normal width, item columns get medium width, accessorial columns get smaller width
  const colWidths = [
    // Core fields
    { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 10 },
    // Enhanced fields (removed packageLength/Width/Height)
    { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 15 },
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 10 },
    { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
    // Hazmat fields
    { wch: 8 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 25 }, { wch: 20 }, { wch: 15 }, { wch: 20 },
    // Timing fields
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
    // Address fields
    { wch: 20 }, { wch: 15 }, { wch: 8 }, { wch: 8 }, { wch: 20 }, { wch: 15 }, { wch: 8 }, { wch: 8 },
    // Contact fields
    { wch: 20 }, { wch: 15 }, { wch: 25 }, { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 25 }, { wch: 20 },
    // API config fields
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
    { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 15 },
    // Item columns (5 items × 11 fields each = 55 columns)
    ...Array(55).fill({ wch: 12 }),
    // All accessorial columns get smaller width
    ...PROJECT44_ACCESSORIALS.map(() => ({ wch: 8 }))
  ];
  
  mainWs['!cols'] = colWidths;
  
  XLSX.utils.book_append_sheet(workbook, mainWs, 'RFQ Data');
  
  // Create multi-item instructions sheet
  const multiItemHeaders = ['Feature', 'Description', 'Example'];
  const multiItemData = [
    ['Itemized-Only Approach', 'ALL dimensions use item1_, item2_, etc. format - no legacy fields', 'item1_packageLength=48, item1_packageWidth=40'],
    ['Single Item Shipments', 'Use only item1_ fields, leave item2-5 blank', 'item1_description="Standard Pallets", item1_totalWeight=2500'],
    ['Multi-Item Shipments', 'Use item1_, item2_, etc. for different items', 'item1_=servers, item2_=switches, item3_=cables'],
    ['Required Item Fields', 'description, totalWeight, freightClass, packageLength/Width/Height', 'All item1_ required fields must be filled'],
    ['Dimensions Per Item', 'Each item has unique length, width, height', 'item1_packageLength=60, item2_packageLength=24'],
    ['Weight Distribution', 'grossWeight = sum of all item weights', 'grossWeight=5000 = item1_totalWeight(3000) + item2_totalWeight(2000)'],
    ['Package Types Per Item', 'Each item can be PLT, BOX, CRATE, etc.', 'item1_packageType=PLT, item2_packageType=BOX'],
    ['Freight Classes Per Item', 'Each item can have different freight class', 'item1_freightClass=70, item2_freightClass=85'],
    ['Stackability Per Item', 'TRUE/FALSE for each item individually', 'item1_stackable=TRUE, item2_stackable=FALSE'],
    ['Empty Items', 'Leave unused item fields completely blank', 'For 2 items: fill item1_ and item2_, leave item3-5 blank']
  ];
  
  const multiItemWsData = [multiItemHeaders, ...multiItemData];
  const multiItemWs = XLSX.utils.aoa_to_sheet(multiItemWsData);
  multiItemWs['!cols'] = [{ wch: 25 }, { wch: 50 }, { wch: 40 }];
  
  XLSX.utils.book_append_sheet(workbook, multiItemWs, 'Itemized-Only Guide');
  
  // Create comprehensive field reference sheet
  const fieldHeaders = ['Field Name', 'Description', 'Type', 'Required', 'Example Values'];
  const fieldData = [
    ['fromDate', 'Pickup date', 'Date (YYYY-MM-DD)', 'Yes', '2025-02-15'],
    ['fromZip', 'Origin ZIP code', 'String (5 digits)', 'Yes', '60607'],
    ['toZip', 'Destination ZIP code', 'String (5 digits)', 'Yes', '30033'],
    ['pallets', 'Number of pallets', 'Integer', 'Yes', '3'],
    ['grossWeight', 'Total weight in pounds', 'Integer', 'Yes', '2500'],
    ['isStackable', 'Can pallets be stacked', 'Boolean', 'Yes', 'TRUE/FALSE'],
    ['isReefer', 'Route to FreshX reefer network', 'Boolean', 'Yes', 'TRUE/FALSE'],
    ['item1_description', 'Description of first item', 'String', 'If using items', 'Electronics Equipment'],
    ['item1_totalWeight', 'Weight of first item', 'Number', 'If using items', '1500'],
    ['item1_freightClass', 'Freight class of first item', 'String', 'If using items', '70'],
    ['item1_packageLength', 'Length of first item (inches)', 'Number', 'If using items', '48'],
    ['item1_packageWidth', 'Width of first item (inches)', 'Number', 'If using items', '40'],
    ['item1_packageHeight', 'Height of first item (inches)', 'Number', 'If using items', '60'],
    ['item1_packageType', 'Package type of first item', 'String', 'If using items', 'PLT/BOX/CRATE'],
    ['item1_stackable', 'Can first item be stacked', 'Boolean', 'If using items', 'TRUE/FALSE'],
    ['item2_description', 'Description of second item', 'String', 'If using items', 'Small Components'],
    ['item2_totalWeight', 'Weight of second item', 'Number', 'If using items', '1000'],
    ['temperature', 'Temperature requirement', 'String', 'No', 'AMBIENT/CHILLED/FROZEN'],
    ['freightClass', 'Default freight class (if no items)', 'String', 'No', '70/85/92.5/etc'],
    ['packageType', 'Default package type (if no items)', 'String', 'No', 'PLT/BOX/CRATE/etc'],
    ['originCity', 'Origin city name', 'String', 'No', 'Chicago'],
    ['destinationCity', 'Destination city name', 'String', 'No', 'Atlanta'],
    ['pickupContactName', 'Pickup contact person', 'String', 'No', 'John Smith'],
    ['deliveryContactName', 'Delivery contact person', 'String', 'No', 'Jane Doe'],
    ['totalLinearFeet', 'Linear feet (for VLTL)', 'Integer', 'No', '30']
  ];
  
  const fieldWsData = [fieldHeaders, ...fieldData];
  const fieldWs = XLSX.utils.aoa_to_sheet(fieldWsData);
  fieldWs['!cols'] = [
    { wch: 25 }, { wch: 40 }, { wch: 20 }, { wch: 15 }, { wch: 30 }
  ];
  
  XLSX.utils.book_append_sheet(workbook, fieldWs, 'Field Reference');
  
  // Create smart routing guide sheet with all 3 modes
  const routingHeaders = ['Row #', 'Mode', 'isReefer', 'Temperature', 'Pallets', 'Weight (lbs)', 'Expected Routing', 'Reasoning'];
  const routingData = [
    ['1', 'FreshX Reefer', 'TRUE', 'CHILLED', '3', '2,500', 'FreshX Reefer Network Only', 'isReefer=TRUE routes to refrigerated network'],
    ['2', 'Project44 Standard', 'FALSE', 'AMBIENT', '5', '4,500', 'Project44 Standard LTL Only', 'isReefer=FALSE, small shipment (< 10 pallets, < 15K lbs)'],
    ['3', 'Project44 Volume/Dual', 'FALSE', 'AMBIENT', '15', '22,000', 'Project44 Volume LTL + Standard LTL', 'isReefer=FALSE, large shipment (≥ 10 pallets OR ≥ 15K lbs)'],
    ['4', 'FreshX Reefer', 'TRUE', 'FROZEN', '8', '12,000', 'FreshX Reefer Network Only', 'isReefer=TRUE routes to frozen network'],
    ['5', 'Project44 Standard', 'FALSE', 'AMBIENT', '2', '1,800', 'Project44 Standard LTL Only', 'isReefer=FALSE, small shipment'],
    ['6', 'Project44 Volume/Dual', 'FALSE', 'AMBIENT', '18', '28,000', 'Project44 Volume LTL + Standard LTL', 'isReefer=FALSE, large shipment (both conditions met)'],
    ['', '', '', '', '', '', '', ''],
    ['Summary', 'Mode Classification Rules', '', '', '', '', '', ''],
    ['', 'isReefer = TRUE', '→', 'FreshX Reefer', 'Any size', 'Any weight', 'Temperature-controlled network', 'Specialized reefer carriers'],
    ['', 'isReefer = FALSE + Small', '→', 'Project44 Standard', '1-9 pallets', '< 15,000 lbs', 'Standard LTL only', 'Regular freight network'],
    ['', 'isReefer = FALSE + Large', '→', 'Project44 Dual Mode', '≥ 10 pallets OR', '≥ 15,000 lbs', 'Both Volume LTL AND Standard LTL', 'Compares both modes for best pricing']
  ];
  
  const routingWsData = [routingHeaders, ...routingData];
  const routingWs = XLSX.utils.aoa_to_sheet(routingWsData);
  
  // Set column widths for routing guide
  routingWs['!cols'] = [
    { wch: 8 }, { wch: 20 }, { wch: 10 }, { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 30 }, { wch: 35 }
  ];
  
  XLSX.utils.book_append_sheet(workbook, routingWs, 'Smart Routing Guide');
  
  // Create accessorial reference sheet
  const project44AccessorialHeaders = ['Code', 'Description', 'Column Position'];
  const accessorialData = PROJECT44_ACCESSORIALS.map((acc, index) => [
    acc.code,
    acc.label,
    `Column ${String.fromCharCode(75 + baseHeaders.length + 55 + index)}` // After all base headers + 55 item columns
  ]);
  
  const accessorialWsData = [project44AccessorialHeaders, ...accessorialData];
  const accessorialWs = XLSX.utils.aoa_to_sheet(accessorialWsData);
  
  // Set column widths for accessorial reference sheet
  accessorialWs['!cols'] = [
    { wch: 15 }, { wch: 40 }, { wch: 15 }
  ];
  
  XLSX.utils.book_append_sheet(workbook, accessorialWs, 'Accessorial Reference');
  
  // Create comprehensive instructions sheet
  const instructionsData = [
    ['3-Mode Smart Routing Template - All Networks Demonstrated'],
    [''],
    ['🧠 ALL 3 SMART ROUTING MODES DEMONSTRATED'],
    ['This template demonstrates all 3 routing modes with actual example data:'],
    [''],
    ['📊 MODE EXAMPLES IN THIS TEMPLATE:'],
    [''],
    ['🌡️ MODE 1: FreshX Reefer Network (Rows 1 & 4)'],
    ['• isReefer = TRUE → Routes to FreshX reefer network'],
    ['• Row 1: Chilled dairy products (CHILLED temperature)'],
    ['• Row 4: Frozen seafood products (FROZEN temperature)'],
    ['• Uses specialized refrigerated carriers'],
    [''],
    ['🚛 MODE 2: Project44 Standard LTL Only (Rows 2 & 5)'],
    ['• isReefer = FALSE + Small shipments → Project44 Standard LTL'],
    ['• Row 2: 5 pallets, 4,500 lbs electronics (small shipment)'],
    ['• Row 5: 2 pallets, 1,800 lbs precision instruments (small shipment)'],
    ['• Uses regular LTL network for smaller shipments'],
    [''],
    ['📦 MODE 3: Project44 Volume LTL + Standard LTL Dual Mode (Rows 3 & 6)'],
    ['• isReefer = FALSE + Large shipments → Both Volume LTL AND Standard LTL'],
    ['• Row 3: 15 pallets, 22,000 lbs heavy machinery (large shipment)'],
    ['• Row 6: 18 pallets, 28,000 lbs consumer goods (large shipment)'],
    ['• Gets quotes from BOTH networks for price comparison'],
    [''],
    ['🎯 SIZE THRESHOLDS FOR ROUTING:'],
    [''],
    ['Small Shipments (Project44 Standard LTL only):'],
    ['• 1-9 pallets AND less than 15,000 lbs'],
    ['• Gets Standard LTL quotes only'],
    [''],
    ['Large Shipments (Project44 Dual Mode):'],
    ['• 10+ pallets OR 15,000+ lbs (either condition triggers)'],
    ['• Gets BOTH Volume LTL AND Standard LTL quotes'],
    ['• Allows side-by-side comparison of both modes'],
    [''],
    ['🌡️ REEFER OVERRIDE:'],
    ['• isReefer = TRUE always routes to FreshX regardless of size'],
    ['• Supports both CHILLED and FROZEN temperatures'],
    ['• Uses specialized temperature-controlled carriers'],
    [''],
    ['• ALL dimensions use item1_, item2_, etc. format for consistency'],
    [''],
    ['📦 ITEMIZED-ONLY STRUCTURE:'],
    [''],
    ['✅ WHAT WE USE (Itemized Fields):'],
    ['• item1_packageLength, item1_packageWidth, item1_packageHeight'],
    ['• item2_packageLength, item2_packageWidth, item2_packageHeight'],
    ['• item3_packageLength, item3_packageWidth, item3_packageHeight'],
    ['• etc. for up to 5 items'],
    [''],
    ['❌ WHAT WE REMOVED (Legacy Fields):'],
    ['• packageLength, packageWidth, packageHeight (removed)'],
    ['• These caused confusion with itemized approach'],
    [''],
    ['🏗️ ITEM FIELD STRUCTURE (Required for each item):'],
    [''],
    ['For each item (1-5), use these field patterns:'],
    ['• item1_description: "Electronics Equipment" (required)'],
    ['• item1_totalWeight: 1500 (pounds, required)'],
    ['• item1_freightClass: "70" (required)'],
    ['• item1_packageLength: 48 (inches, required)'],
    ['• item1_packageWidth: 40 (inches, required)'],
    ['• item1_packageHeight: 60 (inches, required)'],
    ['• item1_packageType: "PLT" (optional)'],
    ['• item1_totalPackages: 2 (optional)'],
    ['• item1_stackable: TRUE/FALSE (optional)'],
    ['• item1_nmfcItemCode: "123456" (optional)'],
    ['• item1_totalValue: 5000 (optional)'],
    [''],
    ['🧪 TESTING ALL 3 MODES:'],
    [''],
    ['Row 1 - FreshX Reefer Test:'],
    ['• isReefer: TRUE'],
    ['• Temperature: CHILLED'],
    ['• Expected: Routes to FreshX reefer network'],
    ['• Result: Specialized refrigerated carriers'],
    [''],
    ['Row 2 - Project44 Standard LTL Test:'],
    ['• isReefer: FALSE'],
    ['• Pallets: 5 (small)'],
    ['• Weight: 4,500 lbs (small)'],
    ['• Expected: Routes to Project44 Standard LTL only'],
    ['• Result: Regular LTL quotes'],
    [''],
    ['Row 3 - Project44 Dual Mode Test:'],
    ['• isReefer: FALSE'],
    ['• Pallets: 15 (large - triggers dual mode)'],
    ['• Weight: 22,000 lbs (large - triggers dual mode)'],
    ['• Expected: Routes to BOTH Volume LTL AND Standard LTL'],
    ['• Result: Side-by-side comparison of both modes'],
    [''],
    ['Row 4-6 - Additional Mode Examples:'],
    ['• Row 4: FreshX Frozen (FROZEN temperature)'],
    ['• Row 5: Project44 Standard (2 pallets, 1,800 lbs)'],
    ['• Row 6: Project44 Dual (18 pallets, 28,000 lbs)'],
    [''],
    ['⚖️ WEIGHT VALIDATION:'],
    [''],
    ['The system validates that:'],
    ['• grossWeight = sum of all item weights'],
    ['• Each item has a valid weight > 0'],
    ['• Total weight is reasonable for the number of pallets'],
    ['• If validation fails, you\'ll get a clear error message'],
    [''],
    ['🔄 PROCESSING WORKFLOW:'],
    ['1. Upload this 3-mode template to Smart Routing Processor'],
    ['2. System validates all item fields and dimensions'],
    ['3. Smart routing analyzes each row:'],
    ['   • FreshX: Routes temperature-controlled shipments'],
    ['   • Project44 Standard: Routes small dry goods shipments'],
    ['   • Project44 Dual: Routes large shipments to both networks'],
    ['4. For dual mode: Gets both Volume LTL AND Standard LTL quotes'],
    ['5. Each item contributes to total linear feet and cubic volume'],
    ['6. Returns detailed quotes with full Project44 API response data'],
    ['7. Displays side-by-side comparison for dual mode shipments'],
    [''],
    ['💡 BEST PRACTICES:'],
    ['• Always use itemized fields (item1_, item2_, etc.) for dimensions'],
    ['• Provide accurate dimensions for each item type'],
    ['• Use appropriate freight classes for each item'],
    ['• Specify stackability for each item individually'],
    ['• Include detailed descriptions for better handling'],
    ['• Ensure total weight equals sum of all item weights'],
    ['• Use consistent units (inches for dimensions, pounds for weight)'],
    ['• Leave unused item fields completely blank'],
    ['• Test all 3 modes using the provided examples'],
    [''],
    ['⚠️ IMPORTANT NOTES:'],
    ['• NO legacy packageLength/Width/Height fields - use ONLY itemized approach'],
    ['• For single items: use item1_ fields, leave item2-5 blank'],
    ['• For multiple items: use item1_, item2_, etc. as needed'],
    ['• Each item can have different freight classes and package types'],
    ['• System automatically calculates total cubic volume from all items'],
    ['• Linear feet calculation considers all item dimensions'],
    ['• Stackability is evaluated per item, not per shipment'],
    ['• Mixed freight classes may affect overall pricing'],
    ['• isReefer field is the PRIMARY routing control'],
    ['• Size thresholds only apply when isReefer=FALSE'],
    [''],
    ['🎯 EXPECTED RESULTS BY MODE:'],
    [''],
    ['FreshX Reefer (isReefer=TRUE):'],
    ['• Routes to specialized refrigerated carriers'],
    ['• Supports both CHILLED and FROZEN temperatures'],
    ['• Uses temperature-controlled logistics network'],
    ['• Optimized for food safety and cold chain integrity'],
    [''],
    ['Project44 Standard LTL (small shipments):'],
    ['• Routes to regular LTL network'],
    ['• Cost-effective for smaller shipments'],
    ['• Standard transit times and service levels'],
    ['• Efficient for typical freight loads'],
    [''],
    ['Project44 Dual Mode (large shipments):'],
    ['• Gets quotes from BOTH Volume LTL AND Standard LTL'],
    ['• Allows direct comparison of both modes'],
    ['• Shows potential savings from volume discounts'],
    ['• Helps optimize shipping decisions for large loads'],
    [''],
    ['All modes provide:'],
    ['• Accurate cubic calculations based on actual item dimensions'],
    ['• Proper freight class handling for mixed-class shipments'],
    ['• Optimized loading and space utilization'],
    ['• Detailed breakdown of charges per item when available'],
    ['• Enhanced carrier selection based on item-specific requirements'],
    ['• Improved transit time estimates considering all items'],
    ['• Consistent field structure across all shipment types'],
    ['• Smart routing based on shipment characteristics']
  ];
  
  const instructionsWs = XLSX.utils.aoa_to_sheet(instructionsData);
  instructionsWs['!cols'] = [{ wch: 80 }];
  
  XLSX.utils.book_append_sheet(workbook, instructionsWs, 'Instructions');
  
  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
};

export const downloadProject44ExcelTemplate = () => {
  console.log('Generating 3-Mode Smart Routing Excel template with all network demonstrations...');
  const excelBuffer = generateUnifiedSmartTemplate();
  const blob = new Blob([excelBuffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = '3-mode-smart-routing-template.xlsx';
  link.style.display = 'none';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
  console.log('3-Mode Smart Routing template download initiated');
};

export const generateHeadersOnlyTemplate = (): ArrayBuffer => {
  const workbook = XLSX.utils.book_new();
  
  // Create comprehensive headers - ONLY headers, no sample data
  const baseHeaders = [
    // Core required fields
    'fromDate',
    'fromZip', 
    'toZip',
    'pallets',
    'grossWeight',
    'isStackable',
    'isReefer',
    
    // Enhanced shipment details
    'temperature',
    'commodity',
    'isFoodGrade',
    'freightClass',
    'nmfcCode',
    'nmfcSubCode',
    'commodityDescription',
    'commodityType',
    'packageType',
    'totalPackages',
    'totalPieces',
    'lengthUnit',
    'weightUnit',
    'totalValue',
    'insuranceAmount',
    'harmonizedCode',
    'countryOfManufacture',
    
    // Hazmat information
    'hazmat',
    'hazmatClass',
    'hazmatIdNumber',
    'hazmatPackingGroup',
    'hazmatProperShippingName',
    'emergencyContactName',
    'emergencyContactPhone',
    'emergencyContactCompany',
    
    // Timing and delivery windows
    'deliveryDate',
    'deliveryStartTime',
    'deliveryEndTime',
    'pickupStartTime',
    'pickupEndTime',
    
    // Address details
    'originAddressLines',
    'originCity',
    'originState',
    'originCountry',
    'destinationAddressLines',
    'destinationCity',
    'destinationState',
    'destinationCountry',
    
    // Contact information
    'pickupContactName',
    'pickupContactPhone',
    'pickupContactEmail',
    'pickupCompanyName',
    'deliveryContactName',
    'deliveryContactPhone',
    'deliveryContactEmail',
    'deliveryCompanyName',
    
    // API configuration
    'preferredCurrency',
    'paymentTerms',
    'direction',
    'preferredSystemOfMeasurement',
    'allowUnacceptedAccessorials',
    'fetchAllGuaranteed',
    'fetchAllInsideDelivery',
    'fetchAllServiceLevels',
    'enableUnitConversion',
    'fallBackToDefaultAccountGroup',
    'apiTimeout',
    'totalLinearFeet',
    
    // Multi-item support - up to 5 items with different dimensions
    // Item 1
    'item1_description',
    'item1_totalWeight',
    'item1_freightClass',
    'item1_packageLength',
    'item1_packageWidth',
    'item1_packageHeight',
    'item1_packageType',
    'item1_totalPackages',
    'item1_stackable',
    'item1_nmfcItemCode',
    'item1_totalValue',
    
    // Item 2
    'item2_description',
    'item2_totalWeight',
    'item2_freightClass',
    'item2_packageLength',
    'item2_packageWidth',
    'item2_packageHeight',
    'item2_packageType',
    'item2_totalPackages',
    'item2_stackable',
    'item2_nmfcItemCode',
    'item2_totalValue',
    
    // Item 3
    'item3_description',
    'item3_totalWeight',
    'item3_freightClass',
    'item3_packageLength',
    'item3_packageWidth',
    'item3_packageHeight',
    'item3_packageType',
    'item3_totalPackages',
    'item3_stackable',
    'item3_nmfcItemCode',
    'item3_totalValue',
    
    // Item 4
    'item4_description',
    'item4_totalWeight',
    'item4_freightClass',
    'item4_packageLength',
    'item4_packageWidth',
    'item4_packageHeight',
    'item4_packageType',
    'item4_totalPackages',
    'item4_stackable',
    'item4_nmfcItemCode',
    'item4_totalValue',
    
    // Item 5
    'item5_description',
    'item5_totalWeight',
    'item5_freightClass',
    'item5_packageLength',
    'item5_packageWidth',
    'item5_packageHeight',
    'item5_packageType',
    'item5_totalPackages',
    'item5_stackable',
    'item5_nmfcItemCode',
    'item5_totalValue'
  ];
  
  // Add each Project44 accessorial as its own column
  const accessorialHeaders = PROJECT44_ACCESSORIALS.map(acc => acc.code);
  const allHeaders = [...baseHeaders, ...accessorialHeaders];
  
  // Create main worksheet with ONLY headers (no sample data)
  const mainWsData = [allHeaders];
  const mainWs = XLSX.utils.aoa_to_sheet(mainWsData);
  
  // Set column widths - base columns get normal width, item columns get medium width, accessorial columns get smaller width
  const colWidths = [
    // Core fields
    { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 10 },
    // Enhanced fields
    { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 15 },
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 10 },
    { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
    // Hazmat fields
    { wch: 8 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 25 }, { wch: 20 }, { wch: 15 }, { wch: 20 },
    // Timing fields
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
    // Address fields
    { wch: 20 }, { wch: 15 }, { wch: 8 }, { wch: 8 }, { wch: 20 }, { wch: 15 }, { wch: 8 }, { wch: 8 },
    // Contact fields
    { wch: 20 }, { wch: 15 }, { wch: 25 }, { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 25 }, { wch: 20 },
    // API config fields
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
    { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 15 },
    // Item columns (5 items × 11 fields each = 55 columns)
    ...Array(55).fill({ wch: 12 }),
    // All accessorial columns get smaller width
    ...PROJECT44_ACCESSORIALS.map(() => ({ wch: 8 }))
  ];
  
  mainWs['!cols'] = colWidths;
  
  XLSX.utils.book_append_sheet(workbook, mainWs, 'RFQ Data');
  
  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
};

export const downloadHeadersOnlyTemplate = () => {
  console.log('Generating headers-only template...');
  const excelBuffer = generateHeadersOnlyTemplate();
  const blob = new Blob([excelBuffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = 'rfq-headers-only-template.xlsx';
  link.style.display = 'none';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
  console.log('Headers-only template download initiated');
};

// Legacy functions for backward compatibility
export const downloadFreshXExcelTemplate = downloadProject44ExcelTemplate;
export const downloadFreshXTemplate = downloadProject44ExcelTemplate;
export const downloadProject44Template = downloadProject44ExcelTemplate;
export const downloadTemplateFile = downloadProject44ExcelTemplate;

export const generateFreshXTemplateCSV = (): string => {
  const headers = [
    'fromDate',
    'fromZip',
    'toZip',
    'pallets',
    'grossWeight',
    'temperature',
    'commodity',
    'isFoodGrade',
    'isStackable',
    'isReefer',
    'accessorial'
  ];

  const sampleData = [
    {
      fromDate: '2025-02-15',
      fromZip: '60607',
      toZip: '30033',
      pallets: 2,
      grossWeight: 2000,
      temperature: 'CHILLED',
      commodity: 'FOODSTUFFS',
      isFoodGrade: true,
      isStackable: false,
      isReefer: true,
      accessorial: ['LIFTGATE_DROPOFF']
    },
    {
      fromDate: '2025-02-16',
      fromZip: '90210',
      toZip: '10001',
      pallets: 5,
      grossWeight: 5000,
      temperature: 'FROZEN',
      commodity: 'ICE_CREAM',
      isFoodGrade: true,
      isStackable: true,
      isReefer: true,
      accessorial: ['DRIVER_LOADING_PICKUP', 'INSIDE_DELIVERY_DROPOFF']
    },
    {
      fromDate: '2025-02-17',
      fromZip: '33101',
      toZip: '75201',
      pallets: 1,
      grossWeight: 800,
      temperature: 'AMBIENT',
      commodity: 'PRODUCE',
      isFoodGrade: false,
      isStackable: true,
      isReefer: false,
      accessorial: []
    }
  ];

  const csvContent = [
    headers.join(','),
    ...sampleData.map(row => [
      row.fromDate,
      row.fromZip,
      row.toZip,
      row.pallets,
      row.grossWeight,
      row.temperature,
      row.commodity,
      row.isFoodGrade,
      row.isStackable,
      row.isReefer,
      Array.isArray(row.accessorial) ? row.accessorial.join(';') : ''
    ].join(','))
  ].join('\n');

  return csvContent;
};

export const generateProject44TemplateCSV = (): string => {
  const headers = [
    'fromDate',
    'fromZip',
    'toZip',
    'pallets',
    'grossWeight',
    'isStackable',
    'isReefer',
    'accessorial'
  ];

  const sampleData = [
    {
      fromDate: '2025-02-15',
      fromZip: '60607',
      toZip: '30033',
      pallets: 2,
      grossWeight: 2000,
      isStackable: false,
      isReefer: false,
      accessorial: ['LGDEL', 'APPTDEL']
    },
    {
      fromDate: '2025-02-16',
      fromZip: '90210',
      toZip: '10001',
      pallets: 5,
      grossWeight: 5000,
      isStackable: true,
      isReefer: false,
      accessorial: ['INPU', 'INDEL', 'RESPU']
    },
    {
      fromDate: '2025-02-17',
      fromZip: '33101',
      toZip: '75201',
      pallets: 1,
      grossWeight: 800,
      isStackable: true,
      isReefer: true,
      accessorial: ['LTDPU', 'SATDEL']
    },
    {
      fromDate: '2025-02-18',
      fromZip: '10001',
      toZip: '90210',
      pallets: 3,
      grossWeight: 3500,
      isStackable: false,
      isReefer: false,
      accessorial: ['LGPU', 'LGDEL', 'NOTIFY']
    }
  ];

  const csvContent = [
    headers.join(','),
    ...sampleData.map(row => [
      row.fromDate,
      row.fromZip,
      row.toZip,
      row.pallets,
      row.grossWeight,
      row.isStackable,
      row.isReefer,
      Array.isArray(row.accessorial) ? row.accessorial.join(';') : ''
    ].join(','))
  ].join('\n');

  return csvContent;
};