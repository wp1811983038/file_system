// pages/user/feedback/index.js
const app = getApp();

Page({
  data: {
    feedbacks: [], // 所有反馈列表
    filteredFeedbacks: [], // 筛选后的反馈列表
    currentType: 'all', // 当前选中的类型
    feedbackTypes: ['功能问题', '使用建议', '内容错误', '其他问题'], // 预设问题类型
    statusText: {
      'pending': '待处理',
      'processing': '处理中',
      'resolved': '已解决'
    },
    showAddModal: false, // 是否显示新增弹窗
    showTypeModal: false, // 是否显示类型弹窗
    typeIndex: -1, // 选择的类型索引
    newFeedback: { // 新反馈信息
      type: '',
      content: ''
    },
    newTypeName: '', // 新类型名称
    imageList: [] // 临时存储选择的图片
  },

  onShow() {
    console.log('问题反馈页面显示');
    // 设置TabBar选中状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 1 // 问题反馈在导航栏中的索引位置，根据实际情况调整
      });
    }
  },

  onLoad: function() {
    // 加载反馈数据
    this.loadFeedbacks();
    
    // 加载本地存储的问题类型
    this.loadFeedbackTypes();
  },

  // 加载本地存储的问题类型
  loadFeedbackTypes: function() {
    const storedTypes = wx.getStorageSync('feedbackTypes');
    
    if (storedTypes && storedTypes.length > 0) {
      // 确保默认类型始终存在
      const defaultTypes = ['功能问题', '使用建议', '内容错误', '其他问题'];
      const mergedTypes = [...defaultTypes];
      
      // 添加自定义类型（去重）
      storedTypes.forEach(type => {
        if (!defaultTypes.includes(type) && !mergedTypes.includes(type)) {
          mergedTypes.push(type);
        }
      });
      
      this.setData({
        feedbackTypes: mergedTypes
      });
    }
  },
  
  // 加载反馈数据
  loadFeedbacks: function() {
    const token = wx.getStorageSync('token');
    
    wx.showLoading({ title: '加载中' });
    
    wx.request({
      url: `${app.globalData.baseUrl}/api/v1/feedback`,
      method: 'GET',
      header: {
        'Authorization': `Bearer ${token}`
      },
      success: (res) => {
        if (res.statusCode === 200) {
          this.setData({
            feedbacks: res.data.feedbacks || [],
            filteredFeedbacks: res.data.feedbacks || []
          });
        }
      },
      complete: () => {
        wx.hideLoading();
      }
    });
  },

  // 按类型筛选
  filterByType: function(e) {
    const type = e.currentTarget.dataset.type;
    let filtered = this.data.feedbacks;
    
    if (type !== 'all') {
      filtered = this.data.feedbacks.filter(item => item.type === type);
    }
    
    this.setData({
      currentType: type,
      filteredFeedbacks: filtered
    });
  },

  // 显示新增反馈弹窗
  showAddFeedbackModal: function() {
    this.setData({
      showAddModal: true,
      typeIndex: -1,
      newFeedback: {
        type: '',
        content: ''
      },
      imageList: [] // 重置图片列表
    });
  },

  // 取消新增
  cancelAdd: function() {
    this.setData({
      showAddModal: false
    });
  },

  // 类型选择变化
  typeChange: function(e) {
    const typeIndex = e.detail.value;
    
    this.setData({
      typeIndex: typeIndex,
      'newFeedback.type': this.data.feedbackTypes[typeIndex]
    });
  },

  // 内容输入
  inputContent: function(e) {
    this.setData({
      'newFeedback.content': e.detail.value
    });
  },

  // 选择图片
  chooseImage: function() {
    const { imageList } = this.data;
    const remainCount = 3 - imageList.length;
    
    if (remainCount <= 0) {
      return;
    }
    
    wx.chooseMedia({
      count: remainCount,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      camera: 'back',
      success: (res) => {
        // 检查文件大小
        const validImages = res.tempFiles.filter(file => {
          const isValid = file.size <= 2 * 1024 * 1024; // 2MB
          if (!isValid) {
            wx.showToast({
              title: '图片大小不能超过2MB',
              icon: 'none'
            });
          }
          return isValid;
        });
        
        // 添加图片
        const newImageList = [...imageList, ...validImages.map(file => file.tempFilePath)];
        this.setData({ imageList: newImageList });
      }
    });
  },

  // 删除图片
  deleteImage: function(e) {
    const { index } = e.currentTarget.dataset;
    const { imageList } = this.data;
    
    imageList.splice(index, 1);
    this.setData({ imageList });
  },

  // 预览图片
  previewImage: function(e) {
    const { index } = e.currentTarget.dataset;
    const { imageList } = this.data;
    
    wx.previewImage({
      current: imageList[index],
      urls: imageList
    });
  },

  // 上传图片
  async uploadImages() {
    const { imageList } = this.data;
    if (!imageList.length) return [];
    
    const token = wx.getStorageSync('token');
    const uploadTasks = imageList.map(tempFilePath => {
      return new Promise((resolve, reject) => {
        wx.uploadFile({
          url: `${app.globalData.baseUrl}/api/v1/feedback/upload`,
          filePath: tempFilePath,
          name: 'image',
          header: {
            'Authorization': `Bearer ${token}`
          },
          success: (res) => {
            try {
              const data = JSON.parse(res.data);
              if (res.statusCode === 200 && data.file_url) {
                resolve(data.file_url);
              } else {
                reject(new Error(data.error || '上传失败'));
              }
            } catch (e) {
              reject(new Error('解析响应失败'));
            }
          },
          fail: reject
        });
      });
    });
    
    try {
      return await Promise.all(uploadTasks);
    } catch (error) {
      throw new Error('上传图片失败: ' + error.message);
    }
  },

  // 提交反馈
  async submitFeedback() {
    try {
      const { newFeedback, imageList } = this.data;
      
      // 表单验证
      if (!newFeedback.type) {
        wx.showToast({
          title: '请选择问题类型',
          icon: 'none'
        });
        return;
      }
      
      if (!newFeedback.content || newFeedback.content.trim().length < 10) {
        wx.showToast({
          title: '请输入至少10个字的问题描述',
          icon: 'none'
        });
        return;
      }
      
      wx.showLoading({ title: '提交中' });
      
      // 上传图片
      let imageUrls = [];
      if (imageList.length > 0) {
        imageUrls = await this.uploadImages();
      }
      
      // 提交反馈
      const token = wx.getStorageSync('token');
      
      wx.request({
        url: `${app.globalData.baseUrl}/api/v1/feedback`,
        method: 'POST',
        header: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        data: {
          ...newFeedback,
          image_urls: imageUrls
        },
        success: (res) => {
          if (res.statusCode === 201) {
            wx.showToast({
              title: '提交成功',
              icon: 'success'
            });
            
            // 关闭弹窗并刷新列表
            this.setData({
              showAddModal: false,
              imageList: [] // 重置图片列表
            });
            
            this.loadFeedbacks();
          } else {
            wx.showToast({
              title: res.data.error || '提交失败',
              icon: 'none'
            });
          }
        },
        fail: () => {
          wx.showToast({
            title: '网络错误，请稍后重试',
            icon: 'none'
          });
        },
        complete: () => {
          wx.hideLoading();
        }
      });
    } catch (error) {
      wx.hideLoading();
      wx.showToast({
        title: error.message || '提交失败',
        icon: 'none'
      });
    }
  },

  // 显示自定义类型弹窗
  showTypeModal: function() {
    this.setData({
      showTypeModal: true,
      newTypeName: ''
    });
  },

  // 取消添加类型
  cancelTypeAdd: function() {
    this.setData({
      showTypeModal: false
    });
  },

  // 输入类型名称
  inputTypeName: function(e) {
    this.setData({
      newTypeName: e.detail.value
    });
  },

  // 添加自定义问题类型
  addFeedbackType: function() {
    const { newTypeName, feedbackTypes } = this.data;
    
    if (!newTypeName.trim()) {
      wx.showToast({
        title: '请输入类型名称',
        icon: 'none'
      });
      return;
    }
    
    // 检查类型是否已存在
    if (feedbackTypes.includes(newTypeName)) {
      wx.showToast({
        title: '此类型已存在',
        icon: 'none'
      });
      return;
    }
    
    // 添加新类型
    const updatedTypes = [...feedbackTypes, newTypeName];
    
    this.setData({
      feedbackTypes: updatedTypes,
      showTypeModal: false,
      currentType: newTypeName // 自动切换到新添加的类型
    });
    
    // 保存到本地存储以便下次使用
    wx.setStorageSync('feedbackTypes', updatedTypes);
    
    // 筛选显示新类型的反馈
    this.filterByType({ currentTarget: { dataset: { type: newTypeName } } });
    
    wx.showToast({
      title: '类型添加成功',
      icon: 'success'
    });
  },

  // 长按类型显示选项
  showTypeOptions: function(e) {
    const index = e.currentTarget.dataset.index;
    const type = e.currentTarget.dataset.type;
    
    // 不允许删除默认类型（前4个）
    if (index < 4) {
      return;
    }
    
    wx.showActionSheet({
      itemList: ['删除此类型'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.showDeleteTypeConfirm(e);
        }
      }
    });
  },

  // 显示删除类型确认对话框
  showDeleteTypeConfirm: function(e) {
    const index = e.currentTarget.dataset.index;
    
    // 不允许删除默认类型（前4个）
    if (index < 4) {
      wx.showToast({
        title: '默认类型不能删除',
        icon: 'none'
      });
      return;
    }
    
    const type = this.data.feedbackTypes[index];
    
    wx.showModal({
      title: '确认删除',
      content: `确定要删除问题类型"${type}"吗？`,
      success: (res) => {
        if (res.confirm) {
          this.deleteType(index);
        }
      }
    });
  },

  // 删除问题类型
  deleteType: function(index) {
    const { feedbackTypes, currentType } = this.data;
    const typeToDelete = feedbackTypes[index];
    
    // 创建新的类型数组（移除指定索引的类型）
    const updatedTypes = [...feedbackTypes];
    updatedTypes.splice(index, 1);
    
    // 如果当前选中的是要删除的类型，则切换到"全部"
    let newCurrentType = currentType;
    if (currentType === typeToDelete) {
      newCurrentType = 'all';
    }
    
    this.setData({
      feedbackTypes: updatedTypes,
      currentType: newCurrentType
    });
    
    // 保存到本地存储
    wx.setStorageSync('feedbackTypes', updatedTypes);
    
    // 如果当前类型被删除，重新筛选显示全部
    if (newCurrentType === 'all') {
      this.filterByType({ currentTarget: { dataset: { type: 'all' } } });
    }
    
    wx.showToast({
      title: '类型已删除',
      icon: 'success'
    });
  },

  // 查看反馈详情
  viewFeedbackDetail: function(e) {
    const id = e.currentTarget.dataset.id;
    
    wx.navigateTo({
      url: `/pages/user/feedback/detail?id=${id}`
    });
  },

  // 删除反馈
  deleteFeedback: function(e) {
    const id = e.currentTarget.dataset.id;
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除此条反馈记录吗？',
      success: (res) => {
        if (res.confirm) {
          const token = wx.getStorageSync('token');
          
          wx.showLoading({ title: '删除中' });
          
          wx.request({
            url: `${app.globalData.baseUrl}/api/v1/feedback/${id}`,
            method: 'DELETE',
            header: {
              'Authorization': `Bearer ${token}`
            },
            success: (res) => {
              if (res.statusCode === 200) {
                wx.showToast({
                  title: '删除成功',
                  icon: 'success'
                });
                
                // 刷新列表
                this.loadFeedbacks();
              } else {
                wx.showToast({
                  title: res.data.error || '删除失败',
                  icon: 'none'
                });
              }
            },
            complete: () => {
              wx.hideLoading();
            }
          });
        }
      }
    });
  }
});