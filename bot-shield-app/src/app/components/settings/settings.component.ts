import { Component } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-settings',
  imports: [MatTabsModule, MatButtonModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss'
})
export class SettingsComponent {
  links = ['First', 'Second', 'Third'];
  activeLink = this.links[0];
  addLink() {
    this.links.push(`Link ${this.links.length + 1}`);
  }
}
