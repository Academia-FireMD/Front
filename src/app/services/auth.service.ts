import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { tap } from 'rxjs';
import { ApiBaseService } from './api-base.service';

@Injectable({
  providedIn: 'root',
})
export class AuthService extends ApiBaseService {
  constructor(private http: HttpClient) {
    super(http);
    this.controllerPrefix = '/auth';
  }

  public register$(email: string, password: string) {
    return this.post('/register', { email, password });
  }
  public login$(email: string, password: string) {
    return this.post('/login', { email, password }).pipe(
      tap((token) => {
        if (token && token.access_token) this.setToken(token.access_token);
      })
    );
  }

  private readonly TOKEN_KEY = 'authToken';

  setToken(token: string): void {
    sessionStorage.setItem(this.TOKEN_KEY, token);
  }

  getToken(): string | null {
    return sessionStorage.getItem(this.TOKEN_KEY);
  }

  decodeToken(): any {
    const token = this.getToken();

    if (!token) {
      return null;
    }

    const payload = token.split('.')[1];
    return JSON.parse(atob(payload));
  }

  clearToken(): void {
    sessionStorage.removeItem(this.TOKEN_KEY);
  }
}
