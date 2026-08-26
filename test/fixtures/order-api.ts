import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

export interface OrderApiStub {
  url: string;
  patches: { orderId: string; status: string; txHash?: string }[];
  close: () => Promise<void>;
}

export async function startOrderApiStub(
  orders: Record<string, { total: string }>,
): Promise<OrderApiStub> {
  const patches: OrderApiStub['patches'] = [];

  const server: Server = createServer((req, res) => {
    const [, resource, id, action] = (req.url ?? '').split('/');

    if (resource !== 'orders' || !orders[id]) {
      res.writeHead(404).end();
      return;
    }

    if (req.method === 'GET' && !action) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ id, ...orders[id] }));
      return;
    }

    if (req.method === 'PATCH' && action === 'status') {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        patches.push({ orderId: id, ...JSON.parse(body) });
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ id, ...JSON.parse(body) }));
      });
      return;
    }

    res.writeHead(405).end();
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  return {
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    patches,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}