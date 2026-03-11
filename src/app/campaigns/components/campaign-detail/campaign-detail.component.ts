import { Location } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { ToastrService } from 'ngx-toastr';
import { firstValueFrom } from 'rxjs';
import {
  Campaign,
  CampaignService,
  CampaignSubscriber,
  CampaignSend,
  CampaignSubscriberStatus,
  ProgramDateConfig,
} from '../../../services/campaign.service';

@Component({
  selector: 'app-campaign-detail',
  templateUrl: './campaign-detail.component.html',
  styleUrls: ['./campaign-detail.component.scss'],
})
export class CampaignDetailComponent implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private location = inject(Location);
  private service = inject(CampaignService);
  private toast = inject(ToastrService);
  private confirmation = inject(ConfirmationService);

  campaign: Campaign | null = null;
  form: FormGroup;
  loading = false;
  subscribers: CampaignSubscriber[] = [];
  subscribersTotal = 0;
  subscribersPage = 0;
  sends: CampaignSend[] = [];
  sendsTotal = 0;
  sending = false;
  subscribedCount = 0;

  statusLabels: Record<CampaignSubscriberStatus, string> = {
    SUBSCRIBED: 'Pendiente',
    NOTIFIED: 'Notificado',
    UNSUBSCRIBED: 'Baja',
    BOUNCED: 'Rebotado',
  };

  constructor() {
    this.form = this.fb.group({
      name: ['', Validators.required],
      enabled: [true],
      hasDate: [false],
      startDate: [null as string | null],
      endDate: [null as string | null],
      messageWithDate: [''],
      messageWithoutDate: [''],
    });
  }

  async ngOnInit() {
    const id = this.route.snapshot.params['id'];
    if (id) {
      await this.loadCampaign(+id);
      await this.loadSubscribers();
      await this.loadSends();
    }
  }

  private async loadCampaign(id: number) {
    try {
      this.loading = true;
      this.campaign = await firstValueFrom(this.service.getById$(id));
      const config = (this.campaign.config || {}) as ProgramDateConfig;
      this.form.patchValue({
        name: this.campaign.name,
        enabled: this.campaign.enabled,
        hasDate: config.hasDate ?? false,
        startDate: config.startDate
          ? config.startDate.toString().slice(0, 10)
          : null,
        endDate: config.endDate
          ? config.endDate.toString().slice(0, 10)
          : null,
        messageWithDate: config.messageWithDate ?? '',
        messageWithoutDate: config.messageWithoutDate ?? '',
      });
      this.subscribedCount = await this.getSubscribedCount();
    } catch {
      this.toast.error('Error al cargar la campaña');
    } finally {
      this.loading = false;
    }
  }

  private async getSubscribedCount(): Promise<number> {
    if (!this.campaign) return 0;
    const res = await firstValueFrom(
      this.service.getSubscribers$(this.campaign.id, {
        status: 'SUBSCRIBED',
        skip: 0,
        take: 1,
      })
    );
    return res.pagination.count;
  }

  private async loadSubscribers() {
    if (!this.campaign) return;
    const res = await firstValueFrom(
      this.service.getSubscribers$(this.campaign.id, {
        skip: this.subscribersPage * 20,
        take: 20,
      })
    );
    this.subscribers = res.data;
    this.subscribersTotal = res.pagination.count;
  }

  private async loadSends() {
    if (!this.campaign) return;
    const res = await firstValueFrom(
      this.service.getSends$(this.campaign.id, 0, 50)
    );
    this.sends = res.data;
    this.sendsTotal = res.pagination.count;
  }

  async guardar() {
    if (!this.campaign || this.form.invalid) return;
    try {
      this.loading = true;
      const v = this.form.value;
      const config: ProgramDateConfig = {
        hasDate: !!v.hasDate,
        startDate: v.startDate || null,
        endDate: v.endDate || null,
        messageWithDate: v.messageWithDate || '',
        messageWithoutDate: v.messageWithoutDate || '',
      };
      await firstValueFrom(
        this.service.update$(this.campaign.id, {
          name: v.name,
          enabled: v.enabled,
          config,
        })
      );
      this.toast.success('Campaña actualizada');
      await this.loadCampaign(this.campaign.id);
      this.subscribedCount = await this.getSubscribedCount();
    } catch {
      this.toast.error('Error al guardar');
    } finally {
      this.loading = false;
    }
  }

  async exportar() {
    if (!this.campaign) return;
    try {
      const blob = await firstValueFrom(
        this.service.exportSubscribers$(this.campaign.id)
      );
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `suscriptores-${this.campaign.slug}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
      this.toast.success('Exportado correctamente');
    } catch {
      this.toast.error('Error al exportar');
    }
  }

  enviarAviso() {
    if (!this.campaign) return;
    const config = this.campaign.config as ProgramDateConfig;
    if (!config?.hasDate || !config?.startDate) {
      this.toast.error('Define una fecha antes de enviar');
      return;
    }
    this.confirmation.confirm({
      header: 'Enviar aviso',
      message: `Se enviará un email a ${this.subscribedCount} suscriptor(es) pendientes. ¿Continuar?`,
      acceptLabel: 'Enviar',
      rejectLabel: 'Cancelar',
      accept: async () => {
        try {
          this.sending = true;
          const res = await firstValueFrom(
            this.service.send$(this.campaign!.id)
          );
          this.toast.success(
            `Enviados: ${res.sent}. Fallidos: ${res.failed}`
          );
          await this.loadSubscribers();
          await this.loadSends();
          this.subscribedCount = await this.getSubscribedCount();
        } catch {
          this.toast.error('Error al enviar');
        } finally {
          this.sending = false;
        }
      },
    });
  }

  resetearNotificados() {
    if (!this.campaign) return;
    this.confirmation.confirm({
      header: 'Resetear suscriptores',
      message:
        '¿Cambiar NOTIFIED a SUBSCRIBED para permitir un nuevo envío? (Útil si rectificaste la fecha)',
      acceptLabel: 'Resetear',
      rejectLabel: 'Cancelar',
      accept: async () => {
        try {
          const res = await firstValueFrom(
            this.service.resetSubscribers$(this.campaign!.id)
          );
          this.toast.success(`${res.reset} suscriptores reseteados`);
          await this.loadSubscribers();
          this.subscribedCount = await this.getSubscribedCount();
        } catch {
          this.toast.error('Error al resetear');
        }
      },
    });
  }

  volver() {
    this.location.back();
  }

  getStatusLabel(status: string): string {
    return this.statusLabels[status as CampaignSubscriberStatus] || status;
  }
}
