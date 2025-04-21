import { Location } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { catchError, finalize, firstValueFrom, of } from 'rxjs';
import { ExamenesService } from '../../../examen/servicios/examen.service';
import { AuthService } from '../../../services/auth.service';
@Component({
  selector: 'app-resultado-simulacro',
  templateUrl: './resultado-simulacro.component.html',
  styleUrl: './resultado-simulacro.component.scss'
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
  public isAdmin: boolean = false;

  ngOnInit(): void {
    this.loadRouteData();
    this.isAdmin = this.authService.getCurrentUser()?.rol === 'ADMIN';
  }

  private async loadRouteData() {
    try {
      const { idExamen, idTest } = await firstValueFrom(this.activedRoute.params);

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
      this.toastr.error('No se pudieron cargar los datos del simulacro', 'Error');
    }
  }

  private async loadResultados() {
    if (!this.idExamen) return;

    this.examenService.getSimulacroResultados$(this.idExamen)
      .pipe(
        catchError(err => {
          console.error('Error al cargar los resultados:', err);
          this.error = true;
          this.errorMessage = err.error?.message || 'Error al cargar los resultados';
          this.toastr.error(this.errorMessage, 'Error');
          return of(null);
        }),
        finalize(() => {
          this.loading = false;
        })
      )
      .subscribe(data => {
        if (!data) return;

        this.examen = data.examen;
        this.resultados = data.resultados;
        this.miPosicion = data.miPosicion;
        this.totalParticipantes = data.totalParticipantes;

        // Encontrar mi resultado
        this.miResultado = this.resultados.find(r => r.usuario.esTuResultado);
      });
  }

  public getColorClass(posicion: number): string {
    if (posicion === 1) return 'first-place';
    if (posicion === 2) return 'second-place';
    if (posicion === 3) return 'third-place';
    return '';
  }

  public getNotaClass(nota: number | null): string {
    if (nota === null) return 'nota-na';
    if (nota >= 9) return 'nota-excelente';
    if (nota >= 7) return 'nota-notable';
    if (nota >= 5) return 'nota-aprobado';
    return 'nota-suspenso';
  }

  public volver(): void {
    this.router.navigate(['/auth/login']);
  }

  public verDetalles(testId: number): void {
    this.router.navigate(['/app/test/alumno/stats-test', testId]);
  }
}
