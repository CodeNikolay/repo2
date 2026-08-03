import math
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

        # 1. select cell at random
        x = math.floor(self.rng.random() * self.size)
        y = math.floor(self.rng.random() * self.size)

        # 2. event (growth or lightning)
        if self.grid[x][y] == EMPTY:
            if self.rng.random() < self.p:
                self.grid[x][y] = TREE
        elif self.grid[x][y] == TREE:
            if self.rng.random() < self.f:
                self.grid[x][y] = BURNING

        # 3. fire spread (burn whole cluster in one time step)
        if self.grid[x][y] == BURNING:
            forest_clusters = label(self.grid)[0]
            struck_number = forest_clusters[x][y]
            struck_cluster = forest_clusters == struck_number

            fire_size = int(np.count_nonzero(struck_cluster))
            self.fire_sizes[fire_size] = self.fire_sizes.setdefault(fire_size, 0) + 1

            self.grid[struck_cluster] = BURNING
            self.last_struck = [[x, y]]
        else:
            self.last_struck = []

        self.grid[burning_mask] = EMPTY

    def set_parameters(self, p, f):
        self.p = p
        self.f = f