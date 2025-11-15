import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import {
  MotivoBaja,
  SuscripcionManagementService,
  ValidacionPlazo,
} from '../../services/suscripcion-management.service';

interface MotivoOption {
  value: MotivoBaja;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-baja-suscripcion',
  standalone: true,
  providers: [MessageService],
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    CardModule,
    CheckboxModule,
    DialogModule,
    InputTextareaModule,
    ProgressSpinnerModule,
  ],
  templateUrl: './baja-suscripcion.component.html',
  styleUrls: ['./baja-suscripcion.component.scss'],
})
export class BajaSuscripcionComponent implements OnInit {
  loading = signal(false);
  validandoPlazo = signal(true);
  procesandoBaja = signal(false);
  dialogConfirmacion = signal(false);
  dialogFueraDePlazo = signal(false);

  validacion: ValidacionPlazo | null = null;
  motivosSeleccionados: MotivoBaja[] = [];
  comentarioAdicional: string = '';

  motivosOptions: MotivoOption[] = [
    {
      value: MotivoBaja.APROBADO,
      label: '🧑‍🚒 Ya he aprobado la oposición',
      icon: 'pi pi-check-circle',
    },
    {
      value: MotivoBaja.CAMBIO_ACADEMIA,
      label: '🔄 He decidido cambiar de academia',
      icon: 'pi pi-sync',
    },
    {
      value: MotivoBaja.PREPARACION_PROPIA,
      label: '💪 Voy a prepararlo por mi cuenta',
      icon: 'pi pi-user',
    },
    {
      value: MotivoBaja.TRATO_NO_COMODO,
      label: '🤝 No me he sentido cómodo/a con el trato recibido',
      icon: 'pi pi-user-minus',
    },
    {
      value: MotivoBaja.MATERIAL_INADECUADO,
      label: '📚 El material no me ha resultado suficiente o adecuado',
      icon: 'pi pi-book',
    },
    {
      value: MotivoBaja.FALTA_TIEMPO,
      label: '🕒 No dispongo del tiempo necesario',
      icon: 'pi pi-clock',
    },
    {
      value: MotivoBaja.MOTIVOS_ECONOMICOS,
      label: '💰 Motivos económicos o personales',
      icon: 'pi pi-wallet',
    },
    {
      value: MotivoBaja.OTROS,
      label: '❓ Otros motivos',
      icon: 'pi pi-question-circle',
    },
  ];

  constructor(
    private suscripcionService: SuscripcionManagementService,
    private messageService: MessageService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.validarPlazo();
  }

  validarPlazo(): void {
    this.validandoPlazo.set(true);
    this.suscripcionService.validarPlazo().subscribe({
      next: (result) => {
        this.validacion = result;
        this.validandoPlazo.set(false);
        if (!result.valido) {
          this.dialogFueraDePlazo.set(true);
        }
      },
      error: (error) => {
        this.validandoPlazo.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail:
            error.error?.message ||
            'No se pudo validar el plazo de modificación',
        });
        // Redirigir al perfil si hay error
        setTimeout(() => this.router.navigate(['/profile']), 2000);
      },
    });
  }

  onMotivoChange(motivo: MotivoBaja, checked: boolean): void {
    if (checked) {
      if (!this.motivosSeleccionados.includes(motivo)) {
        this.motivosSeleccionados.push(motivo);
      }
    } else {
      this.motivosSeleccionados = this.motivosSeleccionados.filter(
        (m) => m !== motivo
      );
    }
  }

  isMotivoSelected(motivo: MotivoBaja): boolean {
    return this.motivosSeleccionados.includes(motivo);
  }

  abrirDialogConfirmacion(): void {
    if (this.motivosSeleccionados.length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Motivo requerido',
        detail: 'Por favor selecciona al menos un motivo de baja',
      });
      return;
    }
    this.dialogConfirmacion.set(true);
  }

  confirmarBaja(): void {
    this.procesandoBaja.set(true);
    this.suscripcionService
      .solicitarBaja({
        motivos: this.motivosSeleccionados,
        comentarioAdicional: this.comentarioAdicional || undefined,
      })
      .subscribe({
        next: (response) => {
          this.procesandoBaja.set(false);
          this.dialogConfirmacion.set(false);
          this.messageService.add({
            severity: 'success',
            summary: 'Baja procesada',
            detail: response.mensaje,
            life: 5000,
          });
          setTimeout(() => this.router.navigate(['/profile']), 3000);
        },
        error: (error) => {
          this.procesandoBaja.set(false);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail:
              error.error?.message || 'No se pudo procesar la solicitud de baja',
          });
        },
      });
  }

  cancelar(): void {
    this.router.navigate(['/profile']);
  }

  cerrarDialogFueraDePlazo(): void {
    this.dialogFueraDePlazo.set(false);
    this.router.navigate(['/profile']);
  }
}
