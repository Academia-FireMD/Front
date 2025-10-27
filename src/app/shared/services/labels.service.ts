import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CreateLabelDto, Label, UsuarioLabel } from '../models/label.model';

@Injectable({
  providedIn: 'root'
})
export class LabelsService {
  private apiUrl = `${environment.apiUrl}/labels`;

  constructor(private http: HttpClient) {}

  createLabel(dto: CreateLabelDto): Observable<Label> {
    return this.http.post<Label>(this.apiUrl, dto);
  }

  getLabels(): Observable<Label[]> {
    return this.http.get<Label[]>(this.apiUrl);
  }

  deleteLabel(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
  }

  // Usuario - Label assignments
  assignLabelToUser(userId: number, labelId: string): Observable<UsuarioLabel[]> {
    return this.http.post<UsuarioLabel[]>(`${this.apiUrl}/users/${userId}/labels`, { labelId });
  }

  assignLabelByKeyValue(userId: number, key: string, value?: string): Observable<UsuarioLabel[]> {
    return this.http.post<UsuarioLabel[]>(`${this.apiUrl}/users/${userId}/labels/keyvalue`, { key, value });
  }

  removeLabelFromUser(userId: number, labelId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/users/${userId}/labels/${labelId}`);
  }

  getUserLabels(userId: number): Observable<UsuarioLabel[]> {
    return this.http.get<UsuarioLabel[]>(`${this.apiUrl}/users/${userId}`);
  }
}

