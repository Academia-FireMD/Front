import {
  HttpClient,
  HttpErrorResponse,
  HttpParams,
} from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { DialogService } from 'primeng/dynamicdialog';
import {
  EMPTY,
  Observable,
  catchError,
  defer,
  ignoreElements,
  map,
  mergeMap,
  of,
  switchMap,
  take,
  tap,
  throwError,
} from 'rxjs';
import { environment } from '../../environments/environment';
import { CompraDatosFiscalesDialogComponent } from './compra-datos-fiscales-dialog.component';
import {
  CAMPOS_FISCALES_COMPRA_VALIDOS,
  COMPRA_DATOS_FISCALES_ENDPOINT,
  DatosFiscalesCompra,
  EstadoDatosFiscalesCompra,
  RequisitoDatosFiscalesCompra,
} from './datos-fiscales-compra.model';

@Injectable({ providedIn: 'root' })
export class CompraFiscalService {
  private readonly url = `${environment.apiUrl}${COMPRA_DATOS_FISCALES_ENDPOINT}`;

  constructor(
    private readonly http: HttpClient,
    private readonly dialogService: DialogService,
    private readonly toast: ToastrService,
  ) {}

  ejecutarConDatosFiscales<T>(
    compra: () => Observable<T>,
    suscripcionId?: number,
    opciones: { omitirLecturaInicial?: boolean } = {},
  ): Observable<T> {
    return defer(() => {
      if (opciones.omitirLecturaInicial) {
        return this.ejecutarCompra(compra, suscripcionId);
      }
      return this.obtenerDatosFiscales(suscripcionId).pipe(
        switchMap((estado) => {
          if (estado.completo || estado.requiereCheckout === true)
            return this.ejecutarCompra(compra, suscripcionId);
          return this.abrirCorreccion(estado, suscripcionId);
        }),
      );
    });
  }

  obtenerDatosFiscales(
    suscripcionId?: number,
  ): Observable<EstadoDatosFiscalesCompra> {
    let params = new HttpParams();
    if (suscripcionId != null) {
      params = params.set('suscripcionId', String(suscripcionId));
    }
    return this.http
      .get<EstadoDatosFiscalesCompra>(this.url, {
        params,
        withCredentials: true,
      })
      .pipe(
        map((estado) => {
          if (!this.estadoValido(estado)) {
            throw new Error('El servidor devolvió una ficha fiscal no válida.');
          }
          if (
            !estado.completo &&
            !estado.fiscalSyncPending &&
            !this.camposPendientes(estado).length
          ) {
            throw new Error(
              'No se pudieron identificar los datos fiscales que requieren corrección.',
            );
          }
          return estado;
        }),
      );
  }

  guardarDatosFiscales(
    datos: Partial<DatosFiscalesCompra>,
    version: string,
    suscripcionId?: number,
  ): Observable<EstadoDatosFiscalesCompra> {
    return this.http.put<EstadoDatosFiscalesCompra>(
      this.url,
      {
        datos,
        version,
        ...(suscripcionId != null ? { suscripcionId } : {}),
      },
      { withCredentials: true },
    );
  }

  private ejecutarCompra<T>(
    compra: () => Observable<T>,
    suscripcionId?: number,
  ): Observable<T> {
    return defer(compra).pipe(
      mergeMap((respuesta) =>
        this.esRequisitoFiscal(respuesta)
          ? this.recargarYCorregir(suscripcionId)
          : of(respuesta),
      ),
      // Se conserva HttpErrorResponse.error; ApiBaseService lo convertiría a
      // Error y perderíamos el contrato estructurado HTTP 400.
      catchError((error: unknown) =>
        this.esRequisitoFiscal(error)
          ? this.recargarYCorregir(suscripcionId)
          : throwError(() => error),
      ),
    );
  }

  private recargarYCorregir(suscripcionId?: number): Observable<never> {
    return this.obtenerDatosFiscales(suscripcionId).pipe(
      switchMap((estado) => {
        if (estado.completo) {
          this.toast.info(
            'No se inició el pago. Comprueba tus datos y vuelve a confirmar la compra.',
          );
          return EMPTY;
        }
        return this.abrirCorreccion(estado, suscripcionId);
      }),
    );
  }

  private abrirCorreccion(
    estado: EstadoDatosFiscalesCompra,
    suscripcionId?: number,
  ): Observable<never> {
    const dialog = this.dialogService.open(CompraDatosFiscalesDialogComponent, {
      header: 'Completa tus datos fiscales',
      width: 'min(96vw, 680px)',
      modal: true,
      closable: true,
      dismissableMask: false,
      data: {
        estado,
        suscripcionId,
        guardar: (datos: Partial<DatosFiscalesCompra>) =>
          this.guardarDatosFiscales(datos, estado.version, suscripcionId),
        comprobar: () => this.obtenerDatosFiscales(suscripcionId),
      },
    });

    return dialog.onClose.pipe(
      take(1),
      tap((resultado: { guardado?: boolean } | null) => {
        if (resultado?.guardado) {
          this.toast.info(
            'Datos fiscales guardados. Vuelve a confirmar la compra para completar el pago.',
          );
        }
      }),
      ignoreElements(),
    );
  }

  private camposPendientes(estado: EstadoDatosFiscalesCompra): string[] {
    return [
      ...new Set([
        ...estado.faltantes,
        ...estado.invalidos,
        ...estado.conflictos,
      ]),
    ].filter((campo) => CAMPOS_FISCALES_COMPRA_VALIDOS.has(campo));
  }

  private estadoValido(
    estado: EstadoDatosFiscalesCompra | null | undefined,
  ): estado is EstadoDatosFiscalesCompra {
    return Boolean(
      estado &&
      typeof estado === 'object' &&
      estado.datos &&
      typeof estado.datos === 'object' &&
      [
        'nombre',
        'apellidos',
        'empresa',
        'direccion',
        'direccion2',
        'poblacion',
        'provincia',
        'codigoPostal',
        'pais',
        'nif',
      ].every((campo) => campo in estado.datos) &&
      Object.values(estado.datos).every((valor) => typeof valor === 'string') &&
      Array.isArray(estado.faltantes) &&
      Array.isArray(estado.invalidos) &&
      Array.isArray(estado.conflictos) &&
      typeof estado.completo === 'boolean' &&
      (estado.fiscalSyncPending === undefined ||
        typeof estado.fiscalSyncPending === 'boolean') &&
      (estado.requiereCheckout === undefined ||
        typeof estado.requiereCheckout === 'boolean') &&
      typeof estado.version === 'string',
    );
  }

  private esRequisitoFiscal(
    valor: unknown,
  ): valor is RequisitoDatosFiscalesCompra {
    const body =
      valor instanceof HttpErrorResponse
        ? valor.error
        : ((valor as { error?: unknown } | null)?.error ?? valor);
    const requisito = body as Partial<RequisitoDatosFiscalesCompra> | null;
    return Boolean(
      requisito &&
      requisito.success === false &&
      requisito.requiereDatosFiscales === true &&
      (requisito.codigo === 'DATOS_FISCALES_INCOMPLETOS' ||
        requisito.codigo === 'DATOS_FISCALES_CONFLICTIVOS'),
    );
  }
}
