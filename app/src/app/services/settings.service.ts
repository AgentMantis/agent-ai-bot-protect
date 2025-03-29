import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, switchMap, shareReplay } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  private readonly ROBOTS_TXT_URL_KEY = 'robotsTxtUrl';
  private defaultRobotsTxtUrl = 'assets/robots.txt';
  
  private robotsTxtUrlSubject = new BehaviorSubject<string>(
    this.getRobotsTxtUrlFromStorage() || this.defaultRobotsTxtUrl
  );

  private robotsTxtContent$ = this.robotsTxtUrlSubject.pipe(
    switchMap(url => this.http.get(url, { responseType: 'text' })),
    shareReplay(1)
  );

  constructor(private http: HttpClient) {}

  getRobotsTxtUrl(): Observable<string> {
    return this.robotsTxtUrlSubject.asObservable();
  }

  getRobotsTxtContent(): Observable<string> {
    return this.robotsTxtContent$;
  }

  setRobotsTxtUrl(url: string): void {
    localStorage.setItem(this.ROBOTS_TXT_URL_KEY, url);
    this.robotsTxtUrlSubject.next(url);
  }

  private getRobotsTxtUrlFromStorage(): string | null {
    return localStorage.getItem(this.ROBOTS_TXT_URL_KEY);
  }
} 