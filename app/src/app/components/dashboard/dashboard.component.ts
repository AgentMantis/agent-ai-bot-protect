import { Component, OnInit, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { Chart, registerables } from 'chart.js';
import { MatCardModule } from '@angular/material/card';
import { CommonModule } from '@angular/common';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatNativeDateModule } from '@angular/material/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { FormGroup, FormBuilder } from '@angular/forms';

import { BotAnalysisService, BotAnalysisResponse, BotStatsResponse } from '../../services/bot-analysis.service';

// Register Chart.js components
Chart.register(...registerables);

interface BotData {
  name: string;
  total: number;
  blocked: number;
}

interface DailyData {
  date: string;
  hits: number;
  blocks: number;
}

@Component({
  selector: 'app-dashboard',
  imports: [
    CommonModule,
    MatCardModule,
    MatTabsModule,
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatInputModule,
    MatNativeDateModule,
    FormsModule,
    ReactiveFormsModule
  ],
  providers: [BotAnalysisService],
  standalone: true,
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit, AfterViewInit {
  @ViewChild('botChart') private botChartRef!: ElementRef;
  @ViewChild('dailyChart') private dailyChartRef!: ElementRef;
  private botChart: Chart | undefined;
  private dailyChart: Chart | undefined;
  
  dateRangeForm: FormGroup;
  totalRequests = 0;
  blockedRequests = 0;
  botData: BotData[] = [];
  dailyData: DailyData[] = [];

  constructor(
    private botAnalysisService: BotAnalysisService,
    private fb: FormBuilder
  ) {
    // Initialize form with default date range (last 30 days)
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    this.dateRangeForm = this.fb.group({
      startDate: [thirtyDaysAgo],
      endDate: [today]
    });
  }

  ngOnInit() {
    this.loadBotData();
  }

  ngAfterViewInit() {
    // Charts will be created when data loads
  }

  onDateRangeChange() {
    this.loadBotData();
  }

  private loadBotData() {
    const startDate = this.formatDate(this.dateRangeForm?.get('startDate')?.value);
    const endDate = this.formatDate(this.dateRangeForm?.get('endDate')?.value);
    
    this.botAnalysisService.getBotStats(startDate, endDate).subscribe({
      next: (response: BotStatsResponse) => {
        if (response.success) {
          this.processData(response.data);
        }
      },
      error: (err: Error) => {
        console.error('Failed to load bot stats, falling back to analyze logs:', err);
        // Fallback to the analyze logs endpoint if bot stats fails
        this.botAnalysisService.analyzeLogs().subscribe({
          next: (response: BotAnalysisResponse) => {
            if (response.success) {
              this.processData(response.data);
            }
          },
          error: (fallbackErr: Error) => {
            console.error('Failed to load bot data:', fallbackErr);
          }
        });
      }
    });
  }

  private processData(data: BotStatsResponse['data'] | BotAnalysisResponse['data']) {
    // For bot stats response
    if ('bots' in data) {
      this.totalRequests = Object.values(data.bots).reduce((sum, bot) => sum + bot.total, 0);
      this.blockedRequests = Object.values(data.bots).reduce((sum, bot) => sum + bot.blocked, 0);
      
      // Process bot data
      this.botData = Object.entries(data.bots).map(([name, stats]) => ({
        name,
        total: stats.total,
        blocked: stats.blocked
      })).sort((a: BotData, b: BotData) => b.total - a.total);
      
      // Process daily data
      this.dailyData = data.daily.map(day => ({
        date: day.date,
        hits: day.hits,
        blocks: day.blocks
      })).sort((a: DailyData, b: DailyData) => new Date(a.date).getTime() - new Date(b.date).getTime());
    } 
    // For analyze logs response
    else if ('detected_bots' in data) {
      this.totalRequests = data.total_requests || 0;
      this.blockedRequests = data.blocked_requests || 0;
      
      // Process bot data
      this.botData = Object.entries(data.detected_bots).map(([name, stats]) => ({
        name,
        total: stats.total,
        blocked: stats.blocked
      })).sort((a: BotData, b: BotData) => b.total - a.total);
      
      // Process daily data
      this.dailyData = (data.daily_stats || []).map((day) => ({
        date: day.date,
        hits: day.hits,
        blocks: day.blocks
      })).sort((a: DailyData, b: DailyData) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }
    
    // Update charts
    this.updateBotChart();
    this.updateDailyChart();
  }

  private updateBotChart() {
    if (this.botChart) {
      this.botChart.destroy();
    }
    
    if (!this.botChartRef) {
      return;
    }
    
    const ctx = this.botChartRef.nativeElement.getContext('2d');
    if (!ctx) {
      return;
    }
    
    this.botChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: this.botData.map(bot => bot.name),
        datasets: [
          {
            label: 'Total Hits',
            data: this.botData.map(bot => bot.total),
            backgroundColor: 'rgba(54, 162, 235, 0.6)',
            borderColor: 'rgba(54, 162, 235, 1)',
            borderWidth: 1
          },
          {
            label: 'Blocked',
            data: this.botData.map(bot => bot.blocked),
            backgroundColor: 'rgba(255, 99, 132, 0.6)',
            borderColor: 'rgba(255, 99, 132, 1)',
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Count'
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

  private updateDailyChart() {
    if (this.dailyChart) {
      this.dailyChart.destroy();
    }
    
    if (!this.dailyChartRef) {
      return;
    }
    
    const ctx = this.dailyChartRef.nativeElement.getContext('2d');
    if (!ctx) {
      return;
    }
    
    this.dailyChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: this.dailyData.map(day => day.date),
        datasets: [
          {
            label: 'Total Hits',
            data: this.dailyData.map(day => day.hits),
            backgroundColor: 'rgba(54, 162, 235, 0.2)',
            borderColor: 'rgba(54, 162, 235, 1)',
            borderWidth: 2,
            tension: 0.1,
            fill: true
          },
          {
            label: 'Blocked',
            data: this.dailyData.map(day => day.blocks),
            backgroundColor: 'rgba(255, 99, 132, 0.2)',
            borderColor: 'rgba(255, 99, 132, 1)',
            borderWidth: 2,
            tension: 0.1,
            fill: true
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Count'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Date'
            }
          }
        }
      }
    });
  }

  private formatDate(date: Date): string {
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
