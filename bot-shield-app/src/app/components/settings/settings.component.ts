import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { SettingsService } from '../../services/settings.service';
import { MatIconModule } from '@angular/material/icon';


@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule,
    MatInputModule,
    MatFormFieldModule,
    MatButtonModule,
    MatIconModule,
    
  ],
  template: `
    <div class="settings-container">
      <h2>Settings</h2>
      
      <mat-form-field class="full-width">
        <mat-label>Robots.txt URL</mat-label>
        <input 
          matInput
          type="text" 
          [(ngModel)]="robotsTxtUrl" 
          placeholder="Enter robots.txt URL"
          (blur)="updateRobotsTxtUrl()">
        <button 
          mat-icon-button 
          matSuffix 
          (click)="resetToDefault()"
          matTooltip="Reset to default">
          <mat-icon>save</mat-icon>
        </button>
      </mat-form-field>

      <div class="help-text">
        This URL specifies where to load the list of known bots from.
        The default value is 'assets/robots.txt'.
      </div>
    </div>
  `,
  styles: [`
    .settings-container {
      padding: 20px;
      max-width: 600px;
      margin: 0 auto;
    }
    .full-width {
      width: 100%;
    }
    .help-text {
      color: #666;
      font-size: 0.9em;
      margin-top: 8px;
    }
  `]
})
export class SettingsComponent implements OnInit {
  robotsTxtUrl: string = '';
  private defaultUrl = 'assets/robots.txt';

  constructor(private settingsService: SettingsService) {}

  ngOnInit() {
    this.settingsService.getRobotsTxtUrl().subscribe(url => {
      this.robotsTxtUrl = url;
    });
  }

  updateRobotsTxtUrl() {
    if (this.robotsTxtUrl.trim()) {
      this.settingsService.setRobotsTxtUrl(this.robotsTxtUrl.trim());
    }
  }

  resetToDefault() {
    this.robotsTxtUrl = this.defaultUrl;
    this.updateRobotsTxtUrl();
  }
}
