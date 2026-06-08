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

    if (!decodedBatch || decodedBatch.records.length === 0) {
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
