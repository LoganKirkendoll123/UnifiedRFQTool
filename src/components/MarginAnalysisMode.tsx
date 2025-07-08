import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';

interface MarginAnalysisModeProps {
  project44Client?: any;
}

export default function MarginAnalysisMode({ project44Client }: MarginAnalysisModeProps) {
  const [loading, setLoading] = useState(false);
  const [connectionError, setConnectionError] = useState('');
  const [customers, setCustomers] = useState<string[]>([]);
  const [carriers, setCarriers] = useState<string[]>([]);
  
  // Default date range (last 30 days)
  const [dateRange, setDateRange] = useState({
    startDate: (() => {
      const date = new Date();
      date.setDate(date.getDate() - 30);
      return date.toISOString().split('T')[0];
    })(),
    endDate: (() => {
      const date = new Date();
      return date.toISOString().split('T')[0];
    })()
  });

  useEffect(() => {
    loadCustomers();
    loadCarriers();
  }, [project44Client]);

  const loadCustomers = async () => {
    setLoading(true);
    setConnectionError('');
    
    try {
      console.log('📋 Loading customers from CustomerCarriers table...');
      
      const allCustomers: any[] = [];
      let from = 0;
      const batchSize = 1000;
      let hasMore = true;
      
      while (hasMore) {
        const { data, error } = await supabase
          .from('CustomerCarriers')
          .select('InternalName')
          .not('InternalName', 'is', null)
          .range(from, from + batchSize - 1);
        
        if (error) {
          console.error('❌ Supabase query error:', error);
          setConnectionError(`Database connection error: ${error.message}. Please check your Supabase configuration.`);
          setCustomers([]);
          return;
        }
        
        if (data && data.length > 0) {
          allCustomers.push(...data);
          from += batchSize;
          hasMore = data.length === batchSize;
          console.log(`📋 Loaded customer batch: ${data.length} customers (total: ${allCustomers.length})`);
        } else {
          hasMore = false;
        }
      }
      
      if (!allCustomers || allCustomers.length === 0) {
        setConnectionError('CustomerCarriers table is empty or contains no valid customer records. Please ensure your customer carrier data is loaded.');
        setCustomers([]);
        return;
      }
      
      const uniqueCustomers = [...new Set(allCustomers.map(d => d.InternalName).filter(Boolean))].sort();
      setCustomers(uniqueCustomers);
      console.log(`✅ Loaded ${uniqueCustomers.length} unique customers from ${allCustomers.length} total records`);
      
      if (uniqueCustomers.length === 0) {
        setConnectionError('CustomerCarriers table contains no valid customer records. Please ensure your customer carrier data is loaded.');
      }
    } catch (error) {
      console.error('❌ Failed to load customers:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setConnectionError(`Failed to load customers: ${errorMessage}`);
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  const loadCarriers = async () => {
    try {
      console.log('🚛 Loading carriers from CustomerCarriers table...');
      
      const { data, error } = await supabase
        .from('CustomerCarriers')
        .select('P44CarrierCode')
        .not('P44CarrierCode', 'is', null);
      
      if (error) {
        console.error('❌ Failed to load carriers:', error);
        return;
      }
      
      const uniqueCarriers = [...new Set(data.map(d => d.P44CarrierCode).filter(Boolean))].sort();
      setCarriers(uniqueCarriers);
      console.log(`✅ Loaded ${uniqueCarriers.length} unique carriers`);
    } catch (error) {
      console.error('❌ Failed to load carriers:', error);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Margin Analysis Mode</h2>
        
        {connectionError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Connection Error</h3>
                <p className="mt-1 text-sm text-red-700">{connectionError}</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Start Date
            </label>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              End Date
            </label>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Customers ({customers.length})
            </label>
            <div className="max-h-40 overflow-y-auto border border-gray-300 rounded-md p-2">
              {loading ? (
                <p className="text-gray-500">Loading customers...</p>
              ) : customers.length > 0 ? (
                customers.map((customer) => (
                  <div key={customer} className="flex items-center py-1">
                    <input
                      type="checkbox"
                      id={`customer-${customer}`}
                      className="mr-2"
                    />
                    <label htmlFor={`customer-${customer}`} className="text-sm text-gray-700">
                      {customer}
                    </label>
                  </div>
                ))
              ) : (
                <p className="text-gray-500">No customers found</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Carriers ({carriers.length})
            </label>
            <div className="max-h-40 overflow-y-auto border border-gray-300 rounded-md p-2">
              {carriers.length > 0 ? (
                carriers.map((carrier) => (
                  <div key={carrier} className="flex items-center py-1">
                    <input
                      type="checkbox"
                      id={`carrier-${carrier}`}
                      className="mr-2"
                    />
                    <label htmlFor={`carrier-${carrier}`} className="text-sm text-gray-700">
                      {carrier}
                    </label>
                  </div>
                ))
              ) : (
                <p className="text-gray-500">No carriers found</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-center">
          <button
            disabled={loading || customers.length === 0}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Loading...' : 'Analyze Margins'}
          </button>
        </div>
      </div>
    </div>
  );
}