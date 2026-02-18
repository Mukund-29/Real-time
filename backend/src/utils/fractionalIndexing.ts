/**
 * Fractional indexing for O(1) task ordering
 * Based on the approach used by Linear, Notion, etc.
 */

export class FractionalIndex {
  /**
   * Generate a new index between two existing indices
   * @param prevIndex Previous index (or null if inserting at start)
   * @param nextIndex Next index (or null if inserting at end)
   * @returns New fractional index
   */
  static generateBetween(prevIndex: number | null, nextIndex: number | null): number {
    if (prevIndex === null && nextIndex === null) {
      // First item
      return 0.5;
    }

    if (prevIndex === null) {
      // Insert at start
      return nextIndex! - 1;
    }

    if (nextIndex === null) {
      // Insert at end
      return prevIndex + 1;
    }

    // Insert between two indices
    const diff = nextIndex - prevIndex;
    if (diff > 1) {
      // Enough space, use midpoint
      return prevIndex + diff / 2;
    } else {
      // Need to rebalance - use a strategy that minimizes rebalancing
      // In practice, we'd trigger a rebalance, but for now we'll use a small increment
      return prevIndex + 0.5;
    }
  }

  /**
   * Get the index before a given index
   */
  static getBefore(index: number): number {
    return index - 1;
  }

  /**
   * Get the index after a given index
   */
  static getAfter(index: number): number {
    return index + 1;
  }

  /**
   * Check if rebalancing is needed (when indices get too close)
   */
  static needsRebalance(indices: number[]): boolean {
    if (indices.length < 2) return false;
    
    const sorted = [...indices].sort((a, b) => a - b);
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i + 1] - sorted[i] < 0.0001) {
        return true;
      }
    }
    return false;
  }

  /**
   * Rebalance indices to ensure proper spacing
   */
  static rebalance(indices: number[]): number[] {
    const sorted = [...indices].sort((a, b) => a - b);
    const step = 1.0;
    return sorted.map((_, i) => i * step);
  }
}
