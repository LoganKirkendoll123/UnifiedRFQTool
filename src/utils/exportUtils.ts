import * as XLSX from 'xlsx';
import { SmartQuotingResult } from './rfqProcessor';
import { RFQRow } from '../types';

export const exportToExcel = (results: SmartQuotingResult[], rfqData: RFQRow[]) => {
  console.log('📊 Exporting results to Excel...');
  
  // Create a new workbook
  const workbook = XLSX.utils.book_new();
  
  // Prepare summary data
  const summaryData = results.map((result, index) => {
    const rfq = rfqData[index] || result.originalData;
    const bestQuote = result.quotes.length > 0 
      ? result.quotes.reduce((best, current) => 
          (current as any).customerPrice < (best as any).customerPrice ? current : best
        )
      : null;
    
    return {
      'RFQ #': index + 1,
      'Route': `${rfq.fromZip} → ${rfq.toZip}`,
      'Pallets': rfq.pallets,
      'Weight (lbs)': rfq.grossWeight.toLocaleString(),
      'Quoting Decision': result.quotingDecision,
      'Quoting Reason': result.quotingReason,
      'Status': result.status,
      'Quotes Received': result.quotes.length,
      'Best Price': bestQuote ? `$${(bestQuote as any).customerPrice?.toFixed(0) || '0'}` : 'No quotes',
      'Best Carrier': bestQuote?.carrier.name || 'N/A',
      'Profit': bestQuote ? `$${(bestQuote as any).profit?.toFixed(0) || '0'}` : 'N/A',
      'Error': result.error || ''
    };
  });
  
  // Create summary worksheet
  const summaryWs = XLSX.utils.json_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summaryWs, 'Summary');
  
  // Prepare detailed quotes data
  const detailedData: any[] = [];
  results.forEach((result, rfqIndex) => {
    result.quotes.forEach((quote, quoteIndex) => {
      const quoteWithPricing = quote as any;
      detailedData.push({
        'RFQ #': rfqIndex + 1,
        'Quote #': quoteIndex + 1,
        'Carrier': quote.carrier.name,
        'Carrier Code': quote.carrierCode || quote.carrier.scac || '',
        'Service Level': quote.serviceLevel?.code || 'Standard',
        'Service Description': quote.serviceLevel?.description || '',
        'Transit Days': quote.transitDays || '',
        'Carrier Total Rate': `$${quote.premiumsAndDiscounts?.toFixed(0) || '0'}`,
        'Customer Price': `$${quoteWithPricing.customerPrice?.toFixed(0) || '0'}`,
        'Profit': `$${quoteWithPricing.profit?.toFixed(0) || '0'}`,
        'Margin %': `${quoteWithPricing.appliedMarginPercentage?.toFixed(1) || '0'}%`,
        'Margin Type': quoteWithPricing.appliedMarginType || 'flat',
        'Quote Mode': (quote as any).quoteMode || 'standard',
        'Submitted By': quote.submittedBy,
        'Route': `${result.originalData.fromZip} → ${result.originalData.toZip}`,
        'Pallets': result.originalData.pallets,
        'Weight (lbs)': result.originalData.grossWeight.toLocaleString(),
        'Temperature': result.originalData.temperature || 'AMBIENT',
        'Is Reefer': result.originalData.isReefer ? 'Yes' : 'No'
      });
    });
  });
  
  // Create detailed quotes worksheet
  if (detailedData.length > 0) {
    const detailedWs = XLSX.utils.json_to_sheet(detailedData);
    XLSX.utils.book_append_sheet(workbook, detailedWs, 'Detailed Quotes');
  }
  
  // Prepare original RFQ data
  const rfqExportData = rfqData.map((rfq, index) => ({
    'RFQ #': index + 1,
    'From Date': rfq.fromDate,
    'From ZIP': rfq.fromZip,
    'To ZIP': rfq.toZip,
    'Pallets': rfq.pallets,
    'Gross Weight': rfq.grossWeight,
    'Is Stackable': rfq.isStackable ? 'Yes' : 'No',
    'Is Reefer': rfq.isReefer ? 'Yes' : 'No',
    'Temperature': rfq.temperature || '',
    'Commodity': rfq.commodity || '',
    'Food Grade': rfq.isFoodGrade ? 'Yes' : 'No',
    'Freight Class': rfq.freightClass || '',
    'Accessorials': Array.isArray(rfq.accessorial) ? rfq.accessorial.join(', ') : '',
    'Origin City': rfq.originCity || '',
    'Origin State': rfq.originState || '',
    'Destination City': rfq.destinationCity || '',
    'Destination State': rfq.destinationState || '',
    'Total Value': rfq.totalValue || '',
    'Package Type': rfq.packageType || '',
    'Total Linear Feet': rfq.totalLinearFeet || ''
  }));
  
  // Create original RFQ data worksheet
  const rfqWs = XLSX.utils.json_to_sheet(rfqExportData);
  XLSX.utils.book_append_sheet(workbook, rfqWs, 'Original RFQ Data');
  
  // Generate filename with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `smart-quoting-results-${timestamp}.xlsx`;
  
  // Write and download the file
  const excelBuffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
  const blob = new Blob([excelBuffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
  
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
  
  console.log(`✅ Excel export completed: ${filename}`);
  console.log(`📊 Exported ${results.length} RFQs with ${detailedData.length} total quotes`);
};