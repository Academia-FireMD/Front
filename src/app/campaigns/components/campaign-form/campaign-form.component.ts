import { Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { firstValueFrom } from 'rxjs';
import {
  CampaignService,
  CreateCampaignDto,
  CampaignType,
  ProgramDateConfig,
} from '../../../services/campaign.service';

@Component({
  selector: 'app-campaign-form',
  templateUrl: './campaign-form.component.html',
  styleUrls: ['./campaign-form.component.scss'],
})
export class CampaignFormComponent {
  private fb = inject(FormBuilder);
  private service = inject(CampaignService);
  private router = inject(Router);
  private toast = inject(ToastrService);

  form: FormGroup;
  loading = false;

  types: { label: string; value: CampaignType }[] = [
    { label: 'Aviso de fecha (programa formativo)', value: 'PROGRAM_DATE' },
    { label: 'Newsletter', value: 'NEWSLETTER' },
    { label: 'Lanzamiento producto', value: 'PRODUCT_LAUNCH' },
  ];

  constructor() {
    this.form = this.fb.group({
      slug: ['', [Validators.required, Validators.pattern(/^[a-z0-9-]+$/)]],
      name: ['', Validators.required],
      type: ['PROGRAM_DATE' as CampaignType, Validators.required],
      hasDate: [false],
      startDate: [null as string | null],
      endDate: [null as string | null],
      messageWithDate: ['El programa ya tiene fecha confirmada.'],
      messageWithoutDate: [
        'El programa no tiene fecha todavía. Déjanos tu email y te avisaremos.',
      ],
    });
  }

  async guardar() {
    if (this.form.invalid) {
      this.toast.error('Completa los campos requeridos');
      return;
    }
    try {
      this.loading = true;
      const v = this.form.value;
      let config: ProgramDateConfig | Record<string, unknown> = {};
      if (v.type === 'PROGRAM_DATE') {
        config = {
          hasDate: !!v.hasDate,
          startDate: v.startDate || null,
          endDate: v.endDate || null,
          messageWithDate: v.messageWithDate || '',
          messageWithoutDate: v.messageWithoutDate || '',
        };
      }
      const campaign = await firstValueFrom(
        this.service.create$({
          slug: v.slug,
          name: v.name,
          type: v.type,
          config,
          enabled: true,
        })
      );
      this.toast.success('Campaña creada');
      this.router.navigate(['/app/campaigns', campaign.id]);
    } catch {
      this.toast.error('Error al crear la campaña');
    } finally {
      this.loading = false;
    }
  }

  cancelar() {
    this.router.navigate(['/app/campaigns']);
  }
}
