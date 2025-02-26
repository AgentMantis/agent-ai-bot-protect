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

    const botSections = blockedBotNames
        .map(bot => `User-agent: ${bot}\nDisallow: /`);

    const newContent = botSections.join('\n\n');
    
    // Always save, even if content is empty string
    this.saveRobotsTxt(newContent);
    // Update the display
    this.generatedRobotsTxt = newContent;
  }

  saveRobotsTxt(content: string) {
    const endpoint = '/wp-json/bot-shield/v1/save-robots-txt';
    
    const payload = content === '' 
        ? { content: '', clear: true }
        : { content };
    
    console.log('Attempting to save robots.txt with payload:', payload);
    
    return this.http.post<{success: boolean, message: string, final_content: string}>(endpoint, payload, {
        headers: {
            'X-WP-Nonce': (window as any).wpRestNonce
        }
    }).subscribe({
        next: (response) => {
            console.log('robots.txt saved successfully:', response);
            // Update the display with the final content from WordPress
            this.generatedRobotsTxt = response.final_content;
        },
        error: (error) => {
            console.error('Error saving robots.txt:', error);
            if (error.error && error.error.message) {
                console.error('Server error message:', error.error.message);
            }
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
}
