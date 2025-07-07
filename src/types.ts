export interface RFQRow {
  fromDate: string;
  fromZip: string;
  toZip: string;
  pallets: number;
  grossWeight: number;
  // Temperature and commodity only for FreshX
  temperature?: 'AMBIENT' | 'CHILLED' | 'FROZEN';
  commodity?: 'ALCOHOL' | 'FOODSTUFFS' | 'FRESH_SEAFOOD' | 'FROZEN_SEAFOOD' | 'ICE_CREAM' | 'PRODUCE';
  isFoodGrade?: boolean;
  isStackable: boolean;
  accessorial: string[];
  // NEW: Smart routing field - determines if shipment goes to FreshX (true) or Project44 (false)
  isReefer?: boolean;
  
  // Enhanced Project44 fields - following API spec exactly
  deliveryDate?: string;
  deliveryStartTime?: string;
  deliveryEndTime?: string;
  pickupStartTime?: string;
  pickupEndTime?: string;
  freightClass?: string;
  nmfcCode?: string;
  commodityDescription?: string;
  totalValue?: number;
  insuranceAmount?: number;
  hazmat?: boolean;
  hazmatClass?: string;
  hazmatIdNumber?: string;
  hazmatPackingGroup?: 'I' | 'II' | 'III' | 'NONE';
  hazmatProperShippingName?: string;
  packageType?: 'BAG' | 'BALE' | 'BOX' | 'BUCKET' | 'BUNDLE' | 'CAN' | 'CARTON' | 'CASE' | 'COIL' | 'CRATE' | 'CYLINDER' | 'DRUM' | 'PAIL' | 'PLT' | 'PIECES' | 'REEL' | 'ROLL' | 'SKID' | 'TOTE' | 'TUBE';
  totalPackages?: number;
  totalPieces?: number;
  // REMOVED: Legacy dimension fields - using ONLY itemized approach
  // packageLength?: number;
  // packageWidth?: number;
  // packageHeight?: number;
  lengthUnit?: 'IN' | 'CM' | 'FT' | 'M';
  weightUnit?: 'LB' | 'KG';
  preferredCurrency?: 'USD' | 'CAD' | 'MXN' | 'EUR';
  paymentTerms?: 'PREPAID' | 'COLLECT' | 'THIRD_PARTY';
  direction?: 'SHIPPER' | 'CONSIGNEE' | 'THIRD_PARTY';
  countryOfManufacture?: 'US' | 'CA' | 'MX';
  harmonizedCode?: string;
  nmfcSubCode?: string;
  commodityType?: string;
  preferredSystemOfMeasurement?: 'METRIC' | 'IMPERIAL';
  
  // Address details
  originAddressLines?: string[];
  originCity?: string;
  originState?: string;
  originCountry?: string;
  destinationAddressLines?: string[];
  destinationCity?: string;
  destinationState?: string;
  destinationCountry?: string;
  
  // Contact information
  pickupContactName?: string;
  pickupContactPhone?: string;
  pickupContactEmail?: string;
  pickupCompanyName?: string;
  deliveryContactName?: string;
  deliveryContactPhone?: string;
  deliveryContactEmail?: string;
  deliveryCompanyName?: string;
  
  // Emergency contact for hazmat
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactCompany?: string;
  
  // API Configuration options
  allowUnacceptedAccessorials?: boolean;
  fetchAllGuaranteed?: boolean;
  fetchAllInsideDelivery?: boolean;
  fetchAllServiceLevels?: boolean;
  enableUnitConversion?: boolean;
  fallBackToDefaultAccountGroup?: boolean;
  apiTimeout?: number;
  totalLinearFeet?: number;
  
  // Multi-item support with different dimensions - ONLY itemized approach
  lineItems?: LineItemData[];
  
  // Service level selection - kept for UI purposes but not sent to API
  requestedServiceLevels?: string[];
  
  // Multi-mode classification metadata
  classificationMode?: 'standard' | 'volume' | 'ftl' | 'reefer';
  classificationReason?: string;
}

// Enhanced interface for individual line items within a shipment
export interface LineItemData {
  id: number;
  description?: string;
  totalWeight: number; // REQUIRED
  freightClass: string; // REQUIRED
  packageType?: 'BAG' | 'BALE' | 'BOX' | 'BUCKET' | 'BUNDLE' | 'CAN' | 'CARTON' | 'CASE' | 'COIL' | 'CRATE' | 'CYLINDER' | 'DRUM' | 'PAIL' | 'PLT' | 'PIECES' | 'REEL' | 'ROLL' | 'SKID' | 'TOTE' | 'TUBE';
  totalPackages?: number;
  totalPieces?: number;
  packageLength: number; // REQUIRED for packageDimensions
  packageWidth: number; // REQUIRED for packageDimensions
  packageHeight: number; // REQUIRED for packageDimensions
  totalValue?: number;
  insuranceAmount?: number;
  stackable?: boolean;
  nmfcItemCode?: string;
  nmfcSubCode?: string;
  commodityType?: string;
  countryOfManufacture?: 'US' | 'CA' | 'MX';
  harmonizedCode?: string;
  // Hazmat details per item
  hazmat?: boolean;
  hazmatClass?: string;
  hazmatIdNumber?: string;
  hazmatPackingGroup?: 'I' | 'II' | 'III' | 'NONE';
  hazmatProperShippingName?: string;
}

export interface PricingSettings {
  markupPercentage: number;
  minimumProfit: number;
  markupType: 'percentage' | 'fixed';
  usesCustomerMargins?: boolean;
  fallbackMarkupPercentage?: number;
}

// Updated to match Project44 schema
export interface CapacityProviderIdentifier {
  type: 'SCAC' | 'DOT_NUMBER' | 'MC_NUMBER' | 'P44_EU' | 'SYSTEM' | 'P44_GLOBAL' | 'VAT';
  value: string;
}

export interface CapacityProvider {
  capacityProviderIdentifiers: CapacityProviderIdentifier[];
  name: string;
  supportedServices: CapacityProviderService[];
  type: 'CARRIER' | 'BROKER';
  // Add service levels support
  supportedServiceLevels?: ServiceLevelInfo[];
}

export interface CapacityProviderService {
  mode: 'PARCEL' | 'LTL' | 'VOLUME_LTL' | 'TRUCKLOAD' | 'OCEAN' | 'RAIL';
  type: 'RATING' | 'DISPATCH' | 'TRACKING' | 'IMAGING';
  // Add service levels to services
  serviceLevels?: ServiceLevelInfo[];
}

// New interface for service level information from Project44
export interface ServiceLevelInfo {
  code: string;
  name: string;
  description?: string;
  mode: 'LTL' | 'VOLUME_LTL' | 'TRUCKLOAD' | 'PARCEL';
  category: 'STANDARD' | 'EXPEDITED' | 'GUARANTEED' | 'ECONOMY' | 'PREMIUM';
  guaranteedDelivery?: boolean;
  transitDaysMin?: number;
  transitDaysMax?: number;
  cutoffTime?: string;
  availableDays?: string[]; // ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
}

// Enhanced service level response from Project44
export interface ServiceLevelResponse {
  serviceLevels: ServiceLevelInfo[];
  capacityProviderIdentifier?: CapacityProviderIdentifier;
  lastUpdated?: string;
}

export interface ServiceLevelsCollection {
  serviceLevels: ServiceLevelResponse[];
}

export interface Address {
  addressLines: string[];
  city: string;
  country: string;
  postalCode: string;
  state: string;
}

export interface GeoCoordinates {
  latitude: number;
  longitude: number;
}

export interface MonetaryValue {
  amount: number;
  currency: string;
}

// Enhanced Project44 API structures
export interface Contact {
  companyName?: string;
  contactName?: string;
  email?: string;
  faxNumber?: string;
  faxNumberCountryCode?: string;
  phoneNumber?: string;
  phoneNumber2?: string;
  phoneNumber2CountryCode?: string;
  phoneNumberCountryCode?: string;
}

export interface PackageDimensions {
  height: number;
  length: number;
  width: number;
}

export interface HazmatDetail {
  hazardClass: string;
  identificationNumber: string;
  packingGroup: 'I' | 'II' | 'III' | 'NONE';
  properShippingName: string;
  emergencyContact?: Contact;
}

export interface NmfcCode {
  code: string;
}

export interface TimeWindow {
  date: string;
  startTime: string;
  endTime: string;
}

// Updated Project44 rate quote structures
export interface RateCharge {
  amount: number;
  amountInPreferredCurrency?: number;
  code: string;
  description: string;
  itemFreightClass?: string;
  itemWeight?: number;
  itemWeightUnit?: string;
  rate?: number;
}

export interface RateQuoteDetail {
  charges: RateCharge[];
  subtotal: number;
  subtotalInPreferredCurrency?: number;
  total: number;
  totalInPreferredCurrency?: number;
}

export interface ServiceLevel {
  code: string;
  description: string;
}

export interface IntegerRange {
  max: number;
  min: number;
}

export interface Quote {
  quoteId: number;
  baseRate: number;
  fuelSurcharge: number;
  accessorial: RateCharge[];
  premiumsAndDiscounts: number;
  readyByDate: string;
  estimatedDeliveryDate: string;
  temperature?: string;
  weight: number;
  pallets: number;
  commodity?: string;
  stackable: boolean;
  foodGrade?: boolean;
  pickup: {
    city: string;
    state: string;
    zip: string;
  };
  dropoff: {
    city: string;
    state: string;
    zip: string;
  };
  submittedBy: string;
  submissionDatetime: string;
  carrier: {
    name: string;
    mcNumber: string;
    logo: string;
    scac?: string;
    dotNumber?: string;
  };
  // Project44 specific fields
  capacityProviderIdentifier?: CapacityProviderIdentifier;
  rateQuoteDetail?: RateQuoteDetail;
  serviceLevel?: ServiceLevel;
  transitDays?: number;
  transitDaysRange?: IntegerRange;
  carrierCode?: string;
  contractId?: string;
  currencyCode?: string;
  laneType?: string;
  quoteEffectiveDateTime?: string;
  quoteExpirationDateTime?: string;
  deliveryDateTime?: string;
  id?: string;
}

export interface QuoteWithPricing extends Quote {
  carrierTotalRate: number;
  customerPrice: number;
  profit: number;
  markupApplied: number;
  isCustomPrice: boolean;
  appliedMarginType?: 'customer' | 'fallback' | 'flat';
  appliedMarginPercentage?: number;
  // Detailed charge breakdown
  chargeBreakdown: {
    baseCharges: RateCharge[];
    fuelCharges: RateCharge[];
    accessorialCharges: RateCharge[];
    discountCharges: RateCharge[];
    premiumCharges: RateCharge[];
    otherCharges: RateCharge[];
  };
}

export interface ProcessingResult {
  rowIndex: number;
  originalData: RFQRow;
  quotes: QuoteWithPricing[];
  error?: string;
  status: 'pending' | 'processing' | 'success' | 'error';
  pricingOverrides?: { [quoteId: number]: number };
}

// Enhanced result type for smart quoting
interface SmartQuotingResult extends ProcessingResult {
  quotingDecision: 'freshx' | 'project44-standard' | 'project44-volume' | 'project44-dual';
  quotingReason: string;
}

// Project44 OAuth Configuration
export interface Project44OAuthConfig {
  oauthUrl: string;
  basicUser: string; // Keep for backward compatibility but not used
  basicPassword: string; // Keep for backward compatibility but not used
  clientId: string;
  clientSecret: string;
  ratingApiUrl: string;
}

// Enhanced Project44 API Request/Response types
export interface Project44RateQuoteRequest {
  originAddress: Address;
  destinationAddress: Address;
  lineItems: LineItem[];
  capacityProviderAccountGroup?: CapacityProviderAccountGroup;
  accessorialServices?: AccessorialService[];
  pickupWindow?: TimeWindow;
  deliveryWindow?: TimeWindow;
  apiConfiguration?: {
    accessorialServiceConfiguration?: {
      allowUnacceptedAccessorials?: boolean;
      fetchAllGuaranteed?: boolean;
      fetchAllInsideDelivery?: boolean;
      fetchAllServiceLevels?: boolean;
    };
    enableUnitConversion?: boolean;
    fallBackToDefaultAccountGroup?: boolean;
    timeout?: number;
  };
  directionOverride?: 'SHIPPER' | 'CONSIGNEE' | 'THIRD_PARTY';
  enhancedHandlingUnits?: EnhancedHandlingUnit[];
  lengthUnit?: 'IN' | 'CM' | 'FT' | 'M';
  paymentTermsOverride?: 'PREPAID' | 'COLLECT' | 'THIRD_PARTY';
  preferredCurrency?: 'USD' | 'CAD' | 'MXN' | 'EUR';
  preferredSystemOfMeasurement?: 'METRIC' | 'IMPERIAL';
  totalLinearFeet?: number;
  weightUnit?: 'LB' | 'KG';
  // Removed serviceLevelConfiguration as it's not supported by the API
}

export interface LineItem {
  totalWeight: number;
  packageDimensions: PackageDimensions;
  freightClass: string;
  description?: string;
  nmfcItemCode?: string;
  nmfcSubCode?: string;
  commodityType?: string;
  countryOfManufacture?: 'US' | 'CA' | 'MX';
  hazmatDetail?: HazmatDetail;
  id?: number;
  insuranceAmount?: number;
  packageType?: 'BAG' | 'BALE' | 'BOX' | 'BUCKET' | 'BUNDLE' | 'CAN' | 'CARTON' | 'CASE' | 'COIL' | 'CRATE' | 'CYLINDER' | 'DRUM' | 'PAIL' | 'PLT' | 'PIECES' | 'REEL' | 'ROLL' | 'SKID' | 'TOTE' | 'TUBE';
  stackable?: boolean;
  totalPackages?: number;
  totalPieces?: number;
  totalValue?: number;
  harmonizedCode?: string;
}

export interface EnhancedHandlingUnit {
  commodityType?: string;
  contact?: Contact;
  deliveryStopNumber?: number;
  description?: string;
  freightClasses?: string[];
  handlingUnitDimensions?: PackageDimensions;
  handlingUnitQuantity?: number;
  handlingUnitType?: 'BAG' | 'BALE' | 'BOX' | 'BUCKET' | 'BUNDLE' | 'CAN' | 'CARTON' | 'CASE' | 'COIL' | 'CRATE' | 'CYLINDER' | 'DRUM' | 'PAIL' | 'PLT' | 'PIECES' | 'REEL' | 'ROLL' | 'SKID' | 'TOTE' | 'TUBE';
  harmonizedCode?: string;
  nmfcCodes?: NmfcCode[];
  packages?: Package[];
  pickupStopNumber?: number;
  stackable?: boolean;
  totalValue?: MonetaryValue;
  weightPerHandlingUnit?: number;
}

export interface Package {
  contact?: Contact;
  description?: string;
  freightClass?: string;
  involvedParties?: InvolvedParty[];
  nmfcCodes?: NmfcCode[];
  packageContainerType?: 'BAG' | 'BALE' | 'BOX' | 'BUCKET' | 'PAIL' | 'BUNDLE' | 'CAN' | 'CARTON' | 'CASE' | 'COIL' | 'CRATE' | 'CYLINDER' | 'EACH' | 'FLAT' | 'LOOSE' | 'ROLL' | 'TUBE';
  packageContents?: PackageContent[];
  packageDimensions?: PackageDimensions;
  packageQuantity?: number;
  weightPerPackage?: number;
}

export interface InvolvedParty {
  partyIdentifiers: PartyIdentifier[];
}

export interface PartyIdentifier {
  type: string;
  value: string;
}

export interface PackageContent {
  countryOfManufacture?: 'US' | 'CA' | 'MX';
  description?: string;
  hazmatDetails?: HazmatDetail[];
  packageContentIdentifiers?: PackageContentIdentifier[];
  packageContentQuantity?: number;
}

export interface PackageContentIdentifier {
  type: string;
  value: string;
}

export interface AccessorialService {
  code: string;
  description?: string;
}

export interface Project44RateQuoteResponse {
  rateQuotes: Project44RateQuote[];
  requestId?: string;
  timestamp?: string;
}

export interface Project44RateQuote {
  id: string;
  capacityProviderName?: string;
  carrierCode?: string;
  contractId?: string;
  currencyCode?: string;
  deliveryDateTime?: string;
  laneType?: string;
  preferredCurrencyCode?: string;
  preferredSystemOfMeasurement?: string;
  quoteEffectiveDateTime?: string;
  quoteExpirationDateTime?: string;
  rateQuoteDetail: RateQuoteDetail;
  serviceLevel?: ServiceLevel;
  transitDays?: number;
  transitDaysRange?: IntegerRange;
  alternateRateQuotes?: AlternateRateQuote[];
  requestedAccessorialServices?: RequestedAccessorialService[];
  errorMessages?: Message[];
  infoMessages?: Message[];
  capacityProviderAccountGroup?: CapacityProviderAccountGroup;
}

export interface AlternateRateQuote {
  capacityProviderQuoteNumber?: string;
  deliveryDateTime?: string;
  rateQuoteDetail: RateQuoteDetail;
  serviceLevel?: ServiceLevel;
  transitDays?: number;
  transitDaysRange?: IntegerRange;
}

export interface RequestedAccessorialService {
  code: string;
  status: 'ACCEPTED' | 'REJECTED' | 'NOT_SUPPORTED';
}

export interface Message {
  diagnostic?: string;
  message: string;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  source: 'SYSTEM' | 'CARRIER';
}

// OAuth Token Response
export interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

// Carrier Performance types
export interface CarrierPerformance {
  carrier: ConnectedCarrierContact;
  last30DaysDeliveryScheduleReliability: number;
  last30DaysPercentTracked: number;
  last30DaysPickupScheduleReliability: number;
  last30DaysShipmentVolume: ShipmentVolumeEnum;
  last365DaysDeliveryScheduleReliability: number;
  last365DaysPercentTracked: number;
  last365DaysPickupScheduleReliability: number;
  last365DaysShipmentVolume: ShipmentVolumeEnum;
  performanceByMonth: MonthlyCarrierPerformance[];
}

export interface ConnectedCarrierContact {
  name: string;
  scac?: string;
  dotNumber?: string;
  mcNumber?: string;
}

export interface MonthlyCarrierPerformance {
  month: string;
  year: number;
  deliveryScheduleReliability: number;
  pickupScheduleReliability: number;
  percentTracked: number;
  shipmentVolume: ShipmentVolumeEnum;
}

export type ShipmentVolumeEnum = 
  | 'VOLUME_0_TO_10_SHIPMENTS'
  | 'VOLUME_11_TO_50_SHIPMENTS'
  | 'VOLUME_51_TO_100_SHIPMENTS'
  | 'VOLUME_101_OR_MORE_SHIPMENTS';

// Account Management types
export interface CapacityProviderAccountInfo {
  accountDefinitionIdentifier: string;
  accountFlag1?: boolean;
  accountNumber1?: string;
  accountNumber2?: string;
  billToLocationId?: string;
  credential1?: string;
  credential2?: string;
  credential3?: string;
  directionCode?: 'SHIPPER' | 'CONSIGNEE' | 'THIRD_PARTY';
  enableDirectionOverride?: boolean;
  enablePaymentTermsOverride?: boolean;
  id?: number;
  oAuth2LoginUrl?: string;
  oAuth2SignupUrl?: string;
  paymentTermsCode?: 'PREPAID' | 'COLLECT' | 'THIRD_PARTY';
  username1?: string;
}

export interface CapacityProviderAccountInfos {
  accounts: CapacityProviderAccountInfo[];
  capacityProviderIdentifier: CapacityProviderIdentifier;
  code: string;
  group?: CapacityProviderAccountGroupInfo;
  id?: number;
}

export interface CapacityProviderAccountInfosCollection {
  accounts: CapacityProviderAccountInfos[];
}

export interface CapacityProviderAccountGroupInfo {
  code: string;
  id?: number;
  name: string;
}

export interface CapacityProviderAccountGroup {
  accounts: { code: string }[];
  code?: string;
}