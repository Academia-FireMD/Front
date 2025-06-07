import { CommonModule, DatePipe, Location } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ToastrModule, ToastrService } from 'ngx-toastr';
import { catchError, finalize, firstValueFrom, of } from 'rxjs';
import { ExamenesService } from '../../../examen/servicios/examen.service';
import { AuthService } from '../../../services/auth.service';
import { SharedModule } from '../../../shared/shared.module';
import { TableModule } from 'primeng/table';
import { PrimengModule } from '../../../shared/primeng.module';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { getColorClass, getNotaClass } from '../../../utils/utils';
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

  getColorClass = getColorClass;
  getNotaClass = getNotaClass;

  ngOnInit(): void {
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
}
