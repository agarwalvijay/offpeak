import streamlit as st
import pandas as pd
import plotly.graph_objects as go
import plotly.express as px
from datetime import datetime, timedelta
import time
import numpy as np
from comed_api import ComEdAPI
from price_alerts import PriceAlerts
from data_processor import DataProcessor

# Initialize session state
if 'last_update' not in st.session_state:
    st.session_state.last_update = datetime.now()
if 'alert_settings' not in st.session_state:
    st.session_state.alert_settings = {
        'low_threshold': 5.0,
        'medium_threshold': 10.0,
        'high_threshold': 15.0,
        'alerts_enabled': True
    }
if 'auto_refresh' not in st.session_state:
    st.session_state.auto_refresh = True

# Initialize API and helper classes
api = ComEdAPI()
alerts = PriceAlerts()
processor = DataProcessor()

# Page configuration
st.set_page_config(
    page_title="ComEd Electricity Pricing Dashboard",
    page_icon="⚡",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS for better spacing, alerts, and mobile responsiveness
st.markdown("""
<style>
    /* PWA Meta Tags */
    .metric-card {
        background-color: #f0f2f6;
        padding: 1rem;
        border-radius: 0.5rem;
        margin: 0.5rem 0;
    }
    .alert-low { background-color: #d4edda; color: #155724; }
    .alert-medium { background-color: #fff3cd; color: #856404; }
    .alert-high { background-color: #f8d7da; color: #721c24; }
    .status-good { color: #28a745; }
    .status-warning { color: #ffc107; }
    .status-danger { color: #dc3545; }
    
    /* Mobile optimizations */
    @media (max-width: 768px) {
        .main .block-container {
            padding-top: 2rem;
            padding-left: 1rem;
            padding-right: 1rem;
        }
        .metric-card {
            margin: 0.25rem 0;
            padding: 0.75rem;
        }
    }
    
    /* Install button for PWA */
    .install-button {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #1f77b4;
        color: white;
        border: none;
        border-radius: 50px;
        padding: 12px 20px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        cursor: pointer;
        font-size: 14px;
        z-index: 1000;
        display: none;
    }
</style>

<!-- PWA Manifest and Service Worker -->
<link rel="manifest" href="/static/manifest.json">
<meta name="theme-color" content="#1f77b4">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="ComEd Pricing">
<link rel="apple-touch-icon" href="/static/icon-192.png">

<script>
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('/static/sw.js');
    });
}

// PWA Install prompt
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const installButton = document.createElement('button');
    installButton.className = 'install-button';
    installButton.innerHTML = '📱 Install App';
    installButton.style.display = 'block';
    installButton.onclick = () => {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                installButton.style.display = 'none';
            }
        });
    };
    document.body.appendChild(installButton);
});
</script>
""", unsafe_allow_html=True)

# Main title
st.title("⚡ ComEd Electricity Pricing Dashboard")
st.markdown("Real-time electricity pricing monitoring with historical analysis and customizable alerts")

# Sidebar for controls
st.sidebar.header("Dashboard Controls")

# Auto-refresh toggle
st.session_state.auto_refresh = st.sidebar.checkbox("Auto-refresh (5 minutes)", value=st.session_state.auto_refresh)

# Alert settings
st.sidebar.header("Price Alert Settings")
st.session_state.alert_settings['alerts_enabled'] = st.sidebar.checkbox("Enable Alerts", value=st.session_state.alert_settings['alerts_enabled'])

if st.session_state.alert_settings['alerts_enabled']:
    st.session_state.alert_settings['low_threshold'] = st.sidebar.slider(
        "Low Price Threshold (¢/kWh)", 
        min_value=0.0, 
        max_value=20.0, 
        value=st.session_state.alert_settings['low_threshold'],
        step=0.5
    )
    st.session_state.alert_settings['medium_threshold'] = st.sidebar.slider(
        "Medium Price Threshold (¢/kWh)", 
        min_value=0.0, 
        max_value=25.0, 
        value=st.session_state.alert_settings['medium_threshold'],
        step=0.5
    )
    st.session_state.alert_settings['high_threshold'] = st.sidebar.slider(
        "High Price Threshold (¢/kWh)", 
        min_value=0.0, 
        max_value=30.0, 
        value=st.session_state.alert_settings['high_threshold'],
        step=0.5
    )

# Date range selection for historical data
st.sidebar.header("Historical Data Range")
start_date = st.sidebar.date_input("Start Date", value=datetime.now() - timedelta(days=7))
end_date = st.sidebar.date_input("End Date", value=datetime.now())

# Manual refresh button
if st.sidebar.button("🔄 Refresh Data"):
    st.session_state.last_update = datetime.now()
    st.rerun()

# Auto-refresh logic
if st.session_state.auto_refresh:
    time_since_update = (datetime.now() - st.session_state.last_update).total_seconds()
    if time_since_update >= 300:  # 5 minutes
        st.session_state.last_update = datetime.now()
        st.rerun()

# Mobile-responsive layout
if 'mobile_view' not in st.session_state:
    st.session_state.mobile_view = False

# Detect mobile view based on viewport (approximate)
mobile_css = """
<script>
if (window.innerWidth < 768) {
    document.body.classList.add('mobile-view');
}
</script>
"""
st.markdown(mobile_css, unsafe_allow_html=True)

# Main dashboard content - responsive layout
if st.sidebar.checkbox("📱 Mobile Layout", value=st.session_state.mobile_view):
    st.session_state.mobile_view = True
    # Stack vertically for mobile
    col1 = st.container()
    col2 = st.container() 
    col3 = st.container()
else:
    st.session_state.mobile_view = False
    # Side by side for desktop
    col1, col2, col3 = st.columns([2, 2, 1])

with col1:
    st.header("Current Pricing")
    
    # Get current hour average
    try:
        current_data = api.get_current_hour_average()
        if current_data:
            latest_price = float(current_data[0]['price'])
            latest_time = processor.convert_millis_to_datetime(int(current_data[0]['millisUTC']))
            
            # Price status indicator
            if latest_price <= st.session_state.alert_settings['low_threshold']:
                status_class = "status-good"
                status_text = "Good time to use electricity"
                price_level = "LOW"
            elif latest_price <= st.session_state.alert_settings['medium_threshold']:
                status_class = "status-warning"
                status_text = "Moderate pricing"
                price_level = "MEDIUM"
            else:
                status_class = "status-danger"
                status_text = "High pricing - consider reducing usage"
                price_level = "HIGH"
            
            st.metric(
                label="Current Hour Average Price",
                value=f"{latest_price:.2f}¢/kWh",
                delta=f"as of {latest_time.strftime('%I:%M %p')}"
            )
            
            st.markdown(f'<p class="{status_class}"><strong>{status_text}</strong></p>', unsafe_allow_html=True)
            
            # Check for alerts
            if st.session_state.alert_settings['alerts_enabled']:
                alert_message = alerts.check_price_alert(latest_price, st.session_state.alert_settings)
                if alert_message:
                    st.warning(alert_message)
        else:
            st.error("Unable to fetch current pricing data. ComEd API may be experiencing issues.")
    except Exception as e:
        st.error(f"Error fetching current pricing: {str(e)}")

with col2:
    st.header("5-Minute Pricing Trend")
    
    # Get last 24 hours of 5-minute data
    try:
        five_min_data = api.get_five_minute_feed()
        if five_min_data:
            df_5min = processor.process_five_minute_data(five_min_data)
            
            # Create trend chart
            fig_trend = go.Figure()
            fig_trend.add_trace(go.Scatter(
                x=df_5min['datetime'],
                y=df_5min['price'],
                mode='lines',
                name='5-Minute Price',
                line=dict(color='#1f77b4', width=2)
            ))
            
            # Add threshold lines
            fig_trend.add_hline(
                y=st.session_state.alert_settings['low_threshold'],
                line_dash="dash",
                line_color="green",
                annotation_text="Low Threshold"
            )
            fig_trend.add_hline(
                y=st.session_state.alert_settings['medium_threshold'],
                line_dash="dash",
                line_color="orange",
                annotation_text="Medium Threshold"
            )
            fig_trend.add_hline(
                y=st.session_state.alert_settings['high_threshold'],
                line_dash="dash",
                line_color="red",
                annotation_text="High Threshold"
            )
            
            fig_trend.update_layout(
                title="Last 24 Hours - 5-Minute Pricing",
                xaxis_title="Time",
                yaxis_title="Price (¢/kWh)",
                height=400,
                showlegend=True
            )
            
            st.plotly_chart(fig_trend, use_container_width=True)
            
            # Quick stats
            st.subheader("24-Hour Statistics")
            col_stats1, col_stats2, col_stats3 = st.columns(3)
            
            with col_stats1:
                st.metric("Average", f"{df_5min['price'].mean():.2f}¢")
            with col_stats2:
                st.metric("Minimum", f"{df_5min['price'].min():.2f}¢")
            with col_stats3:
                st.metric("Maximum", f"{df_5min['price'].max():.2f}¢")
        else:
            st.error("Unable to fetch 5-minute pricing data")
    except Exception as e:
        st.error(f"Error fetching 5-minute data: {str(e)}")

with col3:
    st.header("Price Level")
    
    try:
        if 'latest_price' in locals():
            # Price level gauge
            fig_gauge = go.Figure(go.Indicator(
                mode="gauge+number",
                value=latest_price,
                domain={'x': [0, 1], 'y': [0, 1]},
                title={'text': "¢/kWh"},
                gauge={
                    'axis': {'range': [None, 25]},
                    'bar': {'color': "darkblue"},
                    'steps': [
                        {'range': [0, st.session_state.alert_settings['low_threshold']], 'color': "lightgreen"},
                        {'range': [st.session_state.alert_settings['low_threshold'], st.session_state.alert_settings['medium_threshold']], 'color': "yellow"},
                        {'range': [st.session_state.alert_settings['medium_threshold'], 25], 'color': "lightcoral"}
                    ],
                    'threshold': {
                        'line': {'color': "red", 'width': 4},
                        'thickness': 0.75,
                        'value': st.session_state.alert_settings['high_threshold']
                    }
                }
            ))
            
            fig_gauge.update_layout(height=300)
            st.plotly_chart(fig_gauge, use_container_width=True)
    except:
        st.info("Price gauge will appear when data is available")

# Historical Analysis Section
st.header("Historical Analysis")

# Date range validation
if start_date > end_date:
    st.error("Start date must be before end date")
else:
    try:
        # Get historical data for the selected range
        historical_data = api.get_five_minute_feed_range(start_date, end_date)
        
        if historical_data:
            df_historical = processor.process_five_minute_data(historical_data)
            
            # Historical chart
            fig_historical = px.line(
                df_historical,
                x='datetime',
                y='price',
                title=f"Historical Pricing: {start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')}",
                labels={'datetime': 'Date & Time', 'price': 'Price (¢/kWh)'}
            )
            
            fig_historical.update_layout(height=500)
            st.plotly_chart(fig_historical, use_container_width=True)
            
            # Historical statistics
            st.subheader("Historical Period Statistics")
            col_hist1, col_hist2, col_hist3, col_hist4 = st.columns(4)
            
            with col_hist1:
                st.metric("Period Average", f"{df_historical['price'].mean():.2f}¢")
            with col_hist2:
                st.metric("Period Minimum", f"{df_historical['price'].min():.2f}¢")
            with col_hist3:
                st.metric("Period Maximum", f"{df_historical['price'].max():.2f}¢")
            with col_hist4:
                st.metric("Standard Deviation", f"{df_historical['price'].std():.2f}¢")
            
            # Daily averages
            if len(df_historical) > 0:
                df_daily = processor.calculate_daily_averages(df_historical)
                
                if len(df_daily) > 1:
                    fig_daily = px.bar(
                        df_daily,
                        x='date',
                        y='avg_price',
                        title="Daily Average Prices",
                        labels={'date': 'Date', 'avg_price': 'Average Price (¢/kWh)'}
                    )
                    
                    fig_daily.update_layout(height=400)
                    st.plotly_chart(fig_daily, use_container_width=True)
        else:
            st.info("No historical data available for the selected date range")
    except Exception as e:
        st.error(f"Error fetching historical data: {str(e)}")

# System Status and Info
st.header("System Information")

col_info1, col_info2 = st.columns(2)

with col_info1:
    st.subheader("Data Sources")
    st.markdown("""
    - **5-Minute Feed**: ComEd Official API
    - **Current Hour Average**: Real-time ComEd API
    - **Historical Data**: ComEd Historical API
    - **Update Frequency**: Every 5 minutes (when auto-refresh is enabled)
    """)

with col_info2:
    st.subheader("Last Updated")
    st.markdown(f"**{st.session_state.last_update.strftime('%Y-%m-%d %I:%M:%S %p')}**")
    
    # API status check
    try:
        status = api.check_api_status()
        if status:
            st.success("✅ ComEd API is responding")
        else:
            st.warning("⚠️ ComEd API may be experiencing issues")
    except:
        st.error("❌ Unable to check API status")

# Footer
st.markdown("---")
st.markdown("**Note**: All prices are in cents per kWh (¢/kWh). Data is sourced from ComEd's official APIs and may experience delays during system maintenance.")
st.markdown("**Disclaimer**: This dashboard is for informational purposes only. Final billing prices are subject to ComEd's settlement process.")
