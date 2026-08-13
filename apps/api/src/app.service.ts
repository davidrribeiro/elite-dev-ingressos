import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  health() {
    return { status: 'ok', uptimeSeconds: Math.round(process.uptime()) };
  }
}
