import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
} from '@angular/core';
import { MarkdownComponent } from 'ngx-markdown';
import { ButtonModule } from 'primeng/button';
import { ToastrService } from 'ngx-toastr';
import { CursosAlumnoService } from '../services/cursos-alumno.service';
import { Leccion } from '../models/curso.model';

@Component({
  selector: 'app-leccion-texto',
  standalone: true,
  imports: [MarkdownComponent, ButtonModule],
  templateUrl: './leccion-texto.component.html',
  styleUrl: './leccion-texto.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeccionTextoComponent {
  leccion = input.required<Leccion>();

  private readonly service = inject(CursosAlumnoService);
  private readonly toastr = inject(ToastrService);

  marcarComoVista(): void {
    this.service
      .upsertProgreso(this.leccion().id, {
        segundosVisto: 0,
        porcentajeVisto: 100,
        completada: true,
      })
      .subscribe({
        next: () => this.toastr.success('Lección marcada como vista'),
        error: () => {},
      });
  }
}
