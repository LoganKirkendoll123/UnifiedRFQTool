import { useState, useCallback, useMemo } from 'react';
import { RFQProcessor, RFQProcessingOptions, SmartQuotingResult } from '../utils/rfqProcessor';
import { Project44APIClient, FreshXAPIClient } from '../utils/apiClient';
import { RFQRow } from '../types';
import { 
  createRFQBatch, 
  saveRFQRequest, 
  linkRequestToBatch, 
  saveRFQResponse, 
  updateBatchRequestStatus,
  updateBatchStatistics,
  reconstructSmartQuotingResults
} from '../utils/rfqStorage';

export interface UseRFQProcessorOptions {
  project44Client: Project44APIClient | null;
  freshxClient: FreshXAPIClient | null;
}

export interface ProcessingStatus {
  isProcessing: boolean;
  currentStep: number;
  totalSteps: number;
  currentItem?: string;
  error?: string;
}

export const useRFQProcessor = ({ project44Client, freshxClient }: UseRFQProcessorOptions) => {
  const [results, setResults] = useState<SmartQuotingResult[]>([]);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>({
    isProcessing: false,
    currentStep: 0,
    totalSteps: 0
  });
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(null);

  // Create processor instance
  const processor = useMemo(() => {
    return new RFQProcessor(project44Client, freshxClient);
  }, [project44Client, freshxClient]);

  // Process single RFQ
  const processSingleRFQ = useCallback(async (
    rfq: RFQRow,
    options: RFQProcessingOptions
  ): Promise<SmartQuotingResult> => {
    setProcessingStatus({
      isProcessing: true,
      currentStep: 1,
      totalSteps: 1,
      currentItem: 'Processing RFQ...'
    });

    try {
      const result = await processor.processSingleRFQ(rfq, options);
      setResults([result]);
      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Processing failed';
      setProcessingStatus(prev => ({ ...prev, error: errorMsg }));
      throw error;
    } finally {
      setProcessingStatus(prev => ({ ...prev, isProcessing: false }));
    }
  }, [processor]);

  // Process multiple RFQs
  const processMultipleRFQs = useCallback(async (
    rfqs: RFQRow[],
    options: RFQProcessingOptions,
    batchName?: string
  ): Promise<SmartQuotingResult[]> => {
    setProcessingStatus({
      isProcessing: true,
      currentStep: 0,
      totalSteps: rfqs.length
    });
    setResults([]);
    
    let batchId: string | null = null;
    
    // Create batch if batch name is provided
    if (batchName) {
      try {
        batchId = await createRFQBatch(
          batchName,
          options.pricingSettings,
          options.selectedCarriers,
          options.selectedCustomer
        );
        setCurrentBatchId(batchId);
        console.log('📦 Created batch for real-time saving:', batchId);
      } catch (error) {
        console.error('❌ Failed to create batch, continuing without real-time saving:', error);
      }
    }

    const processingOptions: RFQProcessingOptions = {
      ...options,
      onProgress: (current, total, currentItem) => {
        setProcessingStatus(prev => ({
          ...prev,
          currentStep: current,
          totalSteps: total,
          currentItem
        }));
      }
    };

    try {
      const allResults: SmartQuotingResult[] = [];
      
      // Process each RFQ individually for real-time saving
      for (let i = 0; i < rfqs.length; i++) {
        const rfq = rfqs[i];
        
        if (processingOptions.onProgress) {
          processingOptions.onProgress(i + 1, rfqs.length, `Processing RFQ ${i + 1}...`);
        }
        
        try {
          const result = await processor.processSingleRFQ(rfq, processingOptions, i);
          allResults.push(result);
          
          // Save to database in real-time if we have a batch
          if (batchId) {
            try {
              // Save the request
              const requestId = await saveRFQRequest(
                rfq,
                result.quotingDecision,
                result.quotingReason
              );
              
              // Link to batch
              await linkRequestToBatch(batchId, requestId, i, 'processing');
              
              // Save all quotes
              for (const quote of result.quotes) {
                await saveRFQResponse(requestId, batchId, quote);
              }
              
              // Update status
              await updateBatchRequestStatus(batchId, requestId, result.status, result.error);
              
              console.log(`✅ Saved RFQ ${i + 1} to database in real-time`);
            } catch (saveError) {
              console.error(`❌ Failed to save RFQ ${i + 1} to database:`, saveError);
            }
          }
          
          // Update UI with current results
          setResults([...allResults]);
          
        } catch (error) {
          const errorResult: SmartQuotingResult = {
            rowIndex: i,
            originalData: rfq,
            quotes: [],
            status: 'error',
            error: error instanceof Error ? error.message : 'Processing failed',
            quotingDecision: 'project44-standard',
            quotingReason: 'Error occurred during processing'
          };
          allResults.push(errorResult);
          setResults([...allResults]);
        }
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Update final batch statistics
      if (batchId) {
        try {
          await updateBatchStatistics(batchId);
          console.log('📊 Updated final batch statistics');
        } catch (error) {
          console.error('❌ Failed to update batch statistics:', error);
        }
      }
      
      setResults(allResults);
      return allResults;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Processing failed';
      setProcessingStatus(prev => ({ ...prev, error: errorMsg }));
      throw error;
    } finally {
      setProcessingStatus(prev => ({ ...prev, isProcessing: false }));
      setCurrentBatchId(null);
    }
  }, [processor]);

  // Process RFQs for account group
  const processRFQsForAccountGroup = useCallback(async (
    rfqs: RFQRow[],
    accountGroupCode: string,
    options: Omit<RFQProcessingOptions, 'selectedCarriers'>
  ): Promise<SmartQuotingResult[]> => {
    setProcessingStatus({
      isProcessing: true,
      currentStep: 0,
      totalSteps: rfqs.length
    });
    setResults([]);

    const processingOptions = {
      ...options,
      onProgress: (current: number, total: number, currentItem?: string) => {
        setProcessingStatus(prev => ({
          ...prev,
          currentStep: current,
          totalSteps: total,
          currentItem
        }));
      }
    };

    try {
      const allResults = await processor.processRFQsForAccountGroup(rfqs, accountGroupCode, processingOptions);
      setResults(allResults);
      return allResults;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Processing failed';
      setProcessingStatus(prev => ({ ...prev, error: errorMsg }));
      throw error;
    } finally {
      setProcessingStatus(prev => ({ ...prev, isProcessing: false }));
    }
  }, [processor]);

  // Update quote pricing
  const updateQuotePricing = useCallback((
    resultIndex: number,
    quoteId: number,
    newPrice: number,
    options: Pick<RFQProcessingOptions, 'pricingSettings' | 'selectedCustomer'>
  ) => {
    setResults(prevResults => 
      processor.updateQuotePricing(prevResults, resultIndex, quoteId, newPrice, options)
    );
  }, [processor]);

  // Validate RFQ
  const validateRFQ = useCallback((rfq: RFQRow): string[] => {
    return processor.validateRFQ(rfq);
  }, [processor]);

  // Clear results
  const clearResults = useCallback(() => {
    setResults([]);
    setCurrentBatchId(null);
    setProcessingStatus({
      isProcessing: false,
      currentStep: 0,
      totalSteps: 0
    });
  }, []);

  // Load past RFQ results
  const loadPastRFQResults = useCallback(async (batchId: string): Promise<SmartQuotingResult[]> => {
    try {
      console.log('📥 Loading past RFQ results:', batchId);
      const results = await reconstructSmartQuotingResults(batchId);
      setResults(results);
      setCurrentBatchId(batchId);
      return results;
    } catch (error) {
      console.error('❌ Failed to load past RFQ results:', error);
      throw error;
    }
  }, []);
  // Clear error
  const clearError = useCallback(() => {
    setProcessingStatus(prev => ({ ...prev, error: undefined }));
  }, []);

  return {
    results,
    setResults,
    currentBatchId,
    processingStatus,
    processSingleRFQ,
    processMultipleRFQs,
    processRFQsForAccountGroup,
    updateQuotePricing,
    validateRFQ,
    clearResults,
    loadPastRFQResults,
    clearError
  };
};