import { Component, OnInit, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { Chart, registerables } from 'chart.js';
import { MatCardModule } from '@angular/material/card';
import { CommonModule } from '@angular/common';

// Register Chart.js components
Chart.register(...registerables);

interface BotTrafficData {
  userAgent: string;
  hitCount: number;
}

@Component({
  selector: 'app-dashboard',
  imports: [
    CommonModule,
    MatCardModule
  ],
  standalone: true,
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit, AfterViewInit {
  @ViewChild('botChart') private chartRef!: ElementRef;
  private chart: Chart | undefined;

  // Sample bot traffic data
  private botTrafficData: BotTrafficData[] = [
    { userAgent: 'Googlebot', hitCount: 150 },
    { userAgent: 'Bingbot', hitCount: 80 },
    { userAgent: 'YandexBot', hitCount: 45 },
    { userAgent: 'DuckDuckBot', hitCount: 30 },
    { userAgent: 'Unknown Bot', hitCount: 95 }
  ];

  ngOnInit() {
    // Remove chart creation from here
  }

  ngAfterViewInit() {
    console.log('View initialized');
    // Add setTimeout back to ensure view is ready
    setTimeout(() => {
      this.createChart();
    }, 0);
  }

  private createChart() {
    console.log('Creating chart...');
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

    console.log('Bot traffic data:', this.botTrafficData);
    
    this.chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: this.botTrafficData.map(data => data.userAgent),
        datasets: [{
          label: 'Number of Hits',
          data: this.botTrafficData.map(data => data.hitCount),
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

    console.log('Chart created:', this.chart);
  }
}
