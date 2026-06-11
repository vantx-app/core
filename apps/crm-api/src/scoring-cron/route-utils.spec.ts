import {
  haversineDistance,
  downsampleByDistance,
  splitIntoChunks,
  decodeFlexiblePolyline,
} from './route-utils';

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
});
