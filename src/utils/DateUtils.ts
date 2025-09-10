/**
 * Utility functions for date manipulation and formatting
 */

export class DateUtils {
  /**
   * Format date to readable string
   */
  static formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  /**
   * Format date for input fields (YYYY-MM-DD)
   */
  static formatDateForInput(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Calculate days between two dates
   */
  static daysBetween(startDate: Date, endDate: Date): number {
    const timeDiff = endDate.getTime() - startDate.getTime();
    return Math.ceil(timeDiff / (1000 * 3600 * 24));
  }

  /**
   * Check if date is in the past
   */
  static isPastDate(date: Date): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  }

  /**
   * Add business days to a date (excludes weekends)
   */
  static addBusinessDays(date: Date, days: number): Date {
    const result = new Date(date);
    let addedDays = 0;

    while (addedDays < days) {
      result.setDate(result.getDate() + 1);
      
      // Skip weekends (Saturday = 6, Sunday = 0)
      if (result.getDay() !== 0 && result.getDay() !== 6) {
        addedDays++;
      }
    }

    return result;
  }

  /**
   * Get relative time string (e.g., "2 days ago", "in 3 weeks")
   */
  static getRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (Math.abs(diffDays) === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Tomorrow';
    } else if (diffDays === -1) {
      return 'Yesterday';
    } else if (diffDays > 0) {
      if (diffDays < 7) {
        return `In ${diffDays} days`;
      } else if (diffDays < 30) {
        const weeks = Math.floor(diffDays / 7);
        return `In ${weeks} week${weeks > 1 ? 's' : ''}`;
      } else {
        const months = Math.floor(diffDays / 30);
        return `In ${months} month${months > 1 ? 's' : ''}`;
      }
    } else {
      const absDays = Math.abs(diffDays);
      if (absDays < 7) {
        return `${absDays} days ago`;
      } else if (absDays < 30) {
        const weeks = Math.floor(absDays / 7);
        return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
      } else {
        const months = Math.floor(absDays / 30);
        return `${months} month${months > 1 ? 's' : ''} ago`;
      }
    }
  }
}