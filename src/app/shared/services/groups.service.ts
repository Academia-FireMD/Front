import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CreateGroupDto, Group, UsuarioGroup } from '../models/group.model';

@Injectable({
  providedIn: 'root'
})
export class GroupsService {
  private apiUrl = `${environment.apiUrl}/groups`;

  constructor(private http: HttpClient) {}

  createGroup(dto: CreateGroupDto): Observable<Group> {
    return this.http.post<Group>(this.apiUrl, dto);
  }

  getGroups(): Observable<Group[]> {
    return this.http.get<Group[]>(this.apiUrl);
  }

  getGroup(id: string): Observable<Group> {
    return this.http.get<Group>(`${this.apiUrl}/${id}`);
  }

  deleteGroup(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
  }

  // Usuario - Group memberships
  addUserToGroup(groupId: string, userId: number): Observable<Group> {
    return this.http.post<Group>(`${this.apiUrl}/${groupId}/users`, { userId });
  }

  removeUserFromGroup(groupId: string, userId: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${groupId}/users/${userId}`);
  }

  getUserGroups(userId: number): Observable<UsuarioGroup[]> {
    return this.http.get<UsuarioGroup[]>(`${this.apiUrl}/users/${userId}`);
  }
}

