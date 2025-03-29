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
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
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
