import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject } from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { finalize } from 'rxjs';
import { looksLikeSpanishNif } from '../facturacion/utils/nif.util';
import {
  CAMPOS_FISCALES_COMPRA,
  CampoFiscalCompra,
  DatosFiscalesCompra,
  EstadoDatosFiscalesCompra,
} from './datos-fiscales-compra.model';

interface CampoVisible {
  campo: CampoFiscalCompra;
  etiqueta: string;
  obligatorio: boolean;
}

interface DialogData {
  estado: EstadoDatosFiscalesCompra;
  guardar: (
    datos: Partial<DatosFiscalesCompra>,
  ) => import('rxjs').Observable<EstadoDatosFiscalesCompra>;
}

@Component({
  selector: 'app-compra-datos-fiscales-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
  ],
  templateUrl: './compra-datos-fiscales-dialog.component.html',
  styleUrl: './compra-datos-fiscales-dialog.component.scss',
})
export class CompraDatosFiscalesDialogComponent {
  private readonly config = inject(DynamicDialogConfig<DialogData>);
  private readonly ref = inject(DynamicDialogRef);
  private readonly formBuilder = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly estado = this.config.data.estado;
  private readonly camposReportados = this.camposPorCorregir();
  readonly formulario = this.crearFormulario();
  readonly campos: CampoVisible[] = [];
  guardando = false;
  enviado = false;
  errorGuardado = '';
  private provinciaDinamica = false;

  constructor() {
    this.formulario
      .get('pais')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.sincronizarProvinciaDinamica();
        this.actualizarValidacionProvincia();
        this.actualizarCampos();
      });
    this.sincronizarProvinciaDinamica();
    this.actualizarCampos();
  }

  guardar(): void {
    this.enviado = true;
    this.errorGuardado = '';
    this.formulario.markAllAsTouched();

    if (this.formulario.invalid || !this.identidadValida()) return;

    const datos: Partial<DatosFiscalesCompra> = {};
    for (const campo of this.campos) {
      datos[campo.campo] = String(
        this.formulario.get(campo.campo)?.value ?? '',
      ).trim();
    }

    this.guardando = true;
    this.config.data
      .guardar(datos)
      .pipe(finalize(() => (this.guardando = false)))
      .subscribe({
        next: (estado: EstadoDatosFiscalesCompra) => {
          if (!estado?.completo) {
            this.errorGuardado =
              'La ficha sigue incompleta. Revisa los datos marcados antes de continuar.';
            return;
          }
          this.ref.close({ guardado: true });
        },
        error: (error: unknown) => {
          this.errorGuardado = this.mensajeError(error);
        },
      });
  }

  cancelar(): void {
    this.ref.close({ guardado: false });
  }

  campoTieneError(campo: CampoFiscalCompra): boolean {
    const control = this.formulario.get(campo);
    return Boolean(
      control && control.invalid && (control.touched || this.enviado),
    );
  }

  errorCampo(campo: CampoFiscalCompra): string {
    const control = this.formulario.get(campo);
    if (control?.hasError('required')) return 'Este dato es obligatorio.';
    if (control?.hasError('nifInvalido')) {
      return 'Introduce un NIF, NIE o CIF con formato válido.';
    }
    return '';
  }

  motivoCampo(campo: CampoFiscalCompra): string {
    const motivos: string[] = [];
    if (this.estado.faltantes.includes(campo)) motivos.push('Falta este dato');
    if (this.estado.invalidos.includes(campo)) motivos.push('Dato no válido');
    if (this.estado.conflictos.includes(campo)) {
      motivos.push('Dato en conflicto; revísalo');
    }
    if (campo === 'provincia' && this.provinciaDinamica) {
      motivos.push('Necesaria cuando el país es España');
    }
    return motivos.join('. ');
  }

  esProvinciaObligatoria(): boolean {
    return (
      String(this.formulario.get('pais')?.value ?? this.estado.datos.pais)
        .trim()
        .toUpperCase() === 'ES'
    );
  }

  private camposPorCorregir(): CampoVisible[] {
    const pendientes = new Set<CampoFiscalCompra>([
      ...this.estado.faltantes,
      ...this.estado.invalidos,
      ...this.estado.conflictos,
    ]);
    const datos = this.estado.datos;
    const tieneEmpresa = Boolean(datos.empresa.trim());
    const tienePersona = Boolean(datos.nombre.trim() && datos.apellidos.trim());

    // La identidad puede ser persona (nombre y apellidos) o empresa. No se pide
    // un apellido artificialmente cuando ya existe una razón social válida.
    if (tieneEmpresa) {
      if (this.estado.conflictos.includes('empresa')) pendientes.add('empresa');
      if (this.estado.invalidos.includes('empresa')) pendientes.add('empresa');
      if (this.estado.faltantes.includes('empresa')) pendientes.add('empresa');
      if (
        !this.estado.invalidos.includes('nombre') &&
        !this.estado.conflictos.includes('nombre')
      ) {
        pendientes.delete('nombre');
      }
      if (
        !this.estado.invalidos.includes('apellidos') &&
        !this.estado.conflictos.includes('apellidos')
      ) {
        pendientes.delete('apellidos');
      }
    } else if (tienePersona) {
      if (
        !this.estado.invalidos.includes('empresa') &&
        !this.estado.conflictos.includes('empresa')
      ) {
        pendientes.delete('empresa');
      }
    }

    return CAMPOS_FISCALES_COMPRA.filter(({ campo }) =>
      pendientes.has(campo),
    ).map(({ campo, etiqueta, obligatorio }) => ({
      campo,
      etiqueta,
      obligatorio,
    }));
  }

  private crearFormulario(): FormGroup {
    const controles: Record<string, FormControl> = {};
    for (const campo of this.camposReportados) {
      const validators: ValidatorFn[] = [];
      if (
        ['direccion', 'poblacion', 'codigoPostal', 'pais', 'nif'].includes(
          campo.campo,
        )
      ) {
        validators.push(Validators.required);
      }
      if (campo.campo === 'nif') {
        validators.push((control) =>
          !control.value || looksLikeSpanishNif(control.value)
            ? null
            : { nifInvalido: true },
        );
      }
      if (campo.campo === 'provincia') {
        validators.push(this.validadorProvincia());
      }
      controles[campo.campo] = this.formBuilder.control(
        this.estado.datos[campo.campo] ?? '',
        validators,
      );
    }
    return this.formBuilder.group(controles);
  }

  private actualizarValidacionProvincia(): void {
    this.formulario.get('provincia')?.updateValueAndValidity();
  }

  private actualizarCampos(): void {
    const campos = new Set(this.camposReportados.map(({ campo }) => campo));
    if (
      this.camposReportados.some(({ campo }) => campo === 'provincia') ||
      (this.provinciaDinamica && this.esProvinciaObligatoria())
    ) {
      campos.add('provincia');
    } else if (this.provinciaDinamica) {
      campos.delete('provincia');
    }

    const visibles = CAMPOS_FISCALES_COMPRA.filter(({ campo }) =>
      campos.has(campo),
    );
    this.campos.splice(0, this.campos.length, ...visibles);
  }

  private sincronizarProvinciaDinamica(): void {
    const provinciaReportada = this.camposReportados.some(
      ({ campo }) => campo === 'provincia',
    );
    const provinciaConocida = Boolean(this.estado.datos.provincia.trim());
    this.provinciaDinamica = Boolean(
      !provinciaReportada &&
      !provinciaConocida &&
      this.esProvinciaObligatoria(),
    );
    if (this.provinciaDinamica && !this.formulario.get('provincia')) {
      this.formulario.addControl(
        'provincia',
        this.formBuilder.control('', [this.validadorProvincia()]),
      );
    }
  }

  private validadorProvincia(): ValidatorFn {
    return (control) => {
      const pais = control.parent?.get('pais')?.value ?? this.estado.datos.pais;
      return String(pais ?? '')
        .trim()
        .toUpperCase() === 'ES' && !String(control.value ?? '').trim()
        ? { required: true }
        : null;
    };
  }

  private identidadValida(): boolean {
    const valor = (campo: 'nombre' | 'apellidos' | 'empresa') =>
      String(
        this.formulario.get(campo)?.value ?? this.estado.datos[campo] ?? '',
      ).trim();
    const valida = Boolean(
      valor('empresa') || (valor('nombre') && valor('apellidos')),
    );
    if (!valida) {
      this.errorGuardado =
        'Indica nombre y apellidos, o una empresa o razón social.';
    }
    return valida;
  }

  private mensajeError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const body = error.error as {
        mensaje?: unknown;
        message?: unknown;
      } | null;
      if (typeof body?.mensaje === 'string') return body.mensaje;
      if (typeof body?.message === 'string') return body.message;
    }
    if (error instanceof Error && error.message) return error.message;
    return 'No se pudieron guardar los datos fiscales. Inténtalo de nuevo.';
  }
}
