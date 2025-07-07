import React, { useState, useEffect } from 'react';
import { Search, Users, Building2, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase, checkSupabaseConnection } from '../utils/supabase';

interface CustomerSelectionProps {
  selectedCustomer: string;
  onCustomerChange: (customer: string) => void;
}

export const CustomerSelection: React.FC<CustomerSelectionProps> = ({
  selectedCustomer,
  onCustomerChange
}) => {
  const [customers, setCustomers] = useState<string[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    if (searchTerm) {
      const filtered = customers.filter(customer =>
        customer.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredCustomers(filtered);
    } else {
      setFilteredCustomers(customers);
    }
  }, [searchTerm, customers]);

  const loadCustomers = async () => {
    setLoading(true);
    setError('');
    
    try {
      // First check if Supabase is properly configured
      const connectionCheck = await checkSupabaseConnection();
      if (!connectionCheck.connected) {
        throw new Error(connectionCheck.error || 'Unable to connect to database');
      }

      // Try to get customers from CustomerCarriers table first (has InternalName field)
      let uniqueCustomers: string[] = [];
      
      try {
        const { data: carrierData, error: carrierError } = await supabase
          .from('CustomerCarriers')
          .select('InternalName')
          .not('InternalName', 'is', null);
        
        if (!carrierError && carrierData) {
          uniqueCustomers = [...new Set(carrierData.map(d => d.InternalName).filter(Boolean))];
          console.log(`✅ Loaded ${uniqueCustomers.length} customers from CustomerCarriers`);
        }
      } catch (carrierErr) {
        console.warn('⚠️ Could not load from CustomerCarriers, trying Shipments table');
      }
      
      // If CustomerCarriers didn't work or returned no data, try Shipments table
      if (uniqueCustomers.length === 0) {
        const { data: shipmentData, error: shipmentError } = await supabase
          .from('Shipments')
          .select('Customer')
          .not('Customer', 'is', null);
        
        if (shipmentError) {
          throw shipmentError;
        }
        
        if (shipmentData) {
          uniqueCustomers = [...new Set(shipmentData.map(d => d.Customer).filter(Boolean))];
          console.log(`✅ Loaded ${uniqueCustomers.length} customers from Shipments`);
        }
      }
      
      // Sort the customers alphabetically
      uniqueCustomers.sort();
      setCustomers(uniqueCustomers);
      setFilteredCustomers(uniqueCustomers);
      
      if (uniqueCustomers.length === 0) {
        setError('No customers found in the database');
      }
    } catch (err) {
      let errorMsg = 'Failed to load customers';
      if (err instanceof Error) {
        if (err.message.includes('Failed to fetch') || err.message.includes('fetch')) {
          errorMsg = 'Unable to connect to database. Please check your Supabase configuration and ensure the database is accessible.';
        } else if (err.message.includes('JWT') || err.message.includes('Invalid API key')) {
          errorMsg = 'Invalid Supabase credentials. Please check your API key.';
        } else if (err.message.includes('permission') || err.message.includes('policy')) {
          errorMsg = 'Database access denied. Please check your database permissions and row-level security policies.';
        } else if (err.message.includes('relation') || err.message.includes('does not exist')) {
          errorMsg = 'Database tables not found. Please ensure your database schema is properly set up.';
        } else {
          errorMsg = err.message;
        }
      }
      setError(errorMsg);
      console.error('❌ Failed to load customers:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerSelect = (customer: string) => {
    onCustomerChange(customer);
    setIsOpen(false);
    setSearchTerm('');
  };

  const clearSelection = () => {
    onCustomerChange('');
    setIsOpen(false);
    setSearchTerm('');
  };

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        <Building2 className="inline h-4 w-4 mr-1" />
        Customer Selection
      </label>
      
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-4 py-3 text-left border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center justify-between">
            <span className={selectedCustomer ? 'text-gray-900' : 'text-gray-500'}>
              {selectedCustomer || 'Select a customer...'}
            </span>
            <div className="flex items-center space-x-2">
              {selectedCustomer && (
                <CheckCircle className="h-4 w-4 text-green-500" />
              )}
              <Users className="h-4 w-4 text-gray-400" />
            </div>
          </div>
        </button>

        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-64 overflow-hidden">
            {/* Search Input */}
            <div className="p-3 border-b border-gray-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search customers..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                />
              </div>
            </div>

            {/* Customer List */}
            <div className="max-h-48 overflow-y-auto">
              {loading ? (
                <div className="p-4 text-center text-gray-500">
                  Loading customers...
                </div>
              ) : error ? (
                <div className="p-4 text-center">
                  <div className="flex items-center justify-center mb-2 text-red-600">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    <span className="text-sm font-medium">Error Loading Customers</span>
                  </div>
                  <div className="text-xs text-red-600">
                    <p className="font-medium mb-1">{error}</p>
                    {(error.includes('Supabase') || error.includes('configuration')) && (
                      <p className="text-red-500 mt-2">
                        Click "Connect to Supabase" in the top right to set up your database connection.
                      </p>
                    )}
                    <button
                      onClick={loadCustomers}
                      className="mt-2 px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                    >
                      Retry
                    </button>
                  </div>
                </div>
              ) : filteredCustomers.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  {searchTerm ? 'No customers found' : 'No customers available'}
                </div>
              ) : (
                <>
                  {/* Clear Selection Option */}
                  <button
                    onClick={clearSelection}
                    className="w-full px-4 py-2 text-left hover:bg-gray-100 transition-colors border-b border-gray-100"
                  >
                    <span className="text-gray-500 italic">No customer selected</span>
                  </button>
                  
                  {/* Customer Options */}
                  {filteredCustomers.map((customer) => (
                    <button
                      key={customer}
                      onClick={() => handleCustomerSelect(customer)}
                      className={`w-full px-4 py-2 text-left hover:bg-blue-50 transition-colors ${
                        selectedCustomer === customer ? 'bg-blue-100 text-blue-900' : 'text-gray-900'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{customer}</span>
                        {selectedCustomer === customer && (
                          <CheckCircle className="h-4 w-4 text-blue-600" />
                        )}
                      </div>
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {selectedCustomer && (
        <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center space-x-2 text-green-800">
            <CheckCircle className="h-4 w-4" />
            <span className="text-sm font-medium">
              Customer selected: {selectedCustomer}
            </span>
          </div>
          <p className="text-xs text-green-700 mt-1">
            Customer-specific margins will be applied where available
          </p>
        </div>
      )}

      {customers.length > 0 && (
        <p className="mt-2 text-xs text-gray-500">
          {customers.length} customer{customers.length !== 1 ? 's' : ''} available
        </p>
      )}
    </div>
  );
};