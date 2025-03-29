import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { WordPressAuthService } from './wordpress-auth.service';

export interface BotAnalysisResponse {
  success: boolean;
  data: {
    total_requests: number;
    blocked_requests: number;
    detected_bots: { 
      [key: string]: {
        total: number;
        blocked: number;
      } 
    };
    daily_stats: {
      date: string;
      hits: number;
      blocks: number;
    }[];
  };
}

export interface BotStatsResponse {
  success: boolean;
  data: {
    start_date: string;
    end_date: string;
    bots: { 
      [key: string]: {
        total: number;
        blocked: number;
      } 
    };
    daily: {
      date: string;
      hits: number;
      blocks: number;
    }[];
  };
}

@Injectable({
  providedIn: 'root'
})
export class BotAnalysisService {
  constructor(
    private http: HttpClient,
    private wpAuth: WordPressAuthService
  ) {
  }

  analyzeLogs(): Observable<BotAnalysisResponse> {
    const endpoint = '/wp-json/agent-ai-bot-protect/v1/analyze-logs';
    
    return this.http.get<BotAnalysisResponse>(endpoint, {
      headers: this.wpAuth.getAuthHeaders()
    });
  }
  
  getBotStats(startDate?: string, endDate?: string): Observable<BotStatsResponse> {
    let endpoint = '/wp-json/agent-ai-bot-protect/v1/bot-stats';
    
    // Add date range parameters if provided
    const params: string[] = [];
    if (startDate) {
      params.push(`start_date=${startDate}`);
    }
    if (endDate) {
      params.push(`end_date=${endDate}`);
    }
    
    if (params.length > 0) {
      endpoint += '?' + params.join('&');
    }
    
    return this.http.get<BotStatsResponse>(endpoint, {
      headers: this.wpAuth.getAuthHeaders()
    });
  }
} 