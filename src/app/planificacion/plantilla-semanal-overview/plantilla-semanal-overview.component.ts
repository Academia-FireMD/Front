import {
  Component,
  computed,
  ElementRef,
  EventEmitter,
  inject,
  Input,
  Output,
  ViewChild,
} from '@angular/core';
import { ConfirmationService } from 'primeng/api';
import { firstValueFrom, tap } from 'rxjs';
import { PlanificacionesService } from '../../services/planificaciones.service';
import { PlantillaSemanal } from '../../shared/models/planificacion.model';
import { SharedGridComponent } from '../../shared/shared-grid/shared-grid.component';

@Component({
  selector: 'app-plantilla-semanal-overview',
  templateUrl: './plantilla-semanal-overview.component.html',
  styleUrl: './plantilla-semanal-overview.component.scss',
})
export class PlantillaSemanalOverviewComponent extends SharedGridComponent<PlantillaSemanal> {
  planificacionesService = inject(PlanificacionesService);
  confirmationService = inject(ConfirmationService);
  @ViewChild('fileInput') fileInput!: ElementRef;
  public uploadingFile = false;

  @Input() mode: 'picker' | 'overview' = 'overview';
  @Output() picked = new EventEmitter<PlantillaSemanal>();

  constructor() {
    super();
    this.fetchItems$ = computed(() => {
      return this.planificacionesService
        .getPlantillaSemanales$(this.pagination())
        .pipe(tap((entry) => (this.lastLoadedPagination = entry)));
    });
  }

  public navigateToDetailview = (id: number | 'new') => {
    this.router.navigate(['/app/planificacion/plantillas-semanales/' + id]);
  };

  public eliminar(id: number, event: Event) {
    this.confirmationService.confirm({
      target: event.target as EventTarget,
      message: `Vas a eliminar una plantilla de planificación semanal con el ID ${id}, ¿estás seguro?`,
      header: 'Confirmación',
      icon: 'pi pi-exclamation-triangle',
      acceptIcon: 'none',
      acceptLabel: 'Sí',
      rejectLabel: 'No',
      rejectIcon: 'none',
      rejectButtonStyleClass: 'p-button-text',
      accept: async () => {
        await firstValueFrom(
          this.planificacionesService.deletePlantillaSemanal$(id)
        );
        this.toast.info('Planificación semanal eliminada exitosamente');
        this.refresh();
      },
      reject: () => {},
    });
  }

  public async clonarPlantillaSemanal(id: number) {
    try {
      await firstValueFrom(this.planificacionesService.clonarPlantillaSemanal$(id));
      this.toast.success('Plantilla semanal clonada exitosamente');
      this.refresh();
    } catch (error) {
      this.toast.error('Error al clonar la plantilla semanal');
    }
  }
}
