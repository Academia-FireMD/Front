import { Component, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { PrimeNGConfig } from 'primeng/api';
import { filter, of, switchMap, tap } from 'rxjs';
import { FlashcardDataService } from '../../../services/flashcards.service';
import { TestService } from '../../../services/test.service';
import { FlashcardTest } from '../../../shared/models/flashcard.model';
import { Test } from '../../../shared/models/test.model';
import { SharedGridComponent } from '../../../shared/shared-grid/shared-grid.component';
import {
  calcular100,
  calcular100y50,
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
  router = inject(Router);
  public type: 'TESTS' | 'FLASHCARDS' = 'TESTS';
  public expectedRole: 'ADMIN' | 'ALUMNO' = 'ALUMNO';
  selectedRangeDates = new FormControl([], Validators.required);
  public generandoEstadistica = false;

  public calcular100 = (rawStats: any, numPreguntas: number) => {
    const statsParsed = getStats(rawStats);
    return calcular100(statsParsed.stats100, numPreguntas);
  };

  public calcular100y50 = (rawStats: any, numPreguntas: number) => {
    const statsParsed = getStats(rawStats);
    return calcular100y50(
      statsParsed.stats100,
      statsParsed.stats50,
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
  constructor(private primengConfig: PrimeNGConfig) {
    super();
    this.primengConfig.setTranslation(this.es);
    this.activatedRoute.data
      .pipe(
        filter((e) => !!e),
        switchMap((e) => {
          this.fetchItems$ = computed(() => {
            const { expectedRole, type } = e;
            this.type = type;
            this.expectedRole = expectedRole;
            if (this.type == 'FLASHCARDS') {
              if (this.expectedRole == 'ADMIN') {
                return this.flashcardsService
                  .getTestsAdmin$(this.pagination())
                  .pipe(tap((entry) => (this.lastLoadedPagination = entry)));
              } else {
                return this.flashcardsService
                  .getTestsAlumno$(this.pagination())
                  .pipe(tap((entry) => (this.lastLoadedPagination = entry)));
              }
            } else {
              if (this.expectedRole == 'ADMIN') {
                return this.testService
                  .getTestsAdmin$(this.pagination())
                  .pipe(tap((entry) => (this.lastLoadedPagination = entry)));
              } else {
                return this.testService
                  .getTestsAlumno$(this.pagination())
                  .pipe(tap((entry) => (this.lastLoadedPagination = entry)));
              }
            }
          });
          return of(e);
        })
      )
      .pipe(takeUntilDestroyed())
      .subscribe();
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
              },
            });
          } else {
            this.pagination.set({
              ...this.pagination(),
              where: {},
            });
          }
        }),
        takeUntilDestroyed()
      )
      .subscribe();
  }

  public obtenerTipoDeTest = obtenerTipoDeTest;
  public obtenerTemas = obtenerTemas;

  public viewStats = (id: number | 'new') => {
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
  };

  public generarEstadisticas() {
    const from = ((this.selectedRangeDates.value as any)[0] ??
      new Date()) as Date;
    const to = ((this.selectedRangeDates.value as any)[1] ??
      new Date()) as Date;
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
      },
    });
  }
}
