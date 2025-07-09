import React from 'react';
import { Download, Brain, Info, CheckSquare, Target, Zap } from 'lucide-react';
import { downloadProject44ExcelTemplate } from '../utils/templateGenerator';

interface TemplateDownloadProps {
  isProject44?: boolean;
}

export const TemplateDownload: React.FC<TemplateDownloadProps> = ({ 
  isProject44 = false
}) => {
  const handleDownload = () => {
    console.log('Template download requested for: 3-Mode Smart Routing Template');
    downloadProject44ExcelTemplate();
  };

  return (
    <div className="bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6">
      <div className="flex items-start space-x-4">
        <div className="bg-gradient-to-r from-blue-100 to-purple-100 p-2 rounded-lg flex-shrink-0">
          <Brain className="h-5 w-5 text-blue-600" />
        </div>
        
        <div className="flex-1">
          <h3 className="text-lg font-medium text-blue-900 mb-2">
            🧠 3-Mode Smart Routing Template
          </h3>
          <p className="text-blue-800 mb-4">
            Download our comprehensive Excel template with <strong>6 complete examples</strong> demonstrating all 3 routing modes: 
            <strong>FreshX Reefer Network</strong>, <strong>Project44 Standard LTL</strong>, and <strong>Project44 Volume LTL/Dual Mode</strong>. 
            Includes interactive checkboxes for all 67 Project44 accessorial services.
          </p>
          
          <button
            onClick={handleDownload}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium rounded-lg transition-colors"
          >
            <Download className="h-4 w-4" />
            <span>Download 3-Mode Smart Routing Template</span>
          </button>
          
          {/* 3-Mode Template Features */}
          <div className="mt-4 space-y-4">
            <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg">
              <div className="flex items-start space-x-2">
                <Brain className="h-5 w-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-indigo-800">
                  <p className="font-medium mb-2">🧠 3 Routing Modes Demonstrated:</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div>
                      <strong>Mode 1 (Rows 1 & 4):</strong> FreshX Reefer Network
                    </div>
                    <div>
                      <strong>Mode 2 (Rows 2 & 5):</strong> Project44 Standard LTL
                    </div>
                    <div>
                      <strong>Mode 3 (Rows 3 & 6):</strong> Project44 Volume LTL/Dual Mode
                    </div>
                    <div>
                      <strong>Size Thresholds:</strong> 10+ pallets OR 15,000+ lbs for dual mode
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-start space-x-2">
                <Target className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-green-800">
                  <p className="font-medium mb-1">🎯 Template Features:</p>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    <li>6 complete examples - 2 for each routing mode</li>
                    <li>isReefer field controls FreshX vs Project44 routing</li>
                    <li>Size-based sub-routing for Project44 (Standard vs Volume LTL)</li>
                    <li>Itemized-only structure for precise dimensions</li>
                    <li>All 67 Project44 accessorial services with checkboxes</li>
                    <li>Smart routing guide with detailed explanations</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex items-start space-x-2">
                <Zap className="h-4 w-4 text-orange-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-orange-800">
                  <p className="font-medium mb-1">⚡ Template Includes 6 Sheets:</p>
                  <ol className="list-decimal list-inside space-y-1 text-xs">
                    <li><strong>RFQ Data:</strong> 6 examples demonstrating all 3 routing modes</li>
                    <li><strong>Itemized-Only Guide:</strong> Multi-item structure documentation</li>
                    <li><strong>Field Reference:</strong> Complete field documentation</li>
                    <li><strong>Smart Routing Guide:</strong> Mode classification rules</li>
                    <li><strong>Accessorial Reference:</strong> All 67 Project44 service codes</li>
                    <li><strong>Instructions:</strong> Complete setup and usage guide</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-start space-x-2">
              <CheckSquare className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-green-800">
                <p className="font-medium mb-1">How the 3 routing modes work:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li><strong>FreshX Reefer:</strong> isReefer = TRUE routes to refrigerated network</li>
                  <li><strong>Project44 Standard:</strong> isReefer = FALSE + small shipments</li>
                  <li><strong>Project44 Dual:</strong> isReefer = FALSE + large shipments (10+ pallets OR 15,000+ lbs)</li>
                  <li>System automatically determines which mode based on size thresholds</li>
                  <li>Dual mode gets quotes from BOTH Volume LTL AND Standard LTL</li>
                </ol>
              </div>
            </div>
          </div>

          <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start space-x-2">
              <Info className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium mb-1">Example Routing Decisions:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li><strong>Row 1:</strong> 3 pallets, 2,500 lbs, isReefer=TRUE → FreshX</li>
                  <li><strong>Row 2:</strong> 5 pallets, 4,500 lbs, isReefer=FALSE → Project44 Standard</li>
                  <li><strong>Row 3:</strong> 15 pallets, 22,000 lbs, isReefer=FALSE → Project44 Dual</li>
                  <li><strong>Row 4:</strong> 8 pallets, 12,000 lbs, isReefer=TRUE → FreshX</li>
                  <li><strong>Row 5:</strong> 2 pallets, 1,800 lbs, isReefer=FALSE → Project44 Standard</li>
                  <li><strong>Row 6:</strong> 18 pallets, 28,000 lbs, isReefer=FALSE → Project44 Dual</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};