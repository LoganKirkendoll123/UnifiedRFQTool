import { Quote, QuoteWithPricing, PricingSettings, RateCharge } from '../types';

// Customer-carrier margin lookup cache
const marginCache = new Map<string, number>();

// Function to get customer-specific margin for a carrier
export const getCustomerCarrierMargin = async (
  customerName: string, 
  carrierName: string, 
  carrierScac?: string
): Promise<number | null> => {
  if (!customerName) return null;
  
  // Create cache key
  const cacheKey = `${customerName}:${carrierName}:${carrierScac || ''}`;
  
  // Check cache first
  if (marginCache.has(cacheKey)) {
    return marginCache.get(cacheKey)!;
  }
  
  try {
    console.log(`🔍 Looking up margin for customer "${customerName}" and carrier "${carrierName}" (SCAC: ${carrierScac})`);
    
    // For now, return null - customer margins would require database integration
    console.log(`ℹ️ Customer margin lookup not implemented - using fallback margin`);
    return null;
  } catch (error) {
    console.error('❌ Failed to lookup customer-carrier margin:', error);
    return null;
  }
};

// Clear the margin cache (useful when customer changes)
export const clearMarginCache = () => {
  marginCache.clear();
  console.log('🧹 Cleared customer-carrier margin cache');
};

export const calculatePricing = (
  quote: Quote, 
  settings: PricingSettings,
  customPrice?: number,
  selectedCustomer?: string
): QuoteWithPricing => {
  // Check if this is a FreshX quote (has submittedBy = 'FreshX' or temperature field)
  const isFreshXQuote = quote.submittedBy === 'FreshX' || quote.temperature;
  
  let carrierTotalRate: number;
  let chargeBreakdown = {
    baseCharges: [] as RateCharge[],
    fuelCharges: [] as RateCharge[],
    accessorialCharges: [] as RateCharge[],
    discountCharges: [] as RateCharge[],
    premiumCharges: [] as RateCharge[],
    otherCharges: [] as RateCharge[]
  };

  if (isFreshXQuote) {
    // FreshX: Use baseRate + fuelSurcharge + premiumsAndDiscounts
    carrierTotalRate = quote.baseRate + quote.fuelSurcharge + quote.premiumsAndDiscounts;
    
    console.log(`🌡️ FreshX quote breakdown: Base=${quote.baseRate}, Fuel=${quote.fuelSurcharge}, Premiums=${quote.premiumsAndDiscounts}, Total=${carrierTotalRate}`);
    
    // Create itemized charge breakdown for FreshX
    if (quote.baseRate > 0) {
      chargeBreakdown.baseCharges.push({
        amount: quote.baseRate,
        code: 'BASE',
        description: 'Base Rate'
      });
    }
    
    if (quote.fuelSurcharge > 0) {
      chargeBreakdown.fuelCharges.push({
        amount: quote.fuelSurcharge,
        code: 'FUEL',
        description: 'Fuel Surcharge'
      });
    }
    
    if (quote.premiumsAndDiscounts !== 0) {
      if (quote.premiumsAndDiscounts > 0) {
        chargeBreakdown.premiumCharges.push({
          amount: quote.premiumsAndDiscounts,
          code: 'PREMIUM',
          description: 'Temperature Control & Accessorials'
        });
      } else {
        chargeBreakdown.discountCharges.push({
          amount: quote.premiumsAndDiscounts,
          code: 'DISCOUNT',
          description: 'Discounts'
        });
      }
    }
    
    // Add accessorial charges if available
    if (quote.accessorial && Array.isArray(quote.accessorial)) {
      quote.accessorial.forEach(acc => {
        if (typeof acc === 'object' && acc.amount) {
          chargeBreakdown.accessorialCharges.push(acc);
        }
      });
    }
  } else if (quote.rateQuoteDetail?.total !== undefined && quote.rateQuoteDetail.total > 0) {
    // Use Project44's calculated total
    carrierTotalRate = quote.rateQuoteDetail.total;
    
    // Simply display ALL charges exactly as they come from Project44
    if (quote.rateQuoteDetail.charges && Array.isArray(quote.rateQuoteDetail.charges)) {
      // Put all charges in "otherCharges" to display them exactly as received
      chargeBreakdown.otherCharges = [...quote.rateQuoteDetail.charges];
      
      console.log(`💰 Displaying ${quote.rateQuoteDetail.charges.length} charges exactly as received from Project44`);
      quote.rateQuoteDetail.charges.forEach((charge, index) => {
        console.log(`  ${index + 1}. ${charge.code || 'NO_CODE'} - ${charge.description || 'No description'}: $${charge.amount || 0}`);
      });
    }
    
    // For legacy compatibility, set these to zero since we're showing actual charges
    quote.baseRate = 0;
    quote.fuelSurcharge = 0;
    quote.premiumsAndDiscounts = carrierTotalRate;
  } else if (!isFreshXQuote && (quote.baseRate > 0 || quote.fuelSurcharge > 0)) {
    // Fall back to legacy calculation if we have valid base components
    carrierTotalRate = quote.baseRate + quote.fuelSurcharge + quote.premiumsAndDiscounts;
    
    // Create legacy charge breakdown
    if (quote.baseRate > 0) {
      chargeBreakdown.baseCharges.push({
        amount: quote.baseRate,
        code: 'BASE',
        description: 'Base Rate'
      });
    }
    
    if (quote.fuelSurcharge > 0) {
      chargeBreakdown.fuelCharges.push({
        amount: quote.fuelSurcharge,
        code: 'FUEL',
        description: 'Fuel Surcharge'
      });
    }
    
    if (quote.premiumsAndDiscounts !== 0) {
      if (quote.premiumsAndDiscounts > 0) {
        chargeBreakdown.premiumCharges.push({
          amount: quote.premiumsAndDiscounts,
          code: 'PREMIUM',
          description: 'Premiums and Accessorials'
        });
      } else {
        chargeBreakdown.discountCharges.push({
          amount: quote.premiumsAndDiscounts,
          code: 'DISCOUNT',
          description: 'Discounts'
        });
      }
    }
    
    // Add accessorial charges if available
    if (quote.accessorial && Array.isArray(quote.accessorial)) {
      quote.accessorial.forEach(acc => {
        if (typeof acc === 'object' && acc.amount) {
          chargeBreakdown.accessorialCharges.push(acc);
        }
      });
    }
  } else {
    // No valid pricing data - this quote should have been filtered out
    console.warn(`Quote has no valid pricing data (isFreshX: ${isFreshXQuote}):`, quote);
    carrierTotalRate = 0;
  }
  
  let customerPrice: number;
  let markupApplied: number;
  let isCustomPrice = false;
  let appliedMarginType: 'customer' | 'fallback' | 'flat' = 'flat';
  let appliedMarginPercentage: number = settings.markupPercentage;

  if (customPrice !== undefined) {
    // Custom price override
    customerPrice = customPrice;
    markupApplied = customerPrice - carrierTotalRate;
    isCustomPrice = true;
    appliedMarginType = 'flat';
  } else {
    // Determine which margin to apply
    if (settings.usesCustomerMargins && selectedCustomer) {
      // For customer margins mode, we'll need to do async lookup
      // Use fallback margin with correct formula
      const fallbackMargin = settings.fallbackMarkupPercentage || 23;
      appliedMarginPercentage = fallbackMargin;
      appliedMarginType = 'fallback';
      customerPrice = carrierTotalRate / (1 - (fallbackMargin / 100));
      markupApplied = customerPrice - carrierTotalRate;
    } else {
      // Apply flat markup
      if (settings.markupType === 'percentage') {
        customerPrice = carrierTotalRate / (1 - (settings.markupPercentage / 100));
        markupApplied = customerPrice - carrierTotalRate;
        appliedMarginPercentage = settings.markupPercentage;
      } else {
        markupApplied = settings.markupPercentage;
        customerPrice = carrierTotalRate + markupApplied;
        appliedMarginPercentage = (settings.markupPercentage / carrierTotalRate) * 100; // Convert to percentage for display
      }
      appliedMarginType = 'flat';
    }
    
    // Ensure minimum profit is met (only adjust if below minimum)
    // CRITICAL: Ensure minimum profit is ALWAYS enforced
    const calculatedProfit = customerPrice - carrierTotalRate;
    if (calculatedProfit < settings.minimumProfit) {
      console.log(`⚠️ Enforcing minimum profit: ${formatCurrency(calculatedProfit)} → ${formatCurrency(settings.minimumProfit)}`);
      markupApplied = settings.minimumProfit;
      customerPrice = carrierTotalRate + settings.minimumProfit;
      // Recalculate the applied margin percentage based on the enforced minimum
      appliedMarginPercentage = carrierTotalRate > 0 ? (settings.minimumProfit / carrierTotalRate) * 100 : 0;
    }
  }

  // Calculate final profit after all adjustments
  const profit = customerPrice - carrierTotalRate;
  
  // Recalculate applied margin percentage based on final profit
  appliedMarginPercentage = customerPrice > 0 ? (profit / customerPrice) * 100 : 0;

  return {
    ...quote,
    carrierTotalRate,
    customerPrice,
    profit,
    markupApplied,
    isCustomPrice,
    chargeBreakdown,
    appliedMarginType,
    appliedMarginPercentage
  };
};

// Async version of calculatePricing that can lookup customer margins
export const calculatePricingWithCustomerMargins = async (
  quote: Quote, 
  settings: PricingSettings,
  selectedCustomer?: string,
  customPrice?: number
): Promise<QuoteWithPricing> => {
  // Start with basic calculation
  let result = calculatePricing(quote, settings, customPrice, selectedCustomer);
  
  // If using customer margins and we have a customer selected, try to lookup specific margin
  if (settings.usesCustomerMargins && selectedCustomer && !customPrice) {
    const carrierName = quote.carrier.name;
    const carrierScac = quote.carrier.scac || quote.carrierCode;
    
    // Check if this is a reefer quote (always use fallback for reefer)
    const isReeferQuote = quote.temperature && ['CHILLED', 'FROZEN'].includes(quote.temperature);
    
    if (!isReeferQuote) {
      const customerMargin = await getCustomerCarrierMargin(selectedCustomer, carrierName, carrierScac);
      
      if (customerMargin !== null && customerMargin > 0) {
        // Apply customer-specific margin
        const customerPrice = result.carrierTotalRate / (1 - (customerMargin / 100));
        let markupApplied = customerPrice - result.carrierTotalRate;
        let finalCustomerPrice = customerPrice;
        
        // CRITICAL: Enforce minimum profit for customer margins too
        if (markupApplied < settings.minimumProfit) {
          console.log(`⚠️ Customer margin below minimum profit. Enforcing: ${formatCurrency(markupApplied)} → ${formatCurrency(settings.minimumProfit)}`);
          markupApplied = settings.minimumProfit;
          finalCustomerPrice = result.carrierTotalRate + settings.minimumProfit;
        }
        
        const profit = finalCustomerPrice - result.carrierTotalRate;
        
        result = {
          ...result,
          customerPrice: finalCustomerPrice,
          profit,
          markupApplied,
          appliedMarginType: 'customer',
          appliedMarginPercentage: finalCustomerPrice > 0 ? (profit / finalCustomerPrice) * 100 : 0
        };
        
        console.log(`💰 Applied customer margin: ${customerMargin}% (final: ${result.appliedMarginPercentage.toFixed(1)}%) for ${selectedCustomer} + ${carrierName}`);
      } else {
        console.log(`📋 Using fallback margin: ${settings.fallbackMarkupPercentage || 23}% for ${selectedCustomer} + ${carrierName}`);
      }
    } else {
      console.log(`🌡️ Using fallback margin for reefer quote: ${settings.fallbackMarkupPercentage || 23}%`);
    }
  }
  
  return result;
};

export const calculateBestQuote = (quotes: QuoteWithPricing[]): QuoteWithPricing | null => {
  if (quotes.length === 0) return null;
  
  return quotes.reduce((best, current) => 
    current.customerPrice < best.customerPrice ? current : best
  );
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

export const formatProfit = (profit: number): string => {
  const formatted = formatCurrency(profit);
  return profit >= 0 ? `+${formatted}` : formatted;
};

export const getTotalChargesByCategory = (charges: RateCharge[]): number => {
  return charges.reduce((sum, charge) => sum + charge.amount, 0);
};

export const formatChargeDescription = (charge: RateCharge): string => {
  if (charge.description) {
    return charge.description;
  }
  
  // Fallback to code-based descriptions
  const codeDescriptions: { [key: string]: string } = {
    'BASE': 'Base Rate',
    'FUEL': 'Fuel Surcharge',
    'LGPU': 'Liftgate Pickup',
    'LGDEL': 'Liftgate Delivery',
    'INPU': 'Inside Pickup',
    'INDEL': 'Inside Delivery',
    'RESPU': 'Residential Pickup',
    'RESDEL': 'Residential Delivery',
    'APPTPU': 'Appointment Pickup',
    'APPTDEL': 'Appointment Delivery',
    'LTDPU': 'Limited Access Pickup',
    'LTDDEL': 'Limited Access Delivery'
  };
  
  return codeDescriptions[charge.code] || charge.code || 'Additional Charge';
};

export const formatItemizedCharges = (quote: QuoteWithPricing): string => {
  if (!quote.chargeBreakdown) {
    return `Total/${formatCurrency(quote.carrierTotalRate || 0)}`;
  }
  
  const allCharges: RateCharge[] = [
    ...quote.chargeBreakdown.baseCharges,
    ...quote.chargeBreakdown.fuelCharges,
    ...quote.chargeBreakdown.accessorialCharges,
    ...quote.chargeBreakdown.discountCharges,
    ...quote.chargeBreakdown.premiumCharges,
    ...quote.chargeBreakdown.otherCharges
  ];
  
  if (allCharges.length === 0) {
    return `Total/${formatCurrency(quote.carrierTotalRate || 0)}`;
  }
  
  return allCharges
    .map(charge => {
      const name = formatChargeDescription(charge);
      const value = formatCurrency(charge.amount);
      return `${name}/${value}`;
    })
    .join(';');
};