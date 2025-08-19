import { Location } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { tap } from 'rxjs';
import { TestService } from '../../../services/test.service';
import { SeguridadAlResponder } from '../../../shared/models/pregunta.model';
import { Test } from '../../../shared/models/test.model';
import { MetodoCalificacion } from '../../../shared/models/user.model';
import { AppState } from '../../../store/app.state';
import { selectUserMetodoCalificacion } from '../../../store/user/user.selectors';
import { calcular100, calcular100y75, calcular100y75y50, getStats } from '../../../utils/utils';
@Component({
  selector: 'app-test-stats',
  templateUrl: './test-stats.component.html',
  styleUrl: './test-stats.component.scss',
})
export class TestStatsComponent {
  testService = inject(TestService);
  activedRoute = inject(ActivatedRoute);
  router = inject(Router);
  location = inject(Location);
  store = inject(Store<AppState>);
  
  // Selector para obtener el método de calificación del usuario
  userMetodoCalificacion$ = this.store.select(selectUserMetodoCalificacion);
  public getId() {
    return this.activedRoute.snapshot.paramMap.get('id') as string;
  }
  public goBack() {
    return this.activedRoute.snapshot.queryParamMap.get('goBack') === 'true';
  }
  public test$ = this.testService
    .getTestById(Number(this.getId()))
    .pipe(tap((test) => (this.lastLoadedTest = test)));
  public stats$ = this.testService
    .getStats(Number(this.getId()))
    .pipe(tap((entry) => (this.lastLoadedStats = entry)));
  private lastLoadedStats!: any;
  private lastLoadedTest!: Test;
  public seguridad = SeguridadAlResponder;
  
  // Variable para almacenar el método actual
  private currentMetodoCalificacion: MetodoCalificacion = MetodoCalificacion.A1_E1_3_B0;

  constructor() {
    // Suscribirse al método de calificación del usuario
    this.userMetodoCalificacion$.subscribe(metodo => {
      this.currentMetodoCalificacion = metodo;
    });
  }

  public calcular100() {
    if (!this.lastLoadedStats || !this.lastLoadedTest) return 0;
    const { stats100 } = getStats(this.lastLoadedStats);
    return calcular100(stats100, this.lastLoadedTest.preguntas.length, this.currentMetodoCalificacion);
  }

  public calcular100y75() {
    if (!this.lastLoadedStats || !this.lastLoadedTest) return 0;
    const { stats100, stats75 } = getStats(this.lastLoadedStats);
    return calcular100y75(stats100, stats75, this.lastLoadedTest.preguntas.length, this.currentMetodoCalificacion);
  }

  public calcular100y75y50() {
    if (!this.lastLoadedStats || !this.lastLoadedTest) return 0;
    const { stats100, stats75, stats50 } = getStats(this.lastLoadedStats);
    return calcular100y75y50(stats100, stats75, stats50, this.lastLoadedTest.preguntas.length, this.currentMetodoCalificacion);
  }

  public handleBackButton() {
    if (this.goBack()) {
      this.location.back();
    } else {
      this.router.navigate(['/app/test/alumno/realizar-test']);
    }
  }
}
