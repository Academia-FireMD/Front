import { CommonModule, Location } from '@angular/common';
import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Store } from '@ngrx/store';
import { ToastrModule, ToastrService } from 'ngx-toastr';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TableModule } from 'primeng/table';
import { catchError, finalize, firstValueFrom, of } from 'rxjs';
import { ExamenesService } from '../../../examen/servicios/examen.service';
import { AuthService } from '../../../services/auth.service';
import { ConfidenceAnalysis } from '../../../shared/components/confidence-analysis-cards/confidence-analysis-cards.component';
import { KpiStat } from '../../../shared/components/kpi-stats-cards/kpi-stats-cards.component';
import { MetodoCalificacion } from '../../../shared/models/user.model';
import { PrimengModule } from '../../../shared/primeng.module';
import { SharedModule } from '../../../shared/shared.module';
import { AppState } from '../../../store/app.state';
import { selectUserMetodoCalificacion } from '../../../store/user/user.selectors';
import { calcular100, calcular100y50, calcular100y75y50, createConfidenceAnalysisForResult, getColorClass, getNotaClass } from '../../../utils/utils';
@Component({
  selector: 'app-resultado-simulacro',
  templateUrl: './resultado-simulacro.component.html',
  styleUrl: './resultado-simulacro.component.scss',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ToastrModule,
    SharedModule,
    PrimengModule,
    TableModule,
    ProgressSpinnerModule,
  ],
})
export class ResultadoSimulacroComponent implements OnInit {
  activedRoute = inject(ActivatedRoute);
  router = inject(Router);
  toastr = inject(ToastrService);
  examenService = inject(ExamenesService);
  authService = inject(AuthService);
  location = inject(Location);
  cdr = inject(ChangeDetectorRef);
  store = inject(Store<AppState>);

  public idExamen: number | null = null;
  public idTest: number | null = null;
  public loading: boolean = true;
  public error: boolean = false;
  public errorMessage: string = '';

  public resultados: any[] = [];
  public examen: any = null;
  public miPosicion: number | null = null;
  public totalParticipantes: number = 0;
  public miResultado: any = null;
  public ultimoIntento: any = null;
  public isAdmin: boolean = false;
  public ocultarVolver: boolean = false;
  public showIndividualConfidenceMi: boolean = false;
  public showIndividualConfidenceUltimo: boolean = false;
  public showIndividualConfidenceByUserId: { [key: string]: boolean } = {};

  // Selector para obtener el método de calificación del usuario
  userMetodoCalificacion$ = this.store.select(selectUserMetodoCalificacion);
  // Variable para almacenar el método actual
  private currentMetodoCalificacion: MetodoCalificacion = MetodoCalificacion.A1_E1_3_B0;

  getColorClass = getColorClass;
  getNotaClass = getNotaClass;

  ngOnInit(): void {
    // Suscribirse al método de calificación del usuario
    this.userMetodoCalificacion$.subscribe(metodo => {
      this.currentMetodoCalificacion = metodo;
    });

    this.loadRouteData();
    this.isAdmin = this.authService.getCurrentUser()?.rol === 'ADMIN';
  }

  private async loadRouteData() {
    try {
      const { idExamen, idTest } = await firstValueFrom(
        this.activedRoute.params
      );
      const { ocultarVolver } = await firstValueFrom(this.activedRoute.data);
      this.ocultarVolver = !!ocultarVolver;
      if (!idExamen || !idTest) {
        this.error = true;
        this.errorMessage = 'Parámetros de ruta inválidos';
        this.loading = false;
        this.toastr.error('Parámetros de ruta inválidos', 'Error');
        return;
      }

      this.idExamen = Number(idExamen);
      this.idTest = Number(idTest);

      await this.loadResultados();
    } catch (error) {
      console.error('Error al cargar los datos de la ruta:', error);
      this.error = true;
      this.errorMessage = 'No se pudieron cargar los datos del simulacro';
      this.loading = false;
      this.toastr.error(
        'No se pudieron cargar los datos del simulacro',
        'Error'
      );
    }
  }

  private async loadResultados() {
    if (!this.idExamen) return;

    this.examenService
      .getSimulacroResultados$(this.idExamen)
      .pipe(
        catchError((err) => {
          console.error('Error al cargar los resultados:', err);
          this.error = true;
          this.errorMessage =
            err.error?.message || 'Error al cargar los resultados';
          this.toastr.error(this.errorMessage, 'Error');
          return of(null);
        }),
        finalize(() => {
          this.loading = false;
        })
      )
      .subscribe((data) => {
        if (!data) return;

        this.examen = data.examen;
        this.resultados = data.resultados;
        this.miPosicion = data.miPosicion;
        this.totalParticipantes = data.totalParticipantes;
        this.ultimoIntento = data.ultimoIntento;

        // Encontrar mi resultado (primer intento)
        this.miResultado = this.resultados.find((r) => r.usuario.esTuResultado);
      });
  }



  public goBack() {
    return this.activedRoute.snapshot.queryParamMap.get('goBack') === 'true';
  }

  public volver(): void {
    if (this.goBack()) {
      this.location.back();
    } else {
      this.router.navigate(['/auth/login']);
    }
  }

  public verDetalles(testId: number): void {
    this.router.navigate(['/app/test/alumno/stats-test', testId]);
  }

  public verRespuestas(testId: number): void {
    this.router.navigate(
      ['/app/test/alumno/realizar-test/modo-ver-respuestas/' + testId],
      {
        queryParams: {
          goBack: true,
        },
      }
    );
  }

  // Métodos para el desplegable de análisis de confianza
  public expandedRowKeys: { [key: string]: boolean } = {};

  toggleRowExpansion(resultado: any): void {
    const key = resultado.usuario.id.toString();

    // Alternar el estado de expansión de esta fila específica
    if (this.expandedRowKeys[key]) {
      // Crear nuevo objeto sin esta key para forzar detección de cambios
      const newExpandedRowKeys = { ...this.expandedRowKeys };
      delete newExpandedRowKeys[key];
      this.expandedRowKeys = newExpandedRowKeys;
    } else {
      // Crear nuevo objeto agregando esta key para forzar detección de cambios
      this.expandedRowKeys = { ...this.expandedRowKeys, [key]: true };

      // Forzar detección de cambios y redimensionado de gráficos
      this.cdr.detectChanges();

      // Múltiples timeouts para asegurar que los gráficos se rendericen correctamente
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 50);

      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 200);

      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 500);
    }
  }

  getConfidenceAnalysisForResult(seguridad: any): ConfidenceAnalysis[] {
    return createConfidenceAnalysisForResult(
      seguridad,
      this.currentMetodoCalificacion,
      this.getTotalPreguntasPorSeguridad.bind(this),
      this.getCorrectas.bind(this),
      this.getIncorrectas.bind(this),
      this.getNoContestadas.bind(this),
      this.getAccuracyPercentage.bind(this)
    );
  }

  getKpiStatsForResult(estadisticas: any): KpiStat[] {
    if (!estadisticas) return [];

    const noContestadas = estadisticas.totalPreguntas - estadisticas.correctas - estadisticas.incorrectas;

    return [
      {
        value: estadisticas.correctas,
        label: 'Correctas',
        type: 'correctas',
        icon: 'pi-check'
      },
      {
        value: estadisticas.incorrectas,
        label: 'Incorrectas',
        type: 'incorrectas',
        icon: 'pi-times'
      },
      {
        value: noContestadas,
        label: 'No contestadas',
        type: 'no-contestadas',
        icon: 'pi-minus'
      }
    ];
  }

  // Helpers combinados
  private getCombinedCorrects(stats: any, tipos: string[]): number {
    if (!stats?.seguridad) return 0;
    return tipos.reduce((total, tipo) => {
      return total + (stats.seguridad[tipo]?.correctas || 0);
    }, 0);
  }

  private getCombinedIncorrects(stats: any, tipos: string[]): number {
    if (!stats?.seguridad) return 0;
    return tipos.reduce((total, tipo) => {
      return total + (stats.seguridad[tipo]?.incorrectas || 0);
    }, 0);
  }

  private getCombinedNoAnswered(stats: any, tipos: string[]): number {
    if (!stats?.seguridad) return 0;
    return tipos.reduce((total, tipo) => {
      return total + (stats.seguridad[tipo]?.noRespondidas || 0);
    }, 0);
  }

  private getCombinedTotal(stats: any, tipos: string[]): number {
    return (
      this.getCombinedCorrects(stats, tipos) +
      this.getCombinedIncorrects(stats, tipos) +
      this.getCombinedNoAnswered(stats, tipos)
    );
  }

  private getCombinedAccuracy(stats: any, tipos: string[]): number {
    const total = this.getCombinedTotal(stats, tipos);
    if (total === 0) return 0;
    const correctas = this.getCombinedCorrects(stats, tipos);
    return Math.round((correctas / total) * 100);
  }

  public getCombinedConfidenceAnalysisFromSecurity(seguridad: any, totalPreguntas: number): ConfidenceAnalysis[] {
    if (!seguridad) return [];

    const stats100 = {
      correctas: this.getCorrectas({ seguridad }, 'CIEN_POR_CIENTO'),
      incorrectas: this.getIncorrectas({ seguridad }, 'CIEN_POR_CIENTO'),
    };
    const stats75 = {
      correctas: this.getCorrectas({ seguridad }, 'SETENTA_Y_CINCO_POR_CIENTO'),
      incorrectas: this.getIncorrectas({ seguridad }, 'SETENTA_Y_CINCO_POR_CIENTO'),
    };
    const stats50 = {
      correctas: this.getCorrectas({ seguridad }, 'CINCUENTA_POR_CIENTO'),
      incorrectas: this.getIncorrectas({ seguridad }, 'CINCUENTA_POR_CIENTO'),
    };

    const combinations = [
      {
        id: 'only-100',
        title: 'Solo 100% Seguro',
        icon: '⭐',
        tipos: ['CIEN_POR_CIENTO'],
        score: calcular100(stats100 as any, totalPreguntas, this.currentMetodoCalificacion),
      },
      {
        id: 'combined-100-50',
        title: '100% + 50% Seguro',
        icon: '🎯',
        tipos: ['CIEN_POR_CIENTO', 'CINCUENTA_POR_CIENTO'],
        score: calcular100y50(stats100 as any, stats50 as any, totalPreguntas, this.currentMetodoCalificacion),
      },
      {
        id: 'combined-100-75-50',
        title: '100% + 75% + 50% Seguro',
        icon: '📈',
        tipos: ['CIEN_POR_CIENTO', 'SETENTA_Y_CINCO_POR_CIENTO', 'CINCUENTA_POR_CIENTO'],
        score: calcular100y75y50(stats100 as any, stats75 as any, stats50 as any, totalPreguntas, this.currentMetodoCalificacion),
      },
    ];

    return combinations.map((c) => ({
      id: c.id,
      title: c.title,
      icon: c.icon,
      score: c.score,
      totalPreguntas: this.getCombinedTotal({ seguridad }, c.tipos),
      correctas: this.getCombinedCorrects({ seguridad }, c.tipos),
      incorrectas: this.getCombinedIncorrects({ seguridad }, c.tipos),
      noContestadas: this.getCombinedNoAnswered({ seguridad }, c.tipos),
      accuracyPercentage: this.getCombinedAccuracy({ seguridad }, c.tipos),
    }));
  }

  private getTotalPreguntas(stats: any): number {
    if (!stats?.seguridad) return 0;
    return Object.values(stats.seguridad).reduce((total: number, seguridad: any) => {
      return total + (seguridad.correctas || 0) + (seguridad.incorrectas || 0) + (seguridad.noRespondidas || 0);
    }, 0);
  }

  private getTotalPreguntasPorSeguridad(stats: any, tipoSeguridad: string): number {
    if (!stats?.seguridad?.[tipoSeguridad]) return 0;
    const seguridad = stats.seguridad[tipoSeguridad];
    return (seguridad.correctas || 0) + (seguridad.incorrectas || 0) + (seguridad.noRespondidas || 0);
  }

  private getCorrectas(stats: any, tipoSeguridad: string): number {
    return stats?.seguridad?.[tipoSeguridad]?.correctas || 0;
  }

  private getIncorrectas(stats: any, tipoSeguridad: string): number {
    return stats?.seguridad?.[tipoSeguridad]?.incorrectas || 0;
  }

  private getNoContestadas(stats: any, tipoSeguridad: string): number {
    return stats?.seguridad?.[tipoSeguridad]?.noRespondidas || 0;
  }

  private getAccuracyPercentage(stats: any, tipoSeguridad: string): number {
    const total = this.getTotalPreguntasPorSeguridad(stats, tipoSeguridad);
    if (total === 0) return 0;
    const correctas = this.getCorrectas(stats, tipoSeguridad);
    return Math.round((correctas / total) * 100);
  }
}
