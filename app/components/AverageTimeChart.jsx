import React from 'react';
import { Bar } from 'react-chartjs-2';

const AverageTimeChart = ({ data }) => {
  const chartData = {
    labels: data.map(item => item.country),
    datasets: [
      {
        label: 'Average Time (days)',
        data: data.map(item => item.averageTime),
        backgroundColor: 'rgba(75, 192, 192, 0.6)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1,
      },
    ],
  };

  const options = {
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  return <Bar data={chartData} options={options} />;
};

export default AverageTimeChart; 