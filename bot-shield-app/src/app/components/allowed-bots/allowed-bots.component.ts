import { Component, OnInit } from '@angular/core';
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

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.fetchRobotsTxt();
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
