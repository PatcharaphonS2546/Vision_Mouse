import time
import pandas as pd
import orjson

class AnalyticsReporter:
    def __init__(self):
        self.metrics = []
        self.last_tick = time.time()

    def add_metric(self, metric):
        self.metrics.append(metric)

    def tick(self):
        now = time.time()
        if now - self.last_tick >= 1.0:
            self.report()
            self.last_tick = now

    def report(self):
        if not self.metrics:
            return None
        df = pd.DataFrame(self.metrics)
        summary = {
            'fps': len(self.metrics),
            'latency_p50': df['latency_ms'].quantile(0.5) if 'latency_ms' in df else None,
            'latency_p95': df['latency_ms'].quantile(0.95) if 'latency_ms' in df else None,
            'drop_rate': df['dropped'].mean() if 'dropped' in df else None,
            'rmse': df['rmse'].iloc[-1] if 'rmse' in df else None
        }
        self.metrics.clear()
        return summary

    def export_session(self, path):
        df = pd.DataFrame(self.metrics)
        df.to_csv(path, index=False)

    def export_json(self, path):
        with open(path, 'wb') as f:
            f.write(orjson.dumps(self.metrics))
