import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { catchError, finalize, of } from 'rxjs';
import { DueloService, MiDuelo } from '../../../services/duelo.service';
import { PrimengModule } from '../../../shared/primeng.module';
import { getNotaClass } from '../../../utils/utils';

/**
 * "Mis desafíos": lista de los duelos del alumno (creados y participados) desde
 * la que puede volver a la clasificación de cada uno. Los datos vienen de
 * `GET /duelos/mios`. Standalone; se carga por `loadComponent` en las rutas de
 * alumno del módulo test.
 */
@Component({
  selector: 'app-mis-desafios',
  templateUrl: './mis-desafios.component.html',
  styleUrl: './mis-desafios.component.scss',
  standalone: true,
  imports: [CommonModule, RouterModule, PrimengModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MisDesafiosComponent implements OnInit {
  private dueloService = inject(DueloService);
  private router = inject(Router);

  public readonly duelos = signal<MiDuelo[]>([]);
  public readonly loading = signal<boolean>(true);
  public readonly error = signal<boolean>(false);

  public readonly getNotaClass = getNotaClass;

  public ngOnInit(): void {
    this.cargarDuelos();
  }

  public cargarDuelos(): void {
    this.loading.set(true);
    this.error.set(false);
    this.dueloService
      .misDuelos$()
      .pipe(
        catchError(() => {
          this.error.set(true);
          return of([] as MiDuelo[]);
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe((duelos) => this.duelos.set(duelos ?? []));
  }

  /** True si la sala sigue abierta (acepta la grafía masc./fem. del backend). */
  public esAbierto(duelo: MiDuelo): boolean {
    return /abiert/i.test(duelo.estado);
  }

  public verClasificacion(codigo: string): void {
    this.router.navigate(['/app/test/alumno/duelo/ranking/' + codigo]);
  }
}
