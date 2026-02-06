import {
  Chart,
  LineController,
  BarController,
  LineElement,
  BarElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import type { City } from './data';
import { celsiusToFahrenheit } from './data';

Chart.register(
  LineController, BarController, LineElement, BarElement,
  PointElement, LinearScale, CategoryScale, Tooltip, Legend, Filler
);

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

let chartInstance: Chart | null = null;

export function renderChart(
  canvas: HTMLCanvasElement,
  city: City,
  selectedMonth: number,
  tempMin: number,
  tempMax: number,
  isFahrenheit: boolean
) {
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }

  const temps = isFahrenheit ? city.t.map(celsiusToFahrenheit) : [...city.t];
  const displayMin = isFahrenheit ? celsiusToFahrenheit(tempMin) : tempMin;
  const displayMax = isFahrenheit ? celsiusToFahrenheit(tempMax) : tempMax;
  const tempUnit = isFahrenheit ? 'F' : 'C';

  // Background colors for bars - highlight selected month
  const barColors = city.r.map((_, i) =>
    i === selectedMonth ? 'rgba(59, 130, 246, 0.7)' : 'rgba(59, 130, 246, 0.3)'
  );

  // Point colors for temp line - highlight selected month
  const pointColors = temps.map((_, i) =>
    i === selectedMonth ? '#dc2626' : '#ef4444'
  );
  const pointRadii = temps.map((_, i) => i === selectedMonth ? 6 : 3);

  chartInstance = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: MONTH_LABELS,
      datasets: [
        {
          type: 'line',
          label: `Avg Max Temp (${tempUnit})`,
          data: temps,
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          pointBackgroundColor: pointColors,
          pointRadius: pointRadii,
          pointHoverRadius: 7,
          borderWidth: 2.5,
          tension: 0.3,
          yAxisID: 'y',
          order: 1,
        },
        {
          type: 'bar',
          label: 'Rainfall (mm)',
          data: city.r,
          backgroundColor: barColors,
          borderRadius: 3,
          yAxisID: 'y1',
          order: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: { boxWidth: 12, padding: 8, font: { size: 11 } },
        },
        tooltip: {
          callbacks: {
            label(context) {
              if (context.datasetIndex === 0) {
                return `Temp: ${context.parsed.y}${tempUnit}`;
              }
              return `Rain: ${context.parsed.y}mm`;
            },
          },
        },
      },
      scales: {
        y: {
          type: 'linear',
          position: 'left',
          title: { display: true, text: `Temperature (${tempUnit})`, font: { size: 11 } },
          grid: { color: 'rgba(0,0,0,0.06)' },
        },
        y1: {
          type: 'linear',
          position: 'right',
          title: { display: true, text: 'Rainfall (mm)', font: { size: 11 } },
          grid: { drawOnChartArea: false },
          min: 0,
        },
        x: {
          grid: { display: false },
        },
      },
    },
    plugins: [
      {
        id: 'tempRangeBand',
        beforeDraw(chart) {
          const yScale = chart.scales['y'];
          const ctx = chart.ctx;
          const left = chart.chartArea.left;
          const right = chart.chartArea.right;

          const top = yScale.getPixelForValue(displayMax);
          const bottom = yScale.getPixelForValue(displayMin);

          ctx.save();
          ctx.fillStyle = 'rgba(34, 197, 94, 0.12)';
          ctx.fillRect(left, top, right - left, bottom - top);

          // Dashed border lines
          ctx.strokeStyle = 'rgba(34, 197, 94, 0.5)';
          ctx.lineWidth = 1;
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          ctx.moveTo(left, top);
          ctx.lineTo(right, top);
          ctx.moveTo(left, bottom);
          ctx.lineTo(right, bottom);
          ctx.stroke();
          ctx.restore();
        },
      },
    ],
  });
}

export function destroyChart() {
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }
}

