import { SimulacroCompraIntentoService } from './simulacro-compra-intento.service';

describe('SimulacroCompraIntentoService', () => {
  let service: SimulacroCompraIntentoService;

  beforeEach(() => {
    localStorage.clear();
    service = new SimulacroCompraIntentoService();
  });

  it('persiste key v2 e importe y los reutiliza aunque el precio visible cambie', () => {
    const inicial = service.obtenerOCrear(7, 50, 9.9);
    service.marcarEnviado(inicial);

    const recuperado = service.obtenerOCrear(7, 50, 12.5);

    expect(inicial.idempotencyKey).toMatch(/^simulacro_v2_/);
    expect(recuperado).toEqual({ ...inicial, enviado: true });
    expect(recuperado.importeConfirmado).toBe(9.9);
  });

  it('reutiliza el importe durable aunque el precio actual ya no sea comprable', () => {
    const inicial = service.obtenerOCrear(7, 50, 9.9);
    service.marcarEnviado(inicial);

    const recuperado = service.obtenerOCrear(7, 50, 0);

    expect(recuperado.idempotencyKey).toBe(inicial.idempotencyKey);
    expect(recuperado.importeConfirmado).toBe(9.9);
  });

  it('actualiza precio y key si el precio cambia antes de cualquier POST', () => {
    const inicial = service.obtenerOCrear(7, 50, 9.9);

    const actualizado = service.obtenerOCrear(7, 50, 12.5);

    expect(actualizado.idempotencyKey).not.toBe(inicial.idempotencyKey);
    expect(actualizado.importeConfirmado).toBe(12.5);
    expect(actualizado.enviado).toBe(false);
  });

  it('recupera el mismo intento desde otra instancia tras recarga/navegación', () => {
    const inicial = service.obtenerOCrear(7, 50, 9.9);
    service.marcarEnviado(inicial);

    const recuperado = new SimulacroCompraIntentoService().obtenerOCrear(
      7,
      50,
      12.5,
    );

    expect(recuperado).toEqual({ ...inicial, enviado: true });
  });

  it('aísla el intento por usuario y simulacro', () => {
    const deAna = service.obtenerOCrear(7, 50, 9.9);
    const deLuis = service.obtenerOCrear(8, 50, 9.9);
    const otroProducto = service.obtenerOCrear(7, 51, 9.9);

    expect(deAna.idempotencyKey).not.toBe(deLuis.idempotencyKey);
    expect(deAna.idempotencyKey).not.toBe(otroProducto.idempotencyKey);
  });

  it('rechaza una key legacy sin prefijo v2 y no la convierte ni la sustituye', () => {
    const keyStorage = 'academia:compra-simulacro:v2:7:50';
    localStorage.setItem(
      keyStorage,
      JSON.stringify({
        usuarioId: 7,
        examenId: 50,
        idempotencyKey: 'legacy-uuid-sin-prefijo',
        importeConfirmado: 9.9,
        enviado: true,
      }),
    );

    expect(() => service.obtenerOCrear(7, 50, 9.9)).toThrow(
      /No se pudo recuperar el intento/,
    );
  });

  it('no genera otra key si el registro durable existente está corrupto', () => {
    localStorage.setItem('academia:compra-simulacro:v2:7:50', 'null');

    expect(() => service.obtenerOCrear(7, 50, 9.9)).toThrow(
      /No se pudo recuperar el intento/,
    );
  });

  it('al finalizar un resultado terminal, el siguiente clic crea otro intento v2', () => {
    const inicial = service.obtenerOCrear(7, 50, 9.9);
    service.finalizar(inicial);

    const siguiente = service.obtenerOCrear(7, 50, 9.9);

    expect(siguiente.idempotencyKey).toMatch(/^simulacro_v2_/);
    expect(siguiente.idempotencyKey).not.toBe(inicial.idempotencyKey);
    expect(siguiente.enviado).toBe(false);
  });
});
