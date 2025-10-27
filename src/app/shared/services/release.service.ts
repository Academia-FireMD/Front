import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
    AddReleaseItemDto,
    CreateAudienceRuleDto,
    CreateReleaseDto,
    Release,
    UpdateReleaseDto
} from '../models/release.model';

@Injectable({
  providedIn: 'root'
})
export class ReleaseService {
  private apiUrl = `${environment.apiUrl}/releases`;

  constructor(private http: HttpClient) {}

  createRelease(dto: CreateReleaseDto): Observable<Release> {
    return this.http.post<Release>(this.apiUrl, dto);
  }

  updateRelease(id: string, dto: UpdateReleaseDto): Observable<Release> {
    return this.http.put<Release>(`${this.apiUrl}/${id}`, dto);
  }

  getReleases(): Observable<Release[]> {
    return this.http.get<Release[]>(this.apiUrl);
  }

  getRelease(id: string): Observable<Release> {
    return this.http.get<Release>(`${this.apiUrl}/${id}`);
  }

  deleteRelease(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
  }

  // Items
  addItems(releaseId: string, items: AddReleaseItemDto[]): Observable<Release> {
    return this.http.post<Release>(`${this.apiUrl}/${releaseId}/items`, { items });
  }

  removeItem(releaseId: string, itemId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${releaseId}/items/${itemId}`);
  }

  // Audience Rules
  addAudienceRules(releaseId: string, rules: CreateAudienceRuleDto[]): Observable<Release> {
    return this.http.post<Release>(`${this.apiUrl}/${releaseId}/audience`, { rules });
  }

  removeAudienceRule(releaseId: string, ruleId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${releaseId}/audience/${ruleId}`);
  }

  // Preview
  previewForUser(userId: number, at?: string): Observable<any> {
    const params: any = { userId: userId.toString() };
    if (at) {
      params.at = at;
    }
    return this.http.get(`${this.apiUrl}/preview/user`, { params });
  }
}

