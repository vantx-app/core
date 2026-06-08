import * as net from "net";

// Configuración Local
const INGESTOR_HOST = "127.0.0.1";
const INGESTOR_PORT = 9000;
const IMEI = "865124071453916";
const VIN = "3N1CN8BB8PL123456"; // Formato estándar Nissan Versa

// 1. Constructor de Handshake (Protocolo Teltonika)
function buildHandshake(imei: string): Buffer {
  const buffer = Buffer.alloc(2 + imei.length);
  buffer.writeUInt16BE(imei.length, 0);
  buffer.write(imei, 2);
  return buffer;
}

// 2. Constructor del Payload Codec 8 Extended
function buildAvlPacket(lat: number, lng: number): Buffer {
  const rec = Buffer.alloc(256);
  let offset = 0;

  // Timestamp (8 bytes)
  rec.writeBigUInt64BE(BigInt(Date.now()), offset);
  offset += 8;
  // Priority (1 byte)
  rec.writeUInt8(0, offset);
  offset += 1;

  // Coordenadas: Ciudad de Panamá
  rec.writeInt32BE(Math.floor(lng * 10000000), offset);
  offset += 4; // Longitude
  rec.writeInt32BE(Math.floor(lat * 10000000), offset);
  offset += 4;

  // Altitud (2 bytes), Ángulo (2 bytes), Satélites (1 byte), Velocidad GPS (2 bytes)
  rec.writeInt16BE(10, offset);
  offset += 2;
  rec.writeInt16BE(90, offset);
  offset += 2;
  rec.writeUInt8(12, offset);
  offset += 1;
  rec.writeUInt16BE(45, offset);
  offset += 2;

  // IO Event ID (2 bytes) y Total IOs (2 bytes) -> Enviaremos 4 sensores
  rec.writeUInt16BE(0, offset);
  offset += 2;
  rec.writeUInt16BE(4, offset);
  offset += 2;

  // N1 (1-byte IOs) -> Ignición (ID 239) = 1 (ON)
  rec.writeUInt16BE(1, offset);
  offset += 2;
  rec.writeUInt16BE(239, offset);
  offset += 2;
  rec.writeUInt8(1, offset);
  offset += 1;

  // N2 (2-byte IOs) -> RPM (ID 36) = 2500 RPM
  rec.writeUInt16BE(1, offset);
  offset += 2;
  rec.writeUInt16BE(36, offset);
  offset += 2;
  rec.writeUInt16BE(2500, offset);
  offset += 2;

  // N4 (4-byte IOs) -> Odometer (ID 16) = 307053 metros
  rec.writeUInt16BE(1, offset);
  offset += 2;
  rec.writeUInt16BE(16, offset);
  offset += 2;
  rec.writeUInt32BE(307053, offset);
  offset += 4;

  // N8 (8-byte IOs) -> 0
  rec.writeUInt16BE(0, offset);
  offset += 2;

  // NX (Dinámicos) -> VIN (ID 256) = Nissan Versa String
  rec.writeUInt16BE(1, offset);
  offset += 2;
  rec.writeUInt16BE(256, offset);
  offset += 2;
  rec.writeUInt16BE(VIN.length, offset);
  offset += 2;
  rec.write(VIN, offset, VIN.length, "ascii");
  offset += VIN.length;

  const recordBuffer = rec.subarray(0, offset);
  const dataFieldLength = 1 + 1 + recordBuffer.length + 1; // Codec + NumRec + Datos + NumRec
  const packet = Buffer.alloc(8 + dataFieldLength + 4);

  let pktOffset = 0;
  // Preamble (4 ceros)
  packet.writeUInt32BE(0, pktOffset);
  pktOffset += 4;
  // Data Length
  packet.writeUInt32BE(dataFieldLength, pktOffset);
  pktOffset += 4;
  // Codec ID (142 = Codec 8 Extended)
  packet.writeUInt8(142, pktOffset);
  pktOffset += 1;
  // Number of Records (1)
  packet.writeUInt8(1, pktOffset);
  pktOffset += 1;

  // Insertar Record
  recordBuffer.copy(packet, pktOffset);
  pktOffset += recordBuffer.length;

  // Number of Records x2 (1)
  packet.writeUInt8(1, pktOffset);
  pktOffset += 1;
  // Dummy CRC (Nuestro parser actual prioriza velocidad y no lo valida, ideal para t3.small)
  packet.writeUInt32BE(0x00000000, pktOffset);
  pktOffset += 4;

  return packet;
}

// 3. Lógica del Cliente TCP
function startBinarySimulator() {
  const client = new net.Socket();
  let isAuthorized = false;

  // Coordenadas iniciales en Panamá
  let currentLat = 8.9824616;
  let currentLng = -79.5361716;

  console.log(`[Simulator] Conectando al Ingestor Local...`);

  client.connect(INGESTOR_PORT, INGESTOR_HOST, () => {
    console.log(`[Simulator] Conectado. Enviando Handshake para IMEI: ${IMEI}`);
    client.write(buildHandshake(IMEI));
  });

  client.on("data", (data) => {
    if (!isAuthorized && data.length === 1 && data.readUInt8(0) === 1) {
      console.log(`[Simulator] Handshake Aceptado. Comenzando ruta...`);
      isAuthorized = true;

      setInterval(() => {
        // Movimiento dinámico: Avanzamos ~11 metros al Norte y al Este
        currentLat += 0.0001;
        currentLng += 0.0001;

        // Pasamos las nuevas coordenadas al generador binario
        const payload = buildAvlPacket(currentLat, currentLng);
        client.write(payload);

        console.log(
          `[Simulator] Moviendo a Lat: ${currentLat.toFixed(5)}, Lng: ${currentLng.toFixed(5)}`,
        );
      }, 5000);
    } else if (isAuthorized && data.length === 4) {
      const ackCount = data.readInt32BE(0);
      console.log(`[Simulator] Servidor confirmó ${ackCount} registros.`);
    }
  });

  client.on("error", (err) => console.error(`[Simulator] Error:`, err.message));
  client.on("close", () => console.log(`[Simulator] Conexión cerrada.`));
}

startBinarySimulator();
