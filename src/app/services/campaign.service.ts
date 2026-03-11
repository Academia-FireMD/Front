import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiBaseService } from './api-base.service';
import { PaginatedResult, PaginationFilter } from '../shared/models/pagination.model';

export type CampaignType = 'PROGRAM_DATE' | 'NEWSLETTER' | 'PRODUCT_LAUNCH';
export type CampaignSubscriberStatus =
  | 'SUBSCRIBED'
  | 'NOTIFIED'
  | 'UNSUBSCRIBED'
  | 'BOUNCED';

export interface ProgramDateConfig {
  hasDate: boolean;
  startDate?: string | null;
  endDate?: string | null;
  messageWithDate?: string;
  messageWithoutDate?: string;
}

export interface Campaign {
  id: number;
  slug: string;
  name: string;
  type: CampaignType;
  config: ProgramDateConfig | Record<string, unknown>;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { subscribers: number; sends?: number };
}

export interface CampaignSubscriber {
  id: number;
  campaignId: number;
  email: string;
  acceptedPrivacy: boolean;
  source?: string;
  status: CampaignSubscriberStatus;
  subscribedAt: string;
  lastNotifiedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignSend {
  id: number;
  campaignId: number;
  subscriberId: number;
  sendType: string;
  status: 'PENDING' | 'SENT' | 'FAILED';
  sentAt?: string;
  errorMessage?: string;
  createdAt: string;
  subscriber?: { email: string };
}

export interface CreateCampaignDto {
  slug: string;
  name: string;
  type: CampaignType;
  config: ProgramDateConfig | Record<string, unknown>;
  enabled?: boolean;
}

export interface UpdateCampaignDto {
  name?: string;
  enabled?: boolean;
  config?: ProgramDateConfig | Record<string, unknown>;
}

@Injectable({ providedIn: 'root' })
export class CampaignService extends ApiBaseService {
  constructor(private http: HttpClient) {
    super(http);
    this.controllerPrefix = '/admin/campaigns';
  }

  getList$(filter: PaginationFilter): Observable<PaginatedResult<Campaign>> {
    return this.post('list', filter) as Observable<PaginatedResult<Campaign>>;
  }

  getById$(id: number): Observable<Campaign> {
    return this.get(`/${id}`) as Observable<Campaign>;
  }

  create$(dto: CreateCampaignDto): Observable<Campaign> {
    return this.post('', dto) as Observable<Campaign>;
  }

  update$(id: number, dto: UpdateCampaignDto): Observable<Campaign> {
    return this.put(`/${id}`, dto) as Observable<Campaign>;
  }

  delete$(id: number): Observable<void> {
    return this.delete(`/${id}`) as Observable<void>;
  }

  getSubscribers$(
    campaignId: number,
    params?: { status?: CampaignSubscriberStatus; skip?: number; take?: number }
  ): Observable<{
    data: CampaignSubscriber[];
    pagination: { skip: number; take: number; count: number };
  }> {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.skip != null) q.set('skip', String(params.skip));
    if (params?.take != null) q.set('take', String(params.take));
    const query = q.toString();
    return this.get(
      `/${campaignId}/subscribers${query ? '?' + query : ''}`
    ) as Observable<any>;
  }

  exportSubscribers$(campaignId: number): Observable<Blob> {
    return this._http.get(
      `${environment.apiUrl}/admin/campaigns/${campaignId}/subscribers/export`,
      { responseType: 'blob', withCredentials: true }
    ) as Observable<Blob>;
  }

  updateSubscriberStatus$(
    campaignId: number,
    subscriberId: number,
    status: CampaignSubscriberStatus
  ): Observable<CampaignSubscriber> {
    return this.put(`/${campaignId}/subscribers/${subscriberId}`, {
      status,
    }) as Observable<CampaignSubscriber>;
  }

  deleteSubscriber$(
    campaignId: number,
    subscriberId: number
  ): Observable<void> {
    return this.delete(
      `/${campaignId}/subscribers/${subscriberId}`
    ) as Observable<void>;
  }

  resetSubscribers$(campaignId: number): Observable<{ reset: number }> {
    return this.post(`/${campaignId}/subscribers/reset`, {}) as Observable<{
      reset: number;
    }>;
  }

  send$(campaignId: number): Observable<{
    sent: number;
    failed: number;
    skipped: number;
  }> {
    return this.post(`/${campaignId}/send`, {}) as Observable<any>;
  }

  getSends$(
    campaignId: number,
    skip?: number,
    take?: number
  ): Observable<{
    data: CampaignSend[];
    pagination: { skip: number; take: number; count: number };
  }> {
    const q = new URLSearchParams();
    if (skip != null) q.set('skip', String(skip));
    if (take != null) q.set('take', String(take));
    const query = q.toString();
    return this.get(
      `/${campaignId}/sends${query ? '?' + query : ''}`
    ) as Observable<any>;
  }
}
