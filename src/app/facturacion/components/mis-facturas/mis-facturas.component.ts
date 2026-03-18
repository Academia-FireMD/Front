import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectorRef, ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { firstValueFrom, tap } from 'rxjs';
import { GenericListComponent } from '../../../shared/generic-list/generic-list.component';
import { PrimengModule } from '../../../shared/primeng.module';
import { SharedModule } from '../../../shared/shared.module';
import { Factura, FacturaEstado } from '../../models/factura.model';
import { FacturacionService } from '../../servicios/facturacion.service';

@Component({
  selector: 'app-mis-facturas',
  templateUrl: './mis-facturas.component.html',
  styleUrl: './mis-facturas.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, GenericListComponent, PrimengModule, SharedModule],
})
export class MisFacturasComponent extends GenericListComponent<Factura> {
  private facturacionService = inject(FacturacionService);
  override toast = inject(ToastrService);

  descargandoPdf = signal<number | null>(null);

  constructor() {
    super(inject(Router), inject(ActivatedRoute), inject(ChangeDetectorRef));
    this.fetchItems$ = computed(() =>
      this.facturacionService.misFacturas$(this.pagination()).pipe(
        tap((entry) => (this.lastLoadedPagination = entry as any))
      )
    );
  }

  onItemClickHandler(_item: Factura) {}

  onFiltersChanged(_where: unknown) {}

  async descargarPdf(factura: Factura, event: Event) {
    event.stopPropagation();
    if (!factura.contasimpleId) {
      this.toast.warning('Esta factura aún no tiene PDF disponible');
      return;
    }
    this.descargandoPdf.set(factura.id);
    try {
      const blob = await firstValueFrom(this.facturacionService.descargarMiPdf$(factura.id));
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

  getEstadoChipClass(estado: FacturaEstado): string {
    const map: Record<FacturaEstado, string> = {
      EMITIDA: 'estado-emitida-chip',
      PENDIENTE: 'estado-pendiente-chip',
      ANULADA: 'estado-anulada-chip',
      ERROR: 'estado-error-chip',
    };
    return map[estado] ?? 'estado-pendiente-chip';
  }
}
