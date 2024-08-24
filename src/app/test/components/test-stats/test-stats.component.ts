import { Location } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Memoize } from 'lodash-decorators';
import { TestService } from '../../../services/test.service';
import { SeguridadAlResponder } from '../../../shared/models/pregunta.model';
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
  public getId() {
    return this.activedRoute.snapshot.paramMap.get('id') as string;
  }
  public goBack() {
    return this.activedRoute.snapshot.queryParamMap.get('goBack') === 'true';
  }
  public test$ = this.testService.getTestById(Number(this.getId()));
  public stats$ = this.testService.getStats(Number(this.getId()));
  public seguridad = SeguridadAlResponder;
  @Memoize()
  getDataFromSeguridad(seguridad: SeguridadAlResponder, data: any) {
    const dataParsed = data.seguridad[seguridad] as {
      correctas: number;
      incorrectas: number;
    };
    return {
      labels: ['Correctas', 'Incorrectas'],
      datasets: [
        {
          data: [dataParsed.correctas, dataParsed.incorrectas],
          backgroundColor: ['#00eb003d', '#ff9c9c'],
        },
      ],
    };
  }

  public handleBackButton() {
    if (this.goBack()) {
      this.location.back();
    } else {
      this.router.navigate(['/app/test/alumno/realizar-test']);
    }
  }
}
