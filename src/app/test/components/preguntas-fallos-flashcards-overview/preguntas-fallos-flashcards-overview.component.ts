import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { ConfirmationService } from 'primeng/api';
import { firstValueFrom, tap } from 'rxjs';
import { PreguntasService } from '../../../services/preguntas.service';
import { ReportesFalloService } from '../../../services/reporte-fallo.service';
import { ViewportService } from '../../../services/viewport.service';
import { PreguntaFallo } from '../../../shared/models/pregunta.model';
import { SharedGridComponent } from '../../../shared/shared-grid/shared-grid.component';

@Component({
  selector: 'app-preguntas-fallos-flashcards-overview',
  templateUrl: './preguntas-fallos-flashcards-overview.component.html',
  styleUrl: './preguntas-fallos-flashcards-overview.component.scss',
})
export class PreguntasFallosFlashcardsOverviewComponent extends SharedGridComponent<PreguntaFallo> {
  toast = inject(ToastrService);
  viewportService = inject(ViewportService);
  preguntasService = inject(PreguntasService);
  reportesFalloService = inject(ReportesFalloService);
  confirmationService = inject(ConfirmationService);
  router = inject(Router);
  public expandedItem!: PreguntaFallo | null;

  constructor() {
    super();
    this.fetchItems$ = computed(() => {
      return this.reportesFalloService
        .getReporteFallosFlashcards$(this.pagination())
        .pipe(tap((entry) => (this.lastLoadedPagination = entry)));
    });
  }

  toggleRowExpansion(item: PreguntaFallo) {
    this.expandedItem = this.expandedItem === item ? null : item;
  }

  public eliminarFeedback(id: number, event: Event) {
    this.confirmationService.confirm({
      target: event.target as EventTarget,
      message: `Vas a eliminar el reporte de fallo, ¿estás seguro?`,
      header: 'Confirmación',
      icon: 'pi pi-exclamation-triangle',
      acceptIcon: 'none',
      acceptLabel: 'Sí',
      rejectLabel: 'No',
      rejectIcon: 'none',
      rejectButtonStyleClass: 'p-button-text',
      accept: async () => {
        await firstValueFrom(this.reportesFalloService.deleteReporteFallo$(id));
        this.toast.info('Reporte de fallo eliminado exitosamente');
        this.refresh();
      },
      reject: () => {},
    });
  }
}
