import React, { useState } from 'react';
import { Check, Truck, Loader, Shield, Award, TrendingUp, Users } from 'lucide-react';
import { CarrierGroup } from '../utils/apiClient';

interface CarrierSelectionProps {
  carrierGroups: CarrierGroup[];
  selectedCarriers: { [carrierId: string]: boolean };
  onToggleCarrier: (carrierId: string, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  onSelectAllInGroup: (groupCode: string, selected: boolean) => void;
  isLoading: boolean;
}

export const CarrierSelection: React.FC<CarrierSelectionProps> = ({
  carrierGroups,
  selectedCarriers,
  onToggleCarrier,
  onSelectAll,
  onSelectAllInGroup,
  isLoading
}) => {
  const [activeTab, setActiveTab] = useState('Default');
  
  // Get unique carriers across all groups to avoid duplicates
  const getAllUniqueCarriers = () => {
    const uniqueCarriers = new Map();
    carrierGroups.forEach(group => {
      group.carriers.forEach(carrier => {
        if (!uniqueCarriers.has(carrier.id)) {
          uniqueCarriers.set(carrier.id, carrier);
        }
      });
    });
    return Array.from(uniqueCarriers.values());
  };

  const uniqueCarriers = getAllUniqueCarriers();
  const totalCarriers = uniqueCarriers.length;
  const selectedCount = Object.values(selectedCarriers).filter(Boolean).length;

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-8">
        <div className="flex items-center space-x-3 mb-6">
          <div className="bg-green-600 p-2 rounded-lg">
            <Truck className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Available Carriers</h3>
            <p className="text-sm text-gray-600">Loading carriers from Project44...</p>
          </div>
        </div>
        <div className="flex justify-center items-center py-8">
          <Loader className="h-8 w-8 text-blue-500 animate-spin" />
        </div>
      </div>
    );
  }

  if (carrierGroups.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-8">
        <div className="flex items-center space-x-3 mb-6">
          <div className="bg-green-600 p-2 rounded-lg">
            <Truck className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Available Carriers</h3>
            <p className="text-sm text-gray-600">No carriers found. Please check your API key and connection.</p>
          </div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <Shield className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-medium mb-1">Troubleshooting Tips:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Verify your Project44 API key is valid and active</li>
                <li>Ensure your account has access to capacity provider data</li>
                <li>Check that your API key has the necessary permissions</li>
                <li>Contact Project44 support if the issue persists</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const activeGroup = carrierGroups.find(group => group.groupCode === activeTab) || carrierGroups[0];
  
  // Get unique carriers for the active group only
  const getUniqueCarriersForGroup = (group: CarrierGroup) => {
    const uniqueCarriers = new Map();
    group.carriers.forEach(carrier => {
      if (!uniqueCarriers.has(carrier.id)) {
        uniqueCarriers.set(carrier.id, carrier);
      }
    });
    return Array.from(uniqueCarriers.values());
  };

  const activeGroupUniqueCarriers = getUniqueCarriersForGroup(activeGroup);
  const activeGroupSelectedCount = activeGroupUniqueCarriers.filter(carrier => selectedCarriers[carrier.id]).length;

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="bg-green-600 p-2 rounded-lg">
              <Truck className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Available LTL Carriers</h3>
              <p className="text-sm text-gray-600">
                Select carriers to include in your RFQ ({selectedCount} of {totalCarriers} selected)
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => onSelectAll(true)}
              className="px-3 py-1.5 text-sm rounded transition-colors bg-gray-100 text-gray-700 hover:bg-gray-200"
            >
              Select All
            </button>
            <button
              onClick={() => onSelectAll(false)}
              className={`px-3 py-1.5 text-sm rounded transition-colors ${
                selectedCount === 0 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              disabled={selectedCount === 0}
            >
              Clear All
            </button>
          </div>
        </div>

        {/* Group Tabs */}
        {carrierGroups.length > 1 && (
          <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
            {carrierGroups.map((group) => {
              const groupUniqueCarriers = getUniqueCarriersForGroup(group);
              return (
                <button
                  key={group.groupCode}
                  onClick={() => setActiveTab(group.groupCode)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                    activeTab === group.groupCode
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <Users className="h-4 w-4" />
                  <span>{group.groupName}</span>
                  <span className="bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full text-xs">
                    {groupUniqueCarriers.length}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="p-6">
        {/* Active Group Controls */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <h4 className="text-md font-medium text-gray-900">{activeGroup.groupName}</h4>
            <span className="text-sm text-gray-500">
              ({activeGroupSelectedCount} of {activeGroupUniqueCarriers.length} selected)
            </span>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => onSelectAllInGroup(activeGroup.groupCode, true)}
              className="px-3 py-1.5 text-sm rounded transition-colors bg-blue-100 text-blue-700 hover:bg-blue-200"
            >
              Select Group
            </button>
            <button
              onClick={() => onSelectAllInGroup(activeGroup.groupCode, false)}
              className={`px-3 py-1.5 text-sm rounded transition-colors ${
                activeGroupSelectedCount === 0 
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              disabled={activeGroupSelectedCount === 0}
            >
              Clear Group
            </button>
          </div>
        </div>

        {/* Carriers Grid - Only show unique carriers */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeGroupUniqueCarriers.map((carrier) => {
            const isSelected = selectedCarriers[carrier.id] || false;
            
            return (
              <div
                key={`${activeGroup.groupCode}-${carrier.id}`}
                className={`border rounded-lg p-4 cursor-pointer transition-all duration-200 hover:shadow-md ${
                  isSelected
                    ? 'border-green-500 bg-green-50 shadow-sm'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
                onClick={() => onToggleCarrier(carrier.id, !isSelected)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1">
                    <div className={`p-1.5 rounded-full flex-shrink-0 transition-colors ${
                      isSelected ? 'bg-green-500' : 'bg-gray-200'
                    }`}>
                      {isSelected && <Check className="h-3 w-3 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 truncate" title={carrier.name}>
                        {carrier.name}
                      </div>
                      <div className="mt-1 space-y-1">
                        {carrier.scac && (
                          <div className="flex items-center space-x-1 text-xs text-gray-500">
                            <Award className="h-3 w-3" />
                            <span>SCAC: {carrier.scac}</span>
                          </div>
                        )}
                        {carrier.mcNumber && (
                          <div className="flex items-center space-x-1 text-xs text-gray-500">
                            <Shield className="h-3 w-3" />
                            <span>MC: {carrier.mcNumber}</span>
                          </div>
                        )}
                        {carrier.dotNumber && (
                          <div className="flex items-center space-x-1 text-xs text-gray-500">
                            <TrendingUp className="h-3 w-3" />
                            <span>DOT: {carrier.dotNumber}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {activeGroupUniqueCarriers.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <Truck className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No carriers available in this group</p>
          </div>
        )}
      </div>

      {selectedCount > 0 && (
        <div className="px-6 py-4 bg-blue-50 border-t border-blue-200">
          <div className="flex items-center space-x-2 text-blue-800">
            <Check className="h-4 w-4" />
            <span className="text-sm font-medium">
              {selectedCount} carrier{selectedCount !== 1 ? 's' : ''} selected for quoting across {carrierGroups.length} group{carrierGroups.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};