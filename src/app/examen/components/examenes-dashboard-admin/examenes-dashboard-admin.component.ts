import {
  Component,
  computed,
  ElementRef,
  inject,
  ViewChild,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { combineLatest, filter, firstValueFrom, switchMap, tap } from 'rxjs';
import { FilterConfig } from '../../../shared/generic-list/generic-list.component';
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

  public expectedRole: 'ADMIN' | 'ALUMNO' = 'ADMIN';
  public type: 'disponibles' | 'realizados' = 'disponibles';

  // Propiedades para el popup de exámenes colaborativos
  public colaborativoDialogVisible = false;
  public examenColaborativoSeleccionado: Examen | null = null;
  public progresoColaborativo: any = null;
  public loadingProgreso = false;

  // Configuración de filtros para el GenericListComponent
  public filters: FilterConfig[] = [
    {
      key: 'createdAt',
      specialCaseKey: 'rangeDate',
      label: 'Rango de fechas',
      type: 'calendar',
      placeholder: 'Seleccionar rango de fechas',
      dateConfig: {
        selectionMode: 'range',
      },
    },
    {
      key: 'temas',
      label: 'Temas',
      type: 'tema-select',
      filterInterpolation: (value) => ({
        test: {
          testPreguntas: {
            some: {
              pregunta: {
                temaId: { in: value }
              }
            }
          }
        }
      }),
    },
    // {
    //   key: 'estado',
    //   label: 'Estado',
    //   type: 'dropdown',
    //   placeholder: 'Seleccionar estado',
    //   options: [
    //     { label: 'Borrador', value: EstadoExamen.BORRADOR },
    //     { label: 'Publicado', value: EstadoExamen.PUBLICADO },
    //     { label: 'Archivado', value: EstadoExamen.ARCHIVADO },
    //   ],
    // },
    {
      key: 'tipoAcceso',
      label: 'Tipo de acceso',
      type: 'dropdown',
      placeholder: 'Seleccionar tipo de acceso',
      options: [
        { label: 'Público', value: TipoAcceso.PUBLICO },
        { label: 'Restringido', value: TipoAcceso.RESTRINGIDO },
        { label: 'Simulacro', value: TipoAcceso.SIMULACRO },
        { label: 'Colaborativo', value: TipoAcceso.COLABORATIVO },
      ],
    },
  ];

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

  public onFiltersChanged(where: any) {
    // Actualizar la paginación con los nuevos filtros
    this.pagination.set({
      ...this.pagination(),
      where: where,
      skip: 0, // Resetear a la primera página cuando cambian los filtros
    });
  }

  public onItemClick(item: Examen) {
    // Si es un examen colaborativo y el usuario es alumno, mostrar popup de progreso
    if (item.tipoAcceso === TipoAcceso.COLABORATIVO && this.expectedRole === 'ALUMNO') {
      this.mostrarProgresoColaborativo(item);
      return;
    }

    // Crear un evento sintético para mantener compatibilidad
    const syntheticEvent = new Event('click');
    this.navigateToDetailview(syntheticEvent, item.id, item.test?.id);
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
            this.router.navigate(['/app/test/alumno/realizar-test/' + (test.id)],{queryParams:{
              idExamen:id,
              modoSimulacro:true
            }});
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
      [TipoAcceso.COLABORATIVO]: 'Colaborativo',
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

  // Métodos para manejar exámenes colaborativos
  public async mostrarProgresoColaborativo(examen: Examen) {
    this.examenColaborativoSeleccionado = examen;
    this.colaborativoDialogVisible = true;
    this.loadingProgreso = true;
    this.progresoColaborativo = null;

    try {
      const progreso = await firstValueFrom(
        this.examenesService.getProgresoExamenColaborativo$(examen.id)
      );
      this.progresoColaborativo = progreso;
    } catch (error) {
      this.toast.error('Error al cargar el progreso del examen colaborativo');
      console.error('Error:', error);
    } finally {
      this.loadingProgreso = false;
    }
  }

  public async realizarExamenColaborativo() {
    if (!this.examenColaborativoSeleccionado || !this.progresoColaborativo?.progreso?.puedeAcceder) {
      return;
    }

    try {
      const test = await firstValueFrom(
        this.examenesService.startExamen$(this.examenColaborativoSeleccionado.id)
      );

      if (test) {
        this.colaborativoDialogVisible = false;
        this.router.navigate(['/app/test/alumno/realizar-test/' + test.id], {
          queryParams: {
            idExamen: this.examenColaborativoSeleccionado.id,
            modoSimulacro: true
          }
        });
      }
    } catch (error) {
      this.toast.error('Error al iniciar el examen colaborativo');
      console.error('Error:', error);
    }
  }

  public cerrarDialogoColaborativo() {
    this.colaborativoDialogVisible = false;
    this.examenColaborativoSeleccionado = null;
    this.progresoColaborativo = null;
  }
}
