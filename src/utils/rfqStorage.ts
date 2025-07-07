import { supabase } from './supabase';
import { RFQRow, PricingSettings } from '../types';
import { SmartQuotingResult } from './rfqProcessor';

export interface RFQBatch {
  id: string;
  batch_name: string;
  customer_name?: string;
  pricing_settings: PricingSettings;
  selected_carriers: { [carrierId: string]: boolean };
  rfq_data: RFQRow[];
  results_data?: SmartQuotingResult[];
  total_rfqs: number;
  successful_rfqs: number;
  total_quotes: number;
  best_total_price: number;
  total_profit: number;
  processing_mode: string;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface RFQBatchSummary {
  id: string;
  batch_name: string;
  customer_name?: string;
  total_rfqs: number;
  successful_rfqs: number;
  total_quotes: number;
  best_total_price: number;
  total_profit: number;
  processing_mode: string;
  created_at: string;
  created_by: string;
}

// Save RFQ batch to database
export const saveRFQBatch = async (
  batchName: string,
  rfqData: RFQRow[],
  results: SmartQuotingResult[],
  pricingSettings: PricingSettings,
  selectedCarriers: { [carrierId: string]: boolean },
  selectedCustomer?: string,
  processingMode: string = 'smart'
): Promise<string> => {
  try {
    console.log('💾 Saving RFQ batch to database...', {
      batchName,
      rfqCount: rfqData.length,
      resultsCount: results.length,
      customer: selectedCustomer,
      mode: processingMode
    });

    // Calculate summary statistics
    const totalRfqs = rfqData.length;
    const successfulRfqs = results.filter(r => r.status === 'success' && r.quotes.length > 0).length;
    const totalQuotes = results.reduce((sum, r) => sum + r.quotes.length, 0);
    
    // Calculate best price and total profit
    let bestTotalPrice = 0;
    let totalProfit = 0;
    
    results.forEach(result => {
      if (result.quotes.length > 0) {
        // Find best price in this result
        const bestQuote = result.quotes.reduce((best, current) => 
          (current as any).customerPrice < (best as any).customerPrice ? current : best
        );
        
        if ((bestQuote as any).customerPrice) {
          if (bestTotalPrice === 0 || (bestQuote as any).customerPrice < bestTotalPrice) {
            bestTotalPrice = (bestQuote as any).customerPrice;
          }
          
          // Add profit from best quote
          totalProfit += (bestQuote as any).profit || 0;
        }
      }
    });

    const batchData = {
      batch_name: batchName,
      customer_name: selectedCustomer || null,
      pricing_settings: pricingSettings,
      selected_carriers: selectedCarriers,
      rfq_data: rfqData,
      results_data: results,
      total_rfqs: totalRfqs,
      successful_rfqs: successfulRfqs,
      total_quotes: totalQuotes,
      best_total_price: bestTotalPrice,
      total_profit: totalProfit,
      processing_mode: processingMode,
      created_by: 'user' // TODO: Replace with actual user ID when auth is implemented
    };

    const { data, error } = await supabase
      .from('rfq_batches')
      .insert([batchData])
      .select('id')
      .single();

    if (error) {
      console.error('❌ Failed to save RFQ batch:', error);
      throw new Error(`Failed to save RFQ batch: ${error.message}`);
    }

    console.log('✅ RFQ batch saved successfully:', data.id);
    return data.id;
  } catch (error) {
    console.error('❌ Error saving RFQ batch:', error);
    throw error;
  }
};

// Load RFQ batch summaries (for selection list)
export const loadRFQBatchSummaries = async (): Promise<RFQBatchSummary[]> => {
  try {
    console.log('📋 Loading RFQ batch summaries...');

    const { data, error } = await supabase
      .from('rfq_batches')
      .select(`
        id,
        batch_name,
        customer_name,
        total_rfqs,
        successful_rfqs,
        total_quotes,
        best_total_price,
        total_profit,
        processing_mode,
        created_at,
        created_by
      `)
      .order('created_at', { ascending: false })
      .limit(50); // Limit to recent 50 batches

    if (error) {
      console.error('❌ Failed to load RFQ batch summaries:', error);
      throw new Error(`Failed to load RFQ batch summaries: ${error.message}`);
    }

    console.log(`✅ Loaded ${data?.length || 0} RFQ batch summaries`);
    return data || [];
  } catch (error) {
    console.error('❌ Error loading RFQ batch summaries:', error);
    throw error;
  }
};

// Load full RFQ batch data (for rerunning)
export const loadRFQBatch = async (batchId: string): Promise<RFQBatch | null> => {
  try {
    console.log('📥 Loading full RFQ batch data:', batchId);

    const { data, error } = await supabase
      .from('rfq_batches')
      .select('*')
      .eq('id', batchId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        console.log('ℹ️ RFQ batch not found:', batchId);
        return null;
      }
      console.error('❌ Failed to load RFQ batch:', error);
      throw new Error(`Failed to load RFQ batch: ${error.message}`);
    }

    console.log('✅ RFQ batch loaded successfully');
    return data;
  } catch (error) {
    console.error('❌ Error loading RFQ batch:', error);
    throw error;
  }
};

// Update RFQ batch with new results
export const updateRFQBatch = async (
  batchId: string,
  results: SmartQuotingResult[],
  pricingSettings?: PricingSettings,
  selectedCarriers?: { [carrierId: string]: boolean },
  selectedCustomer?: string
): Promise<void> => {
  try {
    console.log('🔄 Updating RFQ batch:', batchId);

    // Calculate updated statistics
    const successfulRfqs = results.filter(r => r.status === 'success' && r.quotes.length > 0).length;
    const totalQuotes = results.reduce((sum, r) => sum + r.quotes.length, 0);
    
    let bestTotalPrice = 0;
    let totalProfit = 0;
    
    results.forEach(result => {
      if (result.quotes.length > 0) {
        const bestQuote = result.quotes.reduce((best, current) => 
          (current as any).customerPrice < (best as any).customerPrice ? current : best
        );
        
        if ((bestQuote as any).customerPrice) {
          if (bestTotalPrice === 0 || (bestQuote as any).customerPrice < bestTotalPrice) {
            bestTotalPrice = (bestQuote as any).customerPrice;
          }
          totalProfit += (bestQuote as any).profit || 0;
        }
      }
    });

    const updateData: any = {
      results_data: results,
      successful_rfqs: successfulRfqs,
      total_quotes: totalQuotes,
      best_total_price: bestTotalPrice,
      total_profit: totalProfit,
      updated_at: new Date().toISOString()
    };

    // Update optional fields if provided
    if (pricingSettings) updateData.pricing_settings = pricingSettings;
    if (selectedCarriers) updateData.selected_carriers = selectedCarriers;
    if (selectedCustomer !== undefined) updateData.customer_name = selectedCustomer;

    const { error } = await supabase
      .from('rfq_batches')
      .update(updateData)
      .eq('id', batchId);

    if (error) {
      console.error('❌ Failed to update RFQ batch:', error);
      throw new Error(`Failed to update RFQ batch: ${error.message}`);
    }

    console.log('✅ RFQ batch updated successfully');
  } catch (error) {
    console.error('❌ Error updating RFQ batch:', error);
    throw error;
  }
};

// Delete RFQ batch
export const deleteRFQBatch = async (batchId: string): Promise<void> => {
  try {
    console.log('🗑️ Deleting RFQ batch:', batchId);

    const { error } = await supabase
      .from('rfq_batches')
      .delete()
      .eq('id', batchId);

    if (error) {
      console.error('❌ Failed to delete RFQ batch:', error);
      throw new Error(`Failed to delete RFQ batch: ${error.message}`);
    }

    console.log('✅ RFQ batch deleted successfully');
  } catch (error) {
    console.error('❌ Error deleting RFQ batch:', error);
    throw error;
  }
};

// Generate automatic batch name
export const generateBatchName = (rfqData: RFQRow[], customerName?: string): string => {
  const timestamp = new Date().toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
  
  const customerPrefix = customerName ? `${customerName} - ` : '';
  const rfqCount = rfqData.length;
  const rfqText = rfqCount === 1 ? 'RFQ' : 'RFQs';
  
  return `${customerPrefix}${rfqCount} ${rfqText} - ${timestamp}`;
};