"""One heavy model at a time; repeated operations reuse the warm model."""
import gc
import threading
from contextlib import contextmanager

class ModelPool:
    def __init__(self):
        self.lock = threading.RLock()
        self.name = None
        self.model = None
        self.loads = {}

    @contextmanager
    def use(self, name, factory):
        with self.lock:
            if self.name != name:
                previous = self.model
                self.name = self.model = None
                if previous is not None and hasattr(previous, 'close'):
                    previous.close()
                del previous
                gc.collect()
                self.model = factory()
                self.name = name
                self.loads[name] = self.loads.get(name, 0) + 1
            yield self.model

POOL = ModelPool()
