import { Component, OnInit, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { Chart, registerables } from 'chart.js';
import { MatCardModule } from '@angular/material/card';
import { CommonModule } from '@angular/common';

import { BotAnalysisService, BotAnalysisResponse } from '../../services/bot-analysis.service';

// Register Chart.js components
Chart.register(...registerables);

@Component({
  selector: 'app-dashboard',
  imports: [
    CommonModule,
    MatCardModule,
    
  ],
  providers: [BotAnalysisService],
  standalone: true,
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit, AfterViewInit {
  @ViewChild('botChart') private chartRef!: ElementRef;
  private chart: Chart | undefined;

  constructor(private botAnalysisService: BotAnalysisService) {}

  ngOnInit() {
    this.loadBotData();
  }

  ngAfterViewInit() {
    // Initial chart will be updated when data loads
    this.createChart([]);
  }

  private loadBotData() {
    this.botAnalysisService.analyzeLogs().subscribe({
      next: (response) => {
        if (response.success && response.data.detected_bots) {
          // Convert detected_bots object to array format for chart
          const botData = Object.entries(response.data.detected_bots).map(([name, count]) => ({
            userAgent: name,
            hitCount: count
          }));
          this.updateChart(botData);
        }
      },
      error: (err) => {
        console.error('Failed to load bot data:', err);
      }
    });
  }

  private createChart(initialData: { userAgent: string; hitCount: number }[] = []) {
    if (!this.chartRef) {
      console.error('Chart reference not found');
      return;
    }
    
    const canvas = this.chartRef.nativeElement as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('Could not get 2D context');
      return;
    }
    
    this.chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: initialData.map(data => data.userAgent),
        datasets: [{
          label: 'Number of Hits',
          data: initialData.map(data => data.hitCount),
          backgroundColor: [
            'rgba(54, 162, 235, 0.6)',
            'rgba(255, 99, 132, 0.6)',
            'rgba(75, 192, 192, 0.6)',
            'rgba(255, 206, 86, 0.6)',
            'rgba(153, 102, 255, 0.6)'
          ],
          borderColor: [
            'rgba(54, 162, 235, 1)',
            'rgba(255, 99, 132, 1)',
            'rgba(75, 192, 192, 1)',
            'rgba(255, 206, 86, 1)',
            'rgba(153, 102, 255, 1)'
          ],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Number of Hits'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Bot User Agent'
            }
          }
        }
      }
    });
  }

  private updateChart(botData: { userAgent: string; hitCount: number }[]) {
    if (!this.chart) {
      this.createChart(botData);
      return;
    }

    this.chart.data.labels = botData.map(data => data.userAgent);
    this.chart.data.datasets[0].data = botData.map(data => data.hitCount);
    this.chart.update();
  }
}
