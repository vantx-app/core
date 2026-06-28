/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import "dotenv/config";
import * as net from "net";
import { processTelemetry } from "./utils/processTelemetry";
import { Logger } from "@vantx/telemetry-parser";

const logger = new Logger("TCP");
const { INGESTOR_HOST, INGESTOR_PORT } = process.env;

const activeSockets = new Map<string, net.Socket>();

const server = net.createServer((socket) => {
  let isHandshakeComplete = false;
  let deviceImei = "";
  let dataBuffer = Buffer.alloc(0);
  let isProcessing = false;
  const packetQueue: Buffer[] = [];

  const processQueue = async () => {
    if (isProcessing || packetQueue.length === 0) return;
    isProcessing = true;
    while (packetQueue.length > 0) {
      const packet = packetQueue.shift()!;
      try {
        await processTelemetry(packet, deviceImei, socket);
      } catch (err: any) {
        logger.error(
          `Error processing queued packet for ${deviceImei}:`,
          err.message,
        );
      }
    }
    isProcessing = false;
  };

  // 1. Prevenir Ghost Connections
  socket.setTimeout(180000);
  socket.on("timeout", () => {
    logger.log(
      `Timeout: Cerrando conexión inactiva para IMEI: ${deviceImei || "Desconocido"}`,
    );
    socket.destroy();
  });

  socket.on("data", (chunk: Buffer) => {
    dataBuffer = Buffer.concat([dataBuffer, chunk]);

    // FASE 1: HANDSHAKE (IMEI)
    if (!isHandshakeComplete) {
      if (dataBuffer.length < 2) return;
      const imeiLength = dataBuffer.readUInt16BE(0);
      if (dataBuffer.length < 2 + imeiLength) return;

      deviceImei = dataBuffer
        .toString("utf8", 2, 2 + imeiLength)
        .replace(/[^a-zA-Z0-9]/g, "");
      logger.log(`Handshake accepted for IMEI: ${deviceImei}`);

      // Close duplicate/stale socket connection for the same IMEI if it exists
      const oldSocket = activeSockets.get(deviceImei);
      if (oldSocket) {
        logger.log(
          `⚠️ Terminating stale socket session for IMEI: ${deviceImei}`,
        );
        oldSocket.destroy();
      }
      activeSockets.set(deviceImei, socket);

      const acceptBuffer = Buffer.alloc(1);
      acceptBuffer.writeInt8(1, 0);
      socket.write(acceptBuffer);

      isHandshakeComplete = true;
      dataBuffer = dataBuffer.subarray(2 + imeiLength);
      return;
    }

    // FASE 2: TELEMETRÍA (AVL DATA)
    while (dataBuffer.length >= 12) {
      const dataFieldLength = dataBuffer.readUInt32BE(4);
      const totalRequiredLength = 8 + dataFieldLength + 4;

      if (dataBuffer.length < totalRequiredLength) {
        break; // Esperando más chunks TCP
      }

      const completePacket = dataBuffer.subarray(0, totalRequiredLength);

      // Encolar y procesar secuencialmente
      packetQueue.push(completePacket);

      // Limpiar buffer
      dataBuffer = dataBuffer.subarray(totalRequiredLength);
    }

    if (packetQueue.length > 0) {
      processQueue().catch((err) =>
        logger.error(
          `Error en cola de procesamiento para ${deviceImei}:`,
          err.message,
        ),
      );
    }
  });

  const cleanupSocket = () => {
    if (deviceImei && activeSockets.get(deviceImei) === socket) {
      activeSockets.delete(deviceImei);
    }
  };

  socket.on("error", (err) => {
    logger.error(`Error en socket (${deviceImei}):`, err.message);
    cleanupSocket();
  });
  socket.on("close", (hadError) => {
    logger.log(`Connection closed for ${deviceImei}`, hadError);
    cleanupSocket();
  });
});

server.listen({ host: INGESTOR_HOST, port: Number(INGESTOR_PORT) }, () => {
  logger.log(`=========================================`);
  logger.log(`🚀 Native Teltonika TCP Ingestor is running!`);
  logger.log(`📡 Listening for hardware connections on port ${INGESTOR_PORT}`);
  logger.log(`=========================================`);
});
