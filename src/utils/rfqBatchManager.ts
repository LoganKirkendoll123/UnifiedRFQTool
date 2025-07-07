import { supabase } from './supabase';
import { RFQRow, PricingSettings } from '../types';

export interface RFQBatch {
  id?: string;
  batch_name: string;
  customer_name?: string;
  branch_filter?: string;
  sales_rep_filter?: string;
  carrier_filter?: string;
  date_range_start?: string;
  date_range_end?: string;
  shipment_count: number;
  total_quotes_received: number;
  best_total_price?: number;
  total_profit?: number;
  pricing_settings: PricingSettings;
  selected_carriers: { [carrierId: string]: boolean };
  rfq_data: RFQRow[];
  results_data?: any[];
  created_at?: string;
  updated_at?: string;
  created_by?: string;
}

export interface RFQBatchSummary {
  id: string;
  batch_name: string;
  customer_name?: string;
  shipment_count: number;
  total_quotes_received: number;
  best_total_price?: number;
  total_profit?: number;
  created_at: string;
  created_by?: string;
}

// Save a new RFQ batch
export const saveRFQBatch = async (batch: Omit<RFQBatch, 'id' | 'created_at' | 'updated_at'>): Promise<RFQBatch> => {
  try {
    console.log('💾 Saving RFQ batch:', batch.batch_name);
    
    const { data, error } = await supabase
      .from('mass_rfq_batches')
      .insert([{
        ...batch,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();
    
    if (error) {
      console.error('❌ Error saving RFQ batch:', error);
      throw error;
    }
    
    console.log('✅ RFQ batch saved successfully:', data.id);
    return data;
  } catch (error) {
    console.error('❌ Failed to save RFQ batch:', error);
    throw error;
  }
};

// Update an existing RFQ batch with results
export const updateRFQBatchResults = async (
  batchId: string, 
  results: any[], 
  summary: {
    total_quotes_received: number;
    best_total_price?: number;
    total_profit?: number;
  }
): Promise<RFQBatch> => {
  try {
    console.log('🔄 Updating RFQ batch results:', batchId);
    
    const { data, error } = await supabase
      .from('mass_rfq_batches')
      .update({
        results_data: results,
        total_quotes_received: summary.total_quotes_received,
        best_total_price: summary.best_total_price,
        total_profit: summary.total_profit,
        updated_at: new Date().toISOString()
      })
      .eq('id', batchId)
      .select()
      .single();
    
    if (error) {
      console.error('❌ Error updating RFQ batch:', error);
      throw error;
    }
    
    console.log('✅ RFQ batch updated successfully');
    return data;
  } catch (error) {
    console.error('❌ Failed to update RFQ batch:', error);
    throw error;
  }
};

// Get all RFQ batches (summary view)
export const getRFQBatches = async (limit: number = 50): Promise<RFQBatchSummary[]> => {
  try {
    console.log('📋 Loading RFQ batches...');
    
    const { data, error } = await supabase
      .from('mass_rfq_batches')
      .select(`
        id,
        batch_name,
        customer_name,
        shipment_count,
        total_quotes_received,
        best_total_price,
        total_profit,
        created_at,
        created_by
      `)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('❌ Error loading RFQ batches:', error);
      throw error;
    }
    
    console.log(`✅ Loaded ${data?.length || 0} RFQ batches`);
    return data || [];
  } catch (error) {
    console.error('❌ Failed to load RFQ batches:', error);
    throw error;
  }
};

// Get a specific RFQ batch with full data
export const getRFQBatch = async (batchId: string): Promise<RFQBatch | null> => {
  try {
    console.log('📋 Loading RFQ batch:', batchId);
    
    const { data, error } = await supabase
      .from('mass_rfq_batches')
      .select('*')
      .eq('id', batchId)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        console.log('ℹ️ RFQ batch not found:', batchId);
        return null;
      }
      console.error('❌ Error loading RFQ batch:', error);
      throw error;
    }
    
    console.log('✅ RFQ batch loaded successfully');
    return data;
  } catch (error) {
    console.error('❌ Failed to load RFQ batch:', error);
    throw error;
  }
};

// Delete an RFQ batch
export const deleteRFQBatch = async (batchId: string): Promise<void> => {
  try {
    console.log('🗑️ Deleting RFQ batch:', batchId);
    
    const { error } = await supabase
      .from('mass_rfq_batches')
      .delete()
      .eq('id', batchId);
    
    if (error) {
      console.error('❌ Error deleting RFQ batch:', error);
      throw error;
    }
    
    console.log('✅ RFQ batch deleted successfully');
  } catch (error) {
    console.error('❌ Failed to delete RFQ batch:', error);
    throw error;
  }
};

// Search RFQ batches by name or customer
export const searchRFQBatches = async (searchTerm: string, limit: number = 20): Promise<RFQBatchSummary[]> => {
  try {
    console.log('🔍 Searching RFQ batches:', searchTerm);
    
    const { data, error } = await supabase
      .from('mass_rfq_batches')
      .select(`
        id,
        batch_name,
        customer_name,
        shipment_count,
        total_quotes_received,
        best_total_price,
        total_profit,
        created_at,
        created_by
      `)
      .or(`batch_name.ilike.%${searchTerm}%,customer_name.ilike.%${searchTerm}%`)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('❌ Error searching RFQ batches:', error);
      throw error;
    }
    
    console.log(`✅ Found ${data?.length || 0} matching RFQ batches`);
    return data || [];
  } catch (error) {
    console.error('❌ Failed to search RFQ batches:', error);
    throw error;
  }
};

// Calculate batch summary from results
export const calculateBatchSummary = (results: any[]): {
  total_quotes_received: number;
  best_total_price?: number;
  total_profit?: number;
} => {
  const totalQuotes = results.reduce((sum, result) => sum + (result.quotes?.length || 0), 0);
  
  const allQuotes = results.flatMap(result => result.quotes || []);
  const bestPrice = allQuotes.length > 0 
    ? Math.min(...allQuotes.map(q => q.customerPrice || q.baseRate + q.fuelSurcharge + q.premiumsAndDiscounts))
    : undefined;
  
  const totalProfit = allQuotes.reduce((sum, quote) => sum + (quote.profit || 0), 0);
  
  return {
    total_quotes_received: totalQuotes,
    best_total_price: bestPrice,
    total_profit: totalProfit > 0 ? totalProfit : undefined
  };
};