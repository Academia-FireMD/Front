import { decodeJwtPayload } from './jwt.util';

/**
 * Codifica un objeto como segmento de payload base64url (igual que hace
 * jsonwebtoken en el backend) y lo envuelve en un JWT de tres segmentos.
 */
function buildJwt(payload: Record<string, unknown>): string {
  // Replica la codificación de jsonwebtoken (base64url de JSON UTF-8) usando
  // solo globales de navegador (btoa + encodeURIComponent), sin Buffer ni
  // TextEncoder que no existen/typan en el entorno de specs.
  const json = JSON.stringify(payload);
  const binary = encodeURIComponent(json).replace(/%([0-9A-F]{2})/g, (_, h) =>
    String.fromCharCode(parseInt(h, 16)),
  );
  const base64url = btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `header.${base64url}.signature`;
}

describe('decodeJwtPayload', () => {
  it('devuelve null para token vacío o malformado', () => {
    expect(decodeJwtPayload(null)).toBeNull();
    expect(decodeJwtPayload(undefined)).toBeNull();
    expect(decodeJwtPayload('')).toBeNull();
    expect(decodeJwtPayload('sin-puntos')).toBeNull();
    expect(decodeJwtPayload('a.@@@.c')).toBeNull();
  });

  it('decodifica un payload ASCII simple', () => {
    const token = buildJwt({ email: 'a@b.com', rol: 'ALUMNO', sub: 1 });
    expect(decodeJwtPayload(token)).toEqual({
      email: 'a@b.com',
      rol: 'ALUMNO',
      sub: 1,
    });
  });

  // Regresión incidente prod 2026-06-05 (usuario id 249, opob1salva@gmail.com):
  // su payload real (con avatarUrl de gravatar) produce un base64url con '-'/'_'
  // que hacía petar a atob() con InvalidCharacterError -> sin acceso + fallo de
  // impersonación. El payload de abajo está verificado para contener esos
  // caracteres.
  it('decodifica un payload cuyo base64url contiene "-" y "_" (caso Salvador)', () => {
    const payload = {
      email: 'opob1salva@gmail.com',
      sub: 249,
      rol: 'ALUMNO',
      oposiciones: ['ALICANTE_CPBA'],
      nombre: 'Salvador',
      avatarUrl:
        'https://secure.gravatar.com/avatar/1784f5f220585ab9d3bd54a948d4695478a23cedc6866b34fb59646a5011750a?s=96&d=mm&r=g',
      isImpersonating: true,
      impersonatedBy: 1,
      originalAdminEmail: 'firemdacademia@gmail.com',
      iat: 1716210000,
      exp: 1716213600,
    };
    const token = buildJwt(payload);

    // Pre-condición del test: el segmento DEBE contener '-' o '_', si no, no
    // estaríamos cubriendo el caso que rompía.
    const segment = token.split('.')[1];
    expect(/[-_]/.test(segment)).toBe(true);

    const decoded = decodeJwtPayload(token);
    expect(decoded).not.toBeNull();
    expect(decoded.email).toBe('opob1salva@gmail.com');
    expect(decoded.isImpersonating).toBe(true);
    expect(decoded.oposiciones).toEqual(['ALICANTE_CPBA']);
  });

  it('reconstituye UTF-8 (acentos/ñ) sin mojibake', () => {
    const token = buildJwt({ nombre: 'José María', apellidos: 'Núñez Peña' });
    const decoded = decodeJwtPayload(token);
    expect(decoded.nombre).toBe('José María');
    expect(decoded.apellidos).toBe('Núñez Peña');
  });
});
