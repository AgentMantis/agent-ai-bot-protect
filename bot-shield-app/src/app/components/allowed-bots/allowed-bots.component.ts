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
        },
        error: (error) => {
          console.error('Error fetching robots.txt:', error);
        }
      });
  }

  commitRobotsTxt() {
    // Generate new robots.txt content based on selections
    const selectedBotNames = Object.entries(this.selectedBots)
      .filter(([_, selected]) => selected)
      .map(([botName]) => botName);

    const newRobotsTxt = selectedBotNames
      .map(bot => `User-agent: ${bot}\nDisallow: /`)
      .join('\n\n');

    this.generatedRobotsTxt = newRobotsTxt;
    console.log(newRobotsTxt);
    // Here you can add logic to download or display the generated robots.txt
  }
}
