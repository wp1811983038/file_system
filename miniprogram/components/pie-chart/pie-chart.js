// components/pie-chart/pie-chart.js
Component({
  properties: {
    percentage: {
      type: Number,
      value: 0,
      observer: 'updateChart'
    },
    radius: {
      type: Number,
      value: 100
    },
    primaryColor: {
      type: String,
      value: '#10b981' // 已提交的绿色
    },
    secondaryColor: {
      type: String,
      value: '#f59e0b' // 未提交的橙色
    },
    fontSize: {
      type: Number,
      value: 36
    }
  },
  
  data: {
    clipPath: '',
    showSubmitted: false
  },
  
  lifetimes: {
    attached() {
      this.updateChart();
    }
  },
  
  methods: {
    updateChart() {
      const percentage = this.properties.percentage;
      
      if (percentage <= 0) {
        this.setData({
          showSubmitted: false
        });
        return;
      }
      
      if (percentage >= 100) {
        this.setData({
          showSubmitted: true,
          clipPath: 'none' // 全部填充
        });
        return;
      }
      
      // 计算角度和坐标
      const angleInRadians = (percentage / 100) * 2 * Math.PI;
      const endX = 50 + 50 * Math.sin(angleInRadians);
      const endY = 50 - 50 * Math.cos(angleInRadians);
      
      let clipPath = '';
      
      if (percentage <= 50) {
        // 小于等于50%的情况
        clipPath = `polygon(50% 50%, 50% 0%, ${endX}% ${endY}%)`;
      } else {
        // 大于50%的情况
        clipPath = `polygon(50% 50%, 50% 0%, 100% 0%, 100% ${percentage <= 75 ? 0 : (percentage - 75) * 4}%, ${percentage >= 75 ? 100 : (percentage - 25) * 4}% 100%, 0% ${percentage >= 25 ? 100 : percentage * 4}%, 0% ${percentage >= 50 ? 0 : (50 - percentage) * 2}%, ${endX}% ${endY}%)`;
      }
      
      this.setData({
        showSubmitted: true,
        clipPath
      });
    }
  }
})