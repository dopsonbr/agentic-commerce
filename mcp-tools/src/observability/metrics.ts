interface MetricLabels {
  [key: string]: string;
}

interface HistogramData {
  type: 'histogram';
  name: string;
  help: string;
  buckets: number[];
  values: Map<string, number[]>;
}

interface CounterData {
  type: 'counter';
  name: string;
  help: string;
  values: Map<string, number>;
}

interface GaugeData {
  type: 'gauge';
  name: string;
  help: string;
  values: Map<string, number>;
}

type MetricData = HistogramData | CounterData | GaugeData;

// Simple in-memory metrics store
const metrics: Map<string, MetricData> = new Map();

const DEFAULT_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

export function createHistogram(name: string, help: string, buckets: number[] = DEFAULT_BUCKETS) {
  const metric: HistogramData = { type: 'histogram', name, help, buckets, values: new Map() };
  metrics.set(name, metric);

  return {
    observe(value: number, labels: MetricLabels = {}) {
      const key = JSON.stringify(labels);
      if (!metric.values.has(key)) {
        metric.values.set(key, []);
      }
      metric.values.get(key)!.push(value);
    },
  };
}

export function createCounter(name: string, help: string) {
  const metric: CounterData = { type: 'counter', name, help, values: new Map() };
  metrics.set(name, metric);

  return {
    inc(labels: MetricLabels = {}, value: number = 1) {
      const key = JSON.stringify(labels);
      const current = metric.values.get(key) || 0;
      metric.values.set(key, current + value);
    },
  };
}

export function createGauge(name: string, help: string) {
  const metric: GaugeData = { type: 'gauge', name, help, values: new Map() };
  metrics.set(name, metric);

  return {
    set(value: number, labels: MetricLabels = {}) {
      const key = JSON.stringify(labels);
      metric.values.set(key, value);
    },
    inc(labels: MetricLabels = {}) {
      const key = JSON.stringify(labels);
      const current = metric.values.get(key) || 0;
      metric.values.set(key, current + 1);
    },
    dec(labels: MetricLabels = {}) {
      const key = JSON.stringify(labels);
      const current = metric.values.get(key) || 0;
      metric.values.set(key, current - 1);
    },
  };
}

// Export metrics in Prometheus format
export function getMetricsOutput(): string {
  const lines: string[] = [];

  for (const [, metric] of metrics) {
    lines.push(`# HELP ${metric.name} ${metric.help}`);
    lines.push(`# TYPE ${metric.name} ${metric.type}`);

    if (metric.type === 'histogram') {
      const hist = metric as HistogramData;
      for (const [labelsJson, values] of hist.values) {
        const labels = JSON.parse(labelsJson);
        const labelStr = Object.entries(labels)
          .map(([k, v]) => `${k}="${v}"`)
          .join(',');
        const labelPrefix = labelStr ? `{${labelStr},` : '{';
        const labelSuffix = labelStr ? '}' : '}';

        const sorted = [...values].sort((a, b) => a - b);
        const sum = sorted.reduce((a, b) => a + b, 0);
        const count = sorted.length;

        // Output buckets
        for (const bucket of [...hist.buckets, Infinity]) {
          const bucketCount = sorted.filter(v => v <= bucket).length;
          const le = bucket === Infinity ? '+Inf' : bucket.toString();
          if (labelStr) {
            lines.push(`${metric.name}_bucket{${labelStr},le="${le}"} ${bucketCount}`);
          } else {
            lines.push(`${metric.name}_bucket{le="${le}"} ${bucketCount}`);
          }
        }
        if (labelStr) {
          lines.push(`${metric.name}_sum{${labelStr}} ${sum}`);
          lines.push(`${metric.name}_count{${labelStr}} ${count}`);
        } else {
          lines.push(`${metric.name}_sum ${sum}`);
          lines.push(`${metric.name}_count ${count}`);
        }
      }
    } else {
      const simpleMetric = metric as CounterData | GaugeData;
      for (const [labelsJson, value] of simpleMetric.values) {
        const labels = JSON.parse(labelsJson);
        const labelStr = Object.entries(labels)
          .map(([k, v]) => `${k}="${v}"`)
          .join(',');
        if (labelStr) {
          lines.push(`${metric.name}{${labelStr}} ${value}`);
        } else {
          lines.push(`${metric.name} ${value}`);
        }
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}
