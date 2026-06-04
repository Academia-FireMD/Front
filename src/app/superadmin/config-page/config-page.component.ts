import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ConfirmationService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { FileUploadModule } from 'primeng/fileupload';
import { InputSwitchModule } from 'primeng/inputswitch';
import { InputTextModule } from 'primeng/inputtext';
import { ToastrService } from 'ngx-toastr';
import { AppConfigService } from '../../services/app-config.service';
import { ModuloApp } from '../../shared/models/modulo-app.enum';

const HEX_REGEX = /^#[0-9A-Fa-f]{6}$/;
const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ALLOWED_LOGO_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
/** Fallback servido desde `public/` (mounted at root por angular.json). */
const FALLBACK_LOGO = '/white_logo.png';

interface ModuloRow {
  modulo: ModuloApp;
  label: string;
  enabled: boolean;
}

@Component({
  selector: 'app-config-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    FileUploadModule,
    InputSwitchModule,
    ConfirmDialogModule,
  ],
  providers: [ConfirmationService],
  templateUrl: './config-page.component.html',
  styleUrl: './config-page.component.scss',
})
export class ConfigPageComponent {
  readonly appConfigService = inject(AppConfigService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastrService);
  private readonly confirmation = inject(ConfirmationService);

  readonly fallbackLogo = FALLBACK_LOGO;
  readonly logoMimes = ALLOWED_LOGO_MIMES.join(',');
  readonly logoMaxBytes = MAX_LOGO_BYTES;

  readonly brandingForm: FormGroup = this.fb.group({
    appName: [
      this.appConfigService.appConfig().appName,
      [Validators.required, Validators.minLength(2), Validators.maxLength(60)],
    ],
    primaryColor: [
      this.appConfigService.appConfig().primaryColor,
      [Validators.required, Validators.pattern(HEX_REGEX)],
    ],
    secondaryColor: [
      this.appConfigService.appConfig().secondaryColor,
      [Validators.required, Validators.pattern(HEX_REGEX)],
    ],
  });

  /** Spinner state per botón. */
  readonly savingBranding = signal<boolean>(false);
  readonly uploadingLogo = signal<boolean>(false);
  readonly deletingLogo = signal<boolean>(false);
  readonly togglingModulo = signal<ModuloApp | null>(null);
  /** Preview transitorio antes de upload (FileReader). */
  readonly logoPreview = signal<string | null>(null);
  private pendingLogoFile: File | null = null;

  readonly modulos = computed<ModuloRow[]>(() => {
    const estado = this.appConfigService.estadoModulos();
    return Object.values(ModuloApp).map((m) => ({
      modulo: m,
      label: this.formatLabel(m),
      enabled: estado[m] === true,
    }));
  });

  /** Sincroniza el form con el signal cuando la config se recarga (post-409). */
  ngOnInit(): void {
    this.refillForm();
  }

  private refillForm(): void {
    const cfg = this.appConfigService.appConfig();
    this.brandingForm.patchValue(
      {
        appName: cfg.appName,
        primaryColor: cfg.primaryColor,
        secondaryColor: cfg.secondaryColor,
      },
      { emitEvent: false },
    );
  }

  async onSaveBranding(): Promise<void> {
    if (this.brandingForm.invalid) {
      this.brandingForm.markAllAsTouched();
      this.toast.error('Revisa los campos del formulario');
      return;
    }
    this.savingBranding.set(true);
    try {
      const updatedAt = this.appConfigService.appConfig().updatedAt;
      const result = await this.appConfigService.updateConfig(
        this.brandingForm.value,
        updatedAt,
      );
      if (result.ok) {
        this.toast.success('Branding actualizado');
        this.refillForm();
      } else if (result.code === 'STALE_CONFIG') {
        this.toast.warning(
          result.message ??
            'Otro admin modificó la config mientras editabas. Recargando…',
        );
        this.refillForm();
      } else {
        this.toast.error(result.message ?? 'No se pudo guardar');
      }
    } finally {
      this.savingBranding.set(false);
    }
  }

  /**
   * Pre-validación client-side del logo + preview con FileReader. NO sube
   * hasta que el usuario click "Subir".
   */
  onLogoSelected(event: { files: File[] }): void {
    const file = event.files?.[0];
    if (!file) return;
    if (file.size > MAX_LOGO_BYTES) {
      this.toast.error('Logo debe pesar menos de 2MB');
      this.pendingLogoFile = null;
      this.logoPreview.set(null);
      return;
    }
    if (!ALLOWED_LOGO_MIMES.includes(file.type)) {
      this.toast.error('Formato no soportado. Usa JPG, PNG o WEBP');
      this.pendingLogoFile = null;
      this.logoPreview.set(null);
      return;
    }
    this.pendingLogoFile = file;
    const reader = new FileReader();
    reader.onload = () => {
      this.logoPreview.set(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  async onUploadLogo(): Promise<void> {
    if (!this.pendingLogoFile) {
      this.toast.error('Selecciona un archivo primero');
      return;
    }
    this.uploadingLogo.set(true);
    try {
      const url = await this.appConfigService.uploadLogo(this.pendingLogoFile);
      if (url) {
        this.toast.success('Logo subido');
        this.pendingLogoFile = null;
        this.logoPreview.set(null);
      } else {
        this.toast.error('Error subiendo logo, reintenta');
      }
    } finally {
      this.uploadingLogo.set(false);
    }
  }

  onDeleteLogo(): void {
    this.confirmation.confirm({
      message: '¿Eliminar el logo actual? Volverá al fallback.',
      header: 'Confirmar eliminación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, eliminar',
      rejectLabel: 'Cancelar',
      accept: () => this.doDeleteLogo(),
    });
  }

  private async doDeleteLogo(): Promise<void> {
    this.deletingLogo.set(true);
    try {
      const ok = await this.appConfigService.deleteLogo();
      if (ok) {
        this.toast.success('Logo eliminado');
      } else {
        this.toast.error('Error eliminando logo');
      }
    } finally {
      this.deletingLogo.set(false);
    }
  }

  async onToggleModulo(modulo: ModuloApp, enabled: boolean): Promise<void> {
    this.togglingModulo.set(modulo);
    try {
      const ok = await this.appConfigService.toggleModulo(modulo, enabled);
      if (ok) {
        this.toast.success(
          `Módulo ${this.formatLabel(modulo)} ${enabled ? 'habilitado' : 'deshabilitado'}`,
        );
      } else {
        this.toast.error('No se pudo actualizar el módulo');
      }
    } finally {
      this.togglingModulo.set(null);
    }
  }

  onLogoError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img.src.endsWith(FALLBACK_LOGO)) return;
    img.src = FALLBACK_LOGO;
  }

  private formatLabel(modulo: ModuloApp): string {
    const lower = modulo.toLowerCase().replace(/_/g, ' ');
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }
}
