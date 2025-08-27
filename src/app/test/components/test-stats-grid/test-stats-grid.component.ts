import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Store } from '@ngrx/store';
import { flattenDeep } from 'lodash';
import { PrimeNGConfig } from 'primeng/api';
import { combineLatest, filter, tap } from 'rxjs';
import { FlashcardDataService } from '../../../services/flashcards.service';
import { TestService } from '../../../services/test.service';
import { FilterConfig } from '../../../shared/generic-list/generic-list.component';
import { FlashcardTest } from '../../../shared/models/flashcard.model';
import { PaginationFilter } from '../../../shared/models/pagination.model';
import { Test } from '../../../shared/models/test.model';
import { MetodoCalificacion } from '../../../shared/models/user.model';
import { SharedGridComponent } from '../../../shared/shared-grid/shared-grid.component';
import { AppState } from '../../../store/app.state';
import { selectUserMetodoCalificacion } from '../../../store/user/user.selectors';
import {
    calcular100,
    calcular50,
    calcular75,
    getAllInArrays,
    getStats,
    obtenerTemas,
    obtenerTipoDeTest,
} from '../../../utils/utils';

@Component({
  selector: 'app-test-stats-grid',
  templateUrl: './test-stats-grid.component.html',
  styleUrl: './test-stats-grid.component.scss',
})
export class TestStatsGridComponent extends SharedGridComponent<
  Test | FlashcardTest
> {
  es = {
    firstDayOfWeek: 1,
    dayNames: [
      'domingo',
      'lunes',
      'martes',
      'miércoles',
      'jueves',
      'viernes',
      'sábado',
    ],
    dayNamesShort: ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'],
    dayNamesMin: ['D', 'L', 'M', 'X', 'J', 'V', 'S'],
    monthNames: [
      'enero',
      'febrero',
      'marzo',
      'abril',
      'mayo',
      'junio',
      'julio',
      'agosto',
      'septiembre',
      'octubre',
      'noviembre',
      'diciembre',
    ],
    monthNamesShort: [
      'ene',
      'feb',
      'mar',
      'abr',
      'may',
      'jun',
      'jul',
      'ago',
      'sep',
      'oct',
      'nov',
      'dic',
    ],
    today: 'Hoy',
    clear: 'Borrar',
    dateFormat: 'dd/mm/yy',
    weekHeader: 'Sm',
  };
  testService = inject(TestService);
  flashcardsService = inject(FlashcardDataService);
  activatedRoute = inject(ActivatedRoute);
  store = inject(Store<AppState>);

  // Selector para obtener el método de calificación del usuario
  userMetodoCalificacion$ = this.store.select(selectUserMetodoCalificacion);
  public type: 'TESTS' | 'FLASHCARDS' = 'TESTS';
  public expectedRole: 'ADMIN' | 'ALUMNO' = 'ALUMNO';
  public displayOnlyExamen = false;
  public generandoEstadistica = false;
  selectedTestId: number | null = null;
  selectedTest: Test | null = null;

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
      filterInterpolation: (value) => this.getWhereQuery(value),
    },
  ];

  // Variable para almacenar el método actual
  private currentMetodoCalificacion: MetodoCalificacion =
    MetodoCalificacion.A1_E1_3_B0;

  constructor(private primengConfig: PrimeNGConfig) {
    super();
    this.primengConfig.setTranslation(this.es);

    // Suscribirse al método de calificación del usuario
    this.userMetodoCalificacion$.subscribe((metodo) => {
      this.currentMetodoCalificacion = metodo;
    });

    combineLatest([
      this.activatedRoute.queryParams,
      this.activatedRoute.data.pipe(filter((e) => !!e)),
    ]).subscribe(([queryParams, data]) => {
      this.displayOnlyExamen = queryParams['onlyExamen'] === 'true';
      this.fetchItems$ = computed(() => {
        const { expectedRole, type } = data;
        this.type = type;
        this.expectedRole = expectedRole;
        const pagination = this.getPaginationFilter(
          this.displayOnlyExamen,
          this.pagination()
        );
        if (this.type == 'FLASHCARDS') {
          if (this.expectedRole == 'ADMIN') {
            return this.flashcardsService
              .getTestsAdmin$(pagination)
              .pipe(tap((entry) => (this.lastLoadedPagination = entry)));
          } else {
            return this.flashcardsService
              .getTestsAlumno$(pagination)
              .pipe(tap((entry) => (this.lastLoadedPagination = entry)));
          }
        } else {
          if (this.expectedRole == 'ADMIN') {
            return this.testService
              .getTestsAdmin$(pagination)
              .pipe(tap((entry) => (this.lastLoadedPagination = entry)));
          } else {
            return this.testService
              .getTestsAlumno$(pagination)
              .pipe(tap((entry) => (this.lastLoadedPagination = entry)));
          }
        }
      });
    });
  }

  public calcular100 = (rawStats: any, numPreguntas: number) => {
    const statsParsed = getStats(rawStats);
    return calcular100(
      statsParsed.stats100,
      numPreguntas,
      this.currentMetodoCalificacion
    );
  };

  public calcular75 = (rawStats: any, numPreguntas: number) => {
    const statsParsed = getStats(rawStats);
    return calcular75(
      statsParsed.stats75,
      numPreguntas,
      this.currentMetodoCalificacion
    );
  };

  public calcular50 = (rawStats: any, numPreguntas: number) => {
    const statsParsed = getStats(rawStats);
    return calcular50(
      statsParsed.stats50,
      numPreguntas,
      this.currentMetodoCalificacion
    );
  };



  private whereQueryTests(ids: Array<string>) {
    return {
      testPreguntas: {
        some: {
          pregunta: {
            temaId: {
              in: ids,
            },
          },
        },
      },
    };
  }

  private whereQueryFlashcards(ids: Array<string>) {
    return {
      flashcards: {
        some: {
          flashcard: {
            temaId: {
              in: ids,
            },
          },
        },
      },
    };
  }

  private getWhereQuery(ids: Array<string>) {
    return this.type == 'TESTS'
      ? this.whereQueryTests(ids)
      : this.whereQueryFlashcards(ids);
  }

  private getPaginationFilter(
    onlyExamen: boolean,
    pagination: PaginationFilter
  ) {
    let extra = {};
    if (this.type == 'TESTS') {
      if (onlyExamen) {
        extra = { ExamenRealizado: { isNot: null } };
      } else {
        extra = { ExamenRealizado: { is: null } };
      }
    }

    const newPagination = {
      ...pagination,
      where: {
        ...pagination.where,
        ...extra,
      },
    };
    return newPagination;
  }

  public obtenerTipoDeTest = obtenerTipoDeTest;
  public obtenerTemas = obtenerTemas;

  public viewStats = (id: number | 'new') => {
    const item = (this.lastLoadedPagination?.data || []).find(
      (test) => test.id === id
    );
    const isExamenTest =
      item && 'ExamenRealizado' in item && !!item.ExamenRealizado;

    if (isExamenTest) {
      this.selectedTestId = id as number;
      this.selectedTest = item;
    } else {
      this.navigateToStats(id);
    }
  };

  public navigateToStats(id: number | null | 'new') {
    const map = {
      ADMIN: {
        TESTS: '/app/test/stats-test/',
        FLASHCARDS: '/app/test/stats-test-flashcard/',
      },
      ALUMNO: {
        TESTS: '/app/test/alumno/stats-test/',
        FLASHCARDS: '/app/test/alumno/stats-test-flashcard/',
      },
    };
    const path = (map as any)[this.expectedRole][this.type];
    this.router.navigate([path + id], {
      queryParams: {
        goBack: true,
      },
    });
  }

  public navigateToResponses(id: number | null) {
    const map = {
      ADMIN: {
        TESTS: '/app/test/realizar-test/modo-ver-respuestas/',
        FLASHCARDS: '/app/test/realizar-flash-cards-test/modo-ver-respuestas/',
      },
      ALUMNO: {
        TESTS: '/app/test/alumno/realizar-test/modo-ver-respuestas/',
        FLASHCARDS:
          '/app/test/alumno/realizar-flash-cards-test/modo-ver-respuestas/',
      },
    };
    const path = (map as any)[this.expectedRole][this.type];
    this.router.navigate([path + id], {
      queryParams: {
        goBack: true,
      },
    });
  }

  public generarEstadisticas() {
    // Obtener los valores de los filtros del GenericListComponent
    const filters = this.pagination().where || {};
    const from = filters.createdAt?.gte || new Date();
    const to = filters.createdAt?.lte || new Date();
    const temas = flattenDeep(
      getAllInArrays(filters.testPreguntas ?? filters.flashcards)
    );

    const map = {
      ADMIN: {
        TESTS: '/app/test/full-stats-test/',
        FLASHCARDS: '/app/test/full-stats-flashcard/',
      },
      ALUMNO: {
        TESTS: '/app/test/alumno/full-stats-test/',
        FLASHCARDS: '/app/test/alumno/full-stats-flashcard/',
      },
    };
    const path = (map as any)[this.expectedRole][this.type];
    this.router.navigate([path], {
      queryParams: {
        from: from.toISOString(),
        to: to.toISOString(),
        ...(temas?.length ? { temas: temas.join(',') } : {}),
      },
    });
  }

  public onFiltersChanged(where: any) {
    // Actualizar la paginación con los nuevos filtros
    this.pagination.set({
      ...this.pagination(),
      where: where,
      skip: 0, // Resetear a la primera página cuando cambian los filtros
    });
  }
}
