import { DatePipe, DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable, catchError, finalize, map, of, switchMap } from 'rxjs';
import { EstudioApiService, PerfilPsico } from '../estudio/estudio-api.service';
import { REFERENCIA_PSICO, SEMANA_PSICO } from '../estudio/estudio-operaciones';
import { AuthService } from '../services/auth.service';

type Tab = 'reto' | 'alumnos' | 'dificultad' | 'reportes';
interface Aptitud {
  id: string;
  n: string;
}
interface Semanas {
  current: string;
  weeks: { week: string; n: Partial<Record<PerfilPsico, number>> }[];
}
interface Reto {
  enCurso: number;
  cut: number;
  modo: 'apto' | 'nota';
  aptitudes: Aptitud[];
  rows: {
    id: string;
    pos: number;
    name: string;
    alias: string;
    nota: number;
    net: number;
    ok: number;
    ko: number;
    bl: number;
    secs: number;
    apto: boolean | null;
    fp: number | null;
    res: { ok: number; n: number } | null;
    factors: { id: string; p?: number; pct: number }[];
  }[];
}
interface Alumno {
  id: string;
  name: string;
  alias: string;
  ultimo: string | null;
  dias: number | null;
  n7: number;
  n: number;
  pct: number | null;
  fallos: number;
  floja: string | null;
  reto: number | null;
  apt: { id: string; pct: number | null; n: number }[];
}
interface Alumnos {
  aptitudes: Aptitud[];
  rows: Alumno[];
  grupo: {
    id: string;
    n: string;
    resp: number;
    pct: number | null;
    seg: number | null;
  }[];
  tipos: {
    g: string;
    tipo: string;
    apt: string;
    resp: number;
    pct: number;
    seg: number;
    niveles: (number | null)[];
    invertido: boolean;
  }[];
}
interface Reportes {
  rows: {
    ref: string;
    tipo: string;
    nivel: number;
    n: number;
    motivos: Record<string, number>;
    notas: string[];
    alumnos: string[];
    ultimo: string;
  }[];
}

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink, DatePipe, DecimalPipe],
  templateUrl: './psico-admin.component.html',
  styleUrl: './psico-admin.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PsicoAdminComponent {
  private readonly api = inject(EstudioApiService);
  private readonly auth = inject(AuthService);
  private readonly session = this.auth.sessionSnapshot();
  private readonly reload = signal(0);

  readonly tabs: { id: Tab; label: string }[] = [
    { id: 'reto', label: 'Reto semanal' },
    { id: 'alumnos', label: 'Alumnos' },
    { id: 'dificultad', label: 'Dificultad real' },
    { id: 'reportes', label: 'Preguntas reportadas' },
  ];
  readonly tab = signal<Tab>('reto');
  readonly perfil = signal<PerfilPsico>('cv');
  readonly semana = signal('');
  readonly semanas = signal<Semanas['weeks']>([]);
  readonly reto = signal<Reto | null>(null);
  readonly alumnos = signal<Alumnos | null>(null);
  readonly reportes = signal<Reportes | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly actionError = signal('');
  readonly notice = signal('');
  readonly action = signal('');
  readonly aptos = computed(
    () => this.reto()?.rows.filter((r) => r.apto).length ?? 0,
  );
  readonly notaMedia = computed(() => {
    const rows = this.reto()?.rows ?? [];
    return rows.length
      ? rows.reduce((sum, row) => sum + row.nota, 0) / rows.length
      : null;
  });
  readonly activos = computed(
    () => this.alumnos()?.rows.filter((r) => r.n7 > 0).length ?? 0,
  );
  readonly inactivos = computed(
    () =>
      this.alumnos()?.rows.filter((r) => r.dias === null || r.dias >= 7)
        .length ?? 0,
  );
  readonly tipos = computed(() =>
    [...(this.alumnos()?.tipos ?? [])].sort((a, b) => a.pct - b.pct),
  );
  readonly respuestas = computed(() =>
    this.tipos().reduce((sum, row) => sum + row.resp, 0),
  );
  readonly porRevisar = computed(
    () => this.tipos().filter((r) => r.invertido).length,
  );

  private readonly seleccion = computed(() => ({
    tab: this.tab(),
    perfil: this.perfil(),
    semana: this.semana(),
    reload: this.reload(),
  }));

  constructor() {
    toObservable(this.seleccion)
      .pipe(
        switchMap(({ tab, perfil, semana }) => {
          this.error.set('');
          this.loading.set(true);
          const semanas$: Observable<string | null> = this.semanas().length
            ? of(null)
            : this.api.admin<Semanas>('weeks').pipe(
                map((datos) => {
                  this.semanas.set(
                    datos.weeks.filter((w) => SEMANA_PSICO.test(w.week)),
                  );
                  return datos.current;
                }),
              );
          return semanas$.pipe(
            switchMap((actual) => {
              if (tab === 'reportes')
                return this.api
                  .admin<Reportes>('reports')
                  .pipe(map((data) => this.reportes.set(data)));
              if (tab !== 'reto')
                return this.api
                  .admin<Alumnos>('alumnos', perfil)
                  .pipe(map((data) => this.alumnos.set(data)));
              const selected = semana || actual;
              if (!selected || !SEMANA_PSICO.test(selected))
                throw new Error('Semana inválida');
              if (!semana) this.semana.set(selected);
              return this.api
                .admin<Reto>(`week/${selected}`, perfil)
                .pipe(map((data) => this.reto.set(data)));
            }),
            catchError(() => {
              this.error.set(
                'No se han podido cargar los datos de Psicotécnicos.',
              );
              return of(null);
            }),
            finalize(() => this.loading.set(false)),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  seleccionar(tab: Tab) {
    this.tab.set(tab);
    this.notice.set('');
    this.actionError.set('');
  }

  reintentar() {
    this.reload.update((n) => n + 1);
  }

  csv() {
    const semana = this.semana();
    const perfil = this.perfil();
    if (!SEMANA_PSICO.test(semana)) return;
    this.ejecutar('csv', this.api.descargarCsv(semana, perfil), (blob) =>
      this.descargar(blob, `reto-${perfil}-${semana}.csv`),
    );
  }

  exportar(alumno: Alumno) {
    const id = String(alumno.id);
    this.ejecutar(
      'datos-' + id,
      this.api.admin(`alumno/${encodeURIComponent(id)}`),
      (datos) =>
        this.descargar(
          new Blob([JSON.stringify(datos, null, 2)], {
            type: 'application/json',
          }),
          `psicotecnicos-alumno-${id}.json`,
        ),
    );
  }

  borrar(alumno: Alumno) {
    const id = String(alumno.id);
    if (
      this.action() ||
      !confirm(
        `¿Borrar los datos de Psicotécnicos de ${alumno.name || id}? Se eliminarán su práctica, sus retos y sus reportes.`,
      )
    )
      return;
    this.ejecutar('borrar-' + id, this.api.borrarAlumno(id), () => {
      this.notice.set('Datos de Psicotécnicos borrados.');
      this.reintentar();
    });
  }

  revisar(ref: string) {
    if (!this.referenciaValida(ref)) return;
    this.ejecutar('revisar-' + ref, this.api.revisarReporte(ref), () => {
      this.notice.set('Pregunta marcada como revisada.');
      this.reintentar();
    });
  }

  referenciaValida(ref: string) {
    return REFERENCIA_PSICO.test(ref);
  }
  motivos(motivos: Record<string, number>) {
    return Object.entries(motivos)
      .map(([motivo, n]) => `${motivo} (${n})`)
      .join(', ');
  }
  porcentaje(valor: number | null | undefined) {
    return valor == null ? '—' : `${valor} %`;
  }
  tiempo(seg: number) {
    return `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, '0')}`;
  }
  aptitud(id: string | null, aptitudes: Aptitud[]) {
    return aptitudes.find((a) => a.id === id)?.n ?? '—';
  }
  percentil(row: Reto['rows'][number], id: string) {
    return row.factors.find((f) => f.id === id)?.p;
  }
  neto(row: Reto['rows'][number], id: string) {
    return this.porcentaje(row.factors.find((f) => f.id === id)?.pct);
  }
  acierto(row: Alumno, id: string) {
    return this.porcentaje(row.apt.find((a) => a.id === id)?.pct);
  }

  private ejecutar<T>(
    id: string,
    solicitud: import('rxjs').Observable<T>,
    success: (data: T) => void,
  ) {
    if (this.action() || !this.auth.isSessionCurrent(this.session)) return;
    this.action.set(id);
    this.actionError.set('');
    this.notice.set('');
    solicitud
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.action.set('')),
      )
      .subscribe({
        next: (data) => {
          if (this.auth.isSessionCurrent(this.session)) success(data);
        },
        error: () => {
          if (this.auth.isSessionCurrent(this.session))
            this.actionError.set('No se ha podido completar la acción.');
        },
      });
  }

  private readonly destroyRef = inject(DestroyRef);

  private descargar(blob: Blob, nombre: string) {
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombre;
    enlace.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
