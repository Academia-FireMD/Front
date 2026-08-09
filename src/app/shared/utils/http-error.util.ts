import { HttpErrorResponse } from '@angular/common/http';

interface HttpErrorGenerico {
  message?: string;
}

/** Mensaje seguro del contrato HTTP, cuando el backend lo ha proporcionado. */
export function extraerMensajeError(
  err: HttpErrorResponse | undefined,
): string | null {
  const body = err?.error as HttpErrorGenerico | undefined;
  return body?.message ?? null;
}
