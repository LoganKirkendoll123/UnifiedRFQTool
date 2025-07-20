import { useState, useCallback, useMemo } from 'react';
import { RFQProcessor, RFQProcessingOptions, SmartQuotingResult } from '../utils/rfqProcessor';
import { Project44APIClient, FreshXAPIClient } from '../utils/apiClient';
import { RFQRow } from '../types';

export interface UseRFQProcessorOptions {
  project44Client: Project44APIClient | null;
  freshxClient: FreshXAPIClient | null;
}

export interface ProcessingStatus {
  isProcessing: boolean;
  currentStep: number;
  totalSteps: number;
  currentItem?: string;
  currentBatch?: {
    current: number;
    total: number;
  };
  error?: string;
}

export const useRFQProcessor = ({ project44Client, freshxClient }: UseRFQProcessorOptions) => {
  const [results, setResults] = useState<SmartQuotingResult[]>([]);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>({
    isProcessing: false,
    currentStep: 0,
    totalSteps: 0
  });

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
    options: RFQProcessingOptions
  ): Promise<SmartQuotingResult[]> => {
    setProcessingStatus({
      isProcessing: true,
      currentStep: 0,
      totalSteps: rfqs.length
    });
    setResults([]);

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
      const allResults = await processor.processMultipleRFQs(rfqs, processingOptions);
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
    setProcessingStatus({
      isProcessing: false,
      currentStep: 0,
      totalSteps: 0
    });
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setProcessingStatus(prev => ({ ...prev, error: undefined }));
  }, []);

  return {
    results,
    processingStatus,
    processSingleRFQ,
    processMultipleRFQs,
    processRFQsForAccountGroup,
    updateQuotePricing,
    validateRFQ,
    clearResults,
    clearError
  };
};