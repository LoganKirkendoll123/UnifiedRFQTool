import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { RFQRow, LineItemData } from '../types';

// US State abbreviations mapping
const stateAbbreviations: { [key: string]: string } = {
  'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR', 'california': 'CA',
  'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE', 'florida': 'FL', 'georgia': 'GA',
  'hawaii': 'HI', 'idaho': 'ID', 'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA',
  'kansas': 'KS', 'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
  'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS', 'missouri': 'MO',
  'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
  'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH',
  'oklahoma': 'OK', 'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT', 'vermont': 'VT',
  'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV', 'wisconsin': 'WI', 'wyoming': 'WY',
  'american samoa': 'AS', 'district of columbia': 'DC', 'federated states of micronesia': 'FM',
  'guam': 'GU', 'marshall islands': 'MH', 'northern mariana islands': 'MP', 'palau': 'PW',
  'puerto rico': 'PR', 'virgin islands': 'VI'
};

const validStateAbbreviations = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA',
  'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT',
  'VA', 'WA', 'WV', 'WI', 'WY', 'AS', 'DC', 'FM', 'GU', 'MH', 'MP', 'PW', 'PR', 'VI'
]);

// Project44 LTL/VLTL accessorial codes
const PROJECT44_ACCESSORIAL_CODES = [
  'AIRPU', 'APPTPU', 'CAMPPU', 'CFSPU', 'CHRCPU', 'CLUBPU', 'CNVPU', 'CONPU', 'DOCKPU', 'EDUPU',
  'FARMPU', 'GOVPU', 'GROPU', 'HOSPU', 'HOTLPU', 'INPU', 'LGPU', 'LTDPU', 'MILPU', 'MINEPU',
  'NARPU', 'NBPU', 'NURSPU', 'PARKPU', 'PIERPU', 'PRISPU', 'RESPU', 'SATPU', 'SORTPU', 'SSTORPU', 'UTLPU',
  'AIRDEL', 'APPT', 'CAMPDEL', 'CFSDEL', 'CHRCDEL', 'CLUBDEL', 'CNVDEL', 'CONDEL', 'DCDEL',
  'DOCKDEL', 'EDUDEL', 'FARMDEL', 'GOVDEL', 'GRODEL', 'HDAYDEL', 'HOSDEL', 'HOTLDEL', 'INDEL', 'INEDEL',
  'INGDEL', 'INNEDEL', 'LGDEL', 'LTDDEL', 'MALLDEL', 'MILDEL', 'MINEDEL', 'NARDEL', 'NBDEL', 'NCDEL',
  'NOTIFY', 'NURSDEL', 'PARKDEL', 'PIERDEL', 'PRISDEL', 'RESDEL', 'RSRTDEL', 'SATDEL', 'SORTDEL',
  'SSTORDEL', 'SUNDEL', 'UNLOADDEL', 'UTLDEL', 'WEDEL'
];

// FreshX accessorial codes
const FRESHX_ACCESSORIAL_CODES = [
  'DRIVER_LOADING_PICKUP', 'DRIVER_LOADING_DROPOFF', 'INSIDE_DELIVERY_PICKUP', 'INSIDE_DELIVERY_DROPOFF',
  'LIFTGATE_PICKUP', 'LIFTGATE_DROPOFF', 'LIMITED_ACCESS_PICKUP', 'LIMITED_ACCESS_DROPOFF',
  'NIGHTTIME_DELIVERY_PICKUP', 'NIGHTTIME_DELIVERY_DROPOFF'
];

const convertToStateAbbreviation = (state: string): string => {
  if (!state) return '';
  
  const cleanState = state.trim();
  
  // If it's already a valid abbreviation, return it uppercase
  if (validStateAbbreviations.has(cleanState.toUpperCase())) {
    return cleanState.toUpperCase();
  }
  
  // Try to convert from full name to abbreviation
  const lowerState = cleanState.toLowerCase();
  if (stateAbbreviations[lowerState]) {
    return stateAbbreviations[lowerState];
  }
  
  // Return original if no conversion found
  return cleanState.toUpperCase();
};

const isValidStateAbbreviation = (state: string): boolean => {
  return validStateAbbreviations.has(state.toUpperCase());
};

const cleanPostalCode = (zip: string): string => {
  if (!zip) return '';
  
  // Remove any non-digit characters and get first 5 digits
  const cleaned = zip.replace(/\D/g, '');
  return cleaned.substring(0, 5);
};

export const parseCSV = (file: File, isProject44: boolean = false): Promise<RFQRow[]> => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim().toLowerCase().replace(/\s+/g, ''),
      transform: (value) => value.trim(),
      complete: (results) => {
        try {
          const parsed = results.data.map((row: any, index) => parseRow(row, index, isProject44));
          resolve(parsed);
        } catch (error) {
          reject(error);
        }
      },
      error: (error) => reject(error)
    });
  });
};

export const parseXLSX = (file: File, isProject44: boolean = false): Promise<RFQRow[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (jsonData.length < 2) {
          throw new Error('File must contain at least a header row and one data row');
        }
        
        const headers = (jsonData[0] as string[]).map(h => 
          h.toString().trim().toLowerCase().replace(/\s+/g, '')
        );
        
        const rows = jsonData.slice(1).map((row, index) => {
          const rowObject: any = {};
          headers.forEach((header, i) => {
            rowObject[header] = (row as any[])[i]?.toString().trim() || '';
          });
          return parseRow(rowObject, index, isProject44);
        });
        
        resolve(rows);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
};

const parseRow = (row: any, index: number, isProject44: boolean = false): RFQRow => {
  const errors: string[] = [];
  
  // Core required fields
  const fromDate = row.fromdate || row.pickupdate || row.date || '';
  const fromZip = cleanPostalCode(row.fromzip || row.pickupzip || row.originzip || '');
  const toZip = cleanPostalCode(row.tozip || row.deliveryzip || row.destinationzip || '');
  const pallets = parseInt(row.pallets || row.palletcount || '0');
  const grossWeight = parseInt(row.grossweight || row.weight || '0');
  const temperature = (row.temperature || '').toUpperCase();
  const commodity = (row.commodity || '').toUpperCase();
  const isFoodGrade = parseBoolean(row.isfoodgrade || row.foodgrade || 'false');
  const isStackable = parseBoolean(row.isstackable || row.stackable || 'false');
  
  // NEW: Parse isReefer field for smart routing
  const isReefer = parseBoolean(row.isreefer || row.reefer || 'false');
  
  // Parse accessorial services - check for both old format (single column) and new format (individual columns)
  let accessorial: string[] = [];
  
  // Check if there's a single accessorial column (legacy format)
  const legacyAccessorial = row.accessorial || row.accessories || '';
  if (legacyAccessorial) {
    accessorial = parseAccessorial(legacyAccessorial);
  } else {
    // New format: check individual accessorial columns
    const accessorialCodes = isProject44 ? PROJECT44_ACCESSORIAL_CODES : FRESHX_ACCESSORIAL_CODES;
    
    accessorialCodes.forEach(code => {
      const columnValue = row[code.toLowerCase()];
      if (parseBoolean(columnValue)) {
        accessorial.push(code);
      }
    });
  }
  
  // Enhanced Project44 fields
  const deliveryDate = row.deliverydate || '';
  const deliveryStartTime = row.deliverystarttime || '';
  const deliveryEndTime = row.deliveryendtime || '';
  const pickupStartTime = row.pickupstarttime || '';
  const pickupEndTime = row.pickupendtime || '';
  const freightClass = row.freightclass || '';
  const nmfcCode = row.nmfccode || '';
  const commodityDescription = row.commoditydescription || '';
  const totalValue = parseFloat(row.totalvalue || '0') || undefined;
  const insuranceAmount = parseFloat(row.insuranceamount || '0') || undefined;
  const hazmat = parseBoolean(row.hazmat || 'false');
  const hazmatClass = row.hazmatclass || '';
  const hazmatIdNumber = row.hazmatidnumber || '';
  const hazmatPackingGroup = row.hazmatpackinggroup || '';
  const hazmatProperShippingName = row.hazmatpropershippingname || '';
  const packageType = row.packagetype || '';
  const totalPackages = parseInt(row.totalpackages || '0') || undefined;
  const totalPieces = parseInt(row.totalpieces || '0') || undefined;
  
  // REMOVED: Legacy packageLength/Width/Height parsing - using ONLY itemized approach
  // const packageLength = parseFloat(row.packagelength || '0') || undefined;
  // const packageWidth = parseFloat(row.packagewidth || '0') || undefined;
  // const packageHeight = parseFloat(row.packageheight || '0') || undefined;
  
  const lengthUnit = row.lengthunit || '';
  const weightUnit = row.weightunit || '';
  const preferredCurrency = row.preferredcurrency || '';
  const paymentTerms = row.paymentterms || '';
  const direction = row.direction || '';
  const countryOfManufacture = row.countryofmanufacture || '';
  const harmonizedCode = row.harmonizedcode || '';
  const nmfcSubCode = row.nmfcsubcode || '';
  const commodityType = row.commoditytype || '';
  const preferredSystemOfMeasurement = row.preferredsystemofmeasurement || '';
  
  // Address details
  const originAddressLines = parseAddressLines(row.originaddresslines || '');
  const originCity = row.origincity || '';
  const originState = convertToStateAbbreviation(row.originstate || '');
  const originCountry = row.origincountry || '';
  const destinationAddressLines = parseAddressLines(row.destinationaddresslines || '');
  const destinationCity = row.destinationcity || '';
  const destinationState = convertToStateAbbreviation(row.destinationstate || '');
  const destinationCountry = row.destinationcountry || '';
  
  // Contact information
  const pickupContactName = row.pickupcontactname || '';
  const pickupContactPhone = row.pickupcontactphone || '';
  const pickupContactEmail = row.pickupcontactemail || '';
  const pickupCompanyName = row.pickupcompanyname || '';
  const deliveryContactName = row.deliverycontactname || '';
  const deliveryContactPhone = row.deliverycontactphone || '';
  const deliveryContactEmail = row.deliverycontactemail || '';
  const deliveryCompanyName = row.deliverycompanyname || '';
  
  // Emergency contact for hazmat
  const emergencyContactName = row.emergencycontactname || '';
  const emergencyContactPhone = row.emergencycontactphone || '';
  const emergencyContactCompany = row.emergencycontactcompany || '';
  
  // API Configuration options
  const allowUnacceptedAccessorials = parseBoolean(row.allowunacceptedaccessorials || 'true');
  const fetchAllGuaranteed = parseBoolean(row.fetchallguaranteed || 'true');
  const fetchAllInsideDelivery = parseBoolean(row.fetchallinsidedelivery || 'true');
  const fetchAllServiceLevels = parseBoolean(row.fetchallservicelevels || 'true');
  const enableUnitConversion = parseBoolean(row.enableunitconversion || 'true');
  const fallBackToDefaultAccountGroup = parseBoolean(row.fallbacktodefaultaccountgroup || 'true');
  const apiTimeout = parseInt(row.apitimeout || '30') || undefined;
  const totalLinearFeet = parseInt(row.totallinearfeet || '0') || undefined;
  
  // Parse multiple line items with different dimensions - ONLY itemized approach
  const lineItems = parseLineItems(row, index);
  
  // Validation
  if (!fromDate || !isValidDate(fromDate)) {
    errors.push('Invalid or missing fromDate');
  }
  if (!fromZip || !isValidZip(fromZip)) {
    errors.push('Invalid or missing fromZip');
  }
  if (!toZip || !isValidZip(toZip)) {
    errors.push('Invalid or missing toZip');
  }
  if (originState && !isValidStateAbbreviation(originState)) {
    errors.push(`Invalid origin state: ${originState}`);
  }
  if (destinationState && !isValidStateAbbreviation(destinationState)) {
    errors.push(`Invalid destination state: ${destinationState}`);
  }
  if (!pallets || pallets < 1 || pallets > 100) {
    errors.push('Pallets must be between 1 and 100');
  }
  if (!grossWeight || grossWeight < 1 || grossWeight > 100000) {
    errors.push('Gross weight must be between 1 and 100000');
  }
  
  // Validate that if line items exist, total weight matches
  if (lineItems.length > 0) {
    const itemTotalWeight = lineItems.reduce((sum, item) => sum + item.totalWeight, 0);
    if (Math.abs(grossWeight - itemTotalWeight) > 10) { // Allow 10 lb tolerance
      errors.push(`Gross weight (${grossWeight}) must equal sum of item weights (${itemTotalWeight})`);
    }
  }
  
  if (errors.length > 0) {
    throw new Error(`Row ${index + 1}: ${errors.join(', ')}`);
  }
  
  const result: RFQRow = {
    fromDate,
    fromZip,
    toZip,
    pallets,
    grossWeight,
    isStackable,
    accessorial,
    // Add the new isReefer field for smart routing
    isReefer
  };

  // Add optional fields only if they have values
  if (temperature) result.temperature = temperature as any;
  if (commodity) result.commodity = commodity as any;
  if (isFoodGrade !== undefined) result.isFoodGrade = isFoodGrade;
  if (deliveryDate) result.deliveryDate = deliveryDate;
  if (deliveryStartTime) result.deliveryStartTime = deliveryStartTime;
  if (deliveryEndTime) result.deliveryEndTime = deliveryEndTime;
  if (pickupStartTime) result.pickupStartTime = pickupStartTime;
  if (pickupEndTime) result.pickupEndTime = pickupEndTime;
  if (freightClass) result.freightClass = freightClass;
  if (nmfcCode) result.nmfcCode = nmfcCode;
  if (commodityDescription) result.commodityDescription = commodityDescription;
  if (totalValue) result.totalValue = totalValue;
  if (insuranceAmount) result.insuranceAmount = insuranceAmount;
  if (hazmat) result.hazmat = hazmat;
  if (hazmatClass) result.hazmatClass = hazmatClass;
  if (hazmatIdNumber) result.hazmatIdNumber = hazmatIdNumber;
  if (hazmatPackingGroup) result.hazmatPackingGroup = hazmatPackingGroup as any;
  if (hazmatProperShippingName) result.hazmatProperShippingName = hazmatProperShippingName;
  if (packageType) result.packageType = packageType as any;
  if (totalPackages) result.totalPackages = totalPackages;
  if (totalPieces) result.totalPieces = totalPieces;
  
  // REMOVED: Legacy dimension fields - using ONLY itemized approach
  // if (packageLength) result.packageLength = packageLength;
  // if (packageWidth) result.packageWidth = packageWidth;
  // if (packageHeight) result.packageHeight = packageHeight;
  
  if (lengthUnit) result.lengthUnit = lengthUnit as any;
  if (weightUnit) result.weightUnit = weightUnit as any;
  if (preferredCurrency) result.preferredCurrency = preferredCurrency as any;
  if (paymentTerms) result.paymentTerms = paymentTerms as any;
  if (direction) result.direction = direction as any;
  if (countryOfManufacture) result.countryOfManufacture = countryOfManufacture as any;
  if (harmonizedCode) result.harmonizedCode = harmonizedCode;
  if (nmfcSubCode) result.nmfcSubCode = nmfcSubCode;
  if (commodityType) result.commodityType = commodityType;
  if (preferredSystemOfMeasurement) result.preferredSystemOfMeasurement = preferredSystemOfMeasurement as any;
  
  // Address details
  if (originAddressLines.length > 0) result.originAddressLines = originAddressLines;
  if (originCity) result.originCity = originCity;
  if (originState) result.originState = originState;
  if (originCountry) result.originCountry = originCountry;
  if (destinationAddressLines.length > 0) result.destinationAddressLines = destinationAddressLines;
  if (destinationCity) result.destinationCity = destinationCity;
  if (destinationState) result.destinationState = destinationState;
  if (destinationCountry) result.destinationCountry = destinationCountry;
  
  // Contact information
  if (pickupContactName) result.pickupContactName = pickupContactName;
  if (pickupContactPhone) result.pickupContactPhone = pickupContactPhone;
  if (pickupContactEmail) result.pickupContactEmail = pickupContactEmail;
  if (pickupCompanyName) result.pickupCompanyName = pickupCompanyName;
  if (deliveryContactName) result.deliveryContactName = deliveryContactName;
  if (deliveryContactPhone) result.deliveryContactPhone = deliveryContactPhone;
  if (deliveryContactEmail) result.deliveryContactEmail = deliveryContactEmail;
  if (deliveryCompanyName) result.deliveryCompanyName = deliveryCompanyName;
  
  // Emergency contact for hazmat
  if (emergencyContactName) result.emergencyContactName = emergencyContactName;
  if (emergencyContactPhone) result.emergencyContactPhone = emergencyContactPhone;
  if (emergencyContactCompany) result.emergencyContactCompany = emergencyContactCompany;
  
  // API Configuration options
  if (allowUnacceptedAccessorials !== undefined) result.allowUnacceptedAccessorials = allowUnacceptedAccessorials;
  if (fetchAllGuaranteed !== undefined) result.fetchAllGuaranteed = fetchAllGuaranteed;
  if (fetchAllInsideDelivery !== undefined) result.fetchAllInsideDelivery = fetchAllInsideDelivery;
  if (fetchAllServiceLevels !== undefined) result.fetchAllServiceLevels = fetchAllServiceLevels;
  if (enableUnitConversion !== undefined) result.enableUnitConversion = enableUnitConversion;
  if (fallBackToDefaultAccountGroup !== undefined) result.fallBackToDefaultAccountGroup = fallBackToDefaultAccountGroup;
  if (apiTimeout) result.apiTimeout = apiTimeout;
  if (totalLinearFeet) result.totalLinearFeet = totalLinearFeet;
  
  // Add line items if parsed
  if (lineItems.length > 0) result.lineItems = lineItems;

  return result;
};

const parseLineItems = (row: any, rowIndex: number): LineItemData[] => {
  const lineItems: LineItemData[] = [];
  
  // Look for line item columns with pattern: item1_field, item2_field, etc.
  const itemPattern = /^item(\d+)_(.+)$/;
  const itemData: { [itemId: string]: any } = {};
  
  // Group all item fields by item number
  Object.keys(row).forEach(key => {
    const match = key.match(itemPattern);
    if (match) {
      const itemId = match[1];
      const fieldName = match[2];
      
      if (!itemData[itemId]) {
        itemData[itemId] = {};
      }
      itemData[itemId][fieldName] = row[key];
    }
  });
  
  // Convert grouped data to LineItemData objects
  Object.keys(itemData).forEach(itemId => {
    const item = itemData[itemId];
    
    // Required fields for line items
    const totalWeight = parseFloat(item.totalweight || item.weight || '0');
    const freightClass = item.freightclass || item.class || '';
    const packageLength = parseFloat(item.packagelength || item.length || '0');
    const packageWidth = parseFloat(item.packagewidth || item.width || '0');
    const packageHeight = parseFloat(item.packageheight || item.height || '0');
    
    // Skip if missing required fields
    if (!totalWeight || !freightClass || !packageLength || !packageWidth || !packageHeight) {
      console.log(`⚠️ Skipping item ${itemId} - missing required fields:`, {
        totalWeight,
        freightClass,
        packageLength,
        packageWidth,
        packageHeight
      });
      return;
    }
    
    const lineItem: LineItemData = {
      id: parseInt(itemId),
      totalWeight,
      freightClass,
      packageLength,
      packageWidth,
      packageHeight,
      description: item.description || '',
      packageType: item.packagetype as any,
      totalPackages: parseInt(item.totalpackages || '1') || 1,
      totalPieces: parseInt(item.totalpieces || '1') || 1,
      totalValue: parseFloat(item.totalvalue || '0') || undefined,
      insuranceAmount: parseFloat(item.insuranceamount || '0') || undefined,
      stackable: parseBoolean(item.stackable || 'false'),
      nmfcItemCode: item.nmfcitemcode || '',
      nmfcSubCode: item.nmfcsubcode || '',
      commodityType: item.commoditytype || '',
      countryOfManufacture: item.countryofmanufacture as any,
      harmonizedCode: item.harmonizedcode || '',
      hazmat: parseBoolean(item.hazmat || 'false'),
      hazmatClass: item.hazmatclass || '',
      hazmatIdNumber: item.hazmatidnumber || '',
      hazmatPackingGroup: item.hazmatpackinggroup as any,
      hazmatProperShippingName: item.hazmatpropershippingname || ''
    };
    
    console.log(`✅ Parsed item ${itemId}:`, {
      description: lineItem.description,
      totalWeight: lineItem.totalWeight,
      freightClass: lineItem.freightClass,
      dimensions: `${lineItem.packageLength}×${lineItem.packageWidth}×${lineItem.packageHeight}`
    });
    
    lineItems.push(lineItem);
  });
  
  // Sort by item ID
  lineItems.sort((a, b) => a.id - b.id);
  
  console.log(`📦 Parsed ${lineItems.length} line items for row ${rowIndex + 1}`);
  return lineItems;
};

const parseBoolean = (value: string): boolean => {
  if (!value) return false;
  return ['true', '1', 'yes', 'y'].includes(value.toLowerCase());
};

const parseAccessorial = (value: string): string[] => {
  if (!value) return [];
  // Handle comma, semicolon, and slash separators
  const accessorials = value.split(/[,;\/]/).map(s => s.trim().toUpperCase()).filter(Boolean);
  
  // Map common accessorial names to Project44 codes
  const accessorialMap: Record<string, string> = {
    'LIMITED ACCESS DELIVERY': 'LTDPU', // Use pickup version to avoid API errors
    'DELIVERY APPOINTMENT': 'NOTIFY', // Use notification instead of APPT/APPTDEL
    'LIFTGATE DELIVERY': 'LGPU', // Use pickup version to avoid API errors
    'RESIDENTIAL DELIVERY': 'RESDEL',
    'HAZMAT': 'HAZM',
    'LIFTGATE PICKUP': 'LGPU',
    'INSIDE DELIVERY': 'INDEL',
    'AIRPORT DELIVERY': 'AIRDEL',
    'LIMITED ACCESS PICKUP': 'LTDPU',
    'CONVENTION/TRADESHOW DELIVERY': 'CNVDEL',
    'RESIDENTIAL PICKUP': 'RESPU',
    'AIRPORT PICKUP': 'AIRPU',
    'CONVENTION/TRADESHOW PICKUP': 'CNVPU',
    'FARM DELIVERY': 'FARMDEL',
    'MILITARY INSTALLATION PICKUP': 'MILPU',
    'GROCERY WAREHOUSE DELIVERY': 'GRODEL',
    'PROTECT FROM FREEZING': 'PFZ',
    'PIER DELIVERY': 'PIERDEL',
    'INSIDE PICKUP': 'INPU',
    'GROCERY WAREHOUSE PICKUP': 'GROPU',
    'SORT/SEGREGATE DELIVERY': 'SORTDEL',
    'PIER PICKUP': 'PIERPU'
  };
  
  // Map excessive length codes
  const excessiveLengthMap: Record<string, string> = {
    'EXCESSIVE LENGTH, 8FT': 'ELS_8',
    'EXCESSIVE LENGTH, 9FT': 'ELS_9',
    'EXCESSIVE LENGTH, 10FT': 'ELS_10',
    'EXCESSIVE LENGTH, 11FT': 'ELS_11',
    'EXCESSIVE LENGTH, 12FT': 'ELS_12',
    'EXCESSIVE LENGTH, 13FT': 'ELS_13',
    'EXCESSIVE LENGTH, 14FT': 'ELS_14',
    'EXCESSIVE LENGTH, 15FT': 'ELS_15',
    'EXCESSIVE LENGTH, 16FT': 'ELS_16',
    'EXCESSIVE LENGTH, 17FT': 'ELS_17',
    'EXCESSIVE LENGTH, 18FT': 'ELS_18',
    'EXCESSIVE LENGTH, 19FT': 'ELS_19',
    'EXCESSIVE LENGTH, 20FT': 'ELS_20'
  };
  
  // Map accessorials to Project44 codes
  const mappedAccessorials = accessorials.map(acc => {
    // Check for excessive length first
    if (excessiveLengthMap[acc]) {
      return excessiveLengthMap[acc];
    }
    
    // Then check regular accessorials
    if (accessorialMap[acc]) {
      return accessorialMap[acc];
    }
    
    // If no mapping found, return as is
    return acc;
  });
  
  return mappedAccessorials;
};

const parseAddressLines = (value: string): string[] => {
  if (!value) return [];
  // Split by semicolon or pipe for multiple address lines
  return value.split(/[;|]/).map(s => s.trim()).filter(Boolean);
};

const isValidDate = (date: string): boolean => {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(date)) return false;
  const d = new Date(date);
  return d instanceof Date && !isNaN(d.getTime());
};

const isValidZip = (zip: string): boolean => {
  return /^\d{5}$/.test(zip) || /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/.test(zip.toUpperCase());
};