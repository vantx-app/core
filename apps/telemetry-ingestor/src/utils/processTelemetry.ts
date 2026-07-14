/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import * as net from "net";
import { parseTeltonikaData, Logger } from "@vantx/telemetry-parser";
import { processDataBatch } from "./processDataBatch";

const logger = new Logger("TCP");

export async function processTelemetry(
  data: Buffer,
  imei: string,
  socket: net.Socket,
) {
  try {
    const decodedBatch = parseTeltonikaData(data);

    if (!decodedBatch) {
      logger.log(`No se pudo decodificar el lote para IMEI: ${imei}`);
      return;
    }

    if ((decodedBatch as any).isCodec12) {
      const { commandType, commandSize, payloadHex, payloadAscii } = (decodedBatch as any).codec12Data;
      
      logger.log(
        `[Codec 12] Paquete detectado para IMEI: ${imei} | Tipo: 0x${commandType.toString(16).padStart(2, "0")} | Tamaño: ${commandSize} bytes | Payload (HEX): ${payloadHex} | Payload (ASCII): ${payloadAscii}`
      );

      const ackResponse = Buffer.alloc(4);
      ackResponse.writeInt32BE(decodedBatch.totalInBatch, 0);
      socket.write(ackResponse);

      logger.log(`✅ ACK Codec 12 (${decodedBatch.totalInBatch} comandos) para IMEI: ${imei}`);
      return;
    }

    if (decodedBatch.records.length === 0) {
      logger.log(`No valid records found for ${imei}`);
      return;
    }

    await processDataBatch(decodedBatch.records, imei);

    const ackResponse = Buffer.alloc(4);
    ackResponse.writeInt32BE(decodedBatch.totalInBatch, 0);
    socket.write(ackResponse);

    logger.log(`✅ ACK ${decodedBatch.totalInBatch} records for ${imei}`);
  } catch (error: any) {
    logger.error(`Fatal error en procesamiento DB para ${imei}:`, error);
  }
}
