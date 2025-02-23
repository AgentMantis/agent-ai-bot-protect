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
    const container = this.el.nativeElement.querySelector('.container');
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

          // Initialize selectedBots object
          this.botList.forEach(bot => {
            this.selectedBots[bot] = false;
          });

          // Now fetch the actual robots.txt from WordPress root
          this.http.get('/robots.txt', { responseType: 'text' })
            .subscribe({
              next: (robotsTxt) => {
                // Split into sections by blank lines
                const sections = robotsTxt.split('\n\n');
                
                sections.forEach(section => {
                  const lines = section.split('\n');
                  const userAgentLine = lines.find(line => 
                    line.trim().toLowerCase().startsWith('user-agent:')
                  );
                  const disallowLine = lines.find(line => 
                    line.trim().toLowerCase().startsWith('disallow:')
                  );

                  if (userAgentLine && disallowLine) {
                    const botName = userAgentLine.replace('User-agent:', '').trim();
                    const disallowValue = disallowLine.replace('Disallow:', '').trim();

                    // If this bot is in our list and has Disallow: /, mark it as selected
                    if (this.botList.includes(botName) && disallowValue === '/') {
                      this.selectedBots[botName] = true;
                    }
                  }
                });

                // Update the generated text
                this.updateRobotsTxt();
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
    console.log('Starting commitRobotsTxt');
    // First get the current robots.txt content
    this.http.get('/robots.txt', { responseType: 'text' })
        .subscribe({
            next: (currentContent) => {
                console.log('Current robots.txt content:', currentContent);
                
                // Parse existing content into sections
                const sections = currentContent.split('\n\n').filter(Boolean);
                console.log('Parsed sections:', sections);
                
                // Keep non-bot related sections
                const preservedSections = sections.filter(section => {
                    const userAgentLine = section.split('\n')
                        .find(line => line.trim().toLowerCase().startsWith('user-agent:'));
                    if (!userAgentLine) return true;
                    
                    const botName = userAgentLine.replace(/user-agent:/i, '').trim();
                    return !this.botList.includes(botName);
                });
                console.log('Preserved sections:', preservedSections);

                // Generate new sections for selected bots
                const selectedBotNames = Object.entries(this.selectedBots)
                    .filter(([_, selected]) => selected)
                    .map(([botName]) => botName);
                console.log('Selected bots:', selectedBotNames);

                const botSections = selectedBotNames
                    .map(bot => `User-agent: ${bot}\nDisallow: /`);
                console.log('Bot sections:', botSections);

                // Combine preserved sections with new bot sections
                const newContent = [...preservedSections, ...botSections].join('\n\n');
                console.log('New content:', newContent);
                
                // Add trailing newline if there isn't one
                const finalContent = newContent.endsWith('\n') ? newContent : newContent + '\n';
                console.log('Final content to save:', finalContent);

                // Save the combined content
                this.saveRobotsTxt(finalContent);
            },
            error: (error) => {
                console.error('Error fetching current robots.txt:', error);
            }
        });
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
}
