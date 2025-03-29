import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class WordPressAuthService {
  constructor(private http: HttpClient) {
  }

  getNonce(): string | null {
    // Try to get the nonce from AgentAIBotProtectData first
    if ((window as any).AgentAIBotProtectData?.wpRestNonce) {
      return (window as any).AgentAIBotProtectData.wpRestNonce;
    }

    // Try to extract from script tag
    const scriptTag = document.getElementById('agent-ai-bot-protect-module-js-extra');
    if (scriptTag?.textContent) {
      const content = scriptTag.textContent;
      const match = content.match(/var\s+AgentAIBotProtectData\s*=\s*\{[^}]*wpRestNonce[^}]*:\s*["']([^"']*)["']/);
      if (match?.[1]) {
        return match[1];
      }
    }

    // Try to get from meta tag
    const nonceElement = document.querySelector('meta[name="wp-rest-nonce"]');
    if (nonceElement?.getAttribute('content')) {
      return nonceElement.getAttribute('content');
    }

    return null;
  }

  refreshNonce(): Observable<any> {
    // Try to get the nonce from AgentAIBotProtectData first
    if ((window as any).AgentAIBotProtectData?.wpRestNonce) {
      return new Observable(subscriber => {
        subscriber.next({ success: true, data: (window as any).AgentAIBotProtectData.wpRestNonce });
        subscriber.complete();
      });
    }

    // Try to extract from script tag
    const scriptTag = document.getElementById('agent-ai-bot-protect-module-js-extra');
    if (scriptTag?.textContent) {
      const content = scriptTag.textContent;
      const match = content.match(/var\s+AgentAIBotProtectData\s*=\s*\{[^}]*wpRestNonce[^}]*:\s*["']([^"']*)["']/);
      if (match?.[1]) {
        return new Observable(subscriber => {
          subscriber.next({ success: true, data: match[1] });
          subscriber.complete();
        });
      }
    }

    // If we couldn't find it in the expected places, try to fetch a new one
    const ajaxUrl = (window as any).ajaxurl || '/wp-admin/admin-ajax.php';
    const formData = new FormData();
    formData.append('action', 'bot_shield_get_nonce');

    return this.http.post(ajaxUrl, formData);
  }

  setNonce(nonce: string): void {
    (window as any).wpRestNonce = nonce;
  }

  getAuthHeaders(): { [key: string]: string } {
    const nonce = this.getNonce();
    const headers: { [key: string]: string } = {
      'Content-Type': 'application/json'
    };

    if (nonce) {
      headers['X-WP-Nonce'] = nonce;
    }

    return headers;
  }
} 