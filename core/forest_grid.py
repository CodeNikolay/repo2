import math
import numpy as np
from scipy.ndimage import binary_dilation
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

    def step(self):
        burning_mask = self.grid == BURNING

        # # 1. one cell experiences an event per step (original DS model)
        # # 1.1 select cell at random
        # x = math.floor(self.rng.random() * self.size)
        # y = math.floor(self.rng.random() * self.size)
        #
        # # 1.2 event (growth or lightning)
        # if self.grid[x][y] == EMPTY:
        #     if self.rng.random() < self.p:
        #         self.grid[x][y] = TREE
        # elif self.grid[x][y] == TREE:
        #     if self.rng.random() < self.f:
        #         self.grid[x][y] = BURNING
        #
        # # 1.3 fire spread (burn whole cluster in one time step)
        # if self.grid[x][y] == BURNING:
        #     forest_clusters = label(self.grid)[0]
        #     struck_number = forest_clusters[x][y]
        #     struck_cluster = forest_clusters == struck_number
        #     self.grid[struck_cluster] = BURNING
        #     self.last_struck = [[x, y]]
        # else:
        #     self.last_struck = []

        # 2. every cell experiences an event per step
        # 2.1 growth
        empty_mask = self.grid == EMPTY
        grow = self.rng.random(size=self.grid.shape, dtype=np.float32) < self.p
        self.grid[empty_mask & grow] = TREE
        cells_activated = empty_mask & grow

        # 2.2 lightning
        tree_mask = self.grid == TREE
        lightning = self.rng.random(size=self.grid.shape, dtype=np.float32) < self.f
        struck = lightning & tree_mask & ~cells_activated

        # 2.3.a fire spread (burn whole cluster in one time step)
        # every cluster is labeled with a number, get the numbers of the struck cells and
        # ignite all cells with the same number
        if struck.any():
            forest_clusters = label(self.grid)[0]
            struck_numbers = forest_clusters[struck]
            struck_clusters = np.isin(forest_clusters, struck_numbers)
            self.grid[struck_clusters] = BURNING

        # # 2.3.b fire spread (burn only adjacent cells each time step)
        # self.grid[struck] = BURNING
        # tree_mask = self.grid == TREE
        # not_activated_mask = cells_activated != ACTIVATED
        # self.grid[binary_dilation(burning_mask) & tree_mask & not_activated_mask] = BURNING

        self.last_struck = struck

        self.grid[burning_mask] = EMPTY

    def set_parameters(self, p, f):
        self.p = p
        self.f = f