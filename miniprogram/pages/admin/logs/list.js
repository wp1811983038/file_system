// pages/admin/logs/list.js
const app = getApp();

Page({
  data: {
    // 筛选条件
    logTypeOptions: [
      { value: 'all', label: '全部日志' },
      { value: 'system_notice', label: '系统通知' },
      { value: 'template', label: '模板管理' },
      { value: 'submission', label: '文件提交' },
      { value: 'approval', label: '审批记录' },
      { value: 'inspection', label: '执法检查' },
      { value: 'feedback', label: '问题反馈' }
    ],
    // 备份完整日志类型选项，用于动态调整
    allLogTypeOptions: [
      { value: 'all', label: '全部日志' },
      { value: 'system_notice', label: '系统通知' },
      { value: 'template', label: '模板管理' },
      { value: 'submission', label: '文件提交' },
      { value: 'approval', label: '审批记录' },
      { value: 'inspection', label: '执法检查' },
      { value: 'feedback', label: '问题反馈' }
    ],
    logTypeIndex: 0,

    dateRangeOptions: [
      { value: 'today', label: '今日' },
      { value: 'yesterday', label: '昨日' },
      { value: 'this_week', label: '本周' },
      { value: 'last_week', label: '上周' },
      { value: 'this_month', label: '本月' },
      { value: 'last_month', label: '上月' },
      { value: 'this_quarter', label: '本季度' },
      { value: 'custom', label: '自定义' }
    ],
    dateRangeIndex: 0,
    startDate: '',
    endDate: '',

    // 用户筛选
    userRole: '', // 'admin', 'enforcer', 'user'
    selectedUserId: '',
    selectedUserName: '',

    // 日志数据
    logs: [],
    page: 1,
    totalPages: 0,
    totalLogs: 0,
    hasMoreLogs: true,
    isLoading: false,

    // 用户选择器
    showUserSelector: false,
    userList: [],
    userSearchText: '',
    isLoadingUsers: false,

    // 导出选项
    showExportModal: false,
    exportFormat: 'xlsx',
    exportAllFields: true,
    selectedFields: [],
    exportAllData: false,
    availableFields: [
      { value: 'type', label: '操作类型' },
      { value: 'operate_time', label: '操作时间' },
      { value: 'operator', label: '执行人' },
      { value: 'operator_company', label: '执行人公司' },
      { value: 'operator_phone', label: '执行人手机号' },
      { value: 'content', label: '操作内容' },
      { value: 'target_user', label: '相关用户' },
      { value: 'target_company', label: '相关公司' },
      { value: 'target_phone', label: '相关用户手机号' },
      { value: 'status', label: '状态' },
      { value: 'remarks', label: '备注' }
    ],
    additionalOptions: []
  },

  onLoad: function () {
    // 初始化日期
    this.initDates();
    // 初始化字段选择
    this.initSelectedFields();
    // 加载日志数据
    this.loadLogs();
  },

  // 初始化日期范围
  initDates: function () {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');

    const todayString = `${year}-${month}-${day}`;

    this.setData({
      startDate: todayString,
      endDate: todayString
    });
  },

  // 初始化导出字段
  initSelectedFields: function () {
    const allFields = this.data.availableFields.map(field => field.value);
    this.setData({
      selectedFields: allFields
    });
  },

  // 日志类型选择器变更
  onLogTypeChange: function (e) {
    this.setData({
      logTypeIndex: parseInt(e.detail.value)
    });
  },

  // 日期范围选择器变更
  onDateRangeChange: function (e) {
    const index = parseInt(e.detail.value);
    this.setData({ dateRangeIndex: index });

    // 设置对应的日期范围
    if (this.data.dateRangeOptions[index].value !== 'custom') {
      const { startDate, endDate } = this.calculateDateRange(this.data.dateRangeOptions[index].value);
      this.setData({
        startDate,
        endDate
      });
    }
    // 对于自定义范围，保留现有日期直到用户手动修改
  },

  // 选择用户角色
  selectUserRole: function (e) {
    const role = e.currentTarget.dataset.role;

    // 如果选择的是相同角色，不做处理
    if (this.data.userRole === role) return;

    // 根据所选角色更新可用的日志类型
    let logTypeOptions = [...this.data.allLogTypeOptions]; // 复制全部选项

    if (role === 'enforcer') {
      // 执法人员只显示执法检查日志
      logTypeOptions = [
        { value: 'all', label: '全部日志' },
        { value: 'inspection', label: '执法检查' }
      ];
    } else if (role === 'user') {
      // 普通用户显示文件提交、审批、执法检查和问题反馈
      logTypeOptions = [
        { value: 'all', label: '全部日志' },
        { value: 'submission', label: '文件提交' },
        { value: 'approval', label: '审批记录' },
        { value: 'inspection', label: '执法检查' },
        { value: 'feedback', label: '问题反馈' }
      ];
    }
    // 管理员显示全部日志类型

    this.setData({
      userRole: role,
      logTypeOptions: logTypeOptions,
      logTypeIndex: 0, // 重置为"全部日志"
      selectedUserId: '', // 清空已选用户
      selectedUserName: '' // 清空用户显示名称
    });
  },

  // 计算日期范围
  calculateDateRange: function (range) {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const date = today.getDate();
    const day = today.getDay() || 7; // 将周日的0改为7

    let startDate, endDate;

    switch (range) {
      case 'today':
        const todayStart = new Date(year, month, date);
        const todayEnd = new Date(year, month, date, 23, 59, 59);
        startDate = this.formatDateWithTime(todayStart, true);
        endDate = this.formatDateWithTime(todayEnd, true);
        break;

      case 'yesterday':
        const yesterdayStart = new Date(year, month, date - 1);
        const yesterdayEnd = new Date(year, month, date - 1, 23, 59, 59);
        startDate = this.formatDateWithTime(yesterdayStart, true);
        endDate = this.formatDateWithTime(yesterdayEnd, true);
        break;

      case 'this_week':
        const thisWeekStart = new Date(year, month, date - day + 1);
        const thisWeekEnd = new Date(year, month, date, 23, 59, 59);
        startDate = this.formatDateWithTime(thisWeekStart, true);
        endDate = this.formatDateWithTime(thisWeekEnd, true);
        break;

      case 'last_week':
        const lastWeekStart = new Date(year, month, date - day - 6);
        const lastWeekEnd = new Date(year, month, date - day, 23, 59, 59);
        startDate = this.formatDateWithTime(lastWeekStart, true);
        endDate = this.formatDateWithTime(lastWeekEnd, true);
        break;

      case 'this_month':
        const thisMonthStart = new Date(year, month, 1);
        const thisMonthEnd = new Date(year, month, date, 23, 59, 59);
        startDate = this.formatDateWithTime(thisMonthStart, true);
        endDate = this.formatDateWithTime(thisMonthEnd, true);
        break;

      case 'last_month':
        const lastMonthStart = new Date(year, month - 1, 1);
        const lastMonthEnd = new Date(year, month, 0, 23, 59, 59);
        startDate = this.formatDateWithTime(lastMonthStart, true);
        endDate = this.formatDateWithTime(lastMonthEnd, true);
        break;

      case 'this_quarter':
        const quarter = Math.floor(month / 3);
        const quarterStart = new Date(year, quarter * 3, 1);
        const quarterEnd = new Date(year, month, date, 23, 59, 59);
        startDate = this.formatDateWithTime(quarterStart, true);
        endDate = this.formatDateWithTime(quarterEnd, true);
        break;

      default:
        // 默认为今天
        const defaultStart = new Date(year, month, date);
        const defaultEnd = new Date(year, month, date, 23, 59, 59);
        startDate = this.formatDateWithTime(defaultStart, true);
        endDate = this.formatDateWithTime(defaultEnd, true);
    }

    return { startDate, endDate };
  },

  // 格式化日期，添加时间部分
  formatDateWithTime: function (date, includeTime = false) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    if (includeTime) {
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }

    return `${year}-${month}-${day}`;
  },

  // 原始的formatDate函数保留，以避免其他地方的依赖出问题
  formatDate: function (date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // 格式化日期（添加时间部分）
  formatDate: function (date, includeTime = false, isEndDay = false) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    // 基础日期部分
    let result = `${year}-${month}-${day}`;

    // 如果需要包含时间
    if (includeTime) {
      // 开始日期用 00:00:00，结束日期用 23:59:59
      const time = isEndDay ? '23:59:59' : '00:00:00';
      result += ` ${time}`;
    }

    return result;
  },

  // 开始日期变更
  onStartDateChange: function (e) {
    // 为所选日期添加起始时间 00:00:00
    this.setData({
      startDate: e.detail.value + " 00:00:00"
    });
  },

  // 结束日期变更
  onEndDateChange: function (e) {
    // 为所选日期添加结束时间 23:59:59
    this.setData({
      endDate: e.detail.value + " 23:59:59"
    });
  },

  // 显示用户选择器
  showUserSelector: function () {
    // 如果还没选角色，不执行
    if (!this.data.userRole) {
      wx.showToast({
        title: '请先选择用户类型',
        icon: 'none'
      });
      return;
    }

    this.setData({
      showUserSelector: true,
      userSearchText: '',
      userList: []
    });

    // 加载用户列表
    this.loadUserList();
  },

  // 隐藏用户选择器
  hideUserSelector: function () {
    this.setData({
      showUserSelector: false
    });
  },

  // 用户搜索输入
  onUserSearchInput: function (e) {
    this.setData({
      userSearchText: e.detail.value
    });

    // 搜索延迟触发
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.loadUserList();
    }, 500);
  },

  // 加载用户列表 - 修复后的正确版本
  loadUserList: function () {
    this.setData({ isLoadingUsers: true });

    // 获取当前选择的用户角色
    const role = this.data.userRole; // 'admin', 'enforcer' 或 'user'

    // 如果没有选择角色，不执行
    if (!role) {
      this.setData({ isLoadingUsers: false });
      wx.showToast({
        title: '请先选择用户类型',
        icon: 'none'
      });
      return;
    }

    // 构建查询参数 - 根据当前选择的角色筛选用户
    let params = {
      search: this.data.userSearchText || '',
      role: role // 只查询当前选择的角色
    };

    wx.request({
      url: `${app.globalData.baseUrl}/api/v1/admin/users`,  // 正确的API路径
      method: 'GET',  // 正确的请求方法
      header: {
        'Authorization': `Bearer ${wx.getStorageSync('token')}`
      },
      data: params,
      success: (res) => {
        if (res.statusCode === 200 && res.data.users) {
          this.setData({
            userList: res.data.users
          });
          
          // 如果结果为空，给出提示
          if (res.data.users.length === 0) {
            wx.showToast({
              title: `未找到${this.getRoleName(role)}用户`,
              icon: 'none'
            });
          }
        } else {
          wx.showToast({
            title: '加载用户失败',
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        console.error('加载用户失败:', err);
        wx.showToast({
          title: '加载用户失败',
          icon: 'none'
        });
      },
      complete: () => {
        this.setData({ isLoadingUsers: false });
      }
    });
  },

  // 获取角色名称的辅助函数
  getRoleName: function (role) {
    const roleNames = {
      'admin': '管理员',
      'enforcer': '执法人员',
      'user': '普通用户'
    };
    return roleNames[role] || '未知';
  },

  // 选择用户
  selectUser: function (e) {
    const user = e.currentTarget.dataset.user;
    this.setData({
      selectedUserId: user.id,
      selectedUserName: user.username
    });
    this.hideUserSelector();
  },

  // 重置筛选条件
  resetFilters: function () {
    this.setData({
      logTypeIndex: 0,
      dateRangeIndex: 0,
      userRole: '', // 清空用户角色
      selectedUserId: '',
      selectedUserName: '',
      logTypeOptions: [...this.data.allLogTypeOptions]  // 重置为全部日志类型选项
    });

    this.initDates();
  },

  // 查询日志
  searchLogs: function () {
    this.setData({
      logs: [],
      page: 1,
      hasMoreLogs: true
    });

    this.loadLogs();
  },

  // 加载日志数据
  loadLogs: function () {
    if (this.data.isLoading || !this.data.hasMoreLogs) return;

    this.setData({ isLoading: true });

    // 构建筛选参数
    const params = {
      page: this.data.page,
      per_page: 20,
      start_date: this.data.startDate,
      end_date: this.data.endDate
    };

    // 添加类型筛选
    if (this.data.logTypeIndex > 0) {
      params.type = this.data.logTypeOptions[this.data.logTypeIndex].value;
    }

    // 添加用户筛选
    if (this.data.selectedUserId) {
      params.user_id = this.data.selectedUserId; // 使用统一的user_id参数
    }

    // 添加角色筛选
    if (this.data.userRole && !this.data.selectedUserId) {
      params.role = this.data.userRole; // 如果选了角色但没选具体用户，则查询该角色所有用户的日志
    }

    wx.request({
      url: `${app.globalData.baseUrl}/api/v1/admin/logs`,
      method: 'GET',
      header: {
        'Authorization': `Bearer ${wx.getStorageSync('token')}`
      },
      data: params,
      success: (res) => {
        if (res.statusCode === 200 && res.data) {
          // 处理日志数据
          const newLogs = res.data.logs.map(log => {
            return {
              id: log.id,
              type: log.type,
              typeText: this.getLogTypeText(log.type),
              operateTime: log.operate_time,
              operator: log.operator,
              content: log.content,
              status: log.status,
              statusText: this.getStatusText(log.status),
              target_user: log.target_user,
              remarks: log.remarks
            };
          });

          this.setData({
            logs: [...this.data.logs, ...newLogs],
            page: this.data.page + 1,
            totalPages: res.data.pages,
            totalLogs: res.data.total,
            hasMoreLogs: this.data.page < res.data.pages
          });
        } else {
          wx.showToast({
            title: '加载失败',
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        console.error('加载日志失败:', err);
        wx.showToast({
          title: '加载失败',
          icon: 'none'
        });
      },
      complete: () => {
        this.setData({ isLoading: false });
        wx.stopPullDownRefresh();
      }
    });
  },

  // 获取日志类型文本
  getLogTypeText: function (type) {
    const typeTextMap = {
      'system_notice': '系统通知',
      'template': '模板管理',
      'submission': '文件提交',
      'approval': '审批记录',
      'inspection': '执法检查',
      'feedback': '问题反馈'
    };
    return typeTextMap[type] || '未知类型';
  },

  // 获取状态文本
  getStatusText: function (status) {
    const statusTextMap = {
      'success': '成功',
      'pending': '待处理',
      'rejected': '已拒绝',
      'approved': '已通过',
      'processing': '处理中',
      'deleted': '已删除'  // 新增状态映射
    };
    return statusTextMap[status] || '未知状态';
  },

  // 加载更多日志
  loadMoreLogs: function () {
    this.loadLogs();
  },

  // 查看日志详情
  viewLogDetail: function (e) {
    const id = e.currentTarget.dataset.id;
    const index = this.data.logs.findIndex(log => log.id === id);

    if (index === -1) return;

    const log = this.data.logs[index];

    wx.showModal({
      title: '日志详情',
      content: `类型: ${log.typeText}\n时间: ${log.operateTime}\n执行人: ${log.operator}\n内容: ${log.content}\n状态: ${log.statusText}${log.remarks ? '\n备注: ' + log.remarks : ''}`,
      showCancel: false
    });
  },

  // 导出所有日志
  exportAllLogs: function () {
    wx.showModal({
      title: '导出确认',
      content: '确定要导出所有日志记录吗？根据数据量大小，导出过程可能需要一些时间。',
      success: (res) => {
        if (res.confirm) {
          // 弹出导出选项进行确认
          this.setData({
            showExportModal: true,
            exportAllData: true
          });
        }
      }
    });
  },

  // 显示导出选项
  showExportOptions: function () {
    this.setData({
      showExportModal: true,
      exportAllData: false
    });
  },

  // 隐藏导出选项
  hideExportOptions: function () {
    this.setData({ showExportModal: false });
  },

  // 导出格式变更
  onExportFormatChange: function (e) {
    this.setData({
      exportFormat: e.detail.value
    });
  },

  // 导出字段变更
  onExportFieldsChange: function (e) {
    const values = e.detail.value;

    // 检查是否包含"全选"
    const allSelected = values.includes('all');

    if (allSelected) {
      // 如果全选，则选择所有字段
      const allFields = this.data.availableFields.map(field => field.value);
      this.setData({
        exportAllFields: true,
        selectedFields: allFields
      });
    } else {
      this.setData({
        exportAllFields: false,
        selectedFields: values
      });
    }
  },

  // 切换全选字段
  toggleAllFields: function () {
    const allFields = this.data.availableFields.map(field => field.value);

    if (this.data.exportAllFields) {
      // 如果当前是全选，则切换为不选
      this.setData({
        exportAllFields: false,
        selectedFields: []
      });
    } else {
      // 如果当前不是全选，则切换为全选
      this.setData({
        exportAllFields: true,
        selectedFields: allFields
      });
    }
  },

  // 附加选项变更
  onAdditionalOptionsChange: function (e) {
    this.setData({
      additionalOptions: e.detail.value
    });
  },

  // 导出日志
  // 导出日志 - 修复后的完整函数
// 导出日志函数 - 修复中文文件名问题
exportLogs: function() {
  // 检查导出字段
  if (this.data.selectedFields.length === 0) {
    wx.showToast({
      title: '请至少选择一个导出字段',
      icon: 'none'
    });
    return;
  }

  // 显示加载中提示
  wx.showLoading({
    title: '准备导出...',
    mask: true
  });

  // 构建导出参数
  const params = {
    format: this.data.exportFormat,
    fields: this.data.selectedFields.join(','),
    use_ascii_filename: true  // 请求后端使用ASCII文件名
  };

  // 添加筛选条件
  if (!this.data.exportAllData) {
    params.start_date = this.data.startDate;
    params.end_date = this.data.endDate;

    if (this.data.logTypeIndex > 0) {
      params.type = this.data.logTypeOptions[this.data.logTypeIndex].value;
    }

    if (this.data.selectedUserId) {
      params.user_id = this.data.selectedUserId;
    }

    if (this.data.userRole && !this.data.selectedUserId) {
      params.role = this.data.userRole;
    }
  }

  // 附加选项
  if (this.data.additionalOptions.includes('include_template_files')) {
    params.include_template_files = true;
  }

  console.log('导出参数:', params);

  // 发起导出请求
  wx.request({
    url: `${app.globalData.baseUrl}/api/v1/admin/logs/export`,
    method: 'POST',
    header: {
      'Authorization': `Bearer ${wx.getStorageSync('token')}`,
      'Content-Type': 'application/json'
    },
    data: params,
    success: (res) => {
      console.log('导出响应:', res.data);
      
      if (res.statusCode === 200 && res.data && res.data.download_url) {
        // 隐藏导出选项弹窗
        this.hideExportOptions();
        
        // 确保URL是完整路径
        let downloadUrl = res.data.download_url;
        console.log('下载URL:', downloadUrl);
        
        // 显示下载中提示
        wx.showLoading({
          title: '正在下载...',
          mask: true
        });
        
        // 下载文件
        wx.downloadFile({
          url: downloadUrl,
          success: (result) => {
            console.log('下载成功:', result);
            wx.hideLoading();
            
            if (result.statusCode === 200) {
              const tempFilePath = result.tempFilePath;
              
              // 打开文件
              wx.openDocument({
                filePath: tempFilePath,
                fileType: this.data.exportFormat,  // 指定文件类型
                showMenu: true,  // 允许用户保存
                success: () => {
                  console.log('打开文件成功');
                  wx.showToast({
                    title: '导出成功',
                    icon: 'success'
                  });
                },
                fail: (err) => {
                  console.error('打开文件失败:', err);
                  
                  // 文件下载成功但无法打开时的处理
                  wx.showModal({
                    title: '文件已下载',
                    content: '但无法自动打开，请手动查看"文件"应用中的下载项',
                    showCancel: false
                  });
                }
              });
            } else {
              console.error('下载状态码异常:', result.statusCode);
              wx.showToast({
                title: '下载文件异常',
                icon: 'none'
              });
            }
          },
          fail: (err) => {
            wx.hideLoading();
            console.error('下载文件失败:', err);
            
            // 针对中文文件名问题的特别处理
            wx.showModal({
              title: '下载失败',
              content: '可能是因为文件名包含中文字符，请联系管理员修改导出文件名格式',
              showCancel: false
            });
          }
        });
      } else {
        wx.hideLoading();
        console.error('导出响应无效:', res);
        
        wx.showModal({
          title: '导出失败',
          content: res.data && res.data.error ? res.data.error : '服务器返回无效数据',
          showCancel: false
        });
      }
    },
    fail: (err) => {
      wx.hideLoading();
      console.error('导出请求失败:', err);
      
      wx.showModal({
        title: '导出失败',
        content: '请求服务器失败，请检查网络连接',
        showCancel: false
      });
    }
  });

  // 重置导出标记
  this.setData({
    exportAllData: false
  });
},

// 新增：保存文件到本地（可选）
saveFile: function(tempFilePath, filename) {
  // 微信小程序不能直接保存到文件系统
  // 对于非图片文件，可以提示用户手动保存
  wx.showModal({
    title: '保存提示',
    content: '请在打开的文件中，点击右上角"..."，选择"保存"选项',
    showCancel: false
  });
  
  // 如果是图片，可以保存到相册
  if (filename.endsWith('.png') || filename.endsWith('.jpg') || filename.endsWith('.jpeg')) {
    wx.saveImageToPhotosAlbum({
      filePath: tempFilePath,
      success: (res) => {
        wx.showToast({
          title: '已保存到相册',
          icon: 'success'
        });
      },
      fail: (err) => {
        console.error('保存到相册失败:', err);
        wx.showToast({
          title: '保存失败',
          icon: 'none'
        });
      }
    });
  }
},

  // 下拉刷新
  onPullDownRefresh: function () {
    this.setData({
      logs: [],
      page: 1,
      hasMoreLogs: true
    });

    this.loadLogs();
  }
});