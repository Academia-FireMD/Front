import { Component, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { PrimeNGConfig } from 'primeng/api';
import { combineLatest, filter, tap } from 'rxjs';
import { FlashcardDataService } from '../../../services/flashcards.service';
import { TestService } from '../../../services/test.service';
import { FlashcardTest } from '../../../shared/models/flashcard.model';
import { PaginationFilter } from '../../../shared/models/pagination.model';
import { Test } from '../../../shared/models/test.model';
import { SharedGridComponent } from '../../../shared/shared-grid/shared-grid.component';
import {
  calcular100,
  calcular100y75,
  calcular100y75y50,
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
  public type: 'TESTS' | 'FLASHCARDS' = 'TESTS';
  public expectedRole: 'ADMIN' | 'ALUMNO' = 'ALUMNO';
  selectedRangeDates = new FormControl([], Validators.required);
  public temas = new FormControl<string[] | null>([], Validators.required);
  public displayOnlyExamen = false;
  public generandoEstadistica = false;
  showOptionsDialog = false;
  selectedTestId: number | null = null;
  selectedTest: Test | null = null;

  public calcular100 = (rawStats: any, numPreguntas: number) => {
    const statsParsed = getStats(rawStats);
    return calcular100(statsParsed.stats100, numPreguntas);
  };

  public calcular100y75 = (rawStats: any, numPreguntas: number) => {
    const statsParsed = getStats(rawStats);
    return calcular100y75(
      statsParsed.stats100,
      statsParsed.stats75,
      numPreguntas
    );
  };
  public calcular100y75y50 = (rawStats: any, numPreguntas: number) => {
    const statsParsed = getStats(rawStats);
    return calcular100y75y50(
      statsParsed.stats100,
      statsParsed.stats75,
      statsParsed.stats50,
      numPreguntas
    );
  };

  private whereQueryTests(ids: Array<string>) {
    return {
      testPreguntas: {
        some: {
          pregunta: {
            temaId: {
              in: ids
            }
          }
        }
      }
    }
  }

  private whereQueryFlashcards(ids: Array<string>) {
    return {
      flashcards: {
        some: {
          flashcard: {
            temaId: {
              in: ids
            }
          }
        }
      }
    }
  }

  private getWhereQuery() {
    return this.type == 'TESTS' ? this.whereQueryTests : this.whereQueryFlashcards;
  }

  private getPaginationFilter(onlyExamen: boolean, pagination: PaginationFilter) {
    const newPagination = {
      ...pagination,
      where: {
        ...pagination.where,
        ...(onlyExamen ? { ExamenRealizado: { isNot: null } } : {ExamenRealizado: { is: null }}),
      },
    }
    return newPagination;
  }

  constructor(private primengConfig: PrimeNGConfig) {
    super();
    this.primengConfig.setTranslation(this.es);
    combineLatest([
      this.activatedRoute.queryParams,
      this.activatedRoute.data.pipe(filter((e) => !!e))
    ]).subscribe(([queryParams, data]) => {
      this.displayOnlyExamen = queryParams['onlyExamen'] === 'true';
      this.fetchItems$ = computed(() => {
        const pagination = this.getPaginationFilter(this.displayOnlyExamen, this.pagination());
        const { expectedRole, type } = data;
        this.type = type;
        this.expectedRole = expectedRole;
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

    this.selectedRangeDates.valueChanges
      .pipe(
        tap((entry: any) => {
          if (entry) {
            this.pagination.set({
              ...this.pagination(),
              where: {
                createdAt: {
                  gte: entry[0] ?? new Date(),
                  lte: entry[1] ?? new Date(),
                },
                ...(this.temas.value?.length ? this.getWhereQuery()(this.temas.value) : {}),
              },
            });
          } else {
            this.pagination.set({
              ...this.pagination(),
              where: {
                ...(this.temas.value?.length ? this.getWhereQuery()(this.temas.value) : {}),
              },
            });
          }
        }),
        takeUntilDestroyed()
      )
      .subscribe();

    this.temas.valueChanges
      .pipe(
        tap((selectedTemas: string[] | null) => {
          this.pagination.set({
            ...this.pagination(),
            where: {
              ...this.pagination().where,
              ...(selectedTemas?.length ? this.getWhereQuery()(selectedTemas) : {}),
            },
          });
        }),
        takeUntilDestroyed()
      )
      .subscribe();
  }

  public obtenerTipoDeTest = obtenerTipoDeTest;
  public obtenerTemas = obtenerTemas;

  public viewStats = (id: number | 'new') => {
    const item = (this.lastLoadedPagination?.data || []).find(test => test.id === id);
    const isExamenTest = item && 'ExamenRealizado' in item && !!item.ExamenRealizado;

    if (isExamenTest) {
      this.selectedTestId = id as number;
      this.selectedTest = item;
      this.showOptionsDialog = true;
    } else {
      this.navigateToStats(id);
    }
  };

  public canViewResponses(): boolean {
    if (!this.selectedTest?.ExamenRealizado || !this.selectedTest.ExamenRealizado?.fechaSolucion) {
      return true;
    }

    const fechaSolucion = new Date(this.selectedTest.ExamenRealizado?.fechaSolucion);
    const now = new Date();

    return now >= fechaSolucion;
  }

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
        FLASHCARDS: '/app/test/alumno/realizar-flash-cards-test/modo-ver-respuestas/',
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
    const from = ((this.selectedRangeDates.value as any)[0] ?? new Date()) as Date;
    const to = ((this.selectedRangeDates.value as any)[1] ?? new Date()) as Date;
    const temas = this.temas.value;

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
}
