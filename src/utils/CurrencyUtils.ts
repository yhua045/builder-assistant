/**
 * Utility functions for currency and number formatting
 */

export class CurrencyUtils {
  /**
   * Format number as currency (USD by default)
   */
  static formatCurrency(amount: number, currency: string = 'USD'): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  }

  /**
   * Format number with thousands separators
   */
  static formatNumber(number: number): string {
    return new Intl.NumberFormat('en-US').format(number);
  }

  /**
   * Calculate percentage and format it
   */
  static formatPercentage(value: number, total: number, decimals: number = 1): string {
    if (total === 0) return '0%';
    const percentage = (value / total) * 100;
    return `${percentage.toFixed(decimals)}%`;
  }

  /**
   * Parse currency string to number
   */
  static parseCurrency(currencyString: string): number {
    // Remove currency symbols and parse
    const cleaned = currencyString.replace(/[$,\s]/g, '');
    return parseFloat(cleaned) || 0;
  }

  /**
   * Calculate tax amount
   */
  static calculateTax(amount: number, taxRate: number): number {
    return amount * (taxRate / 100);
  }

  /**
   * Calculate discount amount
   */
  static calculateDiscount(amount: number, discountPercentage: number): number {
    return amount * (discountPercentage / 100);
  }

  /**
   * Round to specified decimal places
   */
  static roundToDecimals(number: number, decimals: number = 2): number {
    return Math.round(number * Math.pow(10, decimals)) / Math.pow(10, decimals);
  }
}