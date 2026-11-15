import { clavePendientesAlumno } from '../utils/gestion-pendiente.util';
import { CommonModule } from '@angular/common';
import {
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MenuItem } from 'primeng/api';
import { firstValueFrom } from 'rxjs';
import { AlumnoAdminService } from '../../services/alumno-admin.service';
import { PrimengModule } from '../primeng.module';
import {
  CatalogoExterno,
  CreditoAdministrable,
  CursoAdministrable,
  etiquetaAviso,
  InventarioExterno,
  InvitacionAdministrable,
  ItemCatalogoExterno,
  mensajeErrorManual,
  ReservaAdministrable,
  ResultadoManual,
  SimulacroAdministrable,
} from '../models/alumno-externo.model';
import {
  fechaLocalMadrid,
  isoDesdeMadrid,
  mostrarFechaMadrid,
} from '../utils/fecha-madrid.util';

type TipoDialogo =
  | 'PlanPendiente'
  | 'CursoAlta'
  | 'CursoEditar'
  | 'CursoRetirar'
  | 'SimAlta'
  | 'SimEditar'
  | 'SimRetirar'
  | 'CreditoAlta'
  | 'CreditoEditar'
  | 'CreditoRetirar'
  | 'Invitar'
  | 'RetirarInvitacion'
  | 'Reservar'
  | 'EstadoReserva'
  | 'Reprogramar'
  | 'Habilitar'
  | 'Enlace'
  | 'ReintentarAviso';
type Recurso =
  | CursoAdministrable
  | SimulacroAdministrable
  | CreditoAdministrable
  | InvitacionAdministrable
  | ReservaAdministrable;
interface DialogoGestion {
  tipo: TipoDialogo;
  titulo: string;
  clave: string;
  recurso?: Recurso;
  solicitud?: {
    ruta: string;
    metodo: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body: object;
  };
}

@Component({
  selector: 'app-gestion-externa',
  standalone: true,
  imports: [CommonModule, FormsModule, PrimengModule],
  templateUrl: './gestion-externa.component.html',
  styleUrls: ['./alumno-cards.scss', './gestion-externa.component.scss'],
})
export class GestionExternaComponent implements OnChanges {
  @Input({ required: true }) alumnoId = 0;
  @Input() vista: 'productos' | 'tutorias' = 'productos';
  @Input() revision = 0;
  @Output() actualizado = new EventEmitter<string>();
  @Output() ocupadoCambio = new EventEmitter<boolean>();
  private readonly api = inject(AlumnoAdminService);
  private readonly destroy = inject(DestroyRef);
  private destruido = false;
  private generacion = 0;
  inventario: InventarioExterno | null = null;
  cargando = false;
  error = '';
  ocupado = false;
  errorDialogo = '';
  incierta = false;
  dialogo: DialogoGestion | null = null;
  catalogo: CatalogoExterno | null = null;
  cargandoCatalogo = false;
  busqueda = '';
  seleccion: ItemCatalogoExterno | null = null;
  expiraEn = '';
  validoDesde = '';
  validoHasta = '';
  notas = '';
  estado = 'CONFIRMADA';
  motivo = '';
  financiacion = '';
  notificar = false;
  notificarTutor = false;
  confirmarDuplicado = false;
  resultado: ResultadoManual | null = null;
  enlaceVisible = '';
  pendientes: string[] = [];
  solicitudesPendientes: Record<
    string,
    {
      tipo: TipoDialogo;
      titulo: string;
      solicitud: NonNullable<DialogoGestion['solicitud']>;
    }
  > = {};
  readonly aviso = etiquetaAviso;
  readonly fechaMadrid = mostrarFechaMadrid;
  readonly estados = ['CONFIRMADA', 'CANCELADA', 'COMPLETADA', 'AUSENTE'];
  constructor() {
    this.destroy.onDestroy(() => {
      this.destruido = true;
    });
  }
  ngOnChanges() {
    this.generacion++;
    this.inventario = null;
    this.dialogo = null;
    this.resultado = null;
    this.enlaceVisible = '';
    try {
      this.pendientes = JSON.parse(
        sessionStorage.getItem(this.storageKey) || '[]',
      );
      this.solicitudesPendientes = JSON.parse(
        sessionStorage.getItem(this.storageKey + '-solicitudes') || '{}',
      );
    } catch {
      this.pendientes = [];
      this.solicitudesPendientes = {};
      this.error = 'No se han podido recuperar las intenciones pendientes.';
    }
    void this.cargar();
  }
  private get storageKey() {
    return clavePendientesAlumno(this.alumnoId);
  }
  private guardarPendiente(key: string, retirar = false) {
    this.pendientes = retirar
      ? this.pendientes.filter((p) => p !== key)
      : [...new Set([...this.pendientes, key])];
    if (this.pendientes.length)
      sessionStorage.setItem(this.storageKey, JSON.stringify(this.pendientes));
    else sessionStorage.removeItem(this.storageKey);
    if (retirar) delete this.solicitudesPendientes[key];
    if (Object.keys(this.solicitudesPendientes).length)
      sessionStorage.setItem(
        this.storageKey + '-solicitudes',
        JSON.stringify(this.solicitudesPendientes),
      );
    else sessionStorage.removeItem(this.storageKey + '-solicitudes');
  }
  async cargar() {
    const generacion = this.generacion;
    this.cargando = true;
    this.error = '';
    try {
      const data = await firstValueFrom(this.api.inventario(this.alumnoId));
      if (!this.destruido && generacion === this.generacion)
        this.inventario = data;
    } catch (e) {
      if (generacion === this.generacion) this.error = mensajeErrorManual(e);
    } finally {
      if (generacion === this.generacion) this.cargando = false;
    }
  }
  etiqueta(origen: string) {
    return (
      (
        {
          MANUAL_ADMIN: 'Manual',
          WOOCOMMERCE: 'WooCommerce',
          COMPRA: 'Comprado',
          SUSCRIPCION: 'Suscripción',
          LEGADO_PROTEGIDO: 'Histórico protegido',
          DERIVADO: 'Derivado',
          INVITACION: 'Invitación',
          ACTIVADO: 'Disponible',
          USADO: 'Usado',
          EXPIRADO: 'Caducado',
          REVOCADO: 'Revocado',
          DISPONIBLE: 'Disponible',
          RESERVADO: 'Reservado',
          CONSUMIDO: 'Consumido',
          PENDIENTE: 'Pendiente',
          CONFIRMADA: 'Confirmada',
          CANCELADA: 'Cancelada',
          COMPLETADA: 'Completada',
          AUSENTE: 'Ausente',
        } as Record<string, string>
      )[origen] || origen
    );
  }
  get disponibles() {
    return (
      this.inventario?.tutorias.creditos.filter((c) => c.disponible).length || 0
    );
  }
  get financiaciones() {
    return [
      ...(this.inventario?.tutorias.creditos
        .filter((c) => c.disponible)
        .map((c) => ({
          value: `CREDITO:${c.id}`,
          label: `Crédito #${c.id} · ${this.etiqueta(c.origen)}`,
        })) || []),
      ...(this.inventario?.tutorias.compras
        .filter((c) => c.estado === 'PENDIENTE' && !c.reservaId)
        .map((c) => ({
          value: `COMPRA:${c.id}`,
          label: `Compra pagada #${c.id}`,
        })) || []),
    ];
  }
  get usaCatalogo() {
    return (
      !!this.dialogo &&
      ['CursoAlta', 'SimAlta', 'Invitar', 'Reservar', 'Reprogramar'].includes(
        this.dialogo.tipo,
      )
    );
  }
  get editaVigencia() {
    return (
      !!this.dialogo &&
      ['CursoAlta', 'CursoEditar', 'SimAlta', 'SimEditar'].includes(
        this.dialogo.tipo,
      )
    );
  }
  get editaCredito() {
    return (
      !!this.dialogo &&
      ['CreditoAlta', 'CreditoEditar'].includes(this.dialogo.tipo)
    );
  }
  get esReserva() {
    return (
      !!this.dialogo &&
      ['Reservar', 'EstadoReserva', 'Reprogramar'].includes(this.dialogo.tipo)
    );
  }
  get opcionesCatalogo() {
    return this.seleccion &&
      !this.catalogo?.items.some((i) => i.id === this.seleccion!.id)
      ? [this.seleccion, ...(this.catalogo?.items || [])]
      : this.catalogo?.items || [];
  }
  mismoItem(a: ItemCatalogoExterno | null, b: ItemCatalogoExterno | null) {
    return a?.id === b?.id;
  }
  incompatible(item: ItemCatalogoExterno) {
    return (
      !item.asignable ||
      (this.dialogo?.tipo === 'Reprogramar' &&
        item.tipo !==
          (this.dialogo.recurso as ReservaAdministrable).horarioDisponible.tipo)
    );
  }
  seleccionCambiada() {
    if (this.seleccion?.tipo === 'GENERAL') this.financiacion = '';
  }
  get puedeGuardar() {
    if (this.incierta && this.dialogo?.solicitud) return !this.ocupado;
    return (
      !this.ocupado &&
      !this.cargandoCatalogo &&
      !!this.dialogo &&
      (!this.usaCatalogo ||
        (!!this.seleccion && !this.incompatible(this.seleccion))) &&
      (this.dialogo.tipo !== 'Reservar' ||
        this.seleccion?.tipo !== 'TUTORIA_MADRID' ||
        !!this.financiacion) &&
      (this.dialogo.tipo !== 'ReintentarAviso' ||
        this.resultado?.avisoEstado !== 'INCIERTO' ||
        this.confirmarDuplicado)
    );
  }
  abrir(tipo: TipoDialogo, recurso?: Recurso) {
    if (this.ocupado) return;
    const titulos: Record<TipoDialogo, string> = {
      PlanPendiente: 'Gestión del plan externo',
      CursoAlta: 'Añadir curso',
      CursoEditar: 'Editar vigencia manual del curso',
      CursoRetirar: 'Retirar concesión manual del curso',
      SimAlta: 'Añadir un uso de simulacro',
      SimEditar: 'Editar vigencia del uso',
      SimRetirar: 'Revocar uso manual de simulacro',
      CreditoAlta: 'Añadir una sesión de tutoría',
      CreditoEditar: 'Editar vigencia del crédito',
      CreditoRetirar: 'Revocar crédito manual',
      Invitar: 'Invitar a sesión de tutoría',
      RetirarInvitacion: 'Retirar invitación',
      Reservar: 'Crear reserva',
      EstadoReserva: 'Cambiar estado de reserva',
      Reprogramar: 'Reprogramar reserva',
      Habilitar: 'Habilitar acceso local',
      Enlace: 'Generar enlace de acceso',
      ReintentarAviso: 'Reintentar solo el aviso',
    };
    this.dialogo = {
      tipo,
      titulo: titulos[tipo],
      clave: crypto.randomUUID(),
      recurso,
    };
    this.errorDialogo = '';
    this.incierta = false;
    this.catalogo = null;
    this.seleccion = null;
    this.busqueda = '';
    this.notificar = false;
    this.notificarTutor = false;
    this.confirmarDuplicado = false;
    this.financiacion = '';
    this.notas = '';
    this.motivo = '';
    this.estado = 'CONFIRMADA';
    this.expiraEn = this.fechaLocal(
      tipo === 'CursoEditar'
        ? (recurso as CursoAdministrable).manualExpiraEn
        : tipo === 'SimEditar'
          ? (recurso as SimulacroAdministrable).expiraEn
          : null,
    );
    this.validoDesde =
      tipo === 'CreditoEditar'
        ? this.fechaLocal((recurso as CreditoAdministrable).validoDesde)
        : '';
    this.validoHasta =
      tipo === 'CreditoEditar'
        ? this.fechaLocal((recurso as CreditoAdministrable).validoHasta)
        : '';
    if (this.usaCatalogo) void this.cargarCatalogo();
  }
  cerrar() {
    if (!this.ocupado) {
      this.dialogo = null;
      this.errorDialogo = '';
    }
  }
  private fechaLocal(iso: string | null | undefined) {
    return fechaLocalMadrid(iso);
  }
  private iso(value: string) {
    return isoDesdeMadrid(value);
  }
  private isoEditada(value: string, original: string | null | undefined) {
    return original && fechaLocalMadrid(original) === value
      ? original
      : this.iso(value);
  }
  async cargarCatalogo(skip = 0) {
    const dialogo = this.dialogo;
    if (!dialogo) return;
    const tipo =
      dialogo.tipo === 'CursoAlta'
        ? 'CURSO'
        : dialogo.tipo === 'SimAlta'
          ? 'SIMULACRO'
          : dialogo.tipo === 'Invitar'
            ? 'TUTORIA'
            : 'HORARIO';
    this.cargandoCatalogo = true;
    this.errorDialogo = '';
    try {
      const data = await firstValueFrom(
        this.api.catalogo(this.alumnoId, tipo, this.busqueda, skip),
      );
      if (this.dialogo === dialogo) this.catalogo = data;
    } catch (e) {
      if (this.dialogo === dialogo) this.errorDialogo = mensajeErrorManual(e);
    } finally {
      if (this.dialogo === dialogo) this.cargandoCatalogo = false;
    }
  }
  accionesCurso(c: CursoAdministrable): MenuItem[] {
    return [
      {
        label: 'Editar vigencia manual',
        icon: 'pi pi-pencil',
        disabled: !c.capacidades.editar || this.ocupado,
        command: () => this.abrir('CursoEditar', c),
      },
      {
        label: 'Retirar concesión manual',
        icon: 'pi pi-ban',
        disabled: !c.capacidades.retirar || this.ocupado,
        command: () => this.abrir('CursoRetirar', c),
      },
    ];
  }
  accionesSimulacro(c: SimulacroAdministrable): MenuItem[] {
    return [
      {
        label: 'Editar vigencia',
        icon: 'pi pi-pencil',
        disabled: !c.capacidades.editar || this.ocupado,
        command: () => this.abrir('SimEditar', c),
      },
      {
        label: 'Revocar uso',
        icon: 'pi pi-ban',
        disabled: !c.capacidades.retirar || this.ocupado,
        command: () => this.abrir('SimRetirar', c),
      },
    ];
  }
  accionesCredito(c: CreditoAdministrable): MenuItem[] {
    return [
      {
        label: 'Editar vigencia',
        icon: 'pi pi-pencil',
        disabled: !c.capacidades.editar || this.ocupado,
        command: () => this.abrir('CreditoEditar', c),
      },
      {
        label: 'Revocar crédito',
        icon: 'pi pi-ban',
        disabled: !c.capacidades.retirar || this.ocupado,
        command: () => this.abrir('CreditoRetirar', c),
      },
    ];
  }
  accionesReserva(r: ReservaAdministrable): MenuItem[] {
    return [
      {
        label: 'Cambiar estado',
        icon: 'pi pi-check',
        disabled: !r.capacidades.gestionar || this.ocupado,
        command: () => this.abrir('EstadoReserva', r),
      },
      {
        label: 'Reprogramar',
        icon: 'pi pi-calendar',
        disabled: !r.capacidades.gestionar || this.ocupado,
        command: () => this.abrir('Reprogramar', r),
      },
    ];
  }
  private solicitud(
    d: DialogoGestion,
  ): NonNullable<DialogoGestion['solicitud']> {
    const base = `${this.alumnoId}/`;
    const avisos = {
      notificar: this.notificar,
      ...(this.esReserva ? { notificarTutor: this.notificarTutor } : {}),
    };
    const recurso = d.recurso;
    const version = recurso && 'version' in recurso ? recurso.version : 0;
    switch (d.tipo) {
      case 'PlanPendiente':
        throw new Error('No se ha podido recuperar la solicitud del plan');
      case 'CursoAlta':
        return {
          ruta: base + 'cursos',
          metodo: 'POST',
          body: {
            ...avisos,
            cursoId: this.seleccion!.id,
            expiraEn: this.iso(this.expiraEn),
          },
        };
      case 'CursoEditar':
        return {
          ruta: base + `cursos/${(recurso as CursoAdministrable).cursoId}`,
          metodo: 'PATCH',
          body: {
            ...avisos,
            version,
            expiraEn: this.isoEditada(
              this.expiraEn,
              (recurso as CursoAdministrable).manualExpiraEn,
            ),
          },
        };
      case 'CursoRetirar':
        return {
          ruta: base + `cursos/${(recurso as CursoAdministrable).cursoId}`,
          metodo: 'DELETE',
          body: { ...avisos, version },
        };
      case 'SimAlta':
        return {
          ruta: base + 'simulacros',
          metodo: 'POST',
          body: {
            ...avisos,
            examenId: this.seleccion!.id,
            expiraEn: this.iso(this.expiraEn),
          },
        };
      case 'SimEditar':
        return {
          ruta: base + `simulacros/${recurso!.id}`,
          metodo: 'PATCH',
          body: {
            ...avisos,
            version,
            expiraEn: this.isoEditada(
              this.expiraEn,
              (recurso as SimulacroAdministrable).expiraEn,
            ),
          },
        };
      case 'SimRetirar':
        return {
          ruta: base + `simulacros/${recurso!.id}`,
          metodo: 'DELETE',
          body: { ...avisos, version },
        };
      case 'CreditoAlta':
      case 'CreditoEditar':
        return {
          ruta:
            base +
            'tutorias/creditos' +
            (d.tipo === 'CreditoEditar' ? `/${recurso!.id}` : ''),
          metodo: d.tipo === 'CreditoAlta' ? 'POST' : 'PATCH',
          body: {
            ...avisos,
            ...(d.tipo === 'CreditoEditar' ? { version } : {}),
            ...(this.validoDesde
              ? {
                  validoDesde: this.isoEditada(
                    this.validoDesde,
                    d.tipo === 'CreditoEditar'
                      ? (recurso as CreditoAdministrable).validoDesde
                      : null,
                  ),
                }
              : {}),
            ...(this.validoHasta
              ? {
                  validoHasta: this.isoEditada(
                    this.validoHasta,
                    d.tipo === 'CreditoEditar'
                      ? (recurso as CreditoAdministrable).validoHasta
                      : null,
                  ),
                }
              : {}),
          },
        };
      case 'CreditoRetirar':
        return {
          ruta: base + `tutorias/creditos/${recurso!.id}`,
          metodo: 'DELETE',
          body: { ...avisos, version },
        };
      case 'Invitar':
        return {
          ruta: base + 'tutorias/invitaciones',
          metodo: 'POST',
          body: { ...avisos, tutoriaId: this.seleccion!.id },
        };
      case 'RetirarInvitacion':
        return {
          ruta: base + `tutorias/invitaciones/${recurso!.id}`,
          metodo: 'DELETE',
          body: avisos,
        };
      case 'Reservar': {
        const [tipo, id] = this.financiacion.split(':');
        return {
          ruta: base + 'tutorias/reservas',
          metodo: 'POST',
          body: {
            ...avisos,
            horarioId: this.seleccion!.id,
            notas: this.notas,
            ...(this.seleccion!.tipo === 'TUTORIA_MADRID'
              ? { financiacion: { tipo, id: Number(id) } }
              : {}),
          },
        };
      }
      case 'EstadoReserva':
        return {
          ruta: base + `tutorias/reservas/${recurso!.id}`,
          metodo: 'PATCH',
          body: { ...avisos, estado: this.estado, motivo: this.motivo },
        };
      case 'Reprogramar':
        return {
          ruta: base + `tutorias/reservas/${recurso!.id}/reprogramar`,
          metodo: 'POST',
          body: { ...avisos, horarioId: this.seleccion!.id },
        };
      case 'Habilitar':
        return {
          ruta: base + 'habilitar-acceso',
          metodo: 'POST',
          body: avisos,
        };
      case 'Enlace':
        return { ruta: base + 'enlace-acceso', metodo: 'POST', body: avisos };
      case 'ReintentarAviso':
        return {
          ruta:
            base +
            `operaciones/${this.resultado!.operacionId}/reintentar-aviso`,
          metodo: 'POST',
          body: { confirmarPosibleDuplicado: this.confirmarDuplicado },
        };
    }
  }
  async guardar() {
    const d = this.dialogo;
    if (!d || !this.puedeGuardar) return;
    try {
      d.solicitud ??= this.solicitud(d);
    } catch {
      this.errorDialogo = 'Revisa las fechas del formulario.';
      return;
    }
    this.ocupado = true;
    this.ocupadoCambio.emit(true);
    this.errorDialogo = '';
    this.solicitudesPendientes[d.clave] = {
      tipo: d.tipo,
      titulo: d.titulo,
      solicitud: d.solicitud,
    };
    this.guardarPendiente(d.clave);
    try {
      const respuesta = await firstValueFrom(
        this.api.accionManual(
          d.solicitud.ruta,
          d.solicitud.metodo,
          d.solicitud.body,
          d.clave,
        ),
      );
      const resultado =
        d.tipo === 'ReintentarAviso'
          ? {
              ...respuesta,
              operacionId: (respuesta as any).id,
              mensaje: 'Estado del aviso actualizado.',
            }
          : respuesta;
      this.resultado = resultado;
      this.enlaceVisible = resultado.enlaceAcceso || '';
      this.guardarPendiente(d.clave, true);
      this.dialogo = null;
      this.incierta = false;
      if (
        ['FALLIDO', 'INCIERTO', 'ENVIANDO', 'PENDIENTE'].includes(
          resultado.avisoEstado,
        )
      )
        this.guardarPendiente(resultado.operacionId);
      await this.cargar();
      // La URL inicial permanece sólo en este diálogo; no se emite hacia el padre ni se persiste.
      if (!this.enlaceVisible)
        this.actualizado.emit(resultado.mensaje || 'Gestión actualizada.');
    } catch (e: any) {
      this.errorDialogo = mensajeErrorManual(e);
      this.incierta = !e.status || e.status >= 500;
      if (!this.incierta) {
        this.guardarPendiente(d.clave, true);
        d.solicitud = undefined;
        d.clave = crypto.randomUUID();
      }
    } finally {
      this.ocupado = false;
      this.ocupadoCambio.emit(false);
    }
  }
  reintentarPendiente(key: string) {
    if (this.ocupado) return;
    const pendiente = this.solicitudesPendientes[key];
    if (!pendiente) return;
    this.dialogo = { ...pendiente, clave: key };
    this.incierta = true;
    this.errorDialogo = '';
  }
  async consultar(key: string) {
    if (this.ocupado) return;
    this.ocupado = true;
    this.ocupadoCambio.emit(true);
    this.error = '';
    try {
      const op = await firstValueFrom(this.api.operacion(this.alumnoId, key));
      this.resultado = {
        usuarioId: this.alumnoId,
        operacionId: op.id,
        avisoEstado: op.avisoEstado || 'NO_SOLICITADO',
        mensaje:
          op.resultado?.mensaje ||
          'Operación recuperada. Si necesitas el enlace de acceso, genera uno nuevo.',
      };
      this.guardarPendiente(key, true);
      if (
        op.avisoEstado &&
        ['FALLIDO', 'INCIERTO', 'ENVIANDO', 'PENDIENTE'].includes(
          op.avisoEstado,
        )
      )
        this.guardarPendiente(op.id);
      this.dialogo = null;
      this.incierta = false;
      await this.cargar();
    } catch (e) {
      this.error = mensajeErrorManual(e);
    } finally {
      this.ocupado = false;
      this.ocupadoCambio.emit(false);
    }
  }
}
