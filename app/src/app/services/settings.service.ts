import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, switchMap, shareReplay } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  private readonly ROBOTS_TXT_URL_KEY = 'robotsTxtUrl';
  private defaultRobotsTxtUrl = '/wp-content/plugins/agent-ai-bot-protect/dist/assets/robots.txt';
  
  private robotsTxtUrlSubject = new BehaviorSubject<string>(this.defaultRobotsTxtUrl);
  private robotsTxtContent$ = this.robotsTxtUrlSubject.pipe(
    switchMap(url => this.http.get(url, { responseType: 'text' })),
    shareReplay(1)
  );

  constructor(private http: HttpClient) {
    // Initialize by checking WordPress option
    this.initializeRobotsTxtUrl();
  }

  private initializeRobotsTxtUrl() {
    this.http.get<{ url: string }>(`${environment.wordpressUrl}/wp-json/agent-ai-bot-protect/v1/robots-txt-url`)
      .subscribe({
        next: (response) => {
          if (response.url) {
            this.robotsTxtUrlSubject.next(response.url);
          }
        },
        error: (error) => {
          console.error('Error fetching robots.txt URL from WordPress:', error);
          // Fallback to default URL if WordPress option is not available
          this.robotsTxtUrlSubject.next(this.defaultRobotsTxtUrl);
        }
      });
  }

  getRobotsTxtUrl(): Observable<string> {
    return this.robotsTxtUrlSubject.asObservable();
  }

  getRobotsTxtContent(): Observable<string> {
    return this.robotsTxtContent$;
  }

  setRobotsTxtUrl(url: string): void {
    // Save to WordPress via REST API
    this.http.post(`${environment.wordpressUrl}/wp-json/agent-ai-bot-protect/v1/robots-txt-url`, { url })
      .subscribe({
        next: () => {
          this.robotsTxtUrlSubject.next(url);
        },
        error: (error) => {
          console.error('Error saving robots.txt URL to WordPress:', error);
          // You might want to handle the error appropriately here
        }
      });
  }
} 