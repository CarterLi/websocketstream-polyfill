export interface WebSocketConnection<T extends Uint8Array | string = Uint8Array | string> {
  readable: ReadableStream<T>;
  writable: WritableStream<T>;
  protocol: string;
  extensions: string;
}

export interface WebSocketCloseInfo {
  closeCode?: number;
  reason?: string;
}

export interface WebSocketStreamOptions {
  protocols?: string[];
  signal?: AbortSignal;
}

/**
 * [WebSocket](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket) with [Streams API](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API)
 *
 * @see https://web.dev/websocketstream/
 */
export class WebSocketStream<T extends Uint8Array | string = Uint8Array | string> {
  readonly url: string;

  readonly opened: Promise<WebSocketConnection<T>>;

  readonly closed: Promise<WebSocketCloseInfo>;

  readonly close: (closeInfo?: WebSocketCloseInfo) => void;

  constructor(url: string, options: WebSocketStreamOptions = {}) {
    if (options.signal?.aborted) {
      throw new DOMException('This operation was aborted', 'AbortError');
    }

    this.url = url;

    const ws = new WebSocket(url, options.protocols ?? []);

    const closeWithInfo = ({ closeCode: code, reason }: WebSocketCloseInfo = {}) => ws.close(code, reason);

    this.opened = new Promise((resolve, reject) => {
      ws.onopen = () => {
        resolve({
          readable: new ReadableStream<T>({
            start(controller) {
              ws.onmessage = ({ data }) => controller.enqueue(data);
              ws.onerror = e => controller.error(e);
            },
            cancel: closeWithInfo,
          }),
          writable: new WritableStream<T>({
            write(chunk) { ws.send(chunk); },
            abort() { ws.close(); },
            close: closeWithInfo,
          }),
          protocol: ws.protocol,
          extensions: ws.extensions,
        });
        ws.removeEventListener('error', reject);
      };
      ws.addEventListener('error', reject);
    });

    this.closed = new Promise<WebSocketCloseInfo>((resolve, reject) => {
      ws.onclose = ({ code, reason }) => {
        resolve({ closeCode: code, reason });
        ws.removeEventListener('error', reject);
      };
      ws.addEventListener('error', reject);
    });

    if (options.signal) {
      options.signal.onabort = () => ws.close();
    }

    this.close = closeWithInfo;
  }
}
