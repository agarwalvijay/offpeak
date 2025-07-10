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
    initial_sidebar_state="collapsed"
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

# Define callback functions for checkboxes
def toggle_auto_refresh():
    st.session_state.auto_refresh = st.session_state.auto_refresh_cb

def toggle_alerts():
    st.session_state.alert_settings['alerts_enabled'] = st.session_state.alerts_enabled_cb

def toggle_mobile():
    st.session_state.mobile_view = st.session_state.mobile_layout_cb

# Auto-refresh toggle
st.sidebar.checkbox("Auto-refresh (5 minutes)", 
                   value=st.session_state.auto_refresh, 
                   key="auto_refresh_cb", 
                   on_change=toggle_auto_refresh)

# Alert settings
st.sidebar.header("Price Alert Settings")
st.sidebar.checkbox("Enable Alerts", 
                   value=st.session_state.alert_settings['alerts_enabled'], 
                   key="alerts_enabled_cb", 
                   on_change=toggle_alerts)

if st.session_state.alert_settings['alerts_enabled']:
    low_threshold = st.sidebar.slider(
        "Low Price Threshold (¢/kWh)", 
        min_value=0.0, 
        max_value=20.0, 
        value=st.session_state.alert_settings['low_threshold'],
        step=0.5
    )
    medium_threshold = st.sidebar.slider(
        "Medium Price Threshold (¢/kWh)", 
        min_value=0.0, 
        max_value=25.0, 
        value=st.session_state.alert_settings['medium_threshold'],
        step=0.5
    )
    high_threshold = st.sidebar.slider(
        "High Price Threshold (¢/kWh)", 
        min_value=0.0, 
        max_value=30.0, 
        value=st.session_state.alert_settings['high_threshold'],
        step=0.5
    )
    
    st.session_state.alert_settings['low_threshold'] = low_threshold
    st.session_state.alert_settings['medium_threshold'] = medium_threshold
    st.session_state.alert_settings['high_threshold'] = high_threshold

# Dashboard features toggle
st.sidebar.header("Dashboard Features")
show_day_ahead = st.sidebar.checkbox("📅 Show Day-Ahead Pricing", value=True, key="show_day_ahead_cb")

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
st.sidebar.checkbox("📱 Mobile Layout", 
                   value=st.session_state.mobile_view, 
                   key="mobile_layout_cb", 
                   on_change=toggle_mobile)

if st.session_state.mobile_view:
    # Stack vertically for mobile
    col1 = st.container()
    col2 = st.container()
else:
    # Side by side for desktop
    col1, col2 = st.columns([1, 1])

with col1:
    st.header("Current Pricing")
    
    # Add explanation of pricing types
    st.info("💡 **Current Hour Average** = average price for this hour | **Latest 5-Minute** = most recent real-time price")
    
    # Create two columns for current pricing metrics
    pricing_col1, pricing_col2 = st.columns(2)
    
    # Get current hour average
    try:
        current_data = api.get_current_hour_average()
        hour_avg_price = None
        hour_avg_time = None
        
        if current_data:
            hour_avg_price = float(current_data[0]['price'])
            hour_avg_time = processor.convert_millis_to_datetime(int(current_data[0]['millisUTC']))
            
            with pricing_col1:
                st.metric(
                    label="Current Hour Average",
                    value=f"{hour_avg_price:.2f}¢/kWh",
                    delta=f"as of {hour_avg_time.strftime('%I:%M %p CT')}"
                )
        else:
            with pricing_col1:
                st.error("Hour average unavailable")
    except Exception as e:
        with pricing_col1:
            st.error(f"Error: {str(e)}")
    
    # Get latest 5-minute price
    try:
        five_min_data = api.get_five_minute_feed()
        latest_5min_price = None
        latest_5min_time = None
        
        if five_min_data:
            latest = five_min_data[-1]
            latest_5min_price = float(latest['price'])
            latest_5min_time = processor.convert_millis_to_datetime(int(latest['millisUTC']))
            
            with pricing_col2:
                st.metric(
                    label="Latest 5-Minute Price",
                    value=f"{latest_5min_price:.2f}¢/kWh",
                    delta=f"as of {latest_5min_time.strftime('%I:%M %p CT')}"
                )
        else:
            with pricing_col2:
                st.error("5-min price unavailable")
    except Exception as e:
        with pricing_col2:
            st.error(f"Error: {str(e)}")
    
    # Use the most recent available price for status and alerts
    if latest_5min_price is not None:
        current_price = latest_5min_price
        price_source = "5-minute"
    elif hour_avg_price is not None:
        current_price = hour_avg_price
        price_source = "hour average"
    else:
        current_price = None
    
    if current_price is not None:
        # Price status indicator
        if current_price <= st.session_state.alert_settings['low_threshold']:
            status_class = "status-good"
            status_text = f"Good time to use electricity ({price_source})"
            price_level = "LOW"
        elif current_price <= st.session_state.alert_settings['medium_threshold']:
            status_class = "status-warning"
            status_text = f"Moderate pricing ({price_source})"
            price_level = "MEDIUM"
        else:
            status_class = "status-danger"
            status_text = f"High pricing - consider reducing usage ({price_source})"
            price_level = "HIGH"
        
        st.markdown(f'<p class="{status_class}"><strong>{status_text}</strong></p>', unsafe_allow_html=True)
        
        # Check for alerts
        if st.session_state.alert_settings['alerts_enabled']:
            alert_message = alerts.check_price_alert(current_price, st.session_state.alert_settings)
            if alert_message:
                st.warning(alert_message)

with col2:
    st.header("5-Minute Pricing Trend")
    
    # Time period selector
    time_periods = {
        "Last 30 minutes": 30,
        "Last 1 hour": 60,
        "Last 3 hours": 180,
        "Last 6 hours": 360,
        "Last 24 hours": 1440
    }
    
    selected_period = st.selectbox(
        "Select time period:",
        options=list(time_periods.keys()),
        index=4  # Default to "Last 24 hours"
    )
    
    minutes_back = time_periods[selected_period]
    
    # Get 5-minute data
    try:
        five_min_data = api.get_five_minute_feed()
        if five_min_data:
            df_5min = processor.process_five_minute_data(five_min_data)
            
            # Filter data based on selected time period
            from datetime import datetime, timedelta
            import pytz
            chicago_tz = pytz.timezone('America/Chicago')
            current_time = datetime.now(chicago_tz)
            cutoff_time = current_time - timedelta(minutes=minutes_back)
            
            # Filter the dataframe
            df_filtered = df_5min[df_5min['datetime'] >= cutoff_time].copy()
            
            if not df_filtered.empty:
                # Create trend chart
                fig_trend = go.Figure()
                fig_trend.add_trace(go.Scatter(
                    x=df_filtered['datetime'],
                    y=df_filtered['price'],
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
                    title=f"{selected_period} - 5-Minute Pricing",
                    xaxis_title="Time (CT)",
                    yaxis_title="Price (¢/kWh)",
                    height=400,
                    showlegend=True
                )
                
                st.plotly_chart(fig_trend, use_container_width=True)
                
                # Quick stats for the selected period
                st.subheader(f"{selected_period} Statistics")
                col_stats1, col_stats2, col_stats3 = st.columns(3)
                
                with col_stats1:
                    st.metric("Average", f"{df_filtered['price'].mean():.2f}¢")
                with col_stats2:
                    st.metric("Minimum", f"{df_filtered['price'].min():.2f}¢")
                with col_stats3:
                    st.metric("Maximum", f"{df_filtered['price'].max():.2f}¢")
                    
                # Show data point count
                st.caption(f"Showing {len(df_filtered)} data points over {selected_period.lower()}")
            else:
                st.warning(f"No data available for {selected_period.lower()}")
        else:
            st.error("Unable to fetch 5-minute pricing data")
    except Exception as e:
        st.error(f"Error fetching 5-minute data: {str(e)}")

# Removed duplicative Price Level section

# Day-Ahead Pricing Section
if show_day_ahead:
    st.header("Day-Ahead Pricing")

    day_ahead_col1, day_ahead_col2 = st.columns([3, 1])

    with day_ahead_col1:
        # Date selector for day-ahead pricing
        day_ahead_date = st.date_input(
            "Select Date for Day-Ahead Pricing", 
            value=datetime.now().date(),
            help="Choose date to view day-ahead hourly pricing forecast"
        )
        
        try:
            # Get day-ahead pricing data
            day_ahead_data = api.get_day_ahead_pricing(datetime.combine(day_ahead_date, datetime.min.time()))
            
            if day_ahead_data:
                df_day_ahead = processor.process_day_ahead_data(day_ahead_data)
                # Store in session state for use in second column
                st.session_state.df_day_ahead = df_day_ahead
                
                if not df_day_ahead.empty:
                    # Validate we have hourly data (24 points)
                    if len(df_day_ahead) != 24:
                        st.warning(f"⚠️ Expected 24 hourly data points, got {len(df_day_ahead)}. This may indicate data retrieval issues.")
                    
                    # Show current time context
                    import pytz
                    chicago_tz = pytz.timezone('America/Chicago')
                    current_ct = datetime.now(chicago_tz)
                    current_hour_ct = current_ct.hour
                    st.info(f"📈 **Day-Ahead Forecast** for {day_ahead_date.strftime('%B %d, %Y')} | Current time: {current_ct.strftime('%I:%M %p CT')} (Hour {current_hour_ct})")
                    
                    # Day-ahead pricing chart
                    fig_day_ahead = go.Figure()
                    
                    # Create color list based on both price thresholds and time context
                    colors = []
                    is_today = day_ahead_date == datetime.now().date()
                    
                    for idx, row in df_day_ahead.iterrows():
                        price = row['price']
                        hour = row['hour']
                        
                        # Determine color based on price thresholds
                        if price <= st.session_state.alert_settings['low_threshold']:
                            color = '#27ae60'  # Green
                        elif price <= st.session_state.alert_settings['medium_threshold']:
                            color = '#f39c12'  # Orange
                        elif price <= st.session_state.alert_settings['high_threshold']:
                            color = '#e67e22'  # Dark orange
                        else:
                            color = '#e74c3c'  # Red
                        
                        # If viewing today and hour has passed, make it semi-transparent
                        if is_today and hour < current_hour_ct:
                            # Convert hex to rgba with transparency
                            if color == '#27ae60':
                                color = 'rgba(39, 174, 96, 0.5)'
                            elif color == '#f39c12':
                                color = 'rgba(243, 156, 18, 0.5)'
                            elif color == '#e67e22':
                                color = 'rgba(230, 126, 34, 0.5)'
                            else:
                                color = 'rgba(231, 76, 60, 0.5)'
                        
                        colors.append(color)
                    
                    # Add hourly bars
                    fig_day_ahead.add_trace(go.Bar(
                        x=df_day_ahead['hour'],
                        y=df_day_ahead['price'],
                        name='Day-Ahead Price',
                        marker_color=colors,
                        hovertemplate='<b>Hour %{x}:00 CT</b><br>Price: %{y:.2f}¢/kWh<extra></extra>'
                    ))
                    
                    # Add current hour indicator if viewing today's forecast
                    if day_ahead_date == datetime.now().date():
                        fig_day_ahead.add_vline(
                            x=current_hour_ct,
                            line_dash="dot",
                            line_color="blue",
                            line_width=3,
                            annotation_text="Current Hour",
                            annotation_position="top"
                        )
                    
                    # Add threshold lines
                    fig_day_ahead.add_hline(
                        y=st.session_state.alert_settings['low_threshold'],
                        line_dash="dash",
                        line_color="green",
                        annotation_text="Low Threshold",
                        annotation_position="top right"
                    )
                    fig_day_ahead.add_hline(
                        y=st.session_state.alert_settings['medium_threshold'],
                        line_dash="dash",
                        line_color="orange",
                        annotation_text="Medium Threshold",
                        annotation_position="top right"
                    )
                    fig_day_ahead.add_hline(
                        y=st.session_state.alert_settings['high_threshold'],
                        line_dash="dash",
                        line_color="red",
                        annotation_text="High Threshold",
                        annotation_position="top right"
                    )
                    
                    # Get current Central Time for display
                    import pytz
                    chicago_tz = pytz.timezone('America/Chicago')
                    current_ct = datetime.now(chicago_tz)
                    
                    fig_day_ahead.update_layout(
                        title=f"Day-Ahead Hourly Pricing - {day_ahead_date.strftime('%B %d, %Y')} (Central Time)<br><sub style='font-size:12px'>24-Hour Forecast - Generated at {current_ct.strftime('%I:%M %p CT')}</sub>",
                        xaxis_title="Hour of Day (CT)",
                        yaxis_title="Price (¢/kWh)",
                        height=450,
                        showlegend=False,
                        xaxis=dict(
                            tickmode='linear',
                            tick0=0,
                            dtick=2,
                            range=[-0.5, 23.5]  # Ensure full 24-hour range
                        )
                    )
                    
                    # Add annotation explaining the color coding
                    if is_today:
                        fig_day_ahead.add_annotation(
                            text="Past hours shown semi-transparent | Colors based on price thresholds",
                            xref="paper", yref="paper",
                            x=0, y=1.02,
                            showarrow=False,
                            font=dict(size=10, color="gray")
                        )
                    
                    # Force unique key to prevent caching issues
                    chart_key = f"day_ahead_{day_ahead_date.strftime('%Y%m%d')}_{current_ct.strftime('%H%M%S')}"
                    st.plotly_chart(fig_day_ahead, use_container_width=True, key=chart_key)
                    
                    # Best and worst hours
                    min_price_hour = df_day_ahead.loc[df_day_ahead['price'].idxmin()]
                    max_price_hour = df_day_ahead.loc[df_day_ahead['price'].idxmax()]
                    
                    best_worst_col1, best_worst_col2 = st.columns(2)
                    
                    with best_worst_col1:
                        st.success(f"**Best Hour:** {min_price_hour['hour']:02d}:00 CT - {min_price_hour['price']:.2f}¢/kWh")
                    
                    with best_worst_col2:
                        st.error(f"**Most Expensive:** {max_price_hour['hour']:02d}:00 CT - {max_price_hour['price']:.2f}¢/kWh")
                
                else:
                    st.info("No day-ahead pricing data available for the selected date")
            else:
                st.warning("Unable to fetch day-ahead pricing data")
                
        except Exception as e:
            st.error(f"Error fetching day-ahead pricing: {str(e)}")

    with day_ahead_col2:
        try:
            if hasattr(st.session_state, 'df_day_ahead') and not st.session_state.df_day_ahead.empty:
                df_day_ahead = st.session_state.df_day_ahead
                # Day-ahead statistics
                st.subheader("Day Statistics")
                
                avg_price = df_day_ahead['price'].mean()
                min_price = df_day_ahead['price'].min()
                max_price = df_day_ahead['price'].max()
                price_range = max_price - min_price
                
                st.metric("Average", f"{avg_price:.2f}¢")
                st.metric("Min Price", f"{min_price:.2f}¢")
                st.metric("Max Price", f"{max_price:.2f}¢")
                st.metric("Price Range", f"{price_range:.2f}¢")
                
                # Peak/Off-peak analysis
                peak_hours = df_day_ahead[(df_day_ahead['hour'] >= 16) & (df_day_ahead['hour'] <= 20)]
                off_peak_hours = df_day_ahead[(df_day_ahead['hour'] <= 6) | (df_day_ahead['hour'] >= 22)]
                
                if not peak_hours.empty and not off_peak_hours.empty:
                    peak_avg = peak_hours['price'].mean()
                    off_peak_avg = off_peak_hours['price'].mean()
                    savings_potential = ((peak_avg - off_peak_avg) / peak_avg) * 100
                    
                    st.markdown("---")
                    st.subheader("Peak vs Off-Peak")
                    st.metric("Peak Avg (4-8pm)", f"{peak_avg:.2f}¢")
                    st.metric("Off-Peak Avg", f"{off_peak_avg:.2f}¢")
                    st.metric("Potential Savings", f"{savings_potential:.1f}%")
        except Exception as e:
            st.error(f"Error in day-ahead statistics: {str(e)}")

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
    # Convert last_update to Chicago timezone if it's not already
    import pytz
    chicago_tz = pytz.timezone('America/Chicago')
    if st.session_state.last_update.tzinfo is None:
        # If naive datetime, assume it's UTC and convert
        utc_time = pytz.UTC.localize(st.session_state.last_update)
        chicago_time = utc_time.astimezone(chicago_tz)
    else:
        # If already timezone-aware, convert to Chicago
        chicago_time = st.session_state.last_update.astimezone(chicago_tz)
    
    st.markdown(f"**{chicago_time.strftime('%Y-%m-%d %I:%M:%S %p CT')}**")
    st.markdown("*All times shown in Central Time (CT)*")
    
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
