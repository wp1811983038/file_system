// components/pie-chart/pie-chart.js
Component({
  properties: {
    percentage: {
      type: Number,
      value: 0,
      observer: 'drawPieChart'
    },
    size: {
      type: Number,
      value: 300,
      observer: 'drawPieChart'
    },
    primaryColor: {
      type: String,
      value: '#10b981', // 绿色 - 已提交
      observer: 'drawPieChart'
    },
    secondaryColor: {
      type: String,
      value: '#f59e0b', // 橙色 - 未提交
      observer: 'drawPieChart'
    },
    fontSize: {
      type: Number,
      value: 36
    },
    submittedCount: {
      type: Number,
      value: 0
    },
    pendingCount: {
      type: Number,
      value: 0
    }
  },
  
  lifetimes: {
    ready() {
      // 组件加载完成后绘制饼图
      this.drawPieChart();
    }
  },
  
  methods: {
    async drawPieChart() {
      // 等待属性就绪
      if (!this.data.size) return;
      
      // 获取画布上下文
      const query = this.createSelectorQuery();
      query.select('#pieCanvas')
        .fields({ node: true, size: true })
        .exec(async (res) => {
          if (!res[0] || !res[0].node) {
            console.error('Canvas节点获取失败');
            return;
          }
          
          const canvas = res[0].node;
          const ctx = canvas.getContext('2d');
          
          // 设置canvas尺寸
          const dpr = wx.getSystemInfoSync().pixelRatio;
          canvas.width = this.data.size * dpr;
          canvas.height = this.data.size * dpr;
          ctx.scale(dpr, dpr);
          
          // 清空画布
          ctx.clearRect(0, 0, this.data.size, this.data.size);
          
          // 绘制背景圆环（未提交部分）
          const centerX = this.data.size / 2;
          const centerY = this.data.size / 2;
          const radius = this.data.size / 2 - 10; // 留一些边距
          const innerRadius = radius / 2; // 内圆半径
          
          // 绘制未提交部分（整个圆环）
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
          ctx.fillStyle = this.data.secondaryColor;
          ctx.fill();
          
          // 绘制已提交部分（扇形）
          if (this.data.percentage > 0 && this.data.percentage <= 100) {
            const percentage = this.data.percentage / 100;
            const startAngle = -0.5 * Math.PI; // 从12点钟方向开始
            const endAngle = startAngle + (percentage * 2 * Math.PI);
            
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, radius, startAngle, endAngle);
            ctx.closePath();
            ctx.fillStyle = this.data.primaryColor;
            ctx.fill();
          }
          
          // 绘制内圆（形成环状）
          ctx.beginPath();
          ctx.arc(centerX, centerY, innerRadius, 0, 2 * Math.PI);
          ctx.fillStyle = '#FFFFFF';
          ctx.fill();
          
          // 绘制百分比文字
          ctx.font = `bold ${this.data.fontSize}px sans-serif`;
          ctx.fillStyle = '#000000';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${this.data.percentage}%`, centerX, centerY);
        });
    }
  }
})