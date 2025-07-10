import requests
import json
from datetime import datetime, timedelta
from typing import List, Dict, Optional
import time
import pytz

class ComEdAPI:
    """
    ComEd API client for fetching electricity pricing data
    """
    
    def __init__(self):
        self.base_url = "https://hourlypricing.comed.com/api"
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'ComEd-Pricing-Dashboard/1.0'
        })
        # Chicago/Central timezone for ComEd
        self.chicago_tz = pytz.timezone('America/Chicago')
        self.utc_tz = pytz.UTC
    
    def get_five_minute_feed(self) -> Optional[List[Dict]]:
        """
        Get 5-minute pricing data for the last 24 hours
        
        Returns:
            List of dictionaries containing millisUTC and price data
        """
        try:
            url = f"{self.base_url}?type=5minutefeed"
            response = self.session.get(url, timeout=30)
            response.raise_for_status()
            
            data = response.json()
            return data if isinstance(data, list) else None
            
        except requests.RequestException as e:
            print(f"Error fetching 5-minute feed: {e}")
            return None
        except json.JSONDecodeError as e:
            print(f"Error parsing 5-minute feed JSON: {e}")
            return None
    
    def get_five_minute_feed_range(self, start_date: datetime, end_date: datetime) -> Optional[List[Dict]]:
        """
        Get 5-minute pricing data for a specific date range
        
        Args:
            start_date: Start date for data retrieval
            end_date: End date for data retrieval
            
        Returns:
            List of dictionaries containing millisUTC and price data
        """
        try:
            # Format dates as YYYYMMDDhhmm
            start_str = start_date.strftime("%Y%m%d%H%M")
            end_str = end_date.strftime("%Y%m%d%H%M")
            
            url = f"{self.base_url}?type=5minutefeed&datestart={start_str}&dateend={end_str}"
            response = self.session.get(url, timeout=30)
            response.raise_for_status()
            
            data = response.json()
            return data if isinstance(data, list) else None
            
        except requests.RequestException as e:
            print(f"Error fetching 5-minute feed range: {e}")
            return None
        except json.JSONDecodeError as e:
            print(f"Error parsing 5-minute feed range JSON: {e}")
            return None
    
    def get_current_hour_average(self) -> Optional[List[Dict]]:
        """
        Get current hour average pricing data
        
        Returns:
            List with single dictionary containing current hour average
        """
        try:
            url = f"{self.base_url}?type=currenthouraverage"
            response = self.session.get(url, timeout=30)
            response.raise_for_status()
            
            data = response.json()
            return data if isinstance(data, list) else None
            
        except requests.RequestException as e:
            print(f"Error fetching current hour average: {e}")
            return None
        except json.JSONDecodeError as e:
            print(f"Error parsing current hour average JSON: {e}")
            return None
    
    def get_five_minute_feed_text(self) -> Optional[str]:
        """
        Get 5-minute pricing data in text format
        
        Returns:
            Comma-delimited string of millis:price pairs
        """
        try:
            url = f"{self.base_url}?type=5minutefeed&format=text"
            response = self.session.get(url, timeout=30)
            response.raise_for_status()
            
            return response.text.strip()
            
        except requests.RequestException as e:
            print(f"Error fetching 5-minute feed text: {e}")
            return None
    
    def get_current_hour_average_text(self) -> Optional[str]:
        """
        Get current hour average in text format
        
        Returns:
            Comma-delimited string of millis:price pairs
        """
        try:
            url = f"{self.base_url}?type=currenthouraverage&format=text"
            response = self.session.get(url, timeout=30)
            response.raise_for_status()
            
            return response.text.strip()
            
        except requests.RequestException as e:
            print(f"Error fetching current hour average text: {e}")
            return None
    
    def check_api_status(self) -> bool:
        """
        Check if the ComEd API is responding
        
        Returns:
            True if API is responding, False otherwise
        """
        try:
            url = f"{self.base_url}?type=currenthouraverage"
            response = self.session.get(url, timeout=10)
            return response.status_code == 200
            
        except requests.RequestException:
            return False
    
    def parse_text_response(self, text_data: str) -> List[Dict]:
        """
        Parse text format response into structured data
        
        Args:
            text_data: Comma-delimited string of millis:price pairs
            
        Returns:
            List of dictionaries with millisUTC and price
        """
        try:
            pairs = text_data.split(',')
            result = []
            
            for pair in pairs:
                if ':' in pair:
                    millis, price = pair.split(':', 1)
                    result.append({
                        'millisUTC': millis.strip(),
                        'price': price.strip()
                    })
            
            return result
            
        except Exception as e:
            print(f"Error parsing text response: {e}")
            return []
    
    def get_day_ahead_pricing(self, date: datetime = None) -> Optional[List[Dict]]:
        """
        Get day-ahead pricing data for a specific date
        
        Args:
            date: Date for day-ahead pricing (defaults to today)
            
        Returns:
            List of dictionaries containing hour and price data
        """
        try:
            if date is None:
                date = datetime.now()
            
            # Format date as YYYYMMDD
            date_str = date.strftime("%Y%m%d")
            timestamp = int(time.time() * 1000)  # Current timestamp in milliseconds
            
            url = f"https://hourlypricing.comed.com/rrtp/ServletFeed?type=daynexttoday&date={date_str}&_={timestamp}"
            response = self.session.get(url, timeout=30)
            response.raise_for_status()
            
            # Parse the JavaScript array format response
            data_text = response.text.strip()
            
            # Remove the outer brackets and split by comma groups
            if data_text.startswith('[[') and data_text.endswith(']]'):
                # Parse the JavaScript Date.UTC format
                return self._parse_day_ahead_response(data_text, date)
            else:
                print(f"Unexpected day-ahead response format: {data_text[:100]}...")
                return None
                
        except requests.RequestException as e:
            print(f"Error fetching day-ahead pricing: {e}")
            return None
        except Exception as e:
            print(f"Error parsing day-ahead pricing: {e}")
            return None
    
    def _parse_day_ahead_response(self, data_text: str, base_date: datetime) -> List[Dict]:
        """
        Parse the day-ahead response format
        
        Args:
            data_text: Raw response text in JavaScript array format
            base_date: Base date for the pricing data
            
        Returns:
            List of dictionaries with hour and price data
        """
        try:
            import re
            
            # Extract all [Date.UTC(...), price] patterns
            pattern = r'\[Date\.UTC\((\d+),(\d+),(\d+),(\d+),(\d+),(\d+)\),\s*([\d.]+)\]'
            matches = re.findall(pattern, data_text)
            
            result = []
            for match in matches:
                year, month, day, hour, minute, second, price = match
                
                # JavaScript Date.UTC uses 0-based months, so add 1
                # Despite the Date.UTC format, the day-ahead data appears to be in local Chicago time
                dt_naive = datetime(int(year), int(month) + 1, int(day), int(hour), int(minute), int(second))
                # Localize directly to Chicago timezone (the data is already in local time)
                try:
                    dt = self.chicago_tz.localize(dt_naive)
                except ValueError:
                    # Handle DST transitions by using fold parameter
                    dt = self.chicago_tz.localize(dt_naive, is_dst=None)
                
                result.append({
                    'datetime': dt,
                    'hour': int(hour),
                    'price': float(price),
                    'millisUTC': str(int(dt.timestamp() * 1000))
                })
            
            return result
            
        except Exception as e:
            print(f"Error parsing day-ahead data: {e}")
            return []

    def get_historical_data_batch(self, start_date: datetime, end_date: datetime, 
                                 batch_size_days: int = 7) -> List[Dict]:
        """
        Get historical data in batches to avoid API timeouts
        
        Args:
            start_date: Start date for data retrieval
            end_date: End date for data retrieval
            batch_size_days: Number of days per batch
            
        Returns:
            Combined list of all historical data
        """
        all_data = []
        current_start = start_date
        
        while current_start < end_date:
            current_end = min(current_start + timedelta(days=batch_size_days), end_date)
            
            batch_data = self.get_five_minute_feed_range(current_start, current_end)
            if batch_data:
                all_data.extend(batch_data)
            
            current_start = current_end
            
            # Add small delay between batches to be respectful of API
            time.sleep(0.5)
        
        return all_data
