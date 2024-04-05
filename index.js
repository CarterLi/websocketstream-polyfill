/**
 * [WebSocket](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket) with [Streams API](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API)
 *
 * @see https://web.dev/websocketstream/
 */
export class WebSocketStream {
    url;
    opened;
    closed;
    close;
    constructor(url, options = {}) {
        if (options.signal?.aborted) {
            throw new DOMException('This operation was aborted', 'AbortError');
        }
        this.url = url;
        const ws = new WebSocket(url, options.protocols ?? []);
        const closeWithInfo = ({ closeCode: code, reason } = {}) => ws.close(code, reason);
        this.opened = new Promise((resolve, reject) => {
            ws.onopen = () => {
                resolve({
                    readable: new ReadableStream({
                        start(controller) {
                            ws.onmessage = ({ data }) => controller.enqueue(data);
                            ws.onerror = e => controller.error(e);
                        },
                        cancel: closeWithInfo,
                    }),
                    writable: new WritableStream({
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
        this.closed = new Promise((resolve, reject) => {
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
//# sourceMappingURL=index.js.map