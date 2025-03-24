import {
  Component,
  computed,
  ElementRef,
  inject,
  ViewChild,
} from '@angular/core';
import { FormControl } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { combineLatest, debounceTime, filter, firstValueFrom, switchMap, tap } from 'rxjs';
import { PaginationFilter } from '../../../shared/models/pagination.model';
import { SharedGridComponent } from '../../../shared/shared-grid/shared-grid.component';
import { EstadoExamen, Examen, TipoAcceso } from '../../models/examen.model';
import { ExamenesService } from '../../servicios/examen.service';


@Component({
  selector: 'app-examenes-dashboard-admin',
  templateUrl: './examenes-dashboard-admin.component.html',
  styleUrl: './examenes-dashboard-admin.component.scss',
})
export class ExamenesDashboardAdminComponent extends SharedGridComponent<Examen> {
  examenesService = inject(ExamenesService);
  confirmationService = inject(ConfirmationService);
  activatedRoute = inject(ActivatedRoute);
  @ViewChild('fileInput') fileInput!: ElementRef;
  public uploadingFile = false;
  public formControlTemas = new FormControl();

  public expectedRole: 'ADMIN' | 'ALUMNO' = 'ADMIN';
  public type: 'disponibles' | 'realizados' = 'disponibles';
  commMap = (pagination: PaginationFilter) => {
    return {
      ADMIN: this.examenesService
        .getExamenes$(pagination)
        .pipe(tap((entry) => (this.lastLoadedPagination = entry))),
      ALUMNO: this.examenesService
        .getExamenesDisponibles$(pagination)
        .pipe(tap((entry) => (this.lastLoadedPagination = entry))),
    };
  };

  constructor() {
    super();
    this.fetchItems$ = computed(() => {
      return this.getExamenes({ ...this.pagination() });
    });
    this.formControlTemas.valueChanges.pipe(debounceTime(500)).subscribe((value) => {
      if (!!value?.length) {
        this.pagination.set({
          ...this.pagination(), where: {
            test: {
              testPreguntas: {
                some: {
                  pregunta: {
                    temaId: {
                      in: value
                    }
                  }
                }
              }
            }
          }
        });
      } else {
        this.pagination.set({ ...this.pagination(), where: {} });
      }
    });
  }



  private getExamenes(pagination: PaginationFilter) {
    return combineLatest([
      this.activatedRoute.data,
      this.activatedRoute.queryParams,
    ]).pipe(
      filter((e) => !!e),
      switchMap((e) => {
        const [data, queryParams] = e;
        const { expectedRole, type } = data;
        this.expectedRole = expectedRole;
        this.type = type;
        return this.commMap(pagination)[this.expectedRole];
      })
    );
  }

  public navigateToDetailview = (event: Event, id: number | 'new', idTest?: number) => {
    if (this.expectedRole == 'ADMIN') {
      this.router.navigate(['/app/examen/' + id]);
    } else {
      const mensaje = `Estás a punto de comenzar un examen. El tiempo empezará a descontarse automáticamente y serás dirigido a él. ¿Deseas continuar?`
      this.confirmationService.confirm({
        target: event.target as EventTarget,
        message: mensaje,
        header: 'Confirmación',
        icon: 'pi pi-exclamation-triangle',
        acceptIcon: 'none',
        acceptLabel: 'Sí',
        rejectLabel: 'No',
        rejectIcon: 'none',
        rejectButtonStyleClass: 'p-button-text',
        accept: async () => {
          const test = await firstValueFrom(this.examenesService.startExamen$(id as number));
          if (test) {
            this.router.navigate(['/app/test/alumno/realizar-test/' + (test.id)]);
          }
        },
        reject: () => { },
      });
    }
  };

  public getEstadoLabel(estado: EstadoExamen): string {
    const estadoMap = {
      [EstadoExamen.BORRADOR]: 'Borrador',
      [EstadoExamen.PUBLICADO]: 'Publicado',
      [EstadoExamen.ARCHIVADO]: 'Archivado',
    };
    return estadoMap[estado] || estado;
  }

  public getTipoAccesoLabel(tipoAcceso: TipoAcceso): string {
    const tipoAccesoMap = {
      [TipoAcceso.PUBLICO]: 'Público',
      [TipoAcceso.RESTRINGIDO]: 'Restringido',
      [TipoAcceso.SIMULACRO]: 'Simulacro',
    };
    return tipoAccesoMap[tipoAcceso] || tipoAcceso;
  }

  public eliminarExamen(id: number, event: Event) {
    this.confirmationService.confirm({
      target: event.target as EventTarget,
      message: `Vas a eliminar el examen con el ID ${id}, ¿estás seguro?`,
      header: 'Confirmación',
      icon: 'pi pi-exclamation-triangle',
      acceptIcon: 'none',
      acceptLabel: 'Sí',
      rejectLabel: 'No',
      rejectIcon: 'none',
      rejectButtonStyleClass: 'p-button-text',
      accept: async () => {
        await firstValueFrom(this.examenesService.deleteExamen$(id));
        this.toast.info('Examen eliminado exitosamente');
        this.refresh();
      },
      reject: () => { },
    });
  }

  public publicarExamen(id: number, event: Event) {
    this.confirmationService.confirm({
      target: event.target as EventTarget,
      message: `Vas a publicar el examen con el ID ${id}, ¿estás seguro?`,
      header: 'Confirmación',
      icon: 'pi pi-exclamation-triangle',
      acceptIcon: 'none',
      acceptLabel: 'Sí',
      rejectLabel: 'No',
      rejectIcon: 'none',
      rejectButtonStyleClass: 'p-button-text',
      accept: async () => {
        await firstValueFrom(this.examenesService.publicarExamen$(id));
        this.toast.info('Examen publicado exitosamente');
        this.refresh();
      },
      reject: () => { },
    });
  }

  public archivarExamen(id: number, event: Event) {
    this.confirmationService.confirm({
      target: event.target as EventTarget,
      message: `Vas a archivar el examen con el ID ${id}, ¿estás seguro?`,
      header: 'Confirmación',
      icon: 'pi pi-exclamation-triangle',
      acceptIcon: 'none',
      acceptLabel: 'Sí',
      rejectLabel: 'No',
      rejectIcon: 'none',
      rejectButtonStyleClass: 'p-button-text',
      accept: async () => {
        await firstValueFrom(this.examenesService.archivarExamen$(id));
        this.toast.info('Examen archivado exitosamente');
        this.refresh();
      },
      reject: () => { },
    });
  }
}
