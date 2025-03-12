// pages/user/profile/edit.js
const app = getApp()

Page({
  data: {
    userInfo: {},
    errors: {},
    globalError: '',
    submitting: false
  },

  onLoad() {
    this.loadUserInfo()
  },

  // 加载用户信息
  async loadUserInfo() {
    try {
      const token = wx.getStorageSync('token')
      if (!token) {
        wx.redirectTo({ url: '/pages/login/login' })
        return
      }

      wx.showLoading({ title: '加载中...' })
      
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

      wx.hideLoading()
      console.log('用户信息响应:', res)
      
      if (res.statusCode === 200) {
        this.setData({ userInfo: res.data })
      } else {
        throw new Error('获取用户信息失败')
      }
    } catch (err) {
      console.error('加载用户信息失败:', err)
      wx.showToast({
        title: '获取信息失败',
        icon: 'none'
      })
    }
  },

  // 输入框内容变化处理函数
  onInputChange(e) {
    const { field } = e.currentTarget.dataset;
    const value = e.detail.value;
    
    // 清除相应字段的错误
    if (this.data.errors[field]) {
      const errors = {...this.data.errors};
      delete errors[field];
      this.setData({ errors });
    }
    
    // 如果是联系方式字段，实时验证手机号格式
    if (field === 'contact_info' && value) {
      this.validateContactInfo(value);
    }
    
    return value; // 返回值用于双向绑定
  },
  
  // 验证手机号并显示实时提示
  validateContactInfo(value) {
    if (value && !this.validatePhoneNumber(value)) {
      this.setData({
        errors: {
          ...this.data.errors,
          contact_info: '请输入有效的手机号码'
        }
      });
      return false;
    }
    return true;
  },

  // 表单整体验证
  validateProfile(data) {
    const errors = {}
    
    if (!data.username.trim()) {
      errors.username = '用户名不能为空'
    }
    
    // 手机号码验证 - 只有当有输入值时才验证
    if (data.contact_info && !this.validatePhoneNumber(data.contact_info)) {
      errors.contact_info = '请输入有效的手机号码'
    }
    
    // 更新UI显示错误
    this.setData({ errors })
    return Object.keys(errors).length === 0
  },
  
  // 手机号验证函数
  validatePhoneNumber(phone) {
    if (!phone) return true; // 空值不验证
    // 中国大陆手机号正则表达式验证
    const pattern = /^1[3-9]\d{9}$/
    return pattern.test(phone)
  },

  // 处理个人信息提交
  async handleProfileSubmit(e) {
    try {
      // 先清除全局错误
      this.setData({ globalError: '' })
      
      const data = e.detail.value
      console.log('提交的表单数据:', data)
      
      // 表单验证
      if (!this.validateProfile(data)) {
        console.log('表单验证失败:', this.data.errors)
        return
      }

      this.setData({ submitting: true })
      wx.showLoading({ title: '保存中...' })
      
      const token = wx.getStorageSync('token')
      
      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: `${app.globalData.baseUrl}/api/v1/users/profile`,
          method: 'PUT',
          header: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          data: {
            username: data.username.trim(),
            company_name: data.company_name.trim(),
            contact_info: data.contact_info.trim(),
            // 添加新字段
            company_address: data.company_address.trim(),
            industry: data.industry.trim(),
            recruitment_unit: data.recruitment_unit.trim()
          },
          success: resolve,
          fail: reject
        })
      })

      wx.hideLoading()
      console.log('修改个人信息响应:', res)

      if (res.statusCode === 200) {
        // 添加轻微振动反馈
        wx.vibrateShort({ type: 'light' })
        
        wx.showToast({
          title: '保存成功',
          icon: 'success'
        })
        
        // 延迟返回上一页
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
      } else {
        // 处理错误响应
        let errorMessage = '保存失败，请稍后再试'
        const newErrors = {}
        
        console.log('错误响应数据:', res.data)
        
        if (res.data && res.data.error) {
          errorMessage = res.data.error
          
          // 针对特定错误类型进行处理
          if (errorMessage.includes('用户名已存在')) {
            newErrors.username = '用户名已被占用'
          } else if (errorMessage.includes('有效的手机号') || errorMessage.includes('手机号码')) {
            newErrors.contact_info = '请输入有效的手机号码'
          }
        }
        
        // 更新错误状态
        this.setData({
          errors: newErrors,
          globalError: errorMessage
        })
        
        // 弹出错误提示
        wx.showModal({
          title: '保存失败',
          content: errorMessage,
          showCancel: false
        })
      }
    } catch (err) {
      wx.hideLoading()
      const errorMsg = err.message || '网络连接错误，请稍后再试'
      console.error('更新个人信息失败:', errorMsg, err)
      
      this.setData({ globalError: errorMsg })
      
      wx.showModal({
        title: '保存失败',
        content: errorMsg,
        showCancel: false
      })
    } finally {
      this.setData({ submitting: false })
    }
  }
})