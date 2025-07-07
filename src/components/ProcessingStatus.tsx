import React from 'react';
import { CheckCircle, XCircle, Clock, Loader2, Truck, TrendingUp } from 'lucide-react';

interface ProcessingStatusProps {
  total: number;
  completed: number;
  success: number;
  errors: number;
  isProcessing: boolean;
  currentCarrier?: string;
  carrierProgress?: {
    current: number;
    total: number;
  };
}

export const ProcessingStatus: React.FC<ProcessingStatusProps> = ({
  total,
  completed,
  success,
  errors,
  isProcessing,
  currentCarrier,
  carrierProgress
}) => {
  const progress = total > 0 ? (completed / total) * 100 : 0;
  const carrierProgressPercent = carrierProgress ? (carrierProgress.current / carrierProgress.total) * 100 : 0;

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Processing Status</h3>
        {isProcessing && (
          <div className="flex items-center space-x-2 text-blue-600">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm font-medium">Processing...</span>
          </div>
        )}
      </div>
      
      <div className="space-y-6">
        {/* Overall Progress Bar */}
        <div>
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Overall Progress</span>
            <span>{completed} of {total} RFQs</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-blue-500 h-3 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {progress.toFixed(1)}% complete
          </div>
        </div>

        {/* Current Carrier Progress (if processing) */}
        {isProcessing && currentCarrier && carrierProgress && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <Truck className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">
                Currently processing: {currentCarrier}
              </span>
            </div>
            <div className="flex justify-between text-xs text-blue-700 mb-1">
              <span>Carrier Progress</span>
              <span>{carrierProgress.current} of {carrierProgress.total} carriers</span>
            </div>
            <div className="w-full bg-blue-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${carrierProgressPercent}%` }}
              />
            </div>
          </div>
        )}
        
        {/* Status Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <Clock className="h-6 w-6 text-gray-500 mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-700">{total}</div>
            <div className="text-sm text-gray-500">Total RFQs</div>
          </div>
          
          <div className="bg-blue-50 rounded-lg p-4 text-center">
            <Loader2 className={`h-6 w-6 text-blue-500 mx-auto mb-2 ${isProcessing ? 'animate-spin' : ''}`} />
            <div className="text-2xl font-bold text-blue-700">{total - completed}</div>
            <div className="text-sm text-blue-600">Pending</div>
          </div>
          
          <div className="bg-green-50 rounded-lg p-4 text-center">
            <CheckCircle className="h-6 w-6 text-green-500 mx-auto mb-2" />
            <div className="text-2xl font-bold text-green-700">{success}</div>
            <div className="text-sm text-green-600">Success</div>
          </div>
          
          <div className="bg-red-50 rounded-lg p-4 text-center">
            <XCircle className="h-6 w-6 text-red-500 mx-auto mb-2" />
            <div className="text-2xl font-bold text-red-700">{errors}</div>
            <div className="text-sm text-red-600">Errors</div>
          </div>
        </div>

        {/* Processing Benefits */}
        {isProcessing && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-green-900">
                Individual Carrier Processing Benefits
              </span>
            </div>
            <div className="text-xs text-green-700 space-y-1">
              <div>• Faster response times per carrier (25s timeout vs 55s)</div>
              <div>• Better error isolation - one failed carrier doesn't affect others</div>
              <div>• Real-time progress tracking for each carrier</div>
              <div>• Improved reliability and success rates</div>
            </div>
          </div>
        )}

        {/* Completion Summary */}
        {!isProcessing && completed > 0 && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="text-sm text-gray-700">
              <div className="font-medium mb-2">Processing Complete</div>
              <div className="space-y-1">
                <div>✅ Successfully processed: {success} RFQs</div>
                {errors > 0 && <div>❌ Failed: {errors} RFQs</div>}
                <div>📊 Success rate: {total > 0 ? ((success / total) * 100).toFixed(1) : 0}%</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};