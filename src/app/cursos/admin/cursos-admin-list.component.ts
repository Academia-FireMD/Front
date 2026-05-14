import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { InputTextModule } from 'primeng/inputtext';
import { ToastrService } from 'ngx-toastr';
import { firstValueFrom } from 'rxjs';
import { CursosAdminService } from '../services/cursos-admin.service';
import { CursoAdmin, EstadoCurso } from '../models/curso.model';

type TagSeverity =
  | 'success'
  | 'info'
  | 'warning'
  | 'danger'
  | 'secondary'
  | 'contrast'
  | undefined;

@Component({
  selector: 'app-cursos-admin-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    TableModule,
    TagModule,
    InputTextModule,
  ],
  templateUrl: './cursos-admin-list.component.html',
  styleUrl: './cursos-admin-list.component.scss',
})
export class CursosAdminListComponent implements OnInit {
  private cursosAdminService = inject(CursosAdminService);
  private router = inject(Router);
  private toast = inject(ToastrService);

  cursos = signal<CursoAdmin[]>([]);
  loading = signal(true);
  searchTerm = signal('');

  ngOnInit(): void {
    this.loadCursos();
  }

  async loadCursos(): Promise<void> {
    this.loading.set(true);
    try {
      const data = await firstValueFrom(this.cursosAdminService.list());
      this.cursos.set(data);
    } catch {
      // handleError already shows toast
    } finally {
      this.loading.set(false);
    }
  }

  navigateToNew(): void {
    this.router.navigate(['/app/cursos-admin/nuevo']);
  }

  onRowClick(curso: CursoAdmin): void {
    this.router.navigate(['/app/cursos-admin', curso.id]);
  }

  estadoSeverity(estado: EstadoCurso): TagSeverity {
    const map: Record<EstadoCurso, TagSeverity> = {
      BORRADOR: 'warning',
      PUBLICADO: 'success',
      ARCHIVADO: 'secondary',
    };
    return map[estado];
  }
}
