import { FractionalIndex } from '../fractionalIndexing';

describe('FractionalIndex', () => {
  describe('generateBetween', () => {
    it('should generate index for first item', () => {
      const index = FractionalIndex.generateBetween(null, null);
      expect(index).toBe(0.5);
    });

    it('should generate index at start', () => {
      const index = FractionalIndex.generateBetween(null, 1);
      expect(index).toBe(0);
    });

    it('should generate index at end', () => {
      const index = FractionalIndex.generateBetween(1, null);
      expect(index).toBe(2);
    });

    it('should generate index between two items', () => {
      const index = FractionalIndex.generateBetween(1, 3);
      expect(index).toBe(2);
    });

    it('should generate index when items are close', () => {
      const index = FractionalIndex.generateBetween(1, 1.5);
      expect(index).toBe(1.25);
    });
  });

  describe('needsRebalance', () => {
    it('should return false for empty array', () => {
      expect(FractionalIndex.needsRebalance([])).toBe(false);
    });

    it('should return false for single item', () => {
      expect(FractionalIndex.needsRebalance([1])).toBe(false);
    });

    it('should return false when indices are well spaced', () => {
      expect(FractionalIndex.needsRebalance([1, 2, 3, 4])).toBe(false);
    });

    it('should return true when indices are too close', () => {
      expect(FractionalIndex.needsRebalance([1, 1.00001, 1.00002])).toBe(true);
    });
  });

  describe('rebalance', () => {
    it('should rebalance indices', () => {
      const indices = [0.5, 0.75, 0.875, 0.9375];
      const rebalanced = FractionalIndex.rebalance(indices);
      expect(rebalanced).toEqual([0, 1, 2, 3]);
    });

    it('should maintain order after rebalancing', () => {
      const indices = [10, 10.5, 11, 11.25];
      const rebalanced = FractionalIndex.rebalance(indices);
      expect(rebalanced).toEqual([0, 1, 2, 3]);
      // Verify order is maintained
      for (let i = 0; i < rebalanced.length - 1; i++) {
        expect(rebalanced[i]).toBeLessThan(rebalanced[i + 1]);
      }
    });
  });
});
