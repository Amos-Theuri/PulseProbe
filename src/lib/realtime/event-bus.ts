import { EventEmitter } from "node:events";
import { ProbeResult, IncidentDisplay } from "@/types";

export interface StreamEvent {
  type: "ping" | "incident" | "status" | "heartbeat";
  data: ProbeResult | IncidentDisplay | Record<string, unknown>;
  timestamp: string;
}

class EventHub extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100);
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
