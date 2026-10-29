import { CommonModule, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectorRef,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { firstValueFrom, tap } from 'rxjs';
import {
  FilterConfig,
  GenericListComponent,
} from '../../../shared/generic-list/generic-list.component';
import { PrimengModule } from '../../../shared/primeng.module';
import { SharedModule } from '../../../shared/shared.module';
import { UserDashboardComponent } from '../../../test/components/user-dashboard/user-dashboard.component';
import {
  CambioFiscal,
  CrearFacturaManualDto,
  EstadoSincronizacionCliente,
  EstadoSincronizacionFactura,
  EstadoTrabajoFiscal,
  Factura,
  FacturaEstado,
  FacturaTipo,
  OrigenDatoFiscal,
  SincronizacionFiscalPreview,
  SincronizacionFiscalTotales,
} from '../../models/factura.model';
import { FacturacionService } from '../../servicios/facturacion.service';
import { UserService } from '../../../services/user.service';
import { ConfigService } from '../../../services/config.service';
import { Usuario } from '../../../shared/models/user.model';
import { CompletarFiscalDto } from '../../models/factura.model';
import { looksLikeSpanishNif } from '../../utils/nif.util';

type AccionSincronizacionFiscal = 'fichas' | 'recuperar';

interface ResultadoSincronizacionFiscal {
  tono: 'info' | 'warning';
  mensaje: string;
}

const ETIQUETAS_CAMPO_FISCAL: Record<string, string> = {
  nif: 'NIF',
  dni: 'NIF',
  clienteNif: 'NIF',
  nombre: 'Nombre',
  clienteNombre: 'Nombre',
  apellidos: 'Apellidos',
  empresa: 'Empresa o razón social',
  direccion: 'Dirección',
  clienteDireccion: 'Dirección',
  direccion2: 'Dirección (línea 2)',
  poblacion: 'Población',
  clientePoblacion: 'Población',
  provincia: 'Provincia',
  clienteProvincia: 'Provincia',
  codigoPostal: 'Código postal',
  clienteCodigoPostal: 'Código postal',
  pais: 'País',
  clientePais: 'País',
  email: 'Email',
  clienteEmail: 'Email',
  telefono: 'Teléfono',
};

const ETIQUETAS_ESTADO_CLIENTE: Record<EstadoSincronizacionCliente, string> = {
  SIN_CAMBIOS: 'Sin cambios',
  SINCRONIZABLE: 'Se puede completar',
  REVISION: 'Requiere revisión',
  NO_DISPONIBLE: 'No disponible',
};

const ETIQUETAS_ESTADO_FACTURA_SYNC: Record<
  EstadoSincronizacionFactura,
  string
> = {
  ELEGIBLE: 'Elegible',
  YA_EMITIDA: 'Ya emitida',
  REVISION: 'Requiere revisión manual',
  FUERA_PERIODO: 'Fuera del período automático',
  NO_FACTURABLE: 'No facturable',
  ESPERA_PROVEEDOR: 'En espera del proveedor',
};

const ETIQUETAS_ESTADO_TRABAJO_FISCAL: Record<EstadoTrabajoFiscal, string> = {
  PENDIENTE: 'Pendiente de sincronización',
  PROCESANDO: 'Sincronizando',
  REINTENTO: 'Reintentando',
  REVISION: 'Requiere revisión',
  COMPLETADO: 'Sincronización completada',
};

const ETIQUETAS_ORIGEN_FISCAL: Record<OrigenDatoFiscal, string> = {
  PLATAFORMA: 'Plataforma',
  WOOCOMMERCE: 'WooCommerce',
  CONTASIMPLE: 'ContaSimple',
};

@Component({
  selector: 'app-facturacion-admin',
  templateUrl: './facturacion-admin.component.html',
  styleUrl: './facturacion-admin.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    DatePipe,
    GenericListComponent,
    PrimengModule,
    SharedModule,
    UserDashboardComponent,
  ],
})
export class FacturacionAdminComponent extends GenericListComponent<Factura> {
  private facturacionService = inject(FacturacionService);
  private userService = inject(UserService);
  private configService = inject(ConfigService);
  override toast = inject(ToastrService);

  readonly hardDeleteFacturasEnabled =
    this.configService.hardDeleteFacturasEnabled;

  override filters: FilterConfig[] = [
    {
      key: 'dateRange',
      specialCaseKey: 'rangeDate',
      label: 'Rango de fechas',
      type: 'calendar',
      placeholder: 'Seleccionar rango de fechas',
      dateConfig: { selectionMode: 'range' },
      filterInterpolation: (value: Date[] | null) => {
        if (!value || !Array.isArray(value) || !value[0] || !value[1])
          return {};
        return { dateRange: value };
      },
    },
    {
      key: 'tipo',
      label: 'Tipo',
      type: 'dropdown',
      placeholder: 'Todos los tipos',
      options: [
        { label: 'Todos', value: '' },
        { label: 'Normal', value: 'NORMAL' },
        { label: 'Rectificativa', value: 'RECTIFICATIVA' },
      ],
      filterInterpolation: (v: string) => (v ? { tipo: v } : {}),
    },
    {
      key: 'estado',
      label: 'Estado',
      type: 'dropdown',
      placeholder: 'Todos los estados',
      options: [
        { label: 'Todos', value: '' },
        { label: 'Pendiente', value: 'PENDIENTE' },
        { label: 'Emitida', value: 'EMITIDA' },
        { label: 'Anulada', value: 'ANULADA' },
        { label: 'Eliminada (local)', value: 'ELIMINADA_LOCAL' },
        { label: 'Omitida (prueba)', value: 'OMITIDA_PRUEBA' },
        { label: 'Error', value: 'ERROR' },
      ],
      filterInterpolation: (v: string) => (v ? { estado: v } : {}),
    },
  ];

  mostrarDialogManual = signal(false);
  guardandoManual = signal(false);
  formManual: CrearFacturaManualDto = this.emptyForm();
  pasoDialogManual = signal<'seleccionar' | 'datos'>('seleccionar');
  selectedUserIds: number[] = [];

  mostrarDialogRectificativa = signal(false);
  guardandoRectificativa = signal(false);
  facturaSeleccionada = signal<Factura | null>(null);
  motivoRectificativa = '';

  descargandoPdf = signal<number | null>(null);

  mostrarDialogEliminar = signal(false);
  eliminandoFactura = signal(false);
  facturaAEliminar = signal<Factura | null>(null);

  sincronizando = signal(false);

  mostrarDialogCompletarFiscal = signal(false);
  guardandoCompletarFiscal = signal(false);
  facturaParaCompletar = signal<Factura | null>(null);
  formCompletarFiscal: CompletarFiscalDto = this.emptyCompletarFiscalForm();

  mostrarDialogSincronizacionFiscal = signal(false);
  cargandoPreviewSincronizacion = signal(false);
  previewSincronizacion = signal<SincronizacionFiscalPreview | null>(null);
  errorPreviewSincronizacion = signal<string | null>(null);
  previewObsoleta = signal(false);
  previewAplicada = signal(false);
  aplicandoSincronizacion = signal<AccionSincronizacionFiscal | null>(null);
  resultadoSincronizacion = signal<ResultadoSincronizacionFiscal | null>(null);
  errorOperacionSincronizacion = signal<string | null>(null);
  reprocesandoFacturaId = signal<number | null>(null);

  readonly totalesSincronizacionFiscal =
    computed<SincronizacionFiscalTotales | null>(() => {
      const preview = this.previewSincronizacion();
      if (!preview) return null;
      const facturas = preview.facturas ?? [];
      return {
        clientes: preview.totales?.clientes ?? preview.clientes?.length ?? 0,
        facturasElegibles:
          preview.totales?.facturasElegibles ??
          facturas.filter((factura) => factura.estado === 'ELEGIBLE').length,
        importeElegible:
          preview.totales?.importeElegible ??
          facturas
            .filter((factura) => factura.estado === 'ELEGIBLE')
            .reduce((total, factura) => total + (factura.total ?? 0), 0),
        revisionManual:
          preview.totales?.revisionManual ??
          facturas.filter((factura) => factura.estado === 'REVISION').length,
      };
    });

  readonly sincronizacionFiscalPausada = computed(
    () =>
      this.previewSincronizacion()?.automatismos?.sincronizacionHabilitada ===
      false,
  );

  readonly recuperacionFiscalPausada = computed(
    () =>
      this.previewSincronizacion()?.automatismos?.recuperacionHabilitada ===
      false,
  );

  readonly puedeSincronizarFichas = computed(() => {
    if (!this.previewListaParaAplicar()) return false;
    const preview = this.previewSincronizacion();
    if (!preview) return false;
    const clientes = preview.clientes ?? [];
    if (clientes.length > 0) {
      return clientes.some((cliente) => cliente.estado === 'SINCRONIZABLE');
    }
    return (preview.totales?.clientes ?? 0) > 0;
  });

  readonly puedeRecuperarFacturas = computed(
    () =>
      this.previewListaParaAplicar() &&
      (this.totalesSincronizacionFiscal()?.facturasElegibles ?? 0) > 0,
  );

  constructor() {
    super(inject(Router), inject(ActivatedRoute), inject(ChangeDetectorRef));
    this.fetchItems$ = computed(() =>
      this.facturacionService
        .listar$(this.pagination())
        .pipe(tap((entry) => (this.lastLoadedPagination = entry as any))),
    );
  }

  onItemClickHandler(_item: Factura) {}

  onFiltersChanged(where: any) {
    this.updatePaginationSafe({ where: where ?? {}, skip: 0 });
  }

  abrirDialogManual() {
    this.formManual = this.emptyForm();
    this.selectedUserIds = [];
    this.pasoDialogManual.set('seleccionar');
    this.mostrarDialogManual.set(true);
  }

  onUserSelectionChange(ids: number[]) {
    this.selectedUserIds = ids;
  }

  async confirmarSeleccionUsuario() {
    if (this.selectedUserIds.length !== 1) {
      this.toast.warning('Selecciona un único usuario');
      return;
    }
    try {
      const res = await firstValueFrom(
        this.userService.getAllUsers$({
          skip: 0,
          take: 1,
          searchTerm: '',
          where: { id: this.selectedUserIds[0] },
        }),
      );
      const usuario = res.data?.[0];
      if (usuario) {
        this.rellenarDatosDesdeUsuario(usuario);
      }
    } catch {}
    this.pasoDialogManual.set('datos');
  }

  saltarSeleccionUsuario() {
    this.selectedUserIds = [];
    this.formManual = this.emptyForm();
    this.pasoDialogManual.set('datos');
  }

  rellenarDatosDesdeUsuario(usuario: Usuario) {
    this.formManual.clienteNombre =
      ([usuario.nombre, usuario.apellidos].filter(Boolean).join(' ') ||
        usuario.email) ??
      '';
    this.formManual.clienteEmail = usuario.email ?? '';
    this.formManual.clienteNif = usuario.dni ?? '';
    this.formManual.clienteDireccion = usuario.direccionCalle ?? '';
    this.formManual.clientePoblacion = usuario.poblacion ?? '';
    this.formManual.clienteProvincia = (usuario as any).provincia ?? '';
    this.formManual.clienteCodigoPostal = usuario.codigoPostal ?? '';
    this.formManual.clientePais = usuario.paisRegion ?? 'ES';
    this.formManual.usuarioId = usuario.id;
  }

  async guardarFacturaManual() {
    if (
      !this.formManual.clienteNombre?.trim() ||
      !this.formManual.concepto?.trim() ||
      this.formManual.baseImponible == null
    ) {
      this.toast.warning(
        'Nombre del cliente, concepto e importe son obligatorios',
      );
      return;
    }
    if (!this.formManual.clienteNif?.trim()) {
      this.toast.warning('El NIF del cliente es obligatorio');
      return;
    }
    if (!looksLikeSpanishNif(this.formManual.clienteNif)) {
      this.toast.warning('El NIF no tiene un formato válido (DNI, NIE o CIF)');
      return;
    }
    if (!this.formManual.clienteDireccion?.trim()) {
      this.toast.warning('La dirección del cliente es obligatoria');
      return;
    }
    if (!this.formManual.clientePoblacion?.trim()) {
      this.toast.warning('La población del cliente es obligatoria');
      return;
    }
    if (!this.formManual.clienteCodigoPostal?.trim()) {
      this.toast.warning('El código postal del cliente es obligatorio');
      return;
    }
    if (!this.formManual.clientePais?.trim()) {
      this.toast.warning('El país del cliente es obligatorio');
      return;
    }
    if (!this.formManual.clienteProvincia?.trim()) {
      this.toast.warning('La provincia es obligatoria');
      return;
    }
    this.guardandoManual.set(true);
    try {
      await firstValueFrom(
        this.facturacionService.crearManual$(this.formManual),
      );
      this.toast.success('Factura creada correctamente');
      this.mostrarDialogManual.set(false);
      this.refresh();
    } catch {
      // El toast de error ya lo gestiona ApiBaseService.handleError con el
      // mensaje específico del backend (ej: "NIF español inválido").
    } finally {
      this.guardandoManual.set(false);
    }
  }

  abrirDialogRectificativa(factura: Factura) {
    this.facturaSeleccionada.set(factura);
    this.motivoRectificativa = '';
    this.mostrarDialogRectificativa.set(true);
  }

  async guardarRectificativa() {
    const factura = this.facturaSeleccionada();
    if (!factura || !this.motivoRectificativa.trim()) {
      this.toast.warning('El motivo es obligatorio');
      return;
    }
    this.guardandoRectificativa.set(true);
    try {
      await firstValueFrom(
        this.facturacionService.crearRectificativa$(factura.id, {
          motivo: this.motivoRectificativa,
        }),
      );
      this.toast.success('Factura rectificativa creada correctamente');
      this.mostrarDialogRectificativa.set(false);
      this.refresh();
    } catch {
    } finally {
      this.guardandoRectificativa.set(false);
    }
  }

  async descargarPdf(factura: Factura, event: Event) {
    event.stopPropagation();
    if (!factura.contasimpleId) {
      this.toast.warning(
        'Esta factura aún no tiene PDF disponible (puede estar en modo dry-run)',
      );
      return;
    }
    this.descargandoPdf.set(factura.id);
    try {
      const blob = await firstValueFrom(
        this.facturacionService.descargarPdf$(factura.id),
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `factura-${factura.numero || factura.id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
    } finally {
      this.descargandoPdf.set(null);
    }
  }

  abrirDevolver(factura: Factura, event: Event) {
    event.stopPropagation();
    this.abrirDialogRectificativa(factura);
  }

  abrirDialogEliminar(factura: Factura, event: Event) {
    event.stopPropagation();
    this.facturaAEliminar.set(factura);
    this.mostrarDialogEliminar.set(true);
  }

  async confirmarEliminar() {
    const factura = this.facturaAEliminar();
    if (!factura) return;
    this.eliminandoFactura.set(true);
    try {
      const result = await firstValueFrom(
        this.facturacionService.eliminar$(factura.id),
      );
      if (result.remoteStatus === 'not_found') {
        this.toast.warning(
          'La factura no existía en Contasimple; solo se eliminó localmente',
        );
      } else if (result.remoteStatus === 'skipped') {
        this.toast.success('Factura eliminada localmente');
      } else {
        this.toast.success(
          'Factura eliminada de Contasimple y de la plataforma',
        );
      }
      this.mostrarDialogEliminar.set(false);
      this.facturaAEliminar.set(null);
      this.refresh();
    } catch {
      // handleError ya muestra el toast con el mensaje del backend (típicamente
      // "No se pudo borrar en Contasimple: ..." o 403 de VerifactuGuard).
    } finally {
      this.eliminandoFactura.set(false);
    }
  }

  async sincronizarConContasimple() {
    this.sincronizando.set(true);
    try {
      const result = await firstValueFrom(
        this.facturacionService.reconciliar$(),
      );
      if (result.lockSkipped) {
        this.toast.info(
          'Ya hay una sincronización en curso, espera al siguiente ciclo',
        );
      } else {
        const partes = [
          `${result.totalRevisadas} revisadas`,
          `${result.anuladas} anuladas`,
        ];
        if (result.renumeradas > 0) {
          partes.push(`${result.renumeradas} renumeradas`);
        }
        if (result.errores > 0) partes.push(`${result.errores} errores`);
        const mensaje = `Sincronización ${result.estado}: ${partes.join(', ')}`;
        if (result.estado === 'OK') {
          this.toast.success(mensaje);
        } else {
          this.toast.warning(mensaje);
        }
      }
      this.refresh();
    } catch {
      // handleError muestra el toast con el detalle del backend
    } finally {
      this.sincronizando.set(false);
    }
  }

  abrirDialogSincronizacionFiscal() {
    this.previewSincronizacion.set(null);
    this.errorPreviewSincronizacion.set(null);
    this.previewObsoleta.set(false);
    this.previewAplicada.set(false);
    this.resultadoSincronizacion.set(null);
    this.errorOperacionSincronizacion.set(null);
    this.mostrarDialogSincronizacionFiscal.set(true);
    void this.cargarPreviewSincronizacionFiscal();
  }

  async cargarPreviewSincronizacionFiscal() {
    if (this.cargandoPreviewSincronizacion()) return;
    this.cargandoPreviewSincronizacion.set(true);
    this.errorPreviewSincronizacion.set(null);
    this.errorOperacionSincronizacion.set(null);
    this.resultadoSincronizacion.set(null);
    this.previewObsoleta.set(false);
    this.previewAplicada.set(false);
    try {
      const preview = await firstValueFrom(
        this.facturacionService.previsualizarSincronizacionFiscal$(),
      );
      this.previewSincronizacion.set(preview);
    } catch {
      this.previewSincronizacion.set(null);
      this.errorPreviewSincronizacion.set(
        'No se pudo cargar la comparación fiscal. Vuelve a intentarlo.',
      );
    } finally {
      this.cargandoPreviewSincronizacion.set(false);
    }
  }

  async aplicarSincronizacionFiscal(recuperarFacturas: boolean) {
    const preview = this.previewSincronizacion();
    if (!preview || this.aplicandoSincronizacion()) return;
    const puedeAplicar = recuperarFacturas
      ? this.puedeRecuperarFacturas()
      : this.puedeSincronizarFichas();
    if (!puedeAplicar) return;

    this.aplicandoSincronizacion.set(
      recuperarFacturas ? 'recuperar' : 'fichas',
    );
    this.errorOperacionSincronizacion.set(null);
    this.resultadoSincronizacion.set(null);
    try {
      const respuesta = await firstValueFrom(
        this.facturacionService.aplicarSincronizacionFiscal$({
          version: preview.version,
          usuarioIds: [...preview.usuarioIds],
          facturaIds: [...preview.facturaIds],
          recuperarFacturas,
        }),
      );
      this.previewAplicada.set(true);
      const resultado = this.resultadoEncolado(
        respuesta.trabajosEncolados,
        respuesta.procesamientoPausado,
      );
      this.resultadoSincronizacion.set(resultado);
      if (resultado.tono === 'warning') {
        this.toast.warning(resultado.mensaje);
      } else {
        this.toast.info(resultado.mensaje);
      }
      this.refresh();
    } catch (error) {
      if (this.esConflictoDeVersion(error)) {
        this.previewObsoleta.set(true);
        const mensaje =
          'La comparación ha cambiado desde que la revisaste. Actualiza la comparación y confirma de nuevo.';
        this.errorOperacionSincronizacion.set(mensaje);
        this.toast.warning(mensaje);
      } else {
        this.errorOperacionSincronizacion.set(
          this.mensajeDeError(
            error,
            'No se pudo encolar la sincronización fiscal. Vuelve a intentarlo.',
          ),
        );
      }
    } finally {
      this.aplicandoSincronizacion.set(null);
    }
  }

  cerrarDialogSincronizacionFiscal() {
    this.mostrarDialogSincronizacionFiscal.set(false);
  }

  onDialogSincronizacionVisibleChange(visible: boolean) {
    this.mostrarDialogSincronizacionFiscal.set(visible);
  }

  async reprocesarFacturaFiscal(factura: Factura, event: Event) {
    event.stopPropagation();
    if (!this.puedeReprocesar(factura)) return;
    if (this.reprocesandoFacturaId() !== null) return;

    this.reprocesandoFacturaId.set(factura.id);
    const referencia = factura.numero
      ? `la factura nº ${factura.numero}`
      : `la factura #${factura.id}`;
    try {
      const respuesta = await firstValueFrom(
        this.facturacionService.reprocesarFacturaFiscal$(factura.id),
      );
      if (respuesta.trabajosEncolados <= 0) {
        this.toast.info(`No se encoló ningún reintento para ${referencia}.`);
      } else if (respuesta.procesamientoPausado) {
        this.toast.warning(
          `Se encoló el reintento de ${referencia}. Los automatismos están pausados; permanecerá pendiente hasta que se reactiven.`,
        );
      } else {
        this.toast.info(
          `Se encoló el reintento de ${referencia} para sincronización fiscal.`,
        );
      }
      this.refresh();
    } catch (error) {
      if (this.esConflictoDeVersion(error)) {
        this.toast.warning(
          'El estado de la factura ha cambiado. Actualiza el listado antes de reintentar.',
        );
        this.refresh();
      }
    } finally {
      this.reprocesandoFacturaId.set(null);
    }
  }

  puedeReprocesar(factura: Factura): boolean {
    // Solo una factura pendiente puede reintentarse. Cualquier otro estado
    // (emitida, anulada, rectificativa, omitida de prueba, error o un estado
    // desconocido que llegue del backend) es incierto y no se ofrece.
    if (factura.tipo === 'RECTIFICATIVA') return false;
    if (factura.estado !== 'PENDIENTE') return false;

    const trabajo = factura.trabajoFiscal;
    if (trabajo) {
      return trabajo.estado === 'PENDIENTE' || trabajo.estado === 'REVISION';
    }
    // Backend antiguo sin extensión de trabajo fiscal: solo se ofrece el
    // reintento cuando hay una revisión conocida.
    return factura.requiereRevisionFiscal;
  }

  getEstadoTrabajoFiscalLabel(estado: EstadoTrabajoFiscal | undefined): string {
    return estado ? (ETIQUETAS_ESTADO_TRABAJO_FISCAL[estado] ?? estado) : '';
  }

  getEstadoTrabajoFiscalChipClass(
    estado: EstadoTrabajoFiscal | undefined,
  ): string {
    const map: Record<EstadoTrabajoFiscal, string> = {
      PENDIENTE: 'trabajo-fiscal-pendiente-chip',
      PROCESANDO: 'trabajo-fiscal-procesando-chip',
      REINTENTO: 'trabajo-fiscal-reintento-chip',
      REVISION: 'trabajo-fiscal-revision-chip',
      COMPLETADO: 'trabajo-fiscal-completado-chip',
    };
    return estado ? (map[estado] ?? '') : '';
  }

  getEstadoSincronizacionClienteLabel(
    estado: EstadoSincronizacionCliente,
  ): string {
    return ETIQUETAS_ESTADO_CLIENTE[estado] ?? estado;
  }

  getEstadoSincronizacionClienteChipClass(
    estado: EstadoSincronizacionCliente,
  ): string {
    const map: Record<EstadoSincronizacionCliente, string> = {
      SIN_CAMBIOS: 'sync-cliente-sin-cambios-chip',
      SINCRONIZABLE: 'sync-cliente-sincronizable-chip',
      REVISION: 'sync-cliente-revision-chip',
      NO_DISPONIBLE: 'sync-cliente-no-disponible-chip',
    };
    return map[estado] ?? 'sync-cliente-sin-cambios-chip';
  }

  getEstadoSincronizacionFacturaLabel(
    estado: EstadoSincronizacionFactura,
  ): string {
    return ETIQUETAS_ESTADO_FACTURA_SYNC[estado] ?? estado;
  }

  getEstadoSincronizacionFacturaChipClass(
    estado: EstadoSincronizacionFactura,
  ): string {
    const map: Record<EstadoSincronizacionFactura, string> = {
      ELEGIBLE: 'sync-factura-elegible-chip',
      YA_EMITIDA: 'sync-factura-ya-emitida-chip',
      REVISION: 'sync-factura-revision-chip',
      FUERA_PERIODO: 'sync-factura-fuera-periodo-chip',
      NO_FACTURABLE: 'sync-factura-no-facturable-chip',
      ESPERA_PROVEEDOR: 'sync-factura-espera-chip',
    };
    return map[estado] ?? 'sync-factura-revision-chip';
  }

  etiquetaCampoFiscal(campo: string): string {
    const etiqueta = ETIQUETAS_CAMPO_FISCAL[campo];
    if (etiqueta) return etiqueta;
    const humanizado = campo
      .replace(/([a-záéíóú])([A-Z])/g, '$1 $2')
      .replace(/_/g, ' ');
    return humanizado.charAt(0).toUpperCase() + humanizado.slice(1);
  }

  etiquetaOrigenFiscal(origen: OrigenDatoFiscal): string {
    return ETIQUETAS_ORIGEN_FISCAL[origen] ?? origen;
  }

  valorActualCambioFiscal(cambio: CambioFiscal): string {
    return cambio.valorActual?.trim() || 'Vacío';
  }

  motivosFacturaSincronizacion(factura: { motivos?: string[] }): string {
    return factura.motivos?.filter(Boolean).join(' · ') ?? '';
  }

  textoFacturasElegibles(cantidad: number): string {
    return cantidad === 1
      ? '1 factura elegible'
      : `${cantidad} facturas elegibles`;
  }

  textoFacturasParaRecuperar(cantidad: number): string {
    return cantidad === 1 ? '1 factura' : `${cantidad} facturas`;
  }

  mostrarChipRevisionFiscal(factura: Factura): boolean {
    return (
      factura.requiereRevisionFiscal &&
      factura.trabajoFiscal?.estado !== 'REVISION'
    );
  }

  trabajoFiscalTooltip(factura: Factura): string {
    const trabajo = factura.trabajoFiscal;
    if (!trabajo) return '';
    const partes = [
      `Trabajo fiscal: ${this.getEstadoTrabajoFiscalLabel(trabajo.estado)}`,
    ];
    if (trabajo.intentos > 0) {
      partes.push(
        `${trabajo.intentos} ${trabajo.intentos === 1 ? 'intento' : 'intentos'}`,
      );
    }
    if (trabajo.ultimoError) {
      partes.push(`Último error: ${trabajo.ultimoError}`);
    }
    return partes.join(' · ');
  }

  abrirDialogCompletarFiscal(factura: Factura, event: Event) {
    event.stopPropagation();
    this.facturaParaCompletar.set(factura);
    this.formCompletarFiscal = {
      clienteNif: factura.clienteNif ?? '',
      clienteNombre: factura.clienteNombre ?? '',
      clienteDireccion: factura.clienteDireccion ?? '',
      clientePoblacion: factura.clientePoblacion ?? '',
      clienteProvincia: factura.clienteProvincia ?? '',
      clienteCodigoPostal: factura.clienteCodigoPostal ?? '',
      clientePais: factura.clientePais ?? '',
    };
    this.mostrarDialogCompletarFiscal.set(true);
  }

  async guardarCompletarFiscal() {
    const factura = this.facturaParaCompletar();
    if (!factura) return;
    const ficha = this.fichaFiscalResultante(factura);
    if (!ficha.clienteNif) {
      this.toast.warning('El NIF es obligatorio');
      return;
    }
    if (!looksLikeSpanishNif(ficha.clienteNif)) {
      this.toast.warning('El NIF no tiene un formato válido');
      return;
    }
    if (!ficha.clienteNombre) {
      this.toast.warning('El titular o razón social es obligatorio');
      return;
    }
    if (!ficha.clienteDireccion) {
      this.toast.warning('La dirección del cliente es obligatoria');
      return;
    }
    if (!ficha.clientePoblacion) {
      this.toast.warning('La población del cliente es obligatoria');
      return;
    }
    if (!ficha.clienteCodigoPostal) {
      this.toast.warning('El código postal del cliente es obligatorio');
      return;
    }
    if (!ficha.clientePais) {
      this.toast.warning('El país del cliente es obligatorio');
      return;
    }
    if (!ficha.clienteProvincia) {
      this.toast.warning('La provincia es obligatoria');
      return;
    }
    this.guardandoCompletarFiscal.set(true);
    try {
      await firstValueFrom(
        this.facturacionService.completarFiscal$(factura.id, ficha),
      );
      this.toast.success('Factura completada y emitida en Contasimple');
      this.mostrarDialogCompletarFiscal.set(false);
      this.facturaParaCompletar.set(null);
      this.refresh();
    } catch {
      // handleError gestiona el toast
    } finally {
      this.guardandoCompletarFiscal.set(false);
    }
  }

  getEstadoChipClass(estado: FacturaEstado, factura?: Factura): string {
    // "Anulada desde Contasimple" tiene color distinto (amarillo/naranja)
    // para diferenciar del estado ANULADA manual (rojo).
    if (estado === 'ANULADA' && factura?.origenAnulacion === 'CONTASIMPLE') {
      return 'estado-anulada-externa-chip';
    }
    const map: Record<FacturaEstado, string> = {
      EMITIDA: 'estado-emitida-chip',
      PENDIENTE: 'estado-pendiente-chip',
      ANULADA: 'estado-anulada-chip',
      ELIMINADA_LOCAL: 'estado-anulada-chip',
      OMITIDA_PRUEBA: 'estado-omitida-prueba-chip',
      ERROR: 'estado-error-chip',
    };
    return map[estado] ?? 'estado-pendiente-chip';
  }

  getEstadoLabel(factura: Factura): string {
    if (
      factura.estado === 'ANULADA' &&
      factura.origenAnulacion === 'CONTASIMPLE'
    ) {
      return 'Anulada desde Contasimple';
    }
    if (factura.estado === 'ELIMINADA_LOCAL') return 'Eliminada';
    if (factura.estado === 'OMITIDA_PRUEBA') return 'Omitida · prueba';
    return factura.estado;
  }

  motivosRevisionFiscalTexto(factura: Factura): string {
    return (
      factura.motivosRevisionFiscal
        ?.map((motivo) =>
          motivo.campos?.length
            ? `${motivo.codigo}: ${motivo.campos.join(', ')}`
            : motivo.codigo,
        )
        .join(' · ') ?? ''
    );
  }

  calcularTotal(base: number, iva: number): number {
    return base + base * (iva / 100);
  }

  private previewListaParaAplicar(): boolean {
    return (
      this.previewSincronizacion() !== null &&
      !this.cargandoPreviewSincronizacion() &&
      this.aplicandoSincronizacion() === null &&
      !this.previewObsoleta() &&
      !this.previewAplicada()
    );
  }

  private resultadoEncolado(
    trabajosEncolados: number,
    procesamientoPausado: boolean,
  ): ResultadoSincronizacionFiscal {
    const trabajos = Math.max(0, trabajosEncolados);
    if (trabajos === 0) {
      return {
        tono: 'info',
        mensaje: 'No se encoló ningún trabajo de sincronización fiscal.',
      };
    }
    const sustantivo = trabajos === 1 ? 'trabajo' : 'trabajos';
    const verbo = trabajos === 1 ? 'encoló' : 'encolaron';
    if (procesamientoPausado) {
      return {
        tono: 'warning',
        mensaje: `Se ${verbo} ${trabajos} ${sustantivo} de sincronización fiscal. Los automatismos están pausados; el trabajo permanecerá pendiente hasta que se reactiven.`,
      };
    }
    return {
      tono: 'info',
      mensaje: `Se ${verbo} ${trabajos} ${sustantivo} de sincronización fiscal para procesarse en segundo plano.`,
    };
  }

  private esConflictoDeVersion(error: unknown): boolean {
    return error instanceof HttpErrorResponse && error.status === 409;
  }

  private mensajeDeError(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message?.trim()) {
      return error.message.trim();
    }
    return fallback;
  }

  private emptyForm(): CrearFacturaManualDto {
    return {
      clienteNombre: '',
      clienteEmail: '',
      clienteNif: '',
      clienteDireccion: '',
      clientePoblacion: '',
      clienteProvincia: '',
      clienteCodigoPostal: '',
      clientePais: 'ES',
      concepto: '',
      baseImponible: 0,
      tipoIva: 21,
      serie: '',
    };
  }

  private emptyCompletarFiscalForm(): CompletarFiscalDto {
    return {
      clienteNif: '',
      clienteNombre: '',
      clienteDireccion: '',
      clientePoblacion: '',
      clienteProvincia: '',
      clienteCodigoPostal: '',
      clientePais: '',
    };
  }

  private fichaFiscalResultante(factura: Factura): CompletarFiscalDto {
    const usar = (valor: string | undefined, historico: string | undefined) =>
      valor?.trim() || historico?.trim() || '';
    return {
      clienteNif: usar(this.formCompletarFiscal.clienteNif, factura.clienteNif),
      clienteNombre: usar(
        this.formCompletarFiscal.clienteNombre,
        factura.clienteNombre,
      ),
      clienteDireccion: usar(
        this.formCompletarFiscal.clienteDireccion,
        factura.clienteDireccion,
      ),
      clientePoblacion: usar(
        this.formCompletarFiscal.clientePoblacion,
        factura.clientePoblacion,
      ),
      clienteProvincia: usar(
        this.formCompletarFiscal.clienteProvincia,
        factura.clienteProvincia,
      ),
      clienteCodigoPostal: usar(
        this.formCompletarFiscal.clienteCodigoPostal,
        factura.clienteCodigoPostal,
      ),
      clientePais: usar(
        this.formCompletarFiscal.clientePais,
        factura.clientePais,
      ),
    };
  }
}
