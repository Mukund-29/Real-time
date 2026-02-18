/**
 * Fractional indexing utilities for client-side ordering
 */

export class FractionalIndex {
  static generateBetween(prevIndex: number | null, nextIndex: number | null): number {
    if (prevIndex === null && nextIndex === null) {
      return 0.5;
    }

    if (prevIndex === null) {
      return nextIndex! - 1;
    }

    if (nextIndex === null) {
      return prevIndex + 1;
    }

    const diff = nextIndex - prevIndex;
    if (diff > 1) {
      return prevIndex + diff / 2;
    } else {
      return prevIndex + 0.5;
    }
  }

  static getBefore(index: number): number {
    return index - 1;
  }

  static getAfter(index: number): number {
    return index + 1;
  }
}
