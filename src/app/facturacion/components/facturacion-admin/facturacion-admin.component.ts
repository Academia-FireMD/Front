import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectorRef, ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { firstValueFrom, tap } from 'rxjs';
import { FilterConfig, GenericListComponent } from '../../../shared/generic-list/generic-list.component';
import { PrimengModule } from '../../../shared/primeng.module';
import { SharedModule } from '../../../shared/shared.module';
import { UserDashboardComponent } from '../../../test/components/user-dashboard/user-dashboard.component';
import {
  CrearFacturaManualDto,
  Factura,
  FacturaEstado,
  FacturaTipo,
} from '../../models/factura.model';
import { FacturacionService } from '../../servicios/facturacion.service';
import { UserService } from '../../../services/user.service';
import { Usuario } from '../../../shared/models/user.model';

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
  override toast = inject(ToastrService);

  override filters: FilterConfig[] = [
    {
      key: 'dateRange',
      specialCaseKey: 'rangeDate',
      label: 'Rango de fechas',
      type: 'calendar',
      placeholder: 'Seleccionar rango de fechas',
      dateConfig: { selectionMode: 'range' },
      filterInterpolation: (value: Date[] | null) => {
        if (!value || !Array.isArray(value) || !value[0] || !value[1]) return {};
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

  constructor() {
    super(inject(Router), inject(ActivatedRoute), inject(ChangeDetectorRef));
    this.fetchItems$ = computed(() =>
      this.facturacionService.listar$(this.pagination()).pipe(
        tap((entry) => (this.lastLoadedPagination = entry as any))
      )
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
        this.userService.getAllUsers$({ skip: 0, take: 1, searchTerm: '', where: { id: this.selectedUserIds[0] } })
      );
      const usuario = res.data?.[0];
      if (usuario) {
        this.rellenarDatosDesdeUsuario(usuario);
      }
    } catch {
      this.toast.error('Error al cargar datos del usuario');
    }
    this.pasoDialogManual.set('datos');
  }

  saltarSeleccionUsuario() {
    this.selectedUserIds = [];
    this.formManual = this.emptyForm();
    this.pasoDialogManual.set('datos');
  }

  rellenarDatosDesdeUsuario(usuario: Usuario) {
    this.formManual.clienteNombre = ([usuario.nombre, usuario.apellidos].filter(Boolean).join(' ') || usuario.email) ?? '';
    this.formManual.clienteEmail = usuario.email ?? '';
    this.formManual.clienteNif = usuario.dni ?? '';
    this.formManual.clienteDireccion = usuario.direccionCalle ?? '';
    this.formManual.clientePoblacion = usuario.poblacion ?? '';
    this.formManual.clienteCodigoPostal = usuario.codigoPostal ?? '';
    this.formManual.clientePais = usuario.paisRegion ?? 'ES';
    this.formManual.usuarioId = usuario.id;
  }

  async guardarFacturaManual() {
    if (!this.formManual.clienteNombre || !this.formManual.concepto || !this.formManual.baseImponible) {
      this.toast.warning('Nombre del cliente, concepto e importe son obligatorios');
      return;
    }
    this.guardandoManual.set(true);
    try {
      await firstValueFrom(this.facturacionService.crearManual$(this.formManual));
      this.toast.success('Factura creada correctamente');
      this.mostrarDialogManual.set(false);
      this.refresh();
    } catch {
      this.toast.error('Error al crear la factura');
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
        this.facturacionService.crearRectificativa$(factura.id, { motivo: this.motivoRectificativa })
      );
      this.toast.success('Factura rectificativa creada correctamente');
      this.mostrarDialogRectificativa.set(false);
      this.refresh();
    } catch {
      this.toast.error('Error al crear la rectificativa');
    } finally {
      this.guardandoRectificativa.set(false);
    }
  }

  async descargarPdf(factura: Factura, event: Event) {
    event.stopPropagation();
    if (!factura.contasimpleId) {
      this.toast.warning('Esta factura aún no tiene PDF disponible (puede estar en modo dry-run)');
      return;
    }
    this.descargandoPdf.set(factura.id);
    try {
      const blob = await firstValueFrom(this.facturacionService.descargarPdf$(factura.id));
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `factura-${factura.numero || factura.id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      this.toast.error('Error al descargar el PDF');
    } finally {
      this.descargandoPdf.set(null);
    }
  }

  abrirDevolver(factura: Factura, event: Event) {
    event.stopPropagation();
    this.abrirDialogRectificativa(factura);
  }

  getEstadoChipClass(estado: FacturaEstado): string {
    const map: Record<FacturaEstado, string> = {
      EMITIDA: 'estado-emitida-chip',
      PENDIENTE: 'estado-pendiente-chip',
      ANULADA: 'estado-anulada-chip',
      ERROR: 'estado-error-chip',
    };
    return map[estado] ?? 'estado-pendiente-chip';
  }

  calcularTotal(base: number, iva: number): number {
    return base + base * (iva / 100);
  }

  private emptyForm(): CrearFacturaManualDto {
    return {
      clienteNombre: '',
      clienteEmail: '',
      clienteNif: '',
      clienteDireccion: '',
      clientePoblacion: '',
      clienteCodigoPostal: '',
      clientePais: 'ES',
      concepto: '',
      baseImponible: 0,
      tipoIva: 21,
      serie: '',
    };
  }
}
