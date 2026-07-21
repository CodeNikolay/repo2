import numpy as np
from scipy.ndimage import binary_dilation

EMPTY, TREE, BURNING = 0, 1, 2
ACTIVATED = 1

class ForestGrid:
    def __init__(self, size, p, f, seed=None):
        self.size = size
        self.p = p
        self.f = f
        self.grid = np.zeros((size, size), dtype=np.int8)
        self.rng = np.random.default_rng(seed)

    def step(self):
        burning_mask = self.grid == BURNING

        # 1. growth
        empty_mask = self.grid == EMPTY
        grow = self.rng.random(size=self.grid.shape, dtype=np.float32) < self.p
        self.grid[empty_mask & grow] = TREE
        cells_activated = empty_mask & grow

        # 2. lightning
        tree_mask = self.grid == TREE
        not_activated_mask = ~cells_activated
        lightning = self.rng.random(size=self.grid.shape, dtype=np.float32) < self.f
        self.grid[lightning & tree_mask & not_activated_mask] = BURNING
        cells_activated[tree_mask & lightning & not_activated_mask] = ACTIVATED # unnecessary for later calculations (only trees can catch fire through spread), but keeps track of activated cells correctly

        # 3. fire spread
        tree_mask = self.grid == TREE
        not_activated_mask = cells_activated != ACTIVATED
        self.grid[binary_dilation(burning_mask) & tree_mask & not_activated_mask] = BURNING
        self.grid[burning_mask] = EMPTY