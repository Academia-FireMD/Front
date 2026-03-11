import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { FilterConfig } from '../../../shared/generic-list/generic-list.component';
import {
  Campaign,
  CampaignService,
  CampaignType,
} from '../../../services/campaign.service';
import { SharedGridComponent } from '../../../shared/shared-grid/shared-grid.component';

@Component({
  selector: 'app-campaign-overview',
  templateUrl: './campaign-overview.component.html',
  styleUrls: ['./campaign-overview.component.scss'],
})
export class CampaignOverviewComponent extends SharedGridComponent<Campaign> {
  service = inject(CampaignService);
  confirmationService = inject(ConfirmationService);
  override router = inject(Router);

  typeLabels: Record<CampaignType, string> = {
    PROGRAM_DATE: 'Aviso de fecha',
    NEWSLETTER: 'Newsletter',
    PRODUCT_LAUNCH: 'Lanzamiento',
  };

  filters: FilterConfig[] = [
    {
      key: 'type',
      label: 'Tipo',
      type: 'dropdown',
      placeholder: 'Todos los tipos',
      options: [
        { label: 'Todos', value: 'todos' },
        { label: 'Aviso de fecha', value: 'PROGRAM_DATE' },
        { label: 'Newsletter', value: 'NEWSLETTER' },
        { label: 'Lanzamiento', value: 'PRODUCT_LAUNCH' },
      ],
      filterInterpolation: (value) => {
        if (value === 'todos') return {};
        return { type: value };
      },
    },
  ];

  override fetchItems$ = computed(() => {
    return this.service.getList$({
      ...this.pagination(),
      where: this.pagination().where,
    });
  });

  onFiltersChanged(where: unknown) {
    this.updatePaginationSafe({ where, skip: 0 });
  }

  onItemClick(item: Campaign) {
    this.router.navigate(['/app/campaigns', item.id]);
  }

  navigateToDetailview(id: number) {
    this.router.navigate(['/app/campaigns', id]);
  }

  navigateToNew() {
    this.router.navigate(['/app/campaigns/new']);
  }

  getTypeLabel(type: string): string {
    return this.typeLabels[type as CampaignType] || type;
  }

  eliminarCampaign(campaign: Campaign, event?: MouseEvent) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.confirmationService.confirm({
      header: 'Eliminar campaña',
      message: `¿Eliminar la campaña "${campaign.name}"? Se eliminarán también todos los suscriptores e historial de envíos.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Eliminar',
      rejectLabel: 'No',
      accept: () => {
        this.service.delete$(campaign.id).subscribe({
          next: () => {
            this.toast.success('Campaña eliminada');
            this.refresh();
          },
          error: () => this.toast.error('Error al eliminar'),
        });
      },
    });
  }
}
