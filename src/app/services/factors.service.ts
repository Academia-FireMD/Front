import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Factor } from '../shared/models/factor.model';
import { ApiBaseService } from './api-base.service';

@Injectable({
  providedIn: 'root',
})
export class FactorsService extends ApiBaseService {
  constructor(private http: HttpClient) {
    super(http);
    this.controllerPrefix = '/factor';
  }

  public updateFactor$(factor: Factor) {
    return this.post('/actualizar-factor', factor) as Observable<Factor>;
  }

  public getFactors$() {
    return this.get('/') as Observable<Factor[]>;
  }
}
