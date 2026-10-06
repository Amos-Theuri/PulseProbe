import { eventHub, StreamEvent } from "@/lib/realtime/event-bus";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connect notification
      const initialMessage = encoder.encode(
        `event: connected\ndata: ${JSON.stringify({ status: "connected", timestamp: new Date().toISOString() })}\n\n`
      );
      controller.enqueue(initialMessage);

      // Listener for broadcasted events
      const onStreamEvent = (event: StreamEvent) => {
        try {
          const payload = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        } catch {
          // Stream might be closed
        }
      };

      eventHub.on("stream-event", onStreamEvent);

      // Heartbeat interval to prevent proxy timeout
      const heartbeatTimer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeatTimer);
        }
      }, 15000);

      // Clean up when request aborted
      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeatTimer);
        eventHub.off("stream-event", onStreamEvent);
        try {
          controller.close();
        } catch {
          // Ignore
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
