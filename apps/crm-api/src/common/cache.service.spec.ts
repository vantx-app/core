import { Test, TestingModule } from '@nestjs/testing';
import { CacheService } from './cache.service';

describe('CacheService', () => {
  let service: CacheService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CacheService],
    }).compile();

    service = module.get<CacheService>(CacheService);
  });

  afterEach(() => {
    service.clear();
  });

  it('debe estar definido', () => {
    expect(service).toBeDefined();
  });

  it('debe permitir guardar y obtener valores', () => {
    service.set('test-key', { data: 123 }, 5000);
    expect(service.get('test-key')).toEqual({ data: 123 });
  });

  it('debe retornar null para claves inexistentes', () => {
    expect(service.get('non-existent')).toBeNull();
  });

  it('debe expirar los valores después del TTL', async () => {
    jest.useFakeTimers();
    service.set('test-key', 'value', 1000);

    // Avanzar el tiempo 1001ms
    jest.advanceTimersByTime(1001);

    expect(service.get('test-key')).toBeNull();
    jest.useRealTimers();
  });

  it('debe permitir eliminar una clave específica', () => {
    service.set('key1', 'value1', 5000);
    service.del('key1');
    expect(service.get('key1')).toBeNull();
  });

  it('debe eliminar claves por patrón de prefijo', () => {
    service.set('vehicles:1', 'v1', 5000);
    service.set('vehicles:2', 'v2', 5000);
    service.set('drivers:1', 'd1', 5000);

    service.delByPattern('vehicles:');

    expect(service.get('vehicles:1')).toBeNull();
    expect(service.get('vehicles:2')).toBeNull();
    expect(service.get('drivers:1')).toEqual('d1');
  });

  it('debe limpiar todo el caché con clear()', () => {
    service.set('key1', 'value1', 5000);
    service.set('key2', 'value2', 5000);
    service.clear();

    expect(service.get('key1')).toBeNull();
    expect(service.get('key2')).toBeNull();
  });
});
