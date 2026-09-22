import { globalMetricsAggregator } from "../observability/metrics-aggregator.js";
import { v4 as uuidv4 } from "uuid";

export type JobType = "call_summary" | "crm_sync" | "whatsapp_followup" | "hallucination_audit";

export interface Job<T = any> {
  id: string;
  type: JobType;
  payload: T;
  attempts: number;
  maxAttempts: number;
  createdAt: number;
  status: "pending" | "processing" | "completed" | "failed";
  error?: string;
}

export type JobHandler<T = any> = (job: Job<T>) => Promise<void>;

export class AsyncJobQueue {
  private queue: Job[] = [];
  private handlers: Map<JobType, JobHandler> = new Map();
  private isProcessing = false;
  private concurrencyLimit = 5;
  private activeJobsCount = 0;

  registerWorker(type: JobType, handler: JobHandler): void {
    this.handlers.set(type, handler);
  }

  async enqueue<T>(type: JobType, payload: T, maxAttempts = 3): Promise<string> {
    const job: Job<T> = {
      id: `job-${uuidv4().slice(0, 8)}`,
      type,
      payload,
      attempts: 0,
      maxAttempts,
      createdAt: Date.now(),
      status: "pending",
    };

    this.queue.push(job);
    globalMetricsAggregator.updateQueueStats(1, 0);

    // Trigger queue consumer asynchronously
    setImmediate(() => this.processNext());
    return job.id;
  }

  private async processNext(): Promise<void> {
    if (this.activeJobsCount >= this.concurrencyLimit) return;

    const nextJob = this.queue.find((j) => j.status === "pending");
    if (!nextJob) return;

    const handler = this.handlers.get(nextJob.type);
    if (!handler) {
      nextJob.status = "failed";
      nextJob.error = `No worker registered for job type ${nextJob.type}`;
      globalMetricsAggregator.updateQueueStats(-1, 1);
      return;
    }

    nextJob.status = "processing";
    nextJob.attempts += 1;
    this.activeJobsCount += 1;

    try {
      await handler(nextJob);
      nextJob.status = "completed";
      globalMetricsAggregator.updateQueueStats(-1, 1);
    } catch (err: any) {
      if (nextJob.attempts < nextJob.maxAttempts) {
        // Retry with backoff
        nextJob.status = "pending";
      } else {
        nextJob.status = "failed";
        nextJob.error = err.message || String(err);
        globalMetricsAggregator.updateQueueStats(-1, 1);
      }
    } finally {
      this.activeJobsCount -= 1;
      // Continue draining queue
      if (this.queue.some((j) => j.status === "pending")) {
        setImmediate(() => this.processNext());
      }
    }
  }

  getQueueStatus(): { pending: number; active: number; total: number } {
    return {
      pending: this.queue.filter((j) => j.status === "pending").length,
      active: this.activeJobsCount,
      total: this.queue.length,
    };
  }
}

export const globalJobQueue = new AsyncJobQueue();
