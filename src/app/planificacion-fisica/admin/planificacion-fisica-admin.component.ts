import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ConfirmationService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { FileUpload, FileUploadModule } from 'primeng/fileupload';
import { MessageModule } from 'primeng/message';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { ToastrService } from 'ngx-toastr';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AsyncButtonComponent } from '../../shared/components/async-button/async-button.component';
import { SharedModule } from '../../shared/shared.module';
import { Oposicion } from '../../shared/models/subscription.model';
import { extraerMensajeError } from '../../shared/utils/http-error.util';
import {
  BloqueEntrenamiento,
  ErrorImport,
  EliminarBloqueConProgreso,
  ErrorBloqueSolapado,
  PlanificacionFisicaService,
  ResumenImport,
} from '../services/planificacion-fisica.service';

@Component({
  selector: 'app-planificacion-fisica-admin',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ButtonModule,
    CardModule,
    ConfirmDialogModule,
    FileUploadModule,
    MessageModule,
    TableModule,
    TagModule,
    TooltipModule,
    AsyncButtonComponent,
    SharedModule,
  ],
  templateUrl: './planificacion-fisica-admin.component.html',
  styleUrl: './planificacion-fisica-admin.component.scss',
})
export class PlanificacionFisicaAdminComponent implements OnInit {
  private svc = inject(PlanificacionFisicaService);
  private toast = inject(ToastrService);
  private confirmationService = inject(ConfirmationService);
  private router = inject(Router);

  /**
   * PrimeNG `p-fileUpload` (modo `basic`) destruye su `<input type="file">`
   * interno en cuanto detecta un fichero seleccionado (`*ngIf="!hasFiles()"`
   * en su template) y no lo vuelve a crear hasta que se llama a `.clear()`.
   * Sin este reset, el botón "Seleccionar Excel" queda MUERTO tras la
   * primera subida — justo el flujo que este panel necesita (subir Excel
   * roto, corregirlo, volver a subirlo) quedaría bloqueado. Descubierto en
   * QA visual manual (2026-07-17): la segunda subida no abría el selector
   * de fichero.
   */
  @ViewChild('excelUpload') private excelUpload?: FileUpload;

  /** Fichero seleccionado en el `p-fileUpload`, pendiente de preview/import. */
  protected selectedFile = signal<File | null>(null);
  protected previewLoading = signal(false);

  /** Resultado del último `preview()`. `null` hasta que se haga la primera preview. */
  protected resumen = signal<ResumenImport | null>(null);
  protected errores = signal<ErrorImport[]>([]);
  /** Distingue "aún no se ha subido nada" de "se subió y no dio ni resumen ni errores". */
  protected previewRealizada = signal(false);

  protected readonly tieneErrores = computed(() => this.errores().length > 0);

  protected bloques = signal<BloqueEntrenamiento[]>([]);
  protected bloquesLoading = signal(false);
  protected accionBloqueEnCurso = signal<number | null>(null);

  ngOnInit(): void {
    this.cargarBloques();
  }

  descargarPlantillaUrl(): string {
    return this.svc.descargarPlantillaUrl();
  }

  async cargarBloques(): Promise<void> {
    this.bloquesLoading.set(true);
    try {
      const bloques = await firstValueFrom(this.svc.listarBloques());
      this.bloques.set(bloques);
    } catch {
      this.toast.error('No se han podido cargar los bloques existentes.');
    } finally {
      this.bloquesLoading.set(false);
    }
  }

  /**
   * `p-fileUpload` en modo básico (manual, sin auto-subida): al seleccionar
   * el Excel se lanza directamente el `preview()` — no hay paso intermedio
   * de "elegir y luego previsualizar", el criterio de aceptación pide ver el
   * resultado (resumen o errores) en cuanto se sube el fichero.
   */
  async onFileSelected(event: { files: File[] }): Promise<void> {
    const file = event.files?.[0];
    if (!file) return;

    // Reset inmediato del `p-fileUpload`: recreamos su `<input>` interno
    // (ver comentario en `excelUpload`) para que el botón siga sirviendo
    // para volver a elegir fichero tras esta selección — el propio estado
    // de la subida (fichero elegido, resumen, errores) vive en los signals
    // de este componente, no en el file upload de PrimeNG.
    this.excelUpload?.clear();

    this.selectedFile.set(file);
    this.resumen.set(null);
    this.errores.set([]);
    this.previewRealizada.set(false);
    this.previewLoading.set(true);

    try {
      const res = await firstValueFrom(this.svc.preview(file));
      this.resumen.set(res.resumen);
      this.errores.set(res.errores ?? []);
    } catch (err) {
      // El backend puede devolver los errores de validación también dentro
      // del cuerpo de un error HTTP (p.ej. 422) en preview, igual que en
      // import — los tratamos igual en ambos sitios.
      const httpErr = err as HttpErrorResponse;
      const errores = (httpErr?.error?.errores as ErrorImport[]) ?? [];
      if (errores.length) {
        this.errores.set(errores);
      } else {
        this.toast.error(
          this.mensajeError(httpErr) ??
            'No se ha podido previsualizar el Excel.',
        );
      }
    } finally {
      this.previewLoading.set(false);
      this.previewRealizada.set(true);
    }
  }

  /**
   * Acción del `<app-async-button>` de importar. Reintentable: si el
   * backend devuelve 422 con la lista de errores (contrato real: vienen
   * dentro de `error.error.errores`, NO en una respuesta 200), se muestran
   * en la misma tabla que usa el preview y NO se limpia el fichero
   * seleccionado, para que el admin pueda corregir y reintentar sin volver
   * a buscarlo.
   */
  importar = async (): Promise<void> => {
    const file = this.selectedFile();
    if (!file) return;

    try {
      const res = await firstValueFrom(this.svc.importar(file));
      this.toast.success(
        `Bloque "${res.bloqueId}" importado como BORRADOR correctamente.`,
      );
      this.selectedFile.set(null);
      this.resumen.set(null);
      this.errores.set([]);
      this.previewRealizada.set(false);
      await this.cargarBloques();
    } catch (err) {
      const httpErr = err as HttpErrorResponse;
      const errores = (httpErr?.error?.errores as ErrorImport[]) ?? [];
      if (errores.length) {
        this.resumen.set(null);
        this.errores.set(errores);
        this.toast.error('El Excel tiene errores; no se ha importado nada.');
      } else {
        this.toast.error(
          this.mensajeError(httpErr) ?? 'No se ha podido importar el Excel.',
        );
      }
    }
  };

  publicarBloque(bloque: BloqueEntrenamiento, event: Event): void {
    if (this.accionBloqueEnCurso() !== null) return;
    this.confirmationService.confirm({
      key: 'pf-publicar',
      target: event.target as EventTarget,
      message: `Vas a publicar el bloque "${bloque.identificador}". Los alumnos con las oposiciones asociadas empezarán a verlo. ¿Estás seguro?`,
      header: 'Confirmación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí',
      rejectLabel: 'No',
      rejectButtonStyleClass: 'p-button-text',
      accept: async () => {
        if (this.accionBloqueEnCurso() !== null) return;
        this.accionBloqueEnCurso.set(bloque.id);
        try {
          await firstValueFrom(this.svc.publicar(bloque.id));
          this.toast.success(`Bloque "${bloque.identificador}" publicado.`);
          await this.cargarBloques();
        } catch (err) {
          this.toast.error(
            this.mensajeError(err as HttpErrorResponse) ??
              'No se ha podido publicar el bloque.',
          );
        } finally {
          this.accionBloqueEnCurso.set(null);
        }
      },
    });
  }

  despublicarBloque(bloque: BloqueEntrenamiento, event: Event): void {
    if (this.accionBloqueEnCurso() !== null) return;
    this.confirmationService.confirm({
      key: 'pf-despublicar',
      target: event.target as EventTarget,
      message: `Vas a despublicar el bloque "${bloque.identificador}". Los alumnos dejarán de verlo. ¿Estás seguro?`,
      header: 'Confirmación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, despublicar',
      rejectLabel: 'Cancelar',
      rejectButtonStyleClass: 'p-button-text',
      accept: async () => {
        if (this.accionBloqueEnCurso() !== null) return;
        this.accionBloqueEnCurso.set(bloque.id);
        try {
          await firstValueFrom(this.svc.despublicar(bloque.id));
          this.toast.success(`Bloque "${bloque.identificador}" despublicado.`);
          await this.cargarBloques();
        } catch (err) {
          this.toast.error(
            this.mensajeError(err as HttpErrorResponse) ??
              'No se ha podido despublicar el bloque.',
          );
        } finally {
          this.accionBloqueEnCurso.set(null);
        }
      },
    });
  }

  eliminarBloque(bloque: BloqueEntrenamiento, event: Event): void {
    this.confirmationService.confirm({
      key: 'pf-borrar',
      target: event.target as EventTarget,
      message: `Vas a eliminar el bloque "${bloque.identificador}". ¿Estás seguro?`,
      header: 'Confirmación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí',
      rejectLabel: 'No',
      rejectButtonStyleClass: 'p-button-text',
      accept: () => this.intentarEliminar(bloque, event, false),
    });
  }

  /**
   * Primer intento sin `force`. Si el backend responde 409 (el bloque tiene
   * progreso de alumnos registrado), se muestra un SEGUNDO diálogo de
   * confirmación explícito con el número de marcas de progreso que se
   * perderían, y solo si el admin confirma ESE aviso se repite la llamada
   * con `?force=true`. Nunca se borra "a la primera" cuando hay progreso.
   */
  private async intentarEliminar(
    bloque: BloqueEntrenamiento,
    event: Event,
    force: boolean,
  ): Promise<void> {
    try {
      await firstValueFrom(this.svc.eliminar(bloque.id, force));
      this.toast.success(`Bloque "${bloque.identificador}" eliminado.`);
      await this.cargarBloques();
    } catch (err) {
      const httpErr = err as HttpErrorResponse;
      if (httpErr?.status === 409) {
        const body = httpErr.error as EliminarBloqueConProgreso;
        // `key` propia: este aviso se emite desde el `accept` del dialogo
        // anterior, y compartir un unico <p-confirmDialog> hacia que el cierre
        // del primero se comiera este segundo — el admin confirmaba el borrado
        // y no pasaba nada, sin ningun mensaje. Cazado en QA visual (2026-07-17):
        // el confirm() SI se llamaba, pero PrimeNG nunca lo pintaba.
        this.confirmationService.confirm({
          key: 'pf-borrar-con-progreso',
          target: event.target as EventTarget,
          message: `El bloque "${bloque.identificador}" tiene ${body.progreso} marca(s) de progreso de alumnos. Si lo eliminas, se perderán. ¿Eliminar de todas formas?`,
          header: 'Este bloque tiene progreso de alumnos',
          icon: 'pi pi-exclamation-triangle',
          acceptLabel: 'Sí, eliminar de todas formas',
          rejectLabel: 'Cancelar',
          acceptButtonStyleClass: 'p-button-danger',
          rejectButtonStyleClass: 'p-button-text',
          accept: () => this.intentarEliminar(bloque, event, true),
        });
      } else {
        this.toast.error(
          this.mensajeError(httpErr) ?? 'No se ha podido eliminar el bloque.',
        );
      }
    }
  }

  /**
   * Ventana de edición del texto de los ejercicios de este bloque, disciplina
   * a disciplina (el excel del entrenador solo trae la parrilla, no el
   * texto). Ruta hermana de `admin`, mismo gate ADMIN.
   */
  verDetalles(bloque: BloqueEntrenamiento): void {
    this.router.navigate([
      '/app/planificacion-fisica/admin',
      bloque.id,
      'detalles',
    ]);
  }

  async guardarRelevancia(
    bloque: BloqueEntrenamiento,
    oposiciones: Oposicion[],
  ): Promise<void> {
    try {
      const actualizado = await firstValueFrom(
        this.svc.actualizarBloque(bloque.id, { relevancia: oposiciones }),
      );
      bloque.relevancia = actualizado.relevancia;
      this.toast.success(
        `Relevancia de "${bloque.identificador}" actualizada.`,
      );
    } catch (err) {
      this.toast.error(
        this.mensajeError(err as HttpErrorResponse) ??
          'No se ha podido guardar la relevancia.',
      );
    }
  }

  private mensajeError(err: HttpErrorResponse | undefined): string | null {
    const conflicto = err?.error as ErrorBloqueSolapado | undefined;
    if (conflicto?.code === 'BLOQUE_SOLAPADO' && conflicto.details) {
      const { bloque, intervalos, planificaciones } = conflicto.details;
      const semanas = intervalos
        .map(
          (intervalo) =>
            `${intervalo.bloque.label} (${intervalo.bloque.inicio} a ${intervalo.bloque.fin})`,
        )
        .join(', ');
      const planes = planificaciones
        .map((plan) => plan.identificador)
        .join(', ');
      return `Se solapa con ${bloque.identificador}${semanas ? `: ${semanas}` : ''}${planes ? `. Planificaciones compartidas: ${planes}.` : ''}`;
    }
    return extraerMensajeError(err);
  }
}
