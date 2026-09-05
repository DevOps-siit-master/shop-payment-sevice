import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import {
  httpRequestDuration,
  httpRequestsTotal,
  httpResponseSizeBytes,
  uniqueVisitorsTotal,
} from './metrics';
import { visitorFingerprint, isNewVisitor } from './visitors';

@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const forwaded = (req.headers['x-forwarded-for'] as string | undefined)
      ?.split(',')[0]
      ?.trim();
    const ip = forwaded || req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] ?? 'unknown';

    if (isNewVisitor(visitorFingerprint(ip, userAgent))) {
      uniqueVisitorsTotal.inc();
    }

    const start = process.hrtime.bigint();
    res.on('finish', () => {
      const route: string = req.route?.path ?? req.path;
      const labels = {
        method: req.method,
        route,
        status_code: String(res.statusCode),
      };
      httpRequestsTotal.inc(labels);
      httpRequestDuration.observe(
        labels,
        Number(process.hrtime.bigint() - start) / 1e9,
      );
      httpResponseSizeBytes.inc(
        labels,
        Number(res.getHeader('content-length') ?? 0),
      );
    });
    next();
  }
}