import {
  haversineDistance,
  downsampleByDistance,
  splitIntoChunks,
  decodeFlexiblePolyline,
} from './route-utils';
import { snapPointToLinks } from '@vantx/telemetry-parser';

describe('Route Utils', () => {
  describe('haversineDistance', () => {
    it('debe calcular la distancia correcta entre dos puntos geográficos', () => {
      // Coordenadas aproximadas de Ciudad de Panamá a Colón
      const lat1 = 8.983;
      const lon1 = -79.517;
      const lat2 = 9.359;
      const lon2 = -79.901;

      const dist = haversineDistance(lat1, lon1, lat2, lon2);
      expect(dist).toBeGreaterThan(50);
      expect(dist).toBeLessThan(60);
    });
  });

  describe('downsampleByDistance', () => {
    it('debe preservar el primer y último punto siempre', () => {
      const coords = [
        { lat: 9.0, lng: -79.0 },
        { lat: 9.001, lng: -79.001 },
        { lat: 9.01, lng: -79.01 },
      ];
      const result = downsampleByDistance(coords, 0.3, 75);
      expect(result[0]).toEqual(coords[0]);
      expect(result[result.length - 1]).toEqual(coords[coords.length - 1]);
    });

    it('debe retornar los mismos puntos si hay 2 o menos', () => {
      const coords = [
        { lat: 9.0, lng: -79.0 },
        { lat: 9.01, lng: -79.01 },
      ];
      const result = downsampleByDistance(coords, 0.3, 75);
      expect(result).toEqual(coords);
    });

    it('debe filtrar puntos que están demasiado cerca', () => {
      const coords = [
        { lat: 9.0, lng: -79.0 },
        { lat: 9.0001, lng: -79.0001 }, // ~15m — demasiado cerca
        { lat: 9.0002, lng: -79.0002 }, // ~30m — demasiado cerca
        { lat: 9.01, lng: -79.01 }, // ~1.5km — suficiente distancia
        { lat: 9.02, lng: -79.02 }, // ~1.5km — suficiente distancia
      ];
      const result = downsampleByDistance(coords, 0.3, 75);
      expect(result.length).toBeLessThan(coords.length);
      expect(result[0]).toEqual(coords[0]);
      expect(result[result.length - 1]).toEqual(coords[coords.length - 1]);
    });
  });

  describe('splitIntoChunks', () => {
    it('debe retornar un solo chunk si hay 23 puntos o menos', () => {
      const coords = Array.from({ length: 10 }, (_, i) => ({
        lat: 9.0 + i * 0.01,
        lng: -79.0 + i * 0.01,
      }));
      const chunks = splitIntoChunks(coords, 23);
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toEqual(coords);
    });

    it('cada chunk debe tener como máximo 23 puntos', () => {
      const coords = Array.from({ length: 100 }, (_, i) => ({
        lat: 9.0 + i * 0.01,
        lng: -79.0 + i * 0.01,
      }));
      const chunks = splitIntoChunks(coords, 23);
      for (const chunk of chunks) {
        expect(chunk.length).toBeLessThanOrEqual(23);
      }
    });

    it('debe dividir en chunks solapados con continuidad de puntos', () => {
      const coords = Array.from({ length: 50 }, (_, i) => ({
        lat: 9.0 + i * 0.01,
        lng: -79.0 + i * 0.01,
      }));
      const chunks = splitIntoChunks(coords, 23);

      expect(chunks.length).toBeGreaterThan(1);

      // El último punto de cada chunk debe ser el primero del siguiente
      for (let i = 0; i < chunks.length - 1; i++) {
        const lastOfCurrent = chunks[i][chunks[i].length - 1];
        const firstOfNext = chunks[i + 1][0];
        expect(lastOfCurrent).toEqual(firstOfNext);
      }

      // Todos los puntos originales deben estar cubiertos
      const allPoints = new Set<string>();
      for (const chunk of chunks) {
        for (const point of chunk) {
          allPoints.add(`${point.lat},${point.lng}`);
        }
      }
      expect(allPoints.size).toBe(coords.length);
    });
  });

  describe('decodeFlexiblePolyline', () => {
    it('debe decodificar correctamente una flexible polyline válida', () => {
      // Polyline codificada representativa de HERE
      const encoded =
        'BGgn6lRjk613E3N3DnkBjN_EU7B3DUjDkN7pB8Q_EwMzFwvB3X0jBnQ8pBnVwHT0K0PzKzPvHU7pBoVge4wBkhBjSkInB0F4D4N0UoG8GsJoB8Q3Dwb3DsTjD7GjwB7GnfvW3wB7GnkBsE3NgF_OkDsE0UoL6T2R';
      const decoded = decodeFlexiblePolyline(encoded);
      expect(decoded.precision).toBeDefined();
      expect(decoded.polyline).toBeInstanceOf(Array);
      expect(decoded.polyline.length).toBeGreaterThan(0);
    });
  });

  describe('snapPointToLinks - divided highway direction matching', () => {
    it('debe preferir el carril con la dirección de viaje correcta aunque el carril opuesto esté físicamente más cerca', () => {
      // Definir dos segmentos paralelos (Carretera dividida)
      // Segmento 1: Este a Oeste (digitizado hacia el Oeste, rumbo ~270 grados)
      const linkWestbound = {
        linkId: 'link-westbound',
        functionalClass: 1,
        speedLimit: 110,
        isBidirectional: false,
        points: [
          [-79.519, 8.982], // ptA (Este)
          [-79.521, 8.982], // ptB (Oeste)
        ] as [number, number][],
      };

      // Segmento 2: Oeste a Este (digitizado hacia el Este, rumbo ~90 grados)
      const linkEastbound = {
        linkId: 'link-eastbound',
        functionalClass: 1,
        speedLimit: 110,
        isBidirectional: false,
        points: [
          [-79.521, 8.9818], // ptA (Oeste)
          [-79.519, 8.9818], // ptB (Este)
        ] as [number, number][],
      };

      // El vehículo viaja hacia el Este (rumbo 90 grados)
      const vehicleAngle = 90;
      const vehicleSpeed = 80;

      // El punto GPS está a lat: 8.9821, lng: -79.5200.
      // Físicamente:
      // - Distancia al carril Westbound (lat: 8.9820) es menor (~11 metros)
      // - Distancia al carril Eastbound (lat: 8.9818) es mayor (~33 metros)
      const gpsLat = 8.9821;
      const gpsLng = -79.52;

      // Snapping
      const res = snapPointToLinks(
        gpsLat,
        gpsLng,
        vehicleSpeed,
        vehicleAngle,
        [linkWestbound, linkEastbound],
        0.035, // 35m
      );

      expect(res.snapped).toBe(true);
      // Debe haber elegido el carril Eastbound porque coincide con la dirección,
      // a pesar de que el Westbound estaba más cerca.
      expect(res.matchedLink?.linkId).toBe('link-eastbound');
    });

    it('debe snap al único carril disponible en una calle de doble sentido viajando en dirección opuesta', () => {
      // Calle de doble sentido digitizada de Este a Oeste
      const linkTwoWay = {
        linkId: 'link-twoway',
        functionalClass: 3,
        speedLimit: 60,
        isBidirectional: true,
        points: [
          [-79.519, 8.982],
          [-79.521, 8.982],
        ] as [number, number][],
      };

      // El vehículo viaja en sentido contrario (Este, rumbo 90 grados)
      const vehicleAngle = 90;
      const vehicleSpeed = 50;

      const gpsLat = 8.98205; // 5 metros al norte de la calle
      const gpsLng = -79.52;

      const res = snapPointToLinks(
        gpsLat,
        gpsLng,
        vehicleSpeed,
        vehicleAngle,
        [linkTwoWay],
        0.035, // 35m
      );

      // Debe snap correctamente porque es la única opción dentro del rango (35m)
      expect(res.snapped).toBe(true);
      expect(res.matchedLink?.linkId).toBe('link-twoway');
    });

    it('debe snap a la calle de doble sentido en dirección opuesta sin penalización y no confundirse con una calle paralela', () => {
      // Calle de doble sentido digitizada de Este a Oeste (rumbo ~270)
      const linkTwoWay = {
        linkId: 'link-twoway',
        functionalClass: 3,
        speedLimit: 60,
        isBidirectional: true,
        points: [
          [-79.519, 8.982],
          [-79.521, 8.982],
        ] as [number, number][],
      };

      // Otra calle paralela a 15 metros al norte, digitizada de Oeste a Este (rumbo ~90)
      const linkParallel = {
        linkId: 'link-parallel',
        functionalClass: 3,
        speedLimit: 60,
        isBidirectional: true,
        points: [
          [-79.521, 8.98213], // ~15m al norte de A
          [-79.519, 8.98213], // ~15m al norte de B
        ] as [number, number][],
      };

      // El vehículo viaja en sentido contrario al link-twoway (Este, rumbo 90 grados)
      // Está físicamente a 2 metros de link-twoway (muy cerca)
      const vehicleAngle = 90;
      const vehicleSpeed = 50;

      const gpsLat = 8.98202; // Físicamente más cerca de link-twoway (~2 metros) que de link-parallel (~12 metros)
      const gpsLng = -79.52;

      const res = snapPointToLinks(
        gpsLat,
        gpsLng,
        vehicleSpeed,
        vehicleAngle,
        [linkTwoWay, linkParallel],
        0.035, // 35m
      );

      // Debe haber elegido link-twoway porque está más cerca,
      // y no haber sido penalizado por viajar en sentido contrario (ya que es bidirectional)
      expect(res.snapped).toBe(true);
      expect(res.matchedLink?.linkId).toBe('link-twoway');
    });
  });
});
