Component({
  properties: {
    status: {
      type: String,
      value: 'draft'
    }
  },
  
  data: {
    statusText: '',
    statusClass: ''
  },
  
  lifetimes: {
    attached() {
      this.updateStatus();
    }
  },
  
  observers: {
    status: function(newVal) {
      this.updateStatus();
    }
  },
  
  methods: {
    updateStatus() {
      const status = this.properties.status;
      
      const statusMap = {
        'draft': '草稿',
        'submitted': '已提交',
        'under_review': '审核中',
        'approved': '已通过',
        'rejected': '已拒绝'
      };
      
      this.setData({
        statusText: statusMap[status] || '未知',
        statusClass: `status-${status}`
      });
    }
  }
})