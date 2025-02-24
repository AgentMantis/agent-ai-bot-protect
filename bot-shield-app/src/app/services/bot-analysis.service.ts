import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface BotAnalysisResponse {
  success: boolean;
  data: {
    total_requests: number;
    bot_requests: number;
    detected_bots: { [key: string]: number };
    recent_bot_visits: {
      bot: string;
      time: string;
      user_agent: string;
    }[];
  };
}

@Injectable({
  providedIn: 'root'
})
export class BotAnalysisService {
  constructor(private http: HttpClient) {}

  analyzeLogs(): Observable<BotAnalysisResponse> {
    const endpoint = '/wp-json/bot-shield/v1/analyze-logs';
    
    return this.http.get<BotAnalysisResponse>(endpoint, {
      headers: {
        'X-WP-Nonce': (window as any).wpRestNonce
      }
    });
  }
} 