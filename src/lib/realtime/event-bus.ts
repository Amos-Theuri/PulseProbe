import { EventEmitter } from "node:events";
import { ProbeResult, IncidentDisplay } from "@/types";

export interface StreamEvent {
  type: "ping" | "incident" | "status" | "heartbeat";
  data: ProbeResult | IncidentDisplay | Record<string, unknown>;
  timestamp: string;
}

const MAX_SSE_CLIENTS = parseInt(process.env.MAX_SSE_CLIENTS || "100", 10);

class EventHub extends EventEmitter {
  private activeClients = 0;

  constructor() {
    super();
    this.setMaxListeners(MAX_SSE_CLIENTS + 10);
  }

  canAcceptClient(): boolean {
    return this.activeClients < MAX_SSE_CLIENTS;
  }

  registerClient(): boolean {
    if (this.activeClients >= MAX_SSE_CLIENTS) {
      return false;
    }
    this.activeClients++;
    return true;
  }

  unregisterClient(): void {
    if (this.activeClients > 0) {
      this.activeClients--;
    }
  }

  getClientCount(): number {
    return this.activeClients;
  }

  broadcast(event: StreamEvent) {
    this.emit("stream-event", event);
  }
}

declare global {
  // eslint-disable-next-line no-var
  var pulseEventHub: EventHub | undefined;
}

export const eventHub = globalThis.pulseEventHub ?? new EventHub();

if (process.env.NODE_ENV !== "production") {
  globalThis.pulseEventHub = eventHub;
}
