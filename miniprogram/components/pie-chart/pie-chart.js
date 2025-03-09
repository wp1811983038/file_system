// 更新后的饼图组件代码
Component({
  properties: {
    percentage: {
      type: Number,
      value: 0,
      observer: function(newVal) {
        this.drawPieChart();
      }
    },
    size: {
      type: Number,
      value: 200
    },
    primaryColor: {
      type: String,
      value: '#10b981'
    },
    secondaryColor: {
      type: String,
      value: '#f59e0b'
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
  
  data: {
    pixelRatio: 1,
    canvasWidth: 0,
    canvasHeight: 0
  },
  
  lifetimes: {
    attached: function() {
      this.initCanvas();
    }
  },
  
  methods: {
    initCanvas: async function() {
      try {
        // 使用新的API替代已弃用的wx.getSystemInfoSync
        const windowInfo = wx.getWindowInfo();
        const appBaseInfo = wx.getAppBaseInfo();
        
        // 获取设备像素比
        const pixelRatio = appBaseInfo.pixelRatio || 1;
        
        const size = this.properties.size;
        const canvasWidth = size;
        const canvasHeight = size;
        
        this.setData({
          pixelRatio,
          canvasWidth,
          canvasHeight
        }, () => {
          this.drawPieChart();
        });
      } catch (error) {
        console.error('初始化饼图失败:', error);
      }
    },
    
    drawPieChart: function() {
      const query = this.createSelectorQuery();
      query.select('#pieCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res[0] || !res[0].node) {
            console.error('无法获取canvas节点');
            return;
          }
          
          const canvas = res[0].node;
          const ctx = canvas.getContext('2d');
          
          // 设置canvas尺寸
          const width = this.data.canvasWidth;
          const height = this.data.canvasHeight;
          const dpr = this.data.pixelRatio;
          
          canvas.width = width * dpr;
          canvas.height = height * dpr;
          ctx.scale(dpr, dpr);
          
          // 清空画布
          ctx.clearRect(0, 0, width, height);
          
          const centerX = width / 2;
          const centerY = height / 2;
          const radius = Math.min(centerX, centerY) * 0.9;
          
          // 确保percentage是有效值
          let percentage = this.properties.percentage;
          if (isNaN(percentage) || percentage < 0) {
            percentage = 0;
          } else if (percentage > 100) {
            percentage = 100;
          }
          
          // 绘制饼图
          this.drawPie(ctx, centerX, centerY, radius, percentage);
          
          // 绘制中心文本
          this.drawCenterText(ctx, centerX, centerY, radius, percentage);
        });
    },
    
    drawPie: function(ctx, centerX, centerY, radius, percentage) {
      const primaryColor = this.properties.primaryColor;
      const secondaryColor = this.properties.secondaryColor;
      
      // 计算角度
      const startAngle = -Math.PI / 2;
      const endAngle = startAngle + (Math.PI * 2 * percentage / 100);
      
      // 绘制完成部分
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, endAngle, false);
      ctx.closePath();
      ctx.fillStyle = primaryColor;
      ctx.fill();
      
      // 绘制未完成部分
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, endAngle, startAngle + Math.PI * 2, false);
      ctx.closePath();
      ctx.fillStyle = secondaryColor;
      ctx.fill();
      
      // 绘制白色圆心
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 0.5, 0, Math.PI * 2, false);
      ctx.closePath();
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    },
    
    drawCenterText: function(ctx, centerX, centerY, radius, percentage) {
      const fontSize = radius * 0.3;
      ctx.fillStyle = '#333333';
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${percentage}%`, centerX, centerY);
    }
  }
});