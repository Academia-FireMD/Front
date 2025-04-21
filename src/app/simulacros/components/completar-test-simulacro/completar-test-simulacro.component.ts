import { Location } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { firstValueFrom } from 'rxjs';
import { ExamenesService } from '../../../examen/servicios/examen.service';
import { TestService } from '../../../services/test.service';
@Component({
  selector: 'app-completar-test-simulacro',
  templateUrl: './completar-test-simulacro.component.html',
  styleUrl: './completar-test-simulacro.component.scss'
})
export class CompletarTestSimulacroComponent {
  activedRoute = inject(ActivatedRoute);
  router = inject(Router);
  toastr = inject(ToastrService);
  examenService = inject(ExamenesService);
  testExamenService = inject(TestService);

  public idExamen: number | null = null;
  public idTest: number | null = null;
  public loading: boolean = true;
  public error: boolean = false;

  constructor(public location: Location) {
    this.loadRouteData();
  }

  private async loadRouteData() {
    try {
      const { idExamen, idTest } = await firstValueFrom(this.activedRoute.params);

      if (!idExamen || !idTest) {
        this.error = true;
        this.loading = false;
        this.toastr.error('Parámetros de ruta inválidos', 'Error');
        return;
      }

      this.idExamen = Number(idExamen);
      this.idTest = Number(idTest);


      await firstValueFrom(this.testExamenService.getTestById(this.idTest))
      this.loading = false;
    } catch (error) {
      console.error('Error al cargar los datos de la ruta:', error);
      this.error = true;
      this.loading = false;
      this.toastr.error('No se pudieron cargar los datos del simulacro', 'Error');
    }
  }

  // Método que será llamado cuando el test se complete
  public onTestCompleted(event: any): void {
    // Aquí puedes manejar la finalización del test
    console.log('Test completado:', event);

    // Redireccionar a la página de resultados del simulacro
    this.router.navigate(['/simulacros/resultado', this.idExamen, this.idTest]);
  }
}
