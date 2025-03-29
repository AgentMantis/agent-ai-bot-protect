import { Component, OnInit, ElementRef, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { SettingsService } from '../../services/settings.service';
import { Bot } from '../../interfaces/bot.interface';

@Component({
  selector: 'app-allowed-bots',
  imports: [
    CommonModule,
    RouterModule,
    MatCheckboxModule,
    MatSlideToggleModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    FormsModule
  ],
  templateUrl: './allowed-bots.component.html',
  styleUrl: './allowed-bots.component.scss',
  standalone: true,
})

export class AllowedBotsComponent implements OnInit {
  botList: Bot[] = [];
  disallowedBots: { [key: string]: boolean } = {};
  generatedRobotsTxt = '';
  searchTerm = '';
  filteredBotList: Bot[] = [];

  constructor(
    private http: HttpClient,
    private el: ElementRef,
    private renderer: Renderer2,
    private settingsService: SettingsService
  ) {}

  ngOnInit() {
    // Try to set the nonce directly from the script tag
    const scriptTag = document.getElementById('agent-ai-bot-protect-module-js-extra');
    if (scriptTag && scriptTag.textContent) {
      const content = scriptTag.textContent;
      const match = content.match(/var\s+AgentAIBotProtectData \s*=\s*\{[^}]*wpRestNonce[^}]*:\s*["']([^"']*)["']/);
      if (match && match[1]) {
        // console.log('Found nonce in script tag during initialization.');
        this.setNonce(match[1]);
      }
    }
    
    // Continue with the regular initialization
    this.loadBots();
    this.setupDivider();
  }

  setupDivider() {
    const divider = this.el.nativeElement.querySelector('.divider');
    const container = this.el.nativeElement.querySelector('.panel-container');
    const leftPanel = this.el.nativeElement.querySelector('.robots-form');
    const rightPanel = this.el.nativeElement.querySelector('.output-panel');

    // Add cursor styling to divider
    this.renderer.setStyle(divider, 'cursor', 'col-resize');
    
    let isDragging = false;
    let mouseMoveListener: () => void;
    let mouseUpListener: () => void;

    this.renderer.listen(divider, 'mousedown', (e) => {
      isDragging = true;
      
      // Prevent text selection while dragging
      this.renderer.setStyle(document.body, 'user-select', 'none');
      
      mouseMoveListener = this.renderer.listen('document', 'mousemove', onMouseMove);
      mouseUpListener = this.renderer.listen('document', 'mouseup', onMouseUp);
    });

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      const containerRect = container.getBoundingClientRect();
      const offset = e.clientX - containerRect.left;
      const totalWidth = containerRect.width;

      const leftWidth = (offset / totalWidth) * 100;
      const rightWidth = 100 - leftWidth;

      this.renderer.setStyle(leftPanel, 'flex', `1 1 ${leftWidth}%`);
      this.renderer.setStyle(rightPanel, 'flex', `1 1 ${rightWidth}%`);
    };

    const onMouseUp = () => {
      isDragging = false;
      // Re-enable text selection
      this.renderer.setStyle(document.body, 'user-select', '');
      mouseMoveListener();
      mouseUpListener();
    };
  }

  // Add a method to fetch a new nonce
  private fetchNewNonce() {
    // This is a common WordPress endpoint that can be used to get a new nonce
    const ajaxUrl = (window as any).ajaxurl || '/wp-admin/admin-ajax.php';
    
    // Create a form data object
    const formData = new FormData();
    formData.append('action', 'bot_shield_get_nonce');
    
    // Make a POST request to the admin-ajax.php endpoint
    this.http.post(ajaxUrl, formData).subscribe({
      next: (response: any) => {
        if (response && response.success && response.data) {
          console.log('Successfully fetched new nonce');
          (window as any).wpRestNonce = response.data;
        } else {
          console.error('Failed to fetch new nonce:', response);
        }
      },
      error: (error) => {
        console.error('Error fetching new nonce:', error);
      }
    });
  }

  updateRobotsTxt() {
    const blockedBots = Object.keys(this.disallowedBots).filter(bot => this.disallowedBots[bot]);
    this.generatedRobotsTxt = blockedBots.length > 0 
        ? blockedBots.map(bot => `User-agent: ${bot}\nDisallow: /`).join('\n\n')
        : '';
  }

  private loadBots() {
    this.settingsService.getRobotsTxtContent().subscribe({
      next: (content) => {
        // Parse the robots.txt content to extract bot names and descriptions
        const lines = content.split('\n');
        let currentBot: Partial<Bot> = {};
        
        this.botList = [];
        
        lines.forEach(line => {
          if (line.startsWith('#')) {
            currentBot.description = line.substring(1).trim();
          } else if (line.startsWith('User-agent:')) {
            if (currentBot.name) {
              this.botList.push(currentBot as Bot);
            }
            currentBot = {
              name: line.replace('User-agent:', '').trim(),
              description: ''
            };
          }
        });
        
        // Add the last bot
        if (currentBot.name) {
          this.botList.push(currentBot as Bot);
        }

        // Initialize filtered list
        this.filteredBotList = this.botList;

        // Initialize all bots to allowed (false means not disallowed)
        this.botList.forEach(bot => {
          this.disallowedBots[bot.name] = false;
        });

        this.loadCurrentBlockedBots();
      },
      error: (error) => console.error('Error fetching bot list:', error)
    });
  }

  private loadCurrentBlockedBots() {
    const timestamp = new Date().getTime();
    this.http.get(`/robots.txt?t=${timestamp}`, { 
      responseType: 'text',
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    }).subscribe({
      next: (robotsTxt) => {
        const botShieldMatch = robotsTxt.match(/# Begin BotShield\s*([\s\S]*?)\s*# End BotShield/);
        if (botShieldMatch && botShieldMatch[1]) {
          const botShieldContent = botShieldMatch[1].trim();
          const sections = botShieldContent.split(/\n\s*\n/).filter(Boolean);
          
          sections.forEach(section => {
            const userAgentMatch = section.match(/User-agent:\s*([^\n]+)/i);
            const disallowMatch = section.match(/Disallow:\s*([^\n]+)/i);

            if (userAgentMatch && disallowMatch) {
              const botName = userAgentMatch[1].trim();
              const disallowValue = disallowMatch[1].trim();

              if (this.botList.some(bot => bot.name === botName) && disallowValue === '/') {
                this.disallowedBots[botName] = true;
              }
            }
          });

          this.updateRobotsTxt();
        }
      },
      error: (error) => console.error('Error fetching current robots.txt:', error)
    });
  }

  commitRobotsTxt() {
    
    const blockedBotNames = Object.entries(this.disallowedBots)
        .filter(([_, selected]) => selected)
        .map(([botName]) => botName);


    // Handle the case where no bots are selected
    if (blockedBotNames.length === 0) {
      console.log('No bots are blocked, clearing BotShield section');
      // Save an empty string to clear the BotShield section
      this.saveRobotsTxt('');
      this.generatedRobotsTxt = '';
      return;
    }

    const botSections = blockedBotNames
        .map(bot => `User-agent: ${bot}\nDisallow: /`);

    const newContent = botSections.join('\n\n');
    
    // Always save, even if content is empty string
    
    this.saveRobotsTxt(newContent);
    // Update the display
    this.generatedRobotsTxt = newContent;
  }

  saveRobotsTxt(content: string) {
    const endpoint = '/wp-json/agent-ai-bot-protect/v1/save-robots-txt';
    
    // Ensure content is always a string, even if null or undefined
    const safeContent = content || '';
    
    // Prepare the payload
    const payload = {
      content: safeContent,
      clear: safeContent === ''
    };
    
    // Check if wpRestNonce is available
    if (!(window as any).wpRestNonce) {
      console.error('WordPress REST API nonce is not available. Authentication will fail.');
      console.log('Please ensure that the WordPress site is properly loading the nonce value.');
      console.log('You may need to refresh the page or check if you are logged in to WordPress.');
      
      // Try to get the nonce from AgentAIBotProtectData  first
      if ((window as any).AgentAIBotProtectData  && (window as any).AgentAIBotProtectData .wpRestNonce) {
        console.log('Found nonce in AgentAIBotProtectData .wpRestNonce.');
        this.setNonce((window as any).AgentAIBotProtectData .wpRestNonce);
      } else {
        // Try to extract from script tag
        const scriptTag = document.getElementById('agent-ai-bot-protect-module-js-extra');
        if (scriptTag && scriptTag.textContent) {
          const content = scriptTag.textContent;
          const match = content.match(/var\s+AgentAIBotProtectData \s*=\s*\{[^}]*wpRestNonce[^}]*:\s*["']([^"']*)["']/);
          if (match && match[1]) {
            this.setNonce(match[1]);
          } else {
            console.log('Could not find nonce in script tag.');
          }
        } else {
          // Try to get the nonce from the page meta tags
          const nonceElement = document.querySelector('meta[name="wp-rest-nonce"]');
          if (nonceElement && nonceElement.getAttribute('content')) {
            console.log('Found nonce in page meta tag, using that instead.');
            this.setNonce(nonceElement.getAttribute('content') || '');
          } else {
            console.log('Could not find nonce in page meta tags.');
          }
        }
      }
    }
    
    // Log the request details for debugging
    // console.log('Attempting to save robots.txt with payload:', payload);
    // console.log('Endpoint:', endpoint);
    // console.log('wpRestNonce available:', (window as any).wpRestNonce ? 'Yes' : 'No');
    // if ((window as any).wpRestNonce) {
    //   console.log('Nonce value (first few chars):', (window as any).wpRestNonce.substring(0, 5) + '...');
    // }
    
    // Create headers object with all required headers
    const headers: any = {
      'Content-Type': 'application/json'
    };
    
    // Only add the nonce if it exists
    if ((window as any).wpRestNonce) {
      headers['X-WP-Nonce'] = (window as any).wpRestNonce;
    }
    
    // Add credentials to ensure cookies are sent
    this.http.post<{success: boolean, message: string, final_content: string}>(
      endpoint, 
      payload, 
      { 
        headers,
        withCredentials: true // This ensures cookies are sent with the request
      }
    ).subscribe({
      next: (response) => {
        // console.log('robots.txt saved successfully:', response);
        // Extract only the BotShield section
        const botShieldMatch = response.final_content.match(/# Begin BotShield\s*([\s\S]*?)\s*# End BotShield/);
        if (botShieldMatch && botShieldMatch[1]) {
          this.generatedRobotsTxt = botShieldMatch[1].trim();
        } else {
          this.generatedRobotsTxt = '';
        }
      },
      error: (error) => {
        console.error('Error saving robots.txt:', error);
        
        // Provide more detailed error information based on status code
        if (error.status === 401) {
          console.error('Authentication failed (401 Unauthorized). Please check if:');
          console.error('1. You are logged in to WordPress');
          console.error('2. The nonce is valid and not expired');
          console.error('3. You have permission to edit robots.txt');
          
          // Try to refresh the nonce if possible
          console.log('Attempting to refresh the nonce...');
          this.refreshNonce();
        } else if (error.status === 403) {
          console.error('Permission denied (403 Forbidden). You do not have permission to edit robots.txt.');
        } else if (error.status === 404) {
          console.error('Endpoint not found (404 Not Found). The BotShield plugin might not be active or properly set up.');
        }
        
        if (error.error && error.error.message) {
          console.error('Server error message:', error.error.message);
        }
        
        // Log more detailed error information
        console.error('Error status:', error.status);
        console.error('Error details:', error);
      }
    });
  }

  // Add this method to generate and save robots.txt content
  generateAndSaveRobotsTxt() {
    // Generate your robots.txt content based on your allowed bots
    const robotsTxtContent = this.generateRobotsTxtContent(); // Implement this method based on your needs
    
    // Save the generated content
    this.saveRobotsTxt(robotsTxtContent);
  }

  private generateRobotsTxtContent(): string {
    // Example implementation - adjust according to your data structure
    let content = 'User-agent: *\n';
    content += 'Disallow: /wp-admin/\n';
    content += 'Allow: /wp-admin/admin-ajax.php\n\n';

    // Add allowed bots
    this.botList.forEach(bot => {
      content += `User-agent: ${bot.name}\n`;
      content += 'Allow: /\n\n';
    });

    return content;
  }

  toggleBot(bot: string) {
    this.disallowedBots[bot] = !this.disallowedBots[bot];
    // console.log(`Bot ${bot} toggled to ${this.disallowedBots[bot] ? 'disallowed' : 'allowed'}`);
    this.updateRobotsTxt();
    // Commit changes immediately when a bot is toggled
    this.commitRobotsTxt();
  }

  filterBots() {
    if (!this.searchTerm.trim()) {
      this.filteredBotList = this.botList;
      return;
    }
    
    const search = this.searchTerm.toLowerCase();
    this.filteredBotList = this.botList.filter(bot => 
      bot.name.toLowerCase().includes(search) || 
      (bot.description && bot.description.toLowerCase().includes(search))
    );
  }

  areAllBotsDisallowed(): boolean {
    return this.botList.every(bot => this.disallowedBots[bot.name]);
  }

  toggleAllBots(allow: boolean) {
    this.botList.forEach(bot => {
      this.disallowedBots[bot.name] = !allow;
    });
    this.updateRobotsTxt();
    this.commitRobotsTxt();
  }

  // Add a public method to refresh the nonce
  refreshNonce() {
    console.log('Manually refreshing WordPress nonce...');
    
    // Try to get the nonce from AgentAIBotProtectData  first
    if ((window as any).AgentAIBotProtectData  && (window as any).AgentAIBotProtectData .wpRestNonce) {
      this.setNonce((window as any).AgentAIBotProtectData .wpRestNonce);
      alert('Authentication token refreshed from AgentAIBotProtectData . Please try saving again.');
      return;
    }
    
    // Try to extract from script tag
    const scriptTag = document.getElementById('agent-ai-bot-protect-module-js-extra');
    if (scriptTag && scriptTag.textContent) {
      const content = scriptTag.textContent;
      const match = content.match(/var\s+AgentAIBotProtectData \s*=\s*\{[^}]*wpRestNonce[^}]*:\s*["']([^"']*)["']/);
      if (match && match[1]) {
        this.setNonce(match[1]);
        alert('Authentication token refreshed from script tag. Please try saving again.');
        return;
      }
    }
    
    // If we couldn't find it in the expected places, try to fetch a new one
    this.fetchNewNonce();
    alert('Authentication token refresh requested. Please try saving again in a few seconds.');
  }
  
  // Method to set the nonce and log it
  setNonce(nonce: string) {
    // console.log('Setting nonce to:', nonce.substring(0, 5) + '...');
    (window as any).wpRestNonce = nonce;
  }
}
