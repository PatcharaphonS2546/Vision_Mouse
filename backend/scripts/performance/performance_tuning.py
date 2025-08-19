import cv2
import numba
import psutil

# เปิด OpenCV optimization
cv2.setUseOptimized(True)

@numba.jit(nopython=True)
def fast_loop(arr):
    # ตัวอย่าง hot-loop ที่เร่งด้วย numba
    s = 0.0
    for i in range(arr.shape[0]):
        s += arr[i]
    return s

class PerformanceProfiler:
    def __init__(self):
        self.cpu_usage = []
        self.memory_usage = []

    def record(self):
        self.cpu_usage.append(psutil.cpu_percent())
        self.memory_usage.append(psutil.virtual_memory().percent)

    def summary(self):
        return {
            'cpu_avg': sum(self.cpu_usage)/len(self.cpu_usage) if self.cpu_usage else 0,
            'mem_avg': sum(self.memory_usage)/len(self.memory_usage) if self.memory_usage else 0
        }
