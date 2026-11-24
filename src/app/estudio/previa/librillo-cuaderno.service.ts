import { HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, firstValueFrom, timeout } from 'rxjs';
import {
  EdicionPdf,
  LibrilloPdfApiService,
  PaginaPdf,
  PartePdf,
  ReferenciaPdf,
} from './librillo-pdf-api.service';

interface BorradorPdf {
  pagina: number;
  base: number;
  valor: PaginaPdf;
}

type EstadoCuaderno =
  | 'local'
  | 'cargando'
  | 'guardado'
  | 'pendiente'
  | 'conflicto'
  | 'reiniciado';

@Injectable()
export class LibrilloCuadernoService {
  private readonly api = inject(LibrilloPdfApiService);
  private readonly destruir = inject(DestroyRef);
  private edicion?: EdicionPdf;
  private clave?: string;
  private generacion = 0;
  private temporizador?: ReturnType<typeof setTimeout>;
  private sincronizacion?: Promise<void>;
  private listo = false;
  private readonly versiones = new Map<number, number>();
  private readonly borradores = new Map<number, BorradorPdf>();
  readonly paginas = signal<Record<number, PaginaPdf>>({});
  readonly conflictos = signal<Record<number, PartePdf>>({});
  readonly referencias = signal<ReferenciaPdf[]>([]);
  readonly estado = signal<EstadoCuaderno>('local');
  readonly aviso = signal('');

  constructor() {
    this.destruir.onDestroy(() => this.cerrar());
  }

  async abrir(edicion: EdicionPdf, clave: string, descartarBorradores = false) {
    this.cerrar();
    this.edicion = edicion;
    this.clave = clave;
    this.estado.set('cargando');
    const guardado = descartarBorradores ? undefined : this.recuperar();
    this.generacion = guardado?.generacion ?? 0;
    for (const parte of guardado?.partes ?? []) {
      this.borradores.set(parte.pagina, parte);
      this.mostrar(parte.pagina, parte.valor);
    }
    try {
      const resultado = await this.pedir(this.api.abrir(edicion));
      if (this.edicion !== edicion) return false;
      this.referencias.set(resultado.referencias);
      this.paginas.set(
        Object.fromEntries(
          resultado.partes.map(({ pagina, valor }) => [pagina, valor]),
        ),
      );
      for (const { pagina, version } of resultado.partes)
        this.versiones.set(pagina, version);
      if (
        this.borradores.size &&
        guardado?.generacion !== resultado.generacion
      ) {
        this.estado.set('reiniciado');
        return true;
      }
      this.generacion = resultado.generacion;
      this.listo = true;
      for (const { pagina, valor } of this.borradores.values())
        this.mostrar(pagina, valor);
      if (descartarBorradores) this.persistirBorradores();
      this.estado.set(this.borradores.size ? 'pendiente' : 'guardado');
      if (this.borradores.size) void this.guardarAhora();
      return true;
    } catch (error) {
      if (this.edicion === edicion) this.mostrarError(error);
      return false;
    }
  }

  editar(pagina: number, valor: PaginaPdf) {
    if (!this.edicion || this.estado() === 'reiniciado') return;
    this.mostrar(pagina, valor);
    this.borradores.set(pagina, {
      pagina,
      base:
        this.borradores.get(pagina)?.base ?? this.versiones.get(pagina) ?? 0,
      valor,
    });
    this.persistirBorradores();
    this.estado.set(
      Object.keys(this.conflictos()).length ? 'conflicto' : 'pendiente',
    );
    clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => void this.guardarAhora(), 550);
  }

  async guardarAhora() {
    if (this.sincronizacion) return this.sincronizacion;
    if (!this.edicion || !this.listo || this.estado() === 'reiniciado') return;
    const edicion = this.edicion;
    const promesa = this.enviarBorradores(edicion);
    this.sincronizacion = promesa;
    try {
      await promesa;
    } finally {
      if (this.sincronizacion === promesa) this.sincronizacion = undefined;
    }
  }

  async reintentar() {
    if (!this.edicion || !this.clave) return;
    if (this.listo) return this.guardarAhora();
    await this.abrir(
      { ...this.edicion },
      this.clave,
      this.estado() === 'reiniciado',
    );
  }

  resolver(pagina: number, usarPerfil: boolean) {
    const conflicto = this.conflictos()[pagina];
    const borrador = this.borradores.get(pagina);
    if (!conflicto || !borrador) return;
    this.versiones.set(pagina, conflicto.version);
    this.conflictos.update((actuales) => {
      const restantes = { ...actuales };
      delete restantes[pagina];
      return restantes;
    });
    if (usarPerfil) {
      this.borradores.delete(pagina);
      this.mostrar(pagina, conflicto.valor);
      this.persistirBorradores();
      this.estado.set(
        Object.keys(this.conflictos()).length
          ? 'conflicto'
          : this.borradores.size
            ? 'pendiente'
            : 'guardado',
      );
    } else {
      this.borradores.set(pagina, { ...borrador, base: conflicto.version });
      this.persistirBorradores();
      void this.guardarAhora();
    }
  }

  async importar(
    lote: string,
    partes: Array<{ pagina: number; valor: PaginaPdf }>,
  ) {
    const edicion = this.edicion;
    if (!edicion || !this.listo) return false;
    await this.guardarAhora();
    if (this.edicion !== edicion || this.borradores.size) return false;
    try {
      const importadas = await this.pedir(
        this.api.importar(edicion, this.generacion, lote, partes),
      );
      if (this.edicion !== edicion) return false;
      for (const parte of importadas.partes) {
        this.versiones.set(parte.pagina, parte.version);
        if (parte.conflicto) {
          const local = partes.find(({ pagina }) => pagina === parte.pagina);
          if (local) {
            this.borradores.set(parte.pagina, {
              ...local,
              base: parte.version,
            });
            this.conflictos.update((previos) => ({
              ...previos,
              [parte.pagina]: parte,
            }));
            this.mostrar(parte.pagina, local.valor);
          }
        } else {
          this.mostrar(parte.pagina, parte.valor);
        }
      }
      this.persistirBorradores();
      this.estado.set(
        Object.keys(this.conflictos()).length ? 'conflicto' : 'guardado',
      );
      return true;
    } catch (error) {
      if (this.edicion === edicion) this.mostrarError(error);
      return false;
    }
  }

  async reiniciar() {
    const edicion = this.edicion;
    if (!edicion || !this.listo) return;
    await this.sincronizacion;
    try {
      const { generacion } = await this.pedir(
        this.api.reiniciar(edicion, this.generacion),
      );
      if (this.edicion !== edicion) return;
      this.generacion = generacion;
      this.versiones.clear();
      this.borradores.clear();
      this.conflictos.set({});
      this.paginas.set({});
      this.persistirBorradores();
      this.estado.set('guardado');
    } catch (error) {
      if (this.edicion === edicion) this.mostrarError(error);
    }
  }

  cerrar() {
    this.edicion = undefined;
    this.clave = undefined;
    this.listo = false;
    this.sincronizacion = undefined;
    clearTimeout(this.temporizador);
    this.versiones.clear();
    this.borradores.clear();
    this.paginas.set({});
    this.referencias.set([]);
    this.conflictos.set({});
    this.aviso.set('');
  }

  private async enviarBorradores(edicion: EdicionPdf) {
    try {
      while (this.edicion === edicion) {
        const partes = [...this.borradores.values()]
          .filter(({ pagina }) => !this.conflictos()[pagina])
          .slice(0, 5);
        if (!partes.length) break;
        const guardado = await this.pedir(
          this.api.guardar(edicion, this.generacion, partes),
        );
        if (this.edicion !== edicion) return;
        for (const parte of guardado.partes) {
          const { pagina, version } = parte;
          if (parte.conflicto) {
            this.conflictos.update((actuales) => ({
              ...actuales,
              [pagina]: parte,
            }));
            continue;
          }
          this.versiones.set(pagina, version);
          const pendiente = this.borradores.get(pagina);
          if (
            pendiente === partes.find((enviada) => enviada.pagina === pagina)
          ) {
            this.borradores.delete(pagina);
          } else if (pendiente) {
            this.borradores.set(pagina, { ...pendiente, base: version });
          }
        }
        this.persistirBorradores();
      }
      this.aviso.set('');
      this.estado.set(
        Object.keys(this.conflictos()).length ? 'conflicto' : 'guardado',
      );
    } catch (error) {
      if (this.edicion === edicion) this.mostrarError(error);
    }
  }

  private mostrar(pagina: number, valor: PaginaPdf) {
    this.paginas.update((actuales) => ({ ...actuales, [pagina]: valor }));
  }

  private recuperar():
    | { generacion: number; partes: BorradorPdf[] }
    | undefined {
    try {
      const datos = JSON.parse(localStorage.getItem(this.clave!) ?? 'null');
      return datos &&
        Number.isInteger(datos.generacion) &&
        Array.isArray(datos.partes)
        ? datos
        : undefined;
    } catch {
      return undefined;
    }
  }

  private persistirBorradores() {
    if (!this.clave) return;
    try {
      if (this.borradores.size) {
        localStorage.setItem(
          this.clave,
          JSON.stringify({
            generacion: this.generacion,
            partes: [...this.borradores.values()],
          }),
        );
      } else {
        localStorage.removeItem(this.clave);
      }
    } catch {
      this.aviso.set(
        'El navegador no pudo guardar una copia de los cambios pendientes.',
      );
    }
  }

  private mostrarError(error: unknown) {
    const reiniciado =
      error instanceof HttpErrorResponse &&
      error.status === 409 &&
      Number.isInteger(error.error?.generacion);
    this.listo = this.listo && !reiniciado;
    this.estado.set(reiniciado ? 'reiniciado' : 'pendiente');
    if (!reiniciado)
      this.aviso.set('No se ha completado el guardado en tu perfil.');
  }

  private pedir<T>(peticion: Observable<T>) {
    return firstValueFrom(
      peticion.pipe(timeout(15000), takeUntilDestroyed(this.destruir)),
    );
  }
}
