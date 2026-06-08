import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { INestApplicationContext } from '@nestjs/common';

export class CustomSocketIoAdapter extends IoAdapter {
  constructor(app: INestApplicationContext) {
    super(app);
  }

  createIOServer(
    port: number,
    options?: ServerOptions,
  ): ReturnType<IoAdapter['createIOServer']> {
    const server = super.createIOServer(port, {
      ...options,
      pingInterval: 25000,
      pingTimeout: 20000,
      cors: {
        origin: process.env.CORS_ORIGIN
          ? (process.env.CORS_ORIGIN.includes(',')
            ? process.env.CORS_ORIGIN.split(',')
            : process.env.CORS_ORIGIN)
          : 'http://localhost:3001',
        credentials: true,
      },
    });
    return server;
  }
}
