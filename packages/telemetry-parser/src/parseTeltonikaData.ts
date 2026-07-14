/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Logger } from "./logger";

const logger = new Logger("Decoder");

export function parseTeltonikaData(buffer: Buffer) {
  try {
    if (buffer.length < 8 || buffer.readUInt32BE(0) !== 0) {
      logger.warn("Paquete descartado: Cabecera inicial inválida.");
      return null;
    }

    const codecId = buffer.readUInt8(8);
    const numberOfRecords = buffer.readUInt8(9);

    if (codecId === 12) {
      if (buffer.length < 15) {
        logger.warn("Paquete Codec 12 descartado: Tamaño insuficiente.");
        return null;
      }
      const commandQuantity1 = buffer.readUInt8(9);
      const commandType = buffer.readUInt8(10);
      const commandSize = buffer.readUInt32BE(11);
      
      if (buffer.length < 15 + commandSize + 1) {
        logger.warn("Paquete Codec 12 descartado: Payload incompleto.");
        return null;
      }
      
      const payload = buffer.subarray(15, 15 + commandSize);
      const commandQuantity2 = buffer.readUInt8(15 + commandSize);
      
      return {
        totalInBatch: commandQuantity1,
        records: [],
        isCodec12: true,
        codec12Data: {
          commandQuantity1,
          commandType,
          commandSize,
          payloadHex: payload.toString("hex"),
          payloadAscii: payload.toString("ascii").replace(/\0/g, "").trim(),
          commandQuantity2,
        }
      };
    }

    if (codecId !== 8 && codecId !== 142) {
      logger.warn(`Codec ignorado o no soportado: ${codecId}`);
      return null;
    }

    let offset = 10;
    const records: any = [];

    for (let i = 0; i < numberOfRecords; i++) {
      if (offset + 24 > buffer.length) break;

      const timestampMs = Number(buffer.readBigUInt64BE(offset));
      offset += 8;
      const priority = buffer.readUInt8(offset);
      offset += 1;

      const longitude = buffer.readInt32BE(offset) / 10000000;
      offset += 4;
      const latitude = buffer.readInt32BE(offset) / 10000000;
      offset += 4;
      const altitude = buffer.readInt16BE(offset);
      offset += 2;
      const angle = buffer.readInt16BE(offset); // Dirección en grados
      offset += 2;
      const satellites = buffer.readUInt8(offset);
      offset += 1;
      const gpsSpeed = buffer.readUInt16BE(offset);
      offset += 2;

      const ioData: Record<number, any> = {};
      let eventId;

      if (codecId === 8) {
        eventId = buffer.readUInt8(offset++);
        offset++; // totalIo

        const n1 = buffer.readUInt8(offset++);
        for (let j = 0; j < n1; j++)
          ioData[buffer.readUInt8(offset++)] = buffer.readUInt8(offset++);

        const n2 = buffer.readUInt8(offset++);
        for (let j = 0; j < n2; j++) {
          ioData[buffer.readUInt8(offset++)] = buffer.readUInt16BE(offset);
          offset += 2;
        }

        const n4 = buffer.readUInt8(offset++);
        for (let j = 0; j < n4; j++) {
          ioData[buffer.readUInt8(offset++)] = buffer.readUInt32BE(offset);
          offset += 4;
        }

        const n8 = buffer.readUInt8(offset++);
        for (let j = 0; j < n8; j++) {
          ioData[buffer.readUInt8(offset++)] = Number(
            buffer.readBigUInt64BE(offset),
          );
          offset += 8;
        }
      } else if (codecId === 142) {
        eventId = buffer.readUInt16BE(offset);
        offset += 2;

        offset += 2; // totalIo

        const n1 = buffer.readUInt16BE(offset);
        offset += 2;
        for (let j = 0; j < n1; j++) {
          ioData[buffer.readUInt16BE(offset)] = buffer.readUInt8(offset + 2);
          offset += 3;
        }

        const n2 = buffer.readUInt16BE(offset);
        offset += 2;
        for (let j = 0; j < n2; j++) {
          ioData[buffer.readUInt16BE(offset)] = buffer.readUInt16BE(offset + 2);
          offset += 4;
        }

        const n4 = buffer.readUInt16BE(offset);
        offset += 2;
        for (let j = 0; j < n4; j++) {
          ioData[buffer.readUInt16BE(offset)] = buffer.readUInt32BE(offset + 2);
          offset += 6;
        }

        const n8 = buffer.readUInt16BE(offset);
        offset += 2;
        for (let j = 0; j < n8; j++) {
          ioData[buffer.readUInt16BE(offset)] = Number(
            buffer.readBigUInt64BE(offset + 2),
          );
          offset += 10;
        }

        const nx = buffer.readUInt16BE(offset);
        offset += 2;
        for (let j = 0; j < nx; j++) {
          const id = buffer.readUInt16BE(offset);
          offset += 2;
          const len = buffer.readUInt16BE(offset);
          offset += 2;

          if (id === 256 || id === 281 || id === 82) {
            ioData[id] = buffer
              .toString("ascii", offset, offset + len)
              .replace(/\0/g, "")
              .trim();
          } else {
            ioData[id] = buffer.subarray(offset, offset + len).toString("hex");
          }
          offset += len;
        }
      }

      records.push({
        timestamp: new Date(timestampMs),
        latitude,
        longitude,
        altitude,
        angle,
        satellites,
        gpsSpeed,
        priority,
        eventId,
        ioData,
      });
    }

    return { totalInBatch: numberOfRecords, records };
  } catch (error: any) {
    logger.error(`EXPLOSIÓN INTERNA DE BUFFER:`, error.message);
    return null;
  }
}
