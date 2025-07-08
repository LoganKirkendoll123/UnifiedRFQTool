Here's the fixed version with all missing closing brackets added:

```javascript
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
      console.log('📋 Loading customers from Shipments table...');
      
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
        setConnectionError('Shipments table is empty or contains no valid customer records. Please ensure your historical shipment data is loaded into the Shipments table.');
        setCustomers([]);
        return;
      }
      
      const uniqueCustomers = [...new Set(allCustomers.map(d => d.InternalName).filter(Boolean))].sort();
      setCustomers(uniqueCustomers);
      console.log(`✅ Loaded ${uniqueCustomers.length} unique customers from ${allCustomers.length} total records`);
      if (uniqueCustomers.length === 0) {
        setConnectionError('Shipments table is empty or contains no valid customer records. Please ensure your historical shipment data is loaded into the Shipments table.');
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
```