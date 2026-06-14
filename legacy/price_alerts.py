from datetime import datetime
from typing import Dict, Optional

class PriceAlerts:
    """
    Price alert system for ComEd electricity pricing
    """
    
    def __init__(self):
        self.last_alert_time = None
        self.last_alert_price = None
        self.alert_cooldown_minutes = 15  # Minimum time between similar alerts
    
    def check_price_alert(self, current_price: float, alert_settings: Dict) -> Optional[str]:
        """
        Check if current price triggers an alert
        
        Args:
            current_price: Current electricity price in cents/kWh
            alert_settings: Dictionary with alert thresholds and settings
            
        Returns:
            Alert message if alert should be triggered, None otherwise
        """
        if not alert_settings.get('alerts_enabled', False):
            return None
        
        now = datetime.now()
        
        # Check if we're in cooldown period for similar price alerts
        if (self.last_alert_time and 
            (now - self.last_alert_time).total_seconds() < self.alert_cooldown_minutes * 60 and
            self.last_alert_price and
            abs(current_price - self.last_alert_price) < 1.0):
            return None
        
        alert_message = None
        
        # Check for high price alert
        if current_price >= alert_settings.get('high_threshold', 15.0):
            alert_message = f"⚠️ HIGH PRICE ALERT: {current_price:.2f}¢/kWh - Consider reducing electricity usage"
            
        # Check for very low price alert (good time to use electricity)
        elif current_price <= alert_settings.get('low_threshold', 5.0):
            alert_message = f"💡 LOW PRICE ALERT: {current_price:.2f}¢/kWh - Great time to use electricity!"
            
        # Check for negative pricing
        elif current_price < 0:
            alert_message = f"🎉 NEGATIVE PRICING: {current_price:.2f}¢/kWh - You're being paid to use electricity!"
        
        # Update last alert info if we're sending an alert
        if alert_message:
            self.last_alert_time = now
            self.last_alert_price = current_price
        
        return alert_message
    
    def get_price_level_description(self, price: float, alert_settings: Dict) -> Dict:
        """
        Get descriptive information about the current price level
        
        Args:
            price: Current electricity price in cents/kWh
            alert_settings: Dictionary with alert thresholds
            
        Returns:
            Dictionary with level, description, and recommendation
        """
        low_threshold = alert_settings.get('low_threshold', 5.0)
        medium_threshold = alert_settings.get('medium_threshold', 10.0)
        high_threshold = alert_settings.get('high_threshold', 15.0)
        
        if price < 0:
            return {
                'level': 'NEGATIVE',
                'description': 'Negative pricing - you get paid to use electricity',
                'recommendation': 'Excellent time to run all major appliances',
                'color': 'purple'
            }
        elif price <= low_threshold:
            return {
                'level': 'LOW',
                'description': 'Very low pricing',
                'recommendation': 'Great time to use electricity - run dishwasher, laundry, etc.',
                'color': 'green'
            }
        elif price <= medium_threshold:
            return {
                'level': 'MEDIUM',
                'description': 'Moderate pricing',
                'recommendation': 'Normal usage is fine',
                'color': 'yellow'
            }
        elif price <= high_threshold:
            return {
                'level': 'HIGH',
                'description': 'High pricing',
                'recommendation': 'Consider reducing usage of major appliances',
                'color': 'orange'
            }
        else:
            return {
                'level': 'VERY HIGH',
                'description': 'Very high pricing',
                'recommendation': 'Avoid unnecessary electricity usage',
                'color': 'red'
            }
    
    def calculate_price_trend(self, price_history: list) -> Dict:
        """
        Calculate price trend from historical data
        
        Args:
            price_history: List of recent price values
            
        Returns:
            Dictionary with trend information
        """
        if len(price_history) < 2:
            return {
                'trend': 'STABLE',
                'direction': 'No change',
                'change_percent': 0.0
            }
        
        # Compare current price to average of last few readings
        current_price = price_history[-1]
        previous_avg = sum(price_history[-6:-1]) / min(5, len(price_history) - 1)
        
        change_percent = ((current_price - previous_avg) / previous_avg) * 100
        
        if change_percent > 10:
            return {
                'trend': 'RISING',
                'direction': 'Rising quickly',
                'change_percent': change_percent
            }
        elif change_percent > 5:
            return {
                'trend': 'RISING',
                'direction': 'Rising',
                'change_percent': change_percent
            }
        elif change_percent < -10:
            return {
                'trend': 'FALLING',
                'direction': 'Falling quickly',
                'change_percent': change_percent
            }
        elif change_percent < -5:
            return {
                'trend': 'FALLING',
                'direction': 'Falling',
                'change_percent': change_percent
            }
        else:
            return {
                'trend': 'STABLE',
                'direction': 'Stable',
                'change_percent': change_percent
            }
    
    def get_usage_recommendations(self, price: float, alert_settings: Dict) -> list:
        """
        Get specific usage recommendations based on current price
        
        Args:
            price: Current electricity price in cents/kWh
            alert_settings: Dictionary with alert thresholds
            
        Returns:
            List of usage recommendations
        """
        low_threshold = alert_settings.get('low_threshold', 5.0)
        medium_threshold = alert_settings.get('medium_threshold', 10.0)
        high_threshold = alert_settings.get('high_threshold', 15.0)
        
        if price < 0:
            return [
                "Run all major appliances now",
                "Charge electric vehicles",
                "Use electric heating/cooling as needed",
                "Run pool pumps and water heaters",
                "Consider bitcoin mining or other energy-intensive activities"
            ]
        elif price <= low_threshold:
            return [
                "Great time to run dishwasher",
                "Do laundry loads",
                "Run dryer",
                "Charge electric vehicles",
                "Use electric water heater"
            ]
        elif price <= medium_threshold:
            return [
                "Normal usage is fine",
                "Consider timing major appliances",
                "Monitor prices for better opportunities"
            ]
        elif price <= high_threshold:
            return [
                "Delay running dishwasher if possible",
                "Avoid using dryer",
                "Reduce air conditioning/heating slightly",
                "Wait to charge electric vehicles"
            ]
        else:
            return [
                "Avoid all unnecessary electricity usage",
                "Turn off non-essential appliances",
                "Raise thermostat in summer, lower in winter",
                "Delay all major appliance usage",
                "Consider using battery backup if available"
            ]
