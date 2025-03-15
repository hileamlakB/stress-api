export interface EndpointMetric {
  endpoint: string;
  concurrentRequests: number;
  avgResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  successRate: number;
}

export interface TestSummary {
  totalRequests: number;
  activeEndpoints: string[];
  peakConcurrentRequests: number;
}

type MetricsListener = (metrics: EndpointMetric[]) => void;
type SummaryListener = (summary: TestSummary) => void;

export class MetricsService {
  private static instance: MetricsService;
  private ws: WebSocket | null = null;
  private metricsListeners: Map<string, Set<MetricsListener>> = new Map();
  private summaryListeners: Map<string, Set<SummaryListener>> = new Map();
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private testId: string | null = null;

  private constructor() {}

  static getInstance(): MetricsService {
    if (!MetricsService.instance) {
      MetricsService.instance = new MetricsService();
    }
    return MetricsService.instance;
  }

  startMonitoring(testId: string) {
    this.testId = testId;
    this.connectWebSocket();
    this.startSummaryPolling();
  }

  stopMonitoring() {
    this.closeWebSocket();
    this.stopSummaryPolling();
    this.testId = null;
  }

  private connectWebSocket() {
    if (!this.testId) return;

    try {
      this.ws = new WebSocket(`ws://${window.location.host}/ws/metrics/${this.testId}`);

      this.ws.onmessage = (event) => {
        const metrics = JSON.parse(event.data);
        this.notifyMetricsListeners(this.testId!, metrics);
      };

      this.ws.onclose = () => {
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        this.closeWebSocket();
        this.scheduleReconnect();
      };
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      this.scheduleReconnect();
    }
  }

  private closeWebSocket() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    this.reconnectTimeout = setTimeout(() => {
      this.connectWebSocket();
    }, 1000);
  }

  private summaryPollingInterval: NodeJS.Timer | null = null;

  private startSummaryPolling() {
    if (!this.testId) return;

    // Poll summary every second
    this.summaryPollingInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/tests/${this.testId}/summary`);
        const summary = await response.json();
        this.notifySummaryListeners(this.testId!, summary);
      } catch (error) {
        console.error('Failed to fetch summary:', error);
      }
    }, 1000);
  }

  private stopSummaryPolling() {
    if (this.summaryPollingInterval) {
      clearInterval(this.summaryPollingInterval);
      this.summaryPollingInterval = null;
    }
  }

  subscribeToMetrics(testId: string, listener: MetricsListener) {
    if (!this.metricsListeners.has(testId)) {
      this.metricsListeners.set(testId, new Set());
    }
    this.metricsListeners.get(testId)!.add(listener);
  }

  unsubscribeFromMetrics(testId: string, listener: MetricsListener) {
    this.metricsListeners.get(testId)?.delete(listener);
  }

  subscribeToSummary(testId: string, listener: SummaryListener) {
    if (!this.summaryListeners.has(testId)) {
      this.summaryListeners.set(testId, new Set());
    }
    this.summaryListeners.get(testId)!.add(listener);
  }

  unsubscribeFromSummary(testId: string, listener: SummaryListener) {
    this.summaryListeners.get(testId)?.delete(listener);
  }

  private notifyMetricsListeners(testId: string, metrics: EndpointMetric[]) {
    this.metricsListeners.get(testId)?.forEach(listener => listener(metrics));
  }

  private notifySummaryListeners(testId: string, summary: TestSummary) {
    this.summaryListeners.get(testId)?.forEach(listener => listener(summary));
  }
}
