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
    console.log('Template download requested for: Smart Multi-Mode Template');
    downloadProject44ExcelTemplate();
  };

  // Only show the Project44 template - remove FreshX template completely
  if (!isProject44) {
    return null;
  }

  return (
    <div className="bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6">
      <div className="flex items-start space-x-4">
        <div className="bg-gradient-to-r from-blue-100 to-purple-100 p-2 rounded-lg flex-shrink-0">
          <Brain className="h-5 w-5 text-blue-600" />
        </div>
        
        <div className="flex-1">
          <h3 className="text-lg font-medium text-blue-900 mb-2">
            🧠 Smart Multi-Mode Template
          </h3>
          <p className="text-blue-800 mb-4">
            Download our comprehensive Excel template with <strong>8 test scenarios</strong> designed to test 
            smart mode classification across <strong>Standard LTL</strong>, <strong>Volume LTL</strong>, and <strong>FreshX Reefer networks</strong>. 
            Includes interactive checkboxes for all 67 accessorial services.
          </p>
          
          <button
            onClick={handleDownload}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium rounded-lg transition-colors"
          >
            <Download className="h-4 w-4" />
            <span>Download Smart Multi-Mode Excel Template</span>
          </button>
          
          {/* Smart Multi-Mode Template Features */}
          <div className="mt-4 space-y-4">
            <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg">
              <div className="flex items-start space-x-2">
                <Brain className="h-5 w-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-indigo-800">
                  <p className="font-medium mb-2">🧠 Smart Routing Control:</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div>
                      <strong>isReefer = TRUE:</strong> Routes to FreshX reefer network
                    </div>
                    <div>
                      <strong>isReefer = FALSE:</strong> Routes to Project44 networks
                    </div>
                    <div>
                      <strong>Standard LTL:</strong> 1-9 pallets, under 15,000 lbs
                    </div>
                    <div>
                      <strong>Volume LTL:</strong> 10+ pallets OR 15,000+ lbs
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
                    <li>Single isReefer field controls all routing decisions</li>
                    <li>8 comprehensive test scenarios for all modes</li>
                    <li>67 Project44 accessorial services with checkboxes</li>
                    <li>Smart routing guide with clear explanations</li>
                    <li>Mixed files (reefer + dry goods) fully supported</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex items-start space-x-2">
                <Zap className="h-4 w-4 text-orange-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-orange-800">
                  <p className="font-medium mb-1">⚡ Template Includes 4 Sheets:</p>
                  <ol className="list-decimal list-inside space-y-1 text-xs">
                    <li><strong>RFQ Data:</strong> 8 test scenarios with isReefer routing control</li>
                    <li><strong>Smart Routing Guide:</strong> Classification rules and expected routing</li>
                    <li><strong>Accessorial Reference:</strong> All 67 Project44 LTL service codes</li>
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
                <p className="font-medium mb-1">How to use the isReefer field:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Set isReefer = TRUE for shipments that need FreshX reefer network</li>
                  <li>Set isReefer = FALSE for shipments that should use Project44 networks</li>
                  <li>System automatically determines LTL vs Volume LTL for Project44</li>
                  <li>Temperature and commodity fields provide additional context</li>
                  <li>All accessorial checkboxes default to FALSE (unchecked)</li>
                </ol>
              </div>
            </div>
          </div>

          <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start space-x-2">
              <Info className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium mb-1">Smart Routing Logic:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li><strong>Primary Control:</strong> isReefer field determines network routing</li>
                  <li><strong>FreshX Route:</strong> isReefer=TRUE routes to specialized reefer network</li>
                  <li><strong>Project44 Route:</strong> isReefer=FALSE routes to LTL/VLTL networks</li>
                  <li><strong>Auto-Classification:</strong> Size/weight determines LTL vs Volume LTL</li>
                  <li>Each test scenario validates different routing decisions</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};