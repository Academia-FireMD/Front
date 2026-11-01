import { Injectable } from '@angular/core';

/** Identidad mínima del JWT que define una sesión autenticada. */
export interface AuthIdentity {
  sub: unknown;
  isImpersonating: boolean;
}

/**
 * Fotografía inmutable de la sesión en un instante.
 *
 * El `generation` se incrementa al iniciar sesión (aunque sea el mismo
 * usuario), al cerrar sesión y al entrar o salir de impersonación. Una
 * renovación normal del access token dentro de la misma identidad conserva la
 * misma generación para no invalidar el perfil que ya está en vuelo.
 */
export interface AuthSessionSnapshot {
  readonly generation: number;
  readonly authenticated: boolean;
  readonly sub: unknown;
  readonly isImpersonating: boolean;
}

/**
 * Fuente única y síncrona de la generación de sesión.
 *
 * No depende de AuthService/UserService: es una utilidad pequeña que evita
 * ciclos de DI. Los servicios capturan `snapshot()` antes de lanzar trabajo
 * asíncrono y solo aplican el resultado si `isCurrent(snapshot)` sigue siendo
 * cierto. La comparación es por identidad de objeto, de modo que cada cambio
 * de sesión (incluido logout→logout) crea una instantánea distinta.
 */
@Injectable({ providedIn: 'root' })
export class AuthSessionService {
  private generation = 0;
  private current: AuthSessionSnapshot = this.crearSnapshot(null);

  snapshot(): AuthSessionSnapshot {
    return this.current;
  }

  /** Inicia una sesión nueva; siempre invalida el trabajo de la anterior. */
  start(identity: AuthIdentity): AuthSessionSnapshot {
    this.current = this.crearSnapshot(identity);
    return this.current;
  }

  /**
   * Mantiene la sesión actual si la identidad no cambió (renovación de token).
   * Si cambió, inicia una sesión nueva.
   */
  continueSession(identity: AuthIdentity): AuthSessionSnapshot {
    const normalizada = this.normalizar(identity);
    if (
      this.current.authenticated &&
      this.current.sub === normalizada.sub &&
      this.current.isImpersonating === normalizada.isImpersonating
    ) {
      return this.current;
    }
    return this.start(normalizada);
  }

  /** Cierra la sesión actual; el trabajo anterior deja de ser aplicable. */
  invalidate(): AuthSessionSnapshot {
    this.current = this.crearSnapshot(null);
    return this.current;
  }

  isCurrent(snapshot: AuthSessionSnapshot): boolean {
    return this.current === snapshot;
  }

  private crearSnapshot(identity: AuthIdentity | null): AuthSessionSnapshot {
    const normalizada = identity ? this.normalizar(identity) : null;
    return {
      generation: ++this.generation,
      authenticated: normalizada !== null,
      sub: normalizada?.sub ?? null,
      isImpersonating: normalizada?.isImpersonating ?? false,
    };
  }

  private normalizar(identity: AuthIdentity): AuthIdentity {
    return {
      sub: identity.sub,
      isImpersonating: identity.isImpersonating === true,
    };
  }
}
