# FreightIQ Pro - Enterprise Freight Quoting Platform

![FreightIQ Pro](https://img.shields.io/badge/FreightIQ-Pro-blue?style=for-the-badge)
![Version](https://img.shields.io/badge/version-1.0.0-green?style=for-the-badge)
![License](https://img.shields.io/badge/license-MIT-orange?style=for-the-badge)

## 🚀 Overview

FreightIQ Pro is an enterprise-grade freight quoting platform that provides automated, intelligent routing across multiple carrier networks. The platform uses smart classification to automatically route shipments to the optimal network:

- **FreshX Network**: For temperature-controlled reefer shipments
- **Project44 LTL**: For standard less-than-truckload shipments
- **Project44 VLTL**: For volume less-than-truckload shipments

## ✨ Key Features

### 🧠 Smart Routing Engine
- **Automatic Classification**: Uses the `isReefer` field to intelligently route shipments
- **Multi-Mode Comparison**: For VLTL shipments, compares both Volume LTL and Standard LTL pricing
- **Optimized Network Selection**: Routes to the most appropriate carrier network based on shipment characteristics

### 📊 Advanced Pricing Management
- **Customer-Specific Margins**: Apply different margins based on customer-carrier relationships
- **Fallback Pricing**: Automatic fallback to default margins when customer-specific rates aren't available
- **Minimum Profit Enforcement**: Ensures all quotes meet minimum profitability requirements
- **Real-Time Price Adjustments**: Manual price override capabilities with instant profit recalculation

### 🔗 Enterprise Integrations
- **Project44 API**: Full OAuth2 integration with comprehensive LTL/VLTL carrier network
- **FreshX API**: Specialized reefer network integration for temperature-controlled shipments
- **67 Accessorial Services**: Complete support for Project44's accessorial service codes
- **Multi-Item Support**: Handle shipments with up to 5 different items with unique dimensions

### 📈 Comprehensive Analytics
- **Real-Time Processing**: Live progress tracking with carrier-by-carrier status updates
- **Competitive Analysis**: Side-by-side comparison of quotes across different modes
- **Export Capabilities**: Full Excel export with detailed breakdown of all quotes and pricing

## 🛠️ Technology Stack

- **Frontend**: React 18 + TypeScript + Tailwind CSS
- **Build Tool**: Vite
- **API Integration**: Project44 OAuth2, FreshX REST API
- **File Processing**: Excel/CSV parsing with comprehensive validation
- **Deployment**: Netlify with serverless functions for API proxying

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Project44 API credentials (Client ID & Client Secret)
- FreshX API key (optional, for reefer shipments)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd freightiq-pro
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

4. **Open in browser**
   ```
   http://localhost:5173
   ```

### Configuration

1. **Project44 Setup**
   - Enter your Client ID and Client Secret in the Project44 Integration section
   - The system will automatically validate your credentials

2. **FreshX Setup (Optional)**
   - Enter your FreshX API key for reefer shipment capabilities
   - Leave blank if you only need dry goods quoting

3. **Carrier Selection**
   - Load available carriers from your Project44 account
   - Select which carriers to include in your quotes

## 📋 Usage Guide

### 1. Smart Template System

Download the comprehensive Excel template that includes:
- **8 Test Scenarios**: Covering Standard LTL, Volume LTL, and FreshX Reefer
- **Smart Routing Control**: Single `isReefer` field controls all routing decisions
- **67 Accessorial Services**: Interactive checkboxes for all Project44 services
- **Multi-Item Support**: Up to 5 items with individual dimensions and freight classes

### 2. File Upload & Processing

1. **Upload Your Data**
   - Supports Excel (.xlsx) and CSV files
   - Automatic validation of all required fields
   - Clear error messages for any data issues

2. **Smart Classification**
   - `isReefer = TRUE` → Routes to FreshX reefer network
   - `isReefer = FALSE` → Routes to Project44 networks
   - Automatic LTL vs VLTL determination based on size/weight

3. **Automated Processing**
   - Real-time progress tracking
   - Individual carrier processing for better reliability
   - Comprehensive error handling and reporting

### 3. Results Analysis

- **Competitive Comparison**: Side-by-side analysis of all quotes
- **Pricing Breakdown**: Detailed charge breakdown from each carrier
- **Profit Analysis**: Real-time profit calculations with margin percentages
- **Export Options**: Full Excel export with all quote details

## 🔧 API Configuration

### Project44 OAuth2 Setup

```javascript
// Required credentials
{
  clientId: "your-project44-client-id",
  clientSecret: "your-project44-client-secret"
}
```

### FreshX API Setup

```javascript
// Required for reefer shipments
{
  apiKey: "your-freshx-api-key"
}
```

## 📊 Smart Routing Logic

### Classification Rules

| Condition | isReefer | Pallets | Weight | Routing Decision |
|-----------|----------|---------|---------|------------------|
| Reefer Shipment | `TRUE` | Any | Any | FreshX Reefer Network |
| Standard LTL | `FALSE` | 1-9 | < 15,000 lbs | Project44 Standard LTL |
| Volume LTL | `FALSE` | 10+ OR | 15,000+ lbs | Project44 Dual Mode (VLTL + LTL) |

### Multi-Mode Benefits

For Volume LTL shipments, the system automatically:
- Gets quotes from both Volume LTL and Standard LTL networks
- Compares pricing and service levels side-by-side
- Highlights the best option with savings calculations
- Provides detailed competitive analysis

## 🏗️ File Structure

```
src/
├── components/           # React components
│   ├── UnifiedRFQTool.tsx   # Main quoting interface
│   ├── CarrierSelection.tsx  # Carrier management
│   ├── PricingSettings.tsx   # Pricing configuration
│   └── ResultsTable.tsx      # Results display
├── hooks/               # Custom React hooks
│   ├── useRFQProcessor.ts    # RFQ processing logic
│   └── useCarrierManagement.ts # Carrier state management
├── utils/               # Utility functions
│   ├── apiClient.ts         # API integration
│   ├── fileParser.ts        # File processing
│   ├── pricingCalculator.ts # Pricing logic
│   └── templateGenerator.ts # Excel template generation
└── types.ts             # TypeScript definitions
```

## 🚀 Deployment

### Netlify Deployment

1. **Build the project**
   ```bash
   npm run build
   ```

2. **Deploy to Netlify**
   - Connect your repository to Netlify
   - Set build command: `npm run build`
   - Set publish directory: `dist`

3. **Configure Functions**
   - Netlify Functions automatically handle API proxying
   - No additional configuration required

### Environment Variables

No environment variables required - all configuration is done through the UI.

## 🔒 Security Features

- **OAuth2 Integration**: Secure token-based authentication with Project44
- **API Key Management**: Secure storage of FreshX API credentials
- **CORS Handling**: Automatic CORS resolution through Netlify Functions
- **Input Validation**: Comprehensive validation of all user inputs
- **Error Handling**: Graceful error handling with detailed user feedback

## 📈 Performance Features

- **Parallel Processing**: Simultaneous quotes from multiple carriers
- **Smart Caching**: Intelligent caching of carrier data and margins
- **Progress Tracking**: Real-time progress updates during processing
- **Timeout Management**: Configurable timeouts for optimal performance
- **Error Recovery**: Automatic retry logic for failed requests

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the documentation for common solutions
- Review the smart routing guide in the Excel template

## 🔄 Version History

### v1.0.0 (Current)
- ✅ Smart routing engine with automatic classification
- ✅ Project44 OAuth2 integration with full LTL/VLTL support
- ✅ FreshX reefer network integration
- ✅ Multi-item shipment support with individual dimensions
- ✅ Customer-specific margin management
- ✅ Comprehensive Excel template with 67 accessorial services
- ✅ Real-time competitive analysis and pricing comparison
- ✅ Enterprise-grade error handling and validation

---

**FreightIQ Pro** - Transforming freight quoting with intelligent automation and enterprise-grade reliability.