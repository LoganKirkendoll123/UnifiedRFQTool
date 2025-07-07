import { useState, useEffect, useCallback } from 'react';
import { Project44APIClient, CarrierGroup } from '../utils/apiClient';

export interface UseCarrierManagementOptions {
  project44Client: Project44APIClient | null;
}

export const useCarrierManagement = ({ project44Client }: UseCarrierManagementOptions) => {
  const [carrierGroups, setCarrierGroups] = useState<CarrierGroup[]>([]);
  const [selectedCarriers, setSelectedCarriers] = useState<{ [carrierId: string]: boolean }>({});
  const [isLoadingCarriers, setIsLoadingCarriers] = useState(false);
  const [carriersLoaded, setCarriersLoaded] = useState(false);

  // Load carriers
  const loadCarriers = useCallback(async () => {
    if (!project44Client) {
      console.log('❌ Cannot load carriers - Project44 client not available. Please configure your Project44 OAuth credentials.');
      return;
    }

    setIsLoadingCarriers(true);
    setCarriersLoaded(false);
    try {
      console.log('🚛 Loading carriers...');
      const groups = await project44Client.getAvailableCarriersByGroup(false, false);
      setCarrierGroups(groups);
      setCarriersLoaded(true);
      console.log(`✅ Loaded ${groups.length} carrier groups`);
    } catch (error) {
      let errorMessage = 'Failed to load carriers';
      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch')) {
          errorMessage = 'Unable to connect to Project44 API. Please check your OAuth credentials.';
        } else if (error.message.includes('OAuth')) {
          errorMessage = 'Project44 authentication failed. Please verify your Client ID and Client Secret.';
        } else {
          errorMessage = error.message;
        }
      }
      console.error('❌ Failed to load carriers:', errorMessage, error);
      setCarrierGroups([]);
      setCarriersLoaded(false);
    } finally {
      setIsLoadingCarriers(false);
    }
  }, [project44Client]);

  // Toggle individual carrier
  const handleCarrierToggle = useCallback((carrierId: string, selected: boolean) => {
    setSelectedCarriers(prev => ({ ...prev, [carrierId]: selected }));
  }, []);

  // Select/deselect all carriers
  const handleSelectAll = useCallback((selected: boolean) => {
    const newSelection: { [carrierId: string]: boolean } = {};
    carrierGroups.forEach(group => {
      group.carriers.forEach(carrier => {
        newSelection[carrier.id] = selected;
      });
    });
    setSelectedCarriers(newSelection);
  }, [carrierGroups]);

  // Select/deselect all carriers in a group
  const handleSelectAllInGroup = useCallback((groupCode: string, selected: boolean) => {
    const group = carrierGroups.find(g => g.groupCode === groupCode);
    if (!group) return;
    
    setSelectedCarriers(prev => {
      const newSelection = { ...prev };
      group.carriers.forEach(carrier => {
        newSelection[carrier.id] = selected;
      });
      return newSelection;
    });
  }, [carrierGroups]);

  // Get selected carrier IDs
  const getSelectedCarrierIds = useCallback(() => {
    return Object.entries(selectedCarriers)
      .filter(([_, selected]) => selected)
      .map(([carrierId, _]) => carrierId);
  }, [selectedCarriers]);

  // Get selected carrier count
  const getSelectedCarrierCount = useCallback(() => {
    return Object.values(selectedCarriers).filter(Boolean).length;
  }, [selectedCarriers]);

  // Initialize carriers when client becomes available
  useEffect(() => {
    if (project44Client && !carriersLoaded && !isLoadingCarriers) {
      loadCarriers();
    }
  }, [project44Client, carriersLoaded, isLoadingCarriers, loadCarriers]);

  return {
    carrierGroups,
    selectedCarriers,
    isLoadingCarriers,
    carriersLoaded,
    loadCarriers,
    handleCarrierToggle,
    handleSelectAll,
    handleSelectAllInGroup,
    getSelectedCarrierIds,
    getSelectedCarrierCount,
    setSelectedCarriers
  };
};