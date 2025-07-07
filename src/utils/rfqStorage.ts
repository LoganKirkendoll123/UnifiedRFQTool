import { supabase } from './supabase';
import { RFQRow, PricingSettings, QuoteWithPricing } from '../types';
import { SmartQuotingResult } from './rfqProcessor';

export interface RFQBatch {
  id: string;
  batch_name: string;
  customer_name?: string;
  pricing_settings: PricingSettings;
  selected_carriers: { [carrierId: string]: boolean };
  processing_mode: string;
  total_rfqs: number;
  successful_rfqs: number;
  total_quotes: number;
  best_total_price: number;
  total_profit: number;
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

export interface RFQRequest {
  id: string;
  request_payload: RFQRow;
  quoting_decision: string;
  quoting_reason: string;
  from_zip: string;
  to_zip: string;
  pallets: number;
  gross_weight: number;
  is_reefer: boolean;
  temperature?: string;
  commodity?: string;
  created_at: string;
}

export interface RFQResponse {
  id: string;
  request_id: string;
  batch_id: string;
  carrier_name: string;
  carrier_code?: string;
  carrier_scac?: string;
  quote_id: string;
  service_level_code?: string;
  service_level_description?: string;
  carrier_total_rate: number;
  customer_price: number;
  profit: number;
  markup_applied: number;
  applied_margin_type?: string;
  applied_margin_percentage?: number;
  is_custom_price: boolean;
  transit_days?: number;
  quote_mode?: string;
  raw_response: any;
  charge_breakdown?: any;
  created_at: string;
}

// Create a new RFQ batch
export const createRFQBatch = async (
  batchName: string,
  pricingSettings: PricingSettings,
  selectedCarriers: { [carrierId: string]: boolean },
  selectedCustomer?: string,
  processingMode: string = 'smart'
): Promise<string> => {
  try {
    console.log('🆕 Creating new RFQ batch...', { batchName, customer: selectedCustomer, mode: processingMode });

    const batchData = {
      batch_name: batchName,
      customer_name: selectedCustomer || null,
      pricing_settings: pricingSettings,
      selected_carriers: selectedCarriers,
      processing_mode: processingMode,
      created_by: 'user' // TODO: Replace with actual user ID when auth is implemented
    };

    const { data, error } = await supabase
      .from('rfq_batches')
      .insert([batchData])
      .select('id')
      .single();

    if (error) {
      console.error('❌ Failed to create RFQ batch:', error);
      throw new Error(`Failed to create RFQ batch: ${error.message}`);
    }

    console.log('✅ RFQ batch created successfully:', data.id);
    return data.id;
  } catch (error) {
    console.error('❌ Error creating RFQ batch:', error);
    throw error;
  }
};

// Save individual RFQ request
export const saveRFQRequest = async (
  rfqData: RFQRow,
  quotingDecision: string,
  quotingReason: string
): Promise<string> => {
  try {
    console.log('💾 Saving RFQ request...', { 
      route: `${rfqData.fromZip} → ${rfqData.toZip}`,
      decision: quotingDecision 
    });

    const requestData = {
      request_payload: rfqData,
      quoting_decision: quotingDecision,
      quoting_reason: quotingReason,
      from_zip: rfqData.fromZip,
      to_zip: rfqData.toZip,
      pallets: rfqData.pallets,
      gross_weight: rfqData.grossWeight,
      is_reefer: rfqData.isReefer || false,
      temperature: rfqData.temperature,
      commodity: rfqData.commodity
    };

    const { data, error } = await supabase
      .from('rfq_requests')
      .insert([requestData])
      .select('id')
      .single();

    if (error) {
      console.error('❌ Failed to save RFQ request:', error);
      throw new Error(`Failed to save RFQ request: ${error.message}`);
    }

    console.log('✅ RFQ request saved successfully:', data.id);
    return data.id;
  } catch (error) {
    console.error('❌ Error saving RFQ request:', error);
    throw error;
  }
};

// Link RFQ request to batch
export const linkRequestToBatch = async (
  batchId: string,
  requestId: string,
  rowIndex: number,
  status: string = 'pending',
  errorMessage?: string
): Promise<void> => {
  try {
    const linkData = {
      batch_id: batchId,
      request_id: requestId,
      row_index: rowIndex,
      status,
      error_message: errorMessage
    };

    const { error } = await supabase
      .from('rfq_batch_requests')
      .insert([linkData]);

    if (error) {
      console.error('❌ Failed to link request to batch:', error);
      throw new Error(`Failed to link request to batch: ${error.message}`);
    }

    console.log('✅ Request linked to batch successfully');
  } catch (error) {
    console.error('❌ Error linking request to batch:', error);
    throw error;
  }
};

// Save individual quote response
export const saveRFQResponse = async (
  requestId: string,
  batchId: string,
  quote: QuoteWithPricing
): Promise<string> => {
  try {
    console.log('💾 Saving RFQ response...', { 
      requestId,
      carrier: quote.carrier.name,
      price: quote.customerPrice 
    });

    const responseData = {
      request_id: requestId,
      batch_id: batchId,
      carrier_name: quote.carrier.name,
      carrier_code: quote.carrierCode,
      carrier_scac: quote.carrier.scac,
      quote_id: quote.id || quote.quoteId.toString(),
      service_level_code: quote.serviceLevel?.code,
      service_level_description: quote.serviceLevel?.description,
      carrier_total_rate: quote.carrierTotalRate,
      customer_price: quote.customerPrice,
      profit: quote.profit,
      markup_applied: quote.markupApplied,
      applied_margin_type: quote.appliedMarginType,
      applied_margin_percentage: quote.appliedMarginPercentage,
      is_custom_price: quote.isCustomPrice,
      transit_days: quote.transitDays,
      quote_mode: (quote as any).quoteMode, // For dual-mode quotes
      raw_response: quote, // Store full quote object
      charge_breakdown: quote.chargeBreakdown
    };

    const { data, error } = await supabase
      .from('rfq_responses')
      .insert([responseData])
      .select('id')
      .single();

    if (error) {
      console.error('❌ Failed to save RFQ response:', error);
      throw new Error(`Failed to save RFQ response: ${error.message}`);
    }

    console.log('✅ RFQ response saved successfully:', data.id);
    return data.id;
  } catch (error) {
    console.error('❌ Error saving RFQ response:', error);
    throw error;
  }
};

// Update batch request status
export const updateBatchRequestStatus = async (
  batchId: string,
  requestId: string,
  status: string,
  errorMessage?: string
): Promise<void> => {
  try {
    const updateData: any = { status };
    if (errorMessage) updateData.error_message = errorMessage;

    const { error } = await supabase
      .from('rfq_batch_requests')
      .update(updateData)
      .eq('batch_id', batchId)
      .eq('request_id', requestId);

    if (error) {
      console.error('❌ Failed to update batch request status:', error);
      throw new Error(`Failed to update batch request status: ${error.message}`);
    }

    console.log('✅ Batch request status updated successfully');
  } catch (error) {
    console.error('❌ Error updating batch request status:', error);
    throw error;
  }
};

// Update batch statistics
export const updateBatchStatistics = async (batchId: string): Promise<void> => {
  try {
    console.log('📊 Updating batch statistics...', batchId);

    // Get batch request counts
    const { data: batchRequests, error: batchError } = await supabase
      .from('rfq_batch_requests')
      .select('status')
      .eq('batch_id', batchId);

    if (batchError) throw batchError;

    // Get response statistics
    const { data: responses, error: responseError } = await supabase
      .from('rfq_responses')
      .select('customer_price, profit')
      .eq('batch_id', batchId);

    if (responseError) throw responseError;

    const totalRfqs = batchRequests?.length || 0;
    const successfulRfqs = batchRequests?.filter(r => r.status === 'success').length || 0;
    const totalQuotes = responses?.length || 0;
    
    let bestTotalPrice = 0;
    let totalProfit = 0;
    
    if (responses && responses.length > 0) {
      bestTotalPrice = Math.min(...responses.map(r => r.customer_price));
      totalProfit = responses.reduce((sum, r) => sum + r.profit, 0);
    }

    const { error: updateError } = await supabase
      .from('rfq_batches')
      .update({
        total_rfqs: totalRfqs,
        successful_rfqs: successfulRfqs,
        total_quotes: totalQuotes,
        best_total_price: bestTotalPrice,
        total_profit: totalProfit,
        updated_at: new Date().toISOString()
      })
      .eq('id', batchId);

    if (updateError) {
      console.error('❌ Failed to update batch statistics:', updateError);
      throw updateError;
    }

    console.log('✅ Batch statistics updated successfully');
  } catch (error) {
    console.error('❌ Error updating batch statistics:', error);
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

// Load full RFQ batch with all requests and responses
export const loadRFQBatchWithData = async (batchId: string): Promise<{
  batch: RFQBatch;
  requests: RFQRequest[];
  responses: RFQResponse[];
} | null> => {
  try {
    console.log('📥 Loading full RFQ batch data:', batchId);

    // Load batch metadata
    const { data: batchData, error: batchError } = await supabase
      .from('rfq_batches')
      .select('*')
      .eq('id', batchId)
      .single();

    if (batchError) {
      if (batchError.code === 'PGRST116') {
        console.log('ℹ️ RFQ batch not found:', batchId);
        return null;
      }
      throw batchError;
    }

    // Load requests linked to this batch
    const { data: requestLinks, error: linkError } = await supabase
      .from('rfq_batch_requests')
      .select(`
        request_id,
        row_index,
        status,
        error_message,
        rfq_requests (*)
      `)
      .eq('batch_id', batchId)
      .order('row_index');

    if (linkError) throw linkError;

    // Load responses for this batch
    const { data: responses, error: responseError } = await supabase
      .from('rfq_responses')
      .select('*')
      .eq('batch_id', batchId)
      .order('created_at');

    if (responseError) throw responseError;

    const requests = requestLinks?.map(link => link.rfq_requests).filter(Boolean) || [];

    console.log('✅ RFQ batch data loaded successfully', {
      requests: requests.length,
      responses: responses?.length || 0
    });

    return {
      batch: batchData,
      requests: requests as RFQRequest[],
      responses: responses || []
    };
  } catch (error) {
    console.error('❌ Error loading RFQ batch data:', error);
    throw error;
  }
};

// Reconstruct SmartQuotingResult from stored data
export const reconstructSmartQuotingResults = async (batchId: string): Promise<SmartQuotingResult[]> => {
  try {
    console.log('🔄 Reconstructing SmartQuotingResults from stored data...', batchId);

    const batchData = await loadRFQBatchWithData(batchId);
    if (!batchData) {
      throw new Error('Batch not found');
    }

    const { requests, responses } = batchData;
    const results: SmartQuotingResult[] = [];

    // Group responses by request_id
    const responsesByRequest = responses.reduce((groups, response) => {
      if (!groups[response.request_id]) {
        groups[response.request_id] = [];
      }
      groups[response.request_id].push(response);
      return groups;
    }, {} as Record<string, RFQResponse[]>);

    // Reconstruct results for each request
    requests.forEach((request, index) => {
      const requestResponses = responsesByRequest[request.id] || [];
      
      // Convert stored responses back to QuoteWithPricing format
      const quotes: QuoteWithPricing[] = requestResponses.map(response => {
        const quote = response.raw_response as QuoteWithPricing;
        // Ensure the quote has the latest pricing data
        return {
          ...quote,
          carrierTotalRate: response.carrier_total_rate,
          customerPrice: response.customer_price,
          profit: response.profit,
          markupApplied: response.markup_applied,
          appliedMarginType: response.applied_margin_type as any,
          appliedMarginPercentage: response.applied_margin_percentage || 0,
          isCustomPrice: response.is_custom_price,
          chargeBreakdown: response.charge_breakdown || quote.chargeBreakdown
        };
      });

      const result: SmartQuotingResult = {
        rowIndex: index,
        originalData: request.request_payload,
        quotes,
        status: quotes.length > 0 ? 'success' : 'error',
        quotingDecision: request.quoting_decision as any,
        quotingReason: request.quoting_reason
      };

      results.push(result);
    });

    console.log(`✅ Reconstructed ${results.length} SmartQuotingResults`);
    return results;
  } catch (error) {
    console.error('❌ Error reconstructing SmartQuotingResults:', error);
    throw error;
  }
};

// Delete RFQ batch and all related data
export const deleteRFQBatch = async (batchId: string): Promise<void> => {
  try {
    console.log('🗑️ Deleting RFQ batch and all related data:', batchId);

    // Delete batch (cascading deletes will handle related data)
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

// Load RFQ batch (simplified interface for UnifiedRFQTool)
export const loadRFQBatch = async (batchId: string): Promise<{
  id: string;
  batch_name: string;
  customer_name?: string;
  rfq_data: RFQRow[];
  results_data?: any[];
  pricing_settings: PricingSettings;
  selected_carriers: { [carrierId: string]: boolean };
} | null> => {
  try {
    console.log('📥 Loading RFQ batch for UnifiedRFQTool:', batchId);

    // First try to load from mass_rfq_batches (new format)
    const { data: massRfqData, error: massRfqError } = await supabase
      .from('mass_rfq_batches')
      .select('*')
      .eq('id', batchId)
      .single();

    if (!massRfqError && massRfqData) {
      console.log('✅ Loaded from mass_rfq_batches');
      return {
        id: massRfqData.id,
        batch_name: massRfqData.batch_name,
        customer_name: massRfqData.customer_name,
        rfq_data: massRfqData.rfq_data,
        results_data: massRfqData.results_data,
        pricing_settings: massRfqData.pricing_settings,
        selected_carriers: massRfqData.selected_carriers
      };
    }

    // Fallback to rfq_batches (old format) and reconstruct
    const batchData = await loadRFQBatchWithData(batchId);
    if (!batchData) {
      console.log('ℹ️ RFQ batch not found:', batchId);
      return null;
    }

    // Convert requests back to RFQRow format
    const rfqData: RFQRow[] = batchData.requests.map(request => request.request_payload);

    // Reconstruct results if available
    let resultsData;
    try {
      resultsData = await reconstructSmartQuotingResults(batchId);
    } catch (error) {
      console.warn('Could not reconstruct results:', error);
      resultsData = [];
    }

    console.log('✅ Loaded and reconstructed from rfq_batches');
    return {
      id: batchData.batch.id,
      batch_name: batchData.batch.batch_name,
      customer_name: batchData.batch.customer_name,
      rfq_data: rfqData,
      results_data: resultsData,
      pricing_settings: batchData.batch.pricing_settings,
      selected_carriers: batchData.batch.selected_carriers
    };
  } catch (error) {
    console.error('❌ Error loading RFQ batch:', error);
    throw error;
  }
};

// Update RFQ batch (simplified interface for UnifiedRFQTool)
export const updateRFQBatch = async (
  batchId: string,
  results: any[],
  pricingSettings: PricingSettings,
  selectedCarriers: { [carrierId: string]: boolean },
  selectedCustomer?: string
): Promise<void> => {
  try {
    console.log('🔄 Updating RFQ batch:', batchId);

    // Calculate summary statistics
    const totalQuotes = results.reduce((sum, result) => sum + (result.quotes?.length || 0), 0);
    const bestTotalPrice = results.length > 0 ? 
      Math.min(...results.flatMap(r => r.quotes?.map((q: any) => q.customerPrice || 0) || [0])) : 0;
    const totalProfit = results.reduce((sum, result) => 
      sum + (result.quotes?.reduce((qSum: number, q: any) => qSum + (q.profit || 0), 0) || 0), 0);

    // First try to update mass_rfq_batches
    const { error: massRfqError } = await supabase
      .from('mass_rfq_batches')
      .update({
        results_data: results,
        pricing_settings: pricingSettings,
        selected_carriers: selectedCarriers,
        customer_name: selectedCustomer,
        total_quotes_received: totalQuotes,
        best_total_price: bestTotalPrice,
        total_profit: totalProfit,
        updated_at: new Date().toISOString()
      })
      .eq('id', batchId);

    if (!massRfqError) {
      console.log('✅ Updated mass_rfq_batches successfully');
      return;
    }

    // Fallback to updating rfq_batches
    const { error: rfqBatchError } = await supabase
      .from('rfq_batches')
      .update({
        pricing_settings: pricingSettings,
        selected_carriers: selectedCarriers,
        customer_name: selectedCustomer,
        total_quotes: totalQuotes,
        best_total_price: bestTotalPrice,
        total_profit: totalProfit,
        updated_at: new Date().toISOString()
      })
      .eq('id', batchId);

    if (rfqBatchError) {
      console.error('❌ Failed to update RFQ batch:', rfqBatchError);
      throw new Error(`Failed to update RFQ batch: ${rfqBatchError.message}`);
    }

    console.log('✅ Updated rfq_batches successfully');
  } catch (error) {
    console.error('❌ Error updating RFQ batch:', error);
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

// Save complete RFQ processing results (legacy compatibility)
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
    console.log('💾 Saving complete RFQ batch with relational structure...', {
      batchName,
      rfqCount: rfqData.length,
      resultsCount: results.length
    });

    // Create the batch
    const batchId = await createRFQBatch(
      batchName,
      pricingSettings,
      selectedCarriers,
      selectedCustomer,
      processingMode
    );

    // Save each RFQ request and its responses
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const rfq = rfqData[i];

      // Save the request
      const requestId = await saveRFQRequest(
        rfq,
        result.quotingDecision,
        result.quotingReason
      );

      // Link request to batch
      await linkRequestToBatch(batchId, requestId, i, result.status, result.error);

      // Save all quote responses for this request
      for (const quote of result.quotes) {
        await saveRFQResponse(requestId, batchId, quote);
      }
    }

    // Update batch statistics
    await updateBatchStatistics(batchId);

    console.log('✅ Complete RFQ batch saved with relational structure');
    return batchId;
  } catch (error) {
    console.error('❌ Error saving complete RFQ batch:', error);
    throw error;
  }
};