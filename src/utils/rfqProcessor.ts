import { RFQRow, ProcessingResult, QuoteWithPricing, PricingSettings } from '../types';
import { Project44APIClient, FreshXAPIClient } from './apiClient';
import { calculatePricingWithCustomerMargins } from './pricingCalculator';

export interface RFQProcessingOptions {
  selectedCarriers: { [carrierId: string]: boolean };
  pricingSettings: PricingSettings;
  selectedCustomer: string;
  onProgress?: (current: number, total: number, currentItem?: string) => void;
  onCarrierProgress?: (current: number, total: number) => void;
}

export interface SmartQuotingResult extends ProcessingResult {
  quotingDecision: 'freshx' | 'project44-standard' | 'project44-volume' | 'project44-dual';
  quotingReason: string;
}

export class RFQProcessor {
  constructor(
    private project44Client: Project44APIClient | null,
    private freshxClient: FreshXAPIClient | null
  ) {}

  // Smart quoting classification function
  private classifyShipment(rfq: RFQRow): {
    quoting: 'freshx' | 'project44-standard' | 'project44-volume' | 'project44-dual',
    reason: string
  } {
    // Check the isReefer field first - this is the primary quoting control
    if (rfq.isReefer === true) {
      return {
        quoting: 'freshx',
        reason: `Marked as reefer shipment (isReefer=TRUE) - quoted through FreshX reefer network`
      };
    }
    
    // For non-reefer shipments (isReefer=FALSE or undefined), quote through Project44
    // Determine LTL vs VLTL based on size and weight
    if (rfq.pallets >= 10 || rfq.grossWeight >= 15000) {
      return {
        quoting: 'project44-dual',
        reason: `Large shipment (${rfq.pallets} pallets, ${rfq.grossWeight.toLocaleString()} lbs) - quoted through both Project44 Volume LTL and Standard LTL for comparison`
      };
    } else {
      return {
        quoting: 'project44-standard',
        reason: `Standard shipment (${rfq.pallets} pallets, ${rfq.grossWeight.toLocaleString()} lbs) - quoted through Project44 Standard LTL`
      };
    }
  }

  // Process a single RFQ with smart routing
  async processSingleRFQ(
    rfq: RFQRow,
    options: RFQProcessingOptions,
    rowIndex: number = 0
  ): Promise<SmartQuotingResult> {
    const selectedCarrierIds = Object.entries(options.selectedCarriers)
      .filter(([_, selected]) => selected)
      .map(([carrierId, _]) => carrierId);

    // Classify the shipment using the smart quoting logic
    const classification = this.classifyShipment(rfq);
    
    console.log(`🧠 RFQ ${rowIndex + 1} Classification: ${classification.reason}`);

    const result: SmartQuotingResult = {
      rowIndex,
      originalData: rfq,
      quotes: [],
      status: 'processing',
      quotingDecision: classification.quoting,
      quotingReason: classification.reason
    };

    try {
      let quotes: any[] = [];

      if (classification.quoting === 'freshx' && this.freshxClient) {
        console.log(`🌡️ Getting FreshX quotes for RFQ ${rowIndex + 1}`);
        quotes = await this.freshxClient.getQuotes(rfq);
      } else if (classification.quoting === 'project44-dual' && this.project44Client) {
        console.log(`📦 Getting dual quotes (Volume LTL + Standard LTL) for RFQ ${rowIndex + 1}`);
        
        // Get both Volume LTL and Standard LTL quotes
        const [volumeQuotes, standardQuotes] = await Promise.all([
          this.project44Client.getQuotes(rfq, selectedCarrierIds, true, false, false),  // Volume LTL
          this.project44Client.getQuotes(rfq, selectedCarrierIds, false, false, false)  // Standard LTL
        ]);
        
        // Tag quotes with their mode for identification
        const taggedVolumeQuotes = volumeQuotes.map(quote => ({
          ...quote,
          quoteMode: 'volume',
          quoteModeLabel: 'Volume LTL'
        }));
        
        const taggedStandardQuotes = standardQuotes.map(quote => ({
          ...quote,
          quoteMode: 'standard',
          quoteModeLabel: 'Standard LTL'
        }));
        
        quotes = [...taggedVolumeQuotes, ...taggedStandardQuotes];
        console.log(`✅ Dual quoting completed: ${volumeQuotes.length} Volume LTL + ${standardQuotes.length} Standard LTL quotes`);
      } else if (this.project44Client) {
        console.log(`🚛 Getting Standard LTL quotes for RFQ ${rowIndex + 1}`);
        quotes = await this.project44Client.getQuotes(rfq, selectedCarrierIds, false, false, false);
      }
      
      if (quotes.length > 0) {
        // Apply pricing to quotes
        const quotesWithPricing = await Promise.all(
          quotes.map(quote => 
            calculatePricingWithCustomerMargins(quote, options.pricingSettings, options.selectedCustomer)
          )
        );
        
        result.quotes = quotesWithPricing;
        result.status = 'success';
        console.log(`✅ ${classification.quoting.toUpperCase()} RFQ ${rowIndex + 1} completed: ${quotes.length} quotes received`);
      } else {
        result.status = 'success'; // No error, just no quotes
        console.log(`ℹ️ ${classification.quoting.toUpperCase()} RFQ ${rowIndex + 1} completed: No quotes received`);
      }
    } catch (error) {
      result.error = error instanceof Error ? error.message : 'Unknown error';
      result.status = 'error';
      console.error(`❌ ${classification.quoting.toUpperCase()} RFQ ${rowIndex + 1} failed:`, error);
    }

    return result;
  }

  // Process multiple RFQs with progress tracking
  async processMultipleRFQs(
    rfqs: RFQRow[],
    options: RFQProcessingOptions
  ): Promise<SmartQuotingResult[]> {
    if (rfqs.length === 0) {
      console.log('⚠️ No RFQ data to process');
      return [];
    }

    console.log(`🧠 Starting Smart Quoting RFQ processing: ${rfqs.length} RFQs`);

    const allResults: SmartQuotingResult[] = [];

    for (let i = 0; i < rfqs.length; i++) {
      const rfq = rfqs[i];
      
      // Update progress
      if (options.onProgress) {
        const classification = this.classifyShipment(rfq);
        options.onProgress(i + 1, rfqs.length, `RFQ ${i + 1}: ${classification.quoting.toUpperCase()}`);
      }

      const result = await this.processSingleRFQ(rfq, options, i);
      allResults.push(result);

      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`🏁 Smart Quoting processing completed: ${allResults.length} total results`);
    return allResults;
  }

  // Process RFQs for account group (used by Negotiation Impact Analyzer)
  async processRFQsForAccountGroup(
    rfqs: RFQRow[],
    accountGroupCode: string,
    options: Omit<RFQProcessingOptions, 'selectedCarriers'>
  ): Promise<SmartQuotingResult[]> {
    if (!this.project44Client) {
      throw new Error('Project44 client not available');
    }

    console.log(`🧠 Processing RFQs for account group: ${accountGroupCode}`);

    const allResults: SmartQuotingResult[] = [];

    for (let i = 0; i < rfqs.length; i++) {
      const rfq = rfqs[i];
      
      // Update progress
      if (options.onProgress) {
        const classification = this.classifyShipment(rfq);
        options.onProgress(i + 1, rfqs.length, `RFQ ${i + 1}: ${classification.quoting.toUpperCase()}`);
      }

      const classification = this.classifyShipment(rfq);
      
      const result: SmartQuotingResult = {
        rowIndex: i,
        originalData: rfq,
        quotes: [],
        status: 'processing',
        quotingDecision: classification.quoting,
        quotingReason: classification.reason
      };

      try {
        let quotes: any[] = [];

        if (classification.quoting === 'freshx' && this.freshxClient) {
          quotes = await this.freshxClient.getQuotes(rfq);
        } else if (classification.quoting === 'project44-dual') {
          // Get both Volume LTL and Standard LTL quotes for account group
          const [volumeQuotes, standardQuotes] = await Promise.all([
            this.project44Client.getQuotesForAccountGroup(rfq, accountGroupCode, true, false, false),
            this.project44Client.getQuotesForAccountGroup(rfq, accountGroupCode, false, false, false)
          ]);
          
          const taggedVolumeQuotes = volumeQuotes.map(quote => ({
            ...quote,
            quoteMode: 'volume',
            quoteModeLabel: 'Volume LTL'
          }));
          
          const taggedStandardQuotes = standardQuotes.map(quote => ({
            ...quote,
            quoteMode: 'standard',
            quoteModeLabel: 'Standard LTL'
          }));
          
          quotes = [...taggedVolumeQuotes, ...taggedStandardQuotes];
        } else {
          quotes = await this.project44Client.getQuotesForAccountGroup(rfq, accountGroupCode, false, false, false);
        }
        
        if (quotes.length > 0) {
          const quotesWithPricing = await Promise.all(
            quotes.map(quote => 
              calculatePricingWithCustomerMargins(quote, options.pricingSettings, options.selectedCustomer)
            )
          );
          
          result.quotes = quotesWithPricing;
          result.status = 'success';
        } else {
          result.status = 'success';
        }
      } catch (error) {
        result.error = error instanceof Error ? error.message : 'Unknown error';
        result.status = 'error';
      }

      allResults.push(result);
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return allResults;
  }

  // Validate RFQ data
  validateRFQ(rfq: RFQRow): string[] {
    const errors: string[] = [];
    
    if (!rfq.fromZip || !/^\d{5}$/.test(rfq.fromZip)) {
      errors.push('Valid origin ZIP code is required');
    }
    
    if (!rfq.toZip || !/^\d{5}$/.test(rfq.toZip)) {
      errors.push('Valid destination ZIP code is required');
    }
    
    if (rfq.pallets < 1 || rfq.pallets > 100) {
      errors.push('Pallets must be between 1 and 100');
    }
    
    if (rfq.grossWeight < 1 || rfq.grossWeight > 100000) {
      errors.push('Gross weight must be between 1 and 100,000 lbs');
    }
    
    // Validate line items if present
    if (rfq.lineItems && rfq.lineItems.length > 0) {
      const itemTotalWeight = rfq.lineItems.reduce((sum, item) => sum + item.totalWeight, 0);
      if (Math.abs(rfq.grossWeight - itemTotalWeight) > 10) {
        errors.push(`Gross weight (${rfq.grossWeight}) must equal sum of item weights (${itemTotalWeight})`);
      }
      
      rfq.lineItems.forEach((item, index) => {
        if (!item.description) {
          errors.push(`Item ${index + 1}: Description is required`);
        }
        if (item.totalWeight <= 0) {
          errors.push(`Item ${index + 1}: Weight must be greater than 0`);
        }
        if (!item.freightClass) {
          errors.push(`Item ${index + 1}: Freight class is required`);
        }
        if (item.packageLength <= 0 || item.packageWidth <= 0 || item.packageHeight <= 0) {
          errors.push(`Item ${index + 1}: All dimensions must be greater than 0`);
        }
      });
    }
    
    return errors;
  }

  // Update quote pricing
  updateQuotePricing(
    results: SmartQuotingResult[],
    resultIndex: number,
    quoteId: number,
    newPrice: number,
    options: Pick<RFQProcessingOptions, 'pricingSettings' | 'selectedCustomer'>
  ): SmartQuotingResult[] {
    const newResults = [...results];
    const result = newResults[resultIndex];
    
    if (result && result.quotes) {
      const updatedQuotes = result.quotes.map(quote => {
        if (quote.quoteId === quoteId) {
          return calculatePricingWithCustomerMargins(quote, options.pricingSettings, options.selectedCustomer, newPrice);
        }
        return quote;
      });
      
      newResults[resultIndex] = {
        ...result,
        quotes: updatedQuotes
      };
    }
    
    return newResults;
  }
}