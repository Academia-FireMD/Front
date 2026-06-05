/**
 * Decodificación del payload de un JWT en el cliente.
 *
 * Motivo (incidente prod 2026-06-05, usuario id 249 Salvador Carreres): el
 * código hacía `JSON.parse(atob(token.split('.')[1]))` en varios sitios
 * (auth.service.decodeToken y role.guard). Pero un JWT va en **base64url**
 * (RFC 7515): usa `-` y `_` en lugar de `+` y `/`, y omite el padding `=`.
 * `atob()` solo entiende base64 estándar y lanza
 * `InvalidCharacterError: The string to be decoded is not correctly encoded`
 * en cuanto el payload contiene `-` o `_`.
 *
 * Con payloads ASCII cortos eso casi nunca pasa (por eso funcionaba para la
 * mayoría), pero campos como `avatarUrl` (URL larga de gravatar con hash hex)
 * o nombres con acentos hacen que la representación base64url contenga `-`/`_`,
 * petando el decode → el usuario no podía entrar y la impersonación fallaba.
 *
 * Este helper normaliza base64url → base64, repone el padding y reconstituye
 * UTF-8 (atob devuelve Latin1, lo que además rompía acentos en silencio).
 * Devuelve `null` ante cualquier token inválido en vez de lanzar, para que los
 * llamantes decidan el flujo (redirigir a login, etc.).
 */
export function decodeJwtPayload<T = any>(
  token: string | null | undefined,
): T | null {
  if (!token) {
    return null;
  }

  const segment = token.split('.')[1];
  if (!segment) {
    return null;
  }

  try {
    const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      '=',
    );
    const binary = atob(padded);
    // atob devuelve un binary string (Latin1); reconstituir UTF-8 mapeando
    // cada byte a %XX y dejando que decodeURIComponent reensamble los
    // multibyte (acentos/ñ). Sin esto, un nombre acentuado salía con mojibake.
    const json = decodeURIComponent(
      Array.prototype.map
        .call(
          binary,
          (c: string) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2),
        )
        .join(''),
    );
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}
