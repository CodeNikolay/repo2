import numpy as np
from scipy.ndimage import label

EMPTY, TREE, BURNING = 0, 1, 2
ACTIVATED = 1

class ForestGrid:
    def __init__(self, size, p, f, seed=None):
        self.size = size
        self.p = p
        self.f = f
        self.grid = np.zeros((size, size), dtype=np.int8)
        self.rng = np.random.default_rng(seed)
        self.last_struck = np.zeros((size, size))
        self.burning = np.zeros((size, size))
        self.fire_sizes = dict()

    def step(self):
        burning_mask = self.grid == BURNING

        # 1. growth
        empty_mask = self.grid == EMPTY
        grow = self.rng.random(size=self.grid.shape, dtype=np.float32) < self.p
        self.grid[empty_mask & grow] = TREE
        cells_activated = empty_mask & grow

        # 2. lightning
        tree_mask = self.grid == TREE
        lightning = self.rng.random(size=self.grid.shape, dtype=np.float32) < self.f
        struck = lightning & tree_mask & ~cells_activated

        # 3.a fire spread (burn whole cluster in one time step)
        # every cluster is labeled with a number, get the numbers of the struck cells and
        # ignite all cells with the same number
        if struck.any():
            forest_clusters = label(self.grid)[0]
            struck_numbers = np.unique(forest_clusters[struck])

            for number in struck_numbers:
                fire_size = int(np.count_nonzero(forest_clusters == number))
                self.fire_sizes[fire_size] = self.fire_sizes.setdefault(fire_size, 0) + 1

            struck_clusters = np.isin(forest_clusters, struck_numbers)
            self.grid[struck_clusters] = BURNING

        self.last_struck = struck
        self.grid[burning_mask] = EMPTY

    def set_parameters(self, p, f):
        self.p = p
        self.f = f