// pages/user/feedback/index.js
const app = getApp()

Page({
  data: {
    typeOptions: ['功能问题', '使用建议', '内容错误', '其他问题'],
    typeIndex: -1,
    content: '',
    contentLength: 0,
    contactInfo: '',
    imageList: [],
    errors: {},
    globalError: '',
    submitting: false,
    showSuccessTip: false,
    successMessage: ''
  },
  onShow() {
    console.log('问题反馈页面显示')
    // 设置TabBar选中状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 1  // 问题反馈在导航栏中的索引位置，根据实际情况调整
      });
    }
  },

  onLoad() {
    // 加载用户联系方式
    this.loadUserContactInfo()
  },

  // 加载用户联系方式
  async loadUserContactInfo() {
    try {
      const token = wx.getStorageSync('token')
      if (!token) {
        wx.redirectTo({ url: '/pages/login/login' })
        return
      }

      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: `${app.globalData.baseUrl}/api/v1/users/profile`,
          method: 'GET',
          header: {
            'Authorization': `Bearer ${token}`
          },
          success: resolve,
          fail: reject
        })
      })

      if (res.statusCode === 200 && res.data.contact_info) {
        this.setData({ 
          contactInfo: res.data.contact_info
        })
      }
    } catch (err) {
      console.error('加载用户联系方式失败:', err)
    }
  },

  // 选择类型
  onTypeChange(e) {
    this.setData({
      typeIndex: parseInt(e.detail.value),
      'errors.type': '' // 清除类型错误
    })
  },

  // 问题描述输入变化
  onContentInput(e) {
    const value = e.detail.value
    this.setData({
      content: value,
      contentLength: value.length,
      'errors.content': '' // 清除内容错误
    })
  },

  // 联系方式输入变化
  onContactInfoInput(e) {
    this.setData({
      contactInfo: e.detail.value,
      'errors.contact_info': '' // 清除联系方式错误
    })
  },

  // 选择图片
  chooseImage() {
    const { imageList } = this.data
    const remainCount = 3 - imageList.length
    
    if (remainCount <= 0) {
      return
    }
    
    wx.chooseMedia({
      count: remainCount,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      camera: 'back',
      success: (res) => {
        // 检查文件大小
        const validImages = res.tempFiles.filter(file => {
          const isValid = file.size <= 2 * 1024 * 1024 // 2MB
          if (!isValid) {
            wx.showToast({
              title: '图片大小不能超过2MB',
              icon: 'none'
            })
          }
          return isValid
        })
        
        // 添加图片
        const newImageList = [...imageList, ...validImages.map(file => file.tempFilePath)]
        this.setData({ imageList: newImageList })
      }
    })
  },

  // 删除图片
  deleteImage(e) {
    const { index } = e.currentTarget.dataset
    const { imageList } = this.data
    
    imageList.splice(index, 1)
    this.setData({ imageList })
  },

  // 预览图片
  previewImage(e) {
    const { index } = e.currentTarget.dataset
    const { imageList } = this.data
    
    wx.previewImage({
      current: imageList[index],
      urls: imageList
    })
  },

  // 验证表单
  validateForm() {
    const { typeIndex, content, contactInfo } = this.data
    const errors = {}
    
    if (typeIndex < 0) {
      errors.type = '请选择问题类型'
    }
    
    if (!content.trim()) {
      errors.content = '请输入问题描述'
    } else if (content.length < 10) {
      errors.content = '问题描述不能少于10个字符'
    }
    
    if (!contactInfo.trim()) {
      errors.contact_info = '请输入联系方式'
    }
    
    this.setData({ errors })
    return Object.keys(errors).length === 0
  },

  // 上传图片
  async uploadImages() {
    const { imageList } = this.data
    if (!imageList.length) return []
    
    const token = wx.getStorageSync('token')
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
              const data = JSON.parse(res.data)
              if (res.statusCode === 200 && data.file_url) {
                resolve(data.file_url)
              } else {
                reject(new Error(data.error || '上传失败'))
              }
            } catch (e) {
              reject(new Error('解析响应失败'))
            }
          },
          fail: reject
        })
      })
    })
    
    try {
      return await Promise.all(uploadTasks)
    } catch (error) {
      throw new Error('上传图片失败: ' + error.message)
    }
  },

  // 提交反馈
  async handleFeedbackSubmit() {
    try {
      // 清除全局错误
      this.setData({ globalError: '' })
      
      // 表单验证
      if (!this.validateForm()) {
        return
      }
      
      this.setData({ submitting: true })
      wx.showLoading({ title: '提交中...' })
      
      // 上传图片（如果有）
      let imageUrls = []
      if (this.data.imageList.length > 0) {
        imageUrls = await this.uploadImages()
      }
      
      // 提交反馈内容
      const { typeOptions, typeIndex, content, contactInfo } = this.data
      const token = wx.getStorageSync('token')
      
      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: `${app.globalData.baseUrl}/api/v1/feedback`,
          method: 'POST',
          header: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          data: {
            type: typeOptions[typeIndex],
            content: content.trim(),
            contact_info: contactInfo.trim(),
            image_urls: imageUrls
          },
          success: resolve,
          fail: reject
        })
      })
      
      wx.hideLoading()
      
      if (res.statusCode === 201) {
        // 添加轻微振动反馈
        wx.vibrateShort({ type: 'light' })
        
        // 显示成功提示
        this.showSuccess('反馈提交成功，感谢您的反馈')
        
        // 重置表单
        setTimeout(() => {
          this.setData({
            typeIndex: -1,
            content: '',
            contentLength: 0,
            imageList: []
          })
          
          // 延迟返回上一页
          setTimeout(() => {
            wx.navigateBack()
          }, 500)
        }, 1500)
      } else {
        throw new Error(res.data.error || '提交失败，请稍后再试')
      }
    } catch (err) {
      wx.hideLoading()
      console.error('提交反馈失败:', err)
      
      this.setData({
        globalError: err.message || '提交失败，请稍后再试',
        submitting: false
      })
      
      wx.showToast({
        title: '提交失败',
        icon: 'none'
      })
    } finally {
      this.setData({ submitting: false })
    }
  },

  // 显示成功提示
  showSuccess(message) {
    this.setData({
      showSuccessTip: true,
      successMessage: message
    })
    
    // 2秒后自动隐藏
    setTimeout(() => {
      this.setData({
        showSuccessTip: false
      })
    }, 2000)
  }
})