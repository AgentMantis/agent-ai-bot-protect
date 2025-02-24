import { Component, OnInit, ElementRef, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { MatCheckboxModule } from '@angular/material/checkbox';
@Component({
  selector: 'app-allowed-bots',
  imports: [
    CommonModule,
    RouterModule,
    HttpClientModule,
    MatCheckboxModule,
    FormsModule
  ],
  templateUrl: './allowed-bots.component.html',
  styleUrl: './allowed-bots.component.scss',
  standalone: true,
})

export class AllowedBotsComponent implements OnInit {
  robotsTxtUrl = 'assets/robots.txt';
  botList: string[] = [];
  selectedBots: { [key: string]: boolean } = {};
  generatedRobotsTxt = '';

  constructor(private http: HttpClient, private el: ElementRef, private renderer: Renderer2) {}

  ngOnInit() {
    this.fetchRobotsTxt();
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
    const blockedBots = Object.keys(this.selectedBots).filter(bot => this.selectedBots[bot]);
    this.generatedRobotsTxt = blockedBots.map(bot => `User-agent: ${bot}\nDisallow: /`).join('\n\n');
  }

  fetchRobotsTxt() {
    // First fetch the bot list from assets
    this.http.get(this.robotsTxtUrl, { responseType: 'text' })
        .subscribe({
            next: (content) => {
                // Parse the robots.txt content to extract bot names
                const userAgentLines = content.split('\n')
                    .filter(line => line.trim().startsWith('User-agent:'));
                
                this.botList = userAgentLines.map(line => 
                    line.replace('User-agent:', '').trim()
                );

                // Initialize selectedBots object to false
                this.botList.forEach(bot => {
                    this.selectedBots[bot] = false;
                });

                // Now fetch the actual robots.txt from WordPress root with cache busting
                const timestamp = new Date().getTime();
                this.http.get(`/robots.txt?t=${timestamp}`, { 
                    responseType: 'text',
                    headers: {
                        'Cache-Control': 'no-cache',
                        'Pragma': 'no-cache'
                    }
                }).subscribe({
                    next: (robotsTxt) => {
                        console.log('Fetched robots.txt:', robotsTxt);
                        
                        // Modified regex pattern to be more flexible with whitespace
                        const botShieldMatch = robotsTxt.match(/# Begin BotShield\s*([\s\S]*?)\s*# End BotShield/);
                        
                        if (botShieldMatch && botShieldMatch[1]) {
                            console.log('Found BotShield section:', botShieldMatch[1]);
                            const botShieldContent = botShieldMatch[1].trim();
                            
                            // Split into individual bot sections and filter out empty strings
                            const sections = botShieldContent.split(/\n\s*\n/).filter(Boolean);
                            console.log('Parsed sections:', sections);
                            
                            sections.forEach(section => {
                                // More flexible regex patterns
                                const userAgentMatch = section.match(/User-agent:\s*([^\n]+)/i);
                                const disallowMatch = section.match(/Disallow:\s*([^\n]+)/i);

                                if (userAgentMatch && disallowMatch) {
                                    const botName = userAgentMatch[1].trim();
                                    const disallowValue = disallowMatch[1].trim();

                                    console.log('Found bot:', botName, 'Disallow:', disallowValue);

                                    // If this bot is in our list and has Disallow: /, mark it as selected
                                    if (this.botList.includes(botName) && disallowValue === '/') {
                                        console.log('Selecting bot:', botName);
                                        this.selectedBots[botName] = true;
                                    }
                                }
                            });

                            this.updateRobotsTxt();
                        } else {
                            console.log('No BotShield section found in robots.txt');
                            console.log('robots.txt content:', robotsTxt);
                        }
                    },
                    error: (error) => {
                        console.error('Error fetching current robots.txt:', error);
                    }
                });
            },
            error: (error) => {
                console.error('Error fetching bot list:', error);
            }
        });
  }

  commitRobotsTxt() {
    // Generate new sections for selected bots
    const selectedBotNames = Object.entries(this.selectedBots)
        .filter(([_, selected]) => selected)
        .map(([botName]) => botName);

    const botSections = selectedBotNames
        .map(bot => `User-agent: ${bot}\nDisallow: /`);

    // Combine sections
    const newContent = botSections.join('\n\n');
    
    // Save the content (PHP will handle wrapping it in BotShield comments)
    this.saveRobotsTxt(newContent);
  }

  saveRobotsTxt(content: string) {
    const endpoint = '/wp-json/bot-shield/v1/save-robots-txt';
    
    console.log('Attempting to save robots.txt with content:', content);
    
    return this.http.post(endpoint, { content }, {
        headers: {
            'X-WP-Nonce': (window as any).wpRestNonce
        }
    }).subscribe({
        next: (response: any) => {
            console.log('robots.txt saved successfully:', response);
            this.generatedRobotsTxt = content; // Update the display
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
      content += `User-agent: ${bot}\n`;
      content += 'Allow: /\n\n';
    });

    return content;
  }

  toggleBot(bot: string) {
    this.selectedBots[bot] = !this.selectedBots[bot];
    this.updateRobotsTxt();
  }
}
