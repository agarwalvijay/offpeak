# ComEd Electricity Pricing Dashboard

## Overview

A real-time electricity pricing dashboard for ComEd customers that displays current pricing data, historical trends, and price alerts. The application uses Streamlit for the web interface and integrates with the ComEd API to fetch 5-minute pricing data.

## User Preferences

Preferred communication style: Simple, everyday language.
Infrastructure: Existing GCP VM with nginx server hosting aoknos.com, wants to add comed.theagarwals.com domain.

## System Architecture

The application follows a modular architecture with clear separation of concerns:

- **Frontend**: Streamlit web application with interactive charts and real-time data display
- **Data Layer**: Direct API integration with ComEd's hourly pricing API
- **Processing Layer**: Custom data processing and alert logic
- **State Management**: Streamlit session state for user preferences and caching

## Key Components

### Frontend (app.py)
- **Technology**: Streamlit with Plotly for interactive charts
- **Features**: Real-time dashboard, day-ahead pricing, price alerts, historical data visualization
- **State Management**: Session state for alert settings, auto-refresh, and last update tracking
- **Styling**: Custom CSS for metric cards, alert styling, and mobile responsiveness
- **PWA Support**: Progressive Web App capabilities for mobile installation

### API Integration (comed_api.py)
- **Purpose**: Handles all communication with ComEd's pricing APIs
- **Features**: 5-minute feed data retrieval, current hour average, day-ahead pricing, date range queries, error handling
- **Design**: Session-based HTTP client with proper timeout and error handling
- **Rate Limiting**: Built-in request management to respect API limits
- **Endpoints**: Real-time 5-minute feed, current hour average, day-ahead hourly pricing via ServletFeed

### Data Processing (data_processor.py)
- **Purpose**: Transforms raw API data into usable formats
- **Features**: Timestamp conversion, DataFrame creation, data validation
- **Design**: Utility class with static methods for data transformation
- **Error Handling**: Robust handling of malformed data and edge cases

### Alert System (price_alerts.py)
- **Purpose**: Monitors pricing data and generates user alerts
- **Features**: Configurable thresholds, cooldown periods, multiple alert types
- **Design**: Event-driven alert system with state tracking
- **Alert Types**: High price warnings, low price opportunities, negative pricing notifications

## Data Flow

1. **Data Ingestion**: ComEd API provides 5-minute pricing data via REST endpoints
2. **Processing**: Raw API data is converted to pandas DataFrames with proper datetime handling
3. **Analysis**: Current prices are analyzed against user-defined thresholds
4. **Visualization**: Plotly charts display real-time and historical pricing trends
5. **Alerts**: Price alert system monitors for significant price changes or threshold breaches

## External Dependencies

### Core Libraries
- **Streamlit**: Web application framework for the dashboard interface
- **Pandas**: Data manipulation and analysis
- **Plotly**: Interactive charting and visualization
- **Requests**: HTTP client for API communication
- **NumPy**: Numerical computing support

### API Integration
- **ComEd Hourly Pricing API**: Primary data source for electricity pricing
- **Endpoint**: `https://hourlypricing.comed.com/api`
- **Data Format**: JSON with millisUTC timestamps and price data

## Deployment Strategy

### Local Development
- Python environment with required dependencies
- Streamlit development server for local testing
- Direct API access to ComEd pricing service

### GCP Cloud Deployment
- **Google Cloud Run**: Serverless deployment with auto-scaling
- **GCP VM Instance**: Direct deployment to existing virtual machines
- **nginx Reverse Proxy**: Custom domain hosting with SSL certificates
- **Docker containerization**: Consistent deployment across environments
- **Automated deployment**: Single script deployment to GCP
- **Cost-effective**: Pay-per-use serverless model or VM-based hosting
- **HTTPS**: Automatic SSL certificate provision (Cloud Run) or Let's Encrypt (VM)
- **Custom domains**: Support for custom domain mapping with nginx configuration
- **Systemd service**: Automatic startup and service management on VM deployments
- **Multi-site hosting**: nginx configuration supports multiple domains on same server

### Production Considerations
- **Hosting**: Google Cloud Run (recommended) or Streamlit Cloud
- **Monitoring**: Built-in error handling and API timeout management
- **Performance**: Session state management for efficient data caching
- **Scalability**: Stateless design allows for horizontal scaling
- **Security**: Public access for electricity pricing data (non-sensitive)

### Configuration Management
- Alert thresholds stored in session state
- API endpoints configurable via environment variables
- User preferences persist during session

## Key Design Decisions

### API Client Design
- **Problem**: Reliable access to ComEd pricing data
- **Solution**: Dedicated API client class with session management
- **Rationale**: Centralized error handling and connection pooling

### Data Processing Architecture
- **Problem**: Raw API data needs transformation for visualization
- **Solution**: Separate processing layer with pandas integration
- **Rationale**: Clean separation of concerns and reusable data utilities

### Alert System Design
- **Problem**: Users need timely notifications about price changes
- **Solution**: Configurable alert system with cooldown periods
- **Rationale**: Prevents alert fatigue while maintaining responsiveness

### State Management
- **Problem**: User preferences and settings need persistence
- **Solution**: Streamlit session state for temporary storage
- **Rationale**: Simple implementation suitable for single-user sessions