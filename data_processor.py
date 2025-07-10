import pandas as pd
from datetime import datetime
from typing import List, Dict
import numpy as np
import pytz

class DataProcessor:
    """
    Data processing utilities for ComEd pricing data
    """
    
    def __init__(self):
        # Chicago/Central timezone for ComEd
        self.chicago_tz = pytz.timezone('America/Chicago')
        self.utc_tz = pytz.UTC
    
    def convert_millis_to_datetime(self, millis: int) -> datetime:
        """
        Convert UTC milliseconds to Chicago timezone datetime object
        
        Args:
            millis: UTC milliseconds timestamp
            
        Returns:
            datetime object in Chicago timezone
        """
        # Create UTC datetime from timestamp
        utc_dt = datetime.fromtimestamp(millis / 1000.0, tz=self.utc_tz)
        # Convert to Chicago timezone
        chicago_dt = utc_dt.astimezone(self.chicago_tz)
        return chicago_dt
    
    def process_five_minute_data(self, api_data: List[Dict]) -> pd.DataFrame:
        """
        Process 5-minute API data into a pandas DataFrame
        
        Args:
            api_data: List of dictionaries from ComEd API
            
        Returns:
            pandas DataFrame with datetime and price columns
        """
        if not api_data:
            return pd.DataFrame(columns=['datetime', 'price', 'millisUTC'])
        
        processed_data = []
        
        for entry in api_data:
            try:
                millis = int(entry['millisUTC'])
                price = float(entry['price'])
                dt = self.convert_millis_to_datetime(millis)
                
                processed_data.append({
                    'datetime': dt,
                    'price': price,
                    'millisUTC': millis
                })
            except (ValueError, KeyError) as e:
                print(f"Error processing entry {entry}: {e}")
                continue
        
        df = pd.DataFrame(processed_data)
        
        # Sort by datetime
        if not df.empty:
            df = df.sort_values('datetime').reset_index(drop=True)
        
        return df
    
    def calculate_daily_averages(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Calculate daily average prices from 5-minute data
        
        Args:
            df: DataFrame with datetime and price columns
            
        Returns:
            DataFrame with daily averages
        """
        if df.empty:
            return pd.DataFrame(columns=['date', 'avg_price', 'min_price', 'max_price', 'std_price'])
        
        df_copy = df.copy()
        df_copy['date'] = df_copy['datetime'].dt.date
        
        daily_stats = df_copy.groupby('date').agg({
            'price': ['mean', 'min', 'max', 'std', 'count']
        }).round(2)
        
        daily_stats.columns = ['avg_price', 'min_price', 'max_price', 'std_price', 'count']
        daily_stats = daily_stats.reset_index()
        
        return daily_stats
    
    def calculate_hourly_averages(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Calculate hourly average prices from 5-minute data
        
        Args:
            df: DataFrame with datetime and price columns
            
        Returns:
            DataFrame with hourly averages
        """
        if df.empty:
            return pd.DataFrame(columns=['hour', 'avg_price', 'min_price', 'max_price'])
        
        df_copy = df.copy()
        df_copy['hour'] = df_copy['datetime'].dt.floor('H')
        
        hourly_stats = df_copy.groupby('hour').agg({
            'price': ['mean', 'min', 'max', 'count']
        }).round(2)
        
        hourly_stats.columns = ['avg_price', 'min_price', 'max_price', 'count']
        hourly_stats = hourly_stats.reset_index()
        
        return hourly_stats
    
    def calculate_statistics(self, df: pd.DataFrame) -> Dict:
        """
        Calculate comprehensive statistics from pricing data
        
        Args:
            df: DataFrame with datetime and price columns
            
        Returns:
            Dictionary with various statistics
        """
        if df.empty:
            return {
                'mean': 0.0,
                'median': 0.0,
                'std': 0.0,
                'min': 0.0,
                'max': 0.0,
                'count': 0,
                'negative_price_count': 0,
                'negative_price_percentage': 0.0
            }
        
        prices = df['price']
        
        stats = {
            'mean': round(prices.mean(), 2),
            'median': round(prices.median(), 2),
            'std': round(prices.std(), 2),
            'min': round(prices.min(), 2),
            'max': round(prices.max(), 2),
            'count': len(prices),
            'negative_price_count': len(prices[prices < 0]),
            'negative_price_percentage': round((len(prices[prices < 0]) / len(prices)) * 100, 2)
        }
        
        # Percentiles
        stats['p25'] = round(prices.quantile(0.25), 2)
        stats['p75'] = round(prices.quantile(0.75), 2)
        stats['p90'] = round(prices.quantile(0.90), 2)
        stats['p95'] = round(prices.quantile(0.95), 2)
        
        return stats
    
    def detect_price_spikes(self, df: pd.DataFrame, threshold_multiplier: float = 2.0) -> pd.DataFrame:
        """
        Detect price spikes in the data
        
        Args:
            df: DataFrame with datetime and price columns
            threshold_multiplier: Multiplier for standard deviation to detect spikes
            
        Returns:
            DataFrame with spike information
        """
        if df.empty:
            return pd.DataFrame(columns=['datetime', 'price', 'spike_type'])
        
        prices = df['price']
        mean_price = prices.mean()
        std_price = prices.std()
        
        upper_threshold = mean_price + (threshold_multiplier * std_price)
        lower_threshold = mean_price - (threshold_multiplier * std_price)
        
        spikes = []
        
        for idx, row in df.iterrows():
            if row['price'] > upper_threshold:
                spikes.append({
                    'datetime': row['datetime'],
                    'price': row['price'],
                    'spike_type': 'HIGH'
                })
            elif row['price'] < lower_threshold:
                spikes.append({
                    'datetime': row['datetime'],
                    'price': row['price'],
                    'spike_type': 'LOW'
                })
        
        return pd.DataFrame(spikes)
    
    def calculate_moving_averages(self, df: pd.DataFrame, windows: List[int] = [12, 48, 144]) -> pd.DataFrame:
        """
        Calculate moving averages for different time windows
        
        Args:
            df: DataFrame with datetime and price columns
            windows: List of window sizes (in number of 5-minute intervals)
                    12 = 1 hour, 48 = 4 hours, 144 = 12 hours
            
        Returns:
            DataFrame with moving averages added
        """
        if df.empty:
            return df
        
        df_copy = df.copy()
        
        for window in windows:
            hours = window / 12  # Convert to hours (12 intervals per hour)
            col_name = f'ma_{int(hours)}h'
            df_copy[col_name] = df_copy['price'].rolling(window=window, min_periods=1).mean().round(2)
        
        return df_copy
    
    def get_price_distribution(self, df: pd.DataFrame, bins: int = 20) -> Dict:
        """
        Calculate price distribution for histogram visualization
        
        Args:
            df: DataFrame with datetime and price columns
            bins: Number of bins for histogram
            
        Returns:
            Dictionary with bin edges and counts
        """
        if df.empty:
            return {'bins': [], 'counts': []}
        
        prices = df['price']
        counts, bin_edges = np.histogram(prices, bins=bins)
        
        return {
            'bins': bin_edges.tolist(),
            'counts': counts.tolist(),
            'bin_centers': ((bin_edges[:-1] + bin_edges[1:]) / 2).tolist()
        }
    
    def process_day_ahead_data(self, api_data: List[Dict]) -> pd.DataFrame:
        """
        Process day-ahead hourly pricing data into a pandas DataFrame
        
        Args:
            api_data: List of dictionaries from ComEd day-ahead API
            
        Returns:
            pandas DataFrame with datetime, hour, and price columns
        """
        if not api_data:
            return pd.DataFrame(columns=['datetime', 'hour', 'price'])
        
        processed_data = []
        
        for entry in api_data:
            try:
                dt = entry['datetime']
                hour = entry['hour']
                price = float(entry['price'])
                
                processed_data.append({
                    'datetime': dt,
                    'hour': hour,
                    'price': price
                })
            except (ValueError, KeyError) as e:
                print(f"Error processing day-ahead entry {entry}: {e}")
                continue
        
        df = pd.DataFrame(processed_data)
        
        # Sort by datetime
        if not df.empty:
            df = df.sort_values('datetime').reset_index(drop=True)
        
        return df

    def filter_data_by_time_range(self, df: pd.DataFrame, start_hour: int, end_hour: int) -> pd.DataFrame:
        """
        Filter data by hour of day
        
        Args:
            df: DataFrame with datetime and price columns
            start_hour: Starting hour (0-23)
            end_hour: Ending hour (0-23)
            
        Returns:
            Filtered DataFrame
        """
        if df.empty:
            return df
        
        df_copy = df.copy()
        df_copy['hour'] = df_copy['datetime'].dt.hour
        
        if start_hour <= end_hour:
            # Normal range (e.g., 9-17)
            filtered = df_copy[(df_copy['hour'] >= start_hour) & (df_copy['hour'] <= end_hour)]
        else:
            # Overnight range (e.g., 22-6)
            filtered = df_copy[(df_copy['hour'] >= start_hour) | (df_copy['hour'] <= end_hour)]
        
        return filtered.drop(columns=['hour'])
