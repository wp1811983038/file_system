// pages/enforcer/inspection/create.js
const app = getApp()

Page({
  data: {
    companyId: null,
    company: {},
    inspectionTypes: ['日常检查', '专项检查', '投诉核查', '复查'],
    typeIndex: null,
    minDate: '',
    formData: {
      planned_date: '',
      description: '',
      basis: '',
      notify_company: true
    },
    submitting: false
  },

  onLoad(options) {
    if (options.company_id) {
      this.setData({
        companyId: options.company_id
      })
      this.loadCompanyInfo()
      
      // 设置最小日期为今天
      const today = new Date()
      const year = today.getFullYear()
      const month = String(today.getMonth() + 1).padStart(2, '0')
      const day = String(today.getDate()).padStart(2, '0')
      
      this.setData({
        minDate: `${year}-${month}-${day}`
      })
    } else {
      wx.showToast({
        title: '参数错误',
        icon: 'none'
      })
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
    }
  },

  // 加载企业信息
  async loadCompanyInfo() {
    try {
      wx.showLoading({ title: '加载中...' })
      
      const res = await wx.request({
        url: `${app.globalData.baseUrl}/api/v1/enforcer/companies/${this.data.companyId}`,
        method: 'GET',
        header: {
          'Authorization': `Bearer ${wx.getStorageSync('token')}`
        }
      })
      
      if (res.statusCode === 200) {
        this.setData({
          company: res.data
        })
      } else {
        wx.showToast({
          title: '获取企业信息失败',
          icon: 'none'
        })
      }
    } catch (err) {
      console.error('加载企业信息失败:', err)
    } finally {
      wx.hideLoading()
    }
  },

  // 检查类型选择
  bindTypeChange(e) {
    this.setData({
      typeIndex: e.detail.value
    })
  },

  // 日期选择
  bindDateChange(e) {
    this.setData({
      'formData.planned_date': e.detail.value
    })
  },

  // 检查内容描述输入
  bindDescInput(e) {
    this.setData({
      'formData.description': e.detail.value
    })
  },

  // 检查依据输入
  bindBasisInput(e) {
    this.setData({
      'formData.basis': e.detail.value
    })
  },

  // 是否通知企业
  bindNotifyChange(e) {
    this.setData({
      'formData.notify_company': e.detail.value
    })
  },

  // 表单验证
  validateForm() {
    if (this.data.typeIndex === null) {
      wx.showToast({
        title: '请选择检查类型',
        icon: 'none'
      })
      return false
    }
    
    if (!this.data.formData.planned_date) {
      wx.showToast({
        title: '请选择计划检查时间',
        icon: 'none'
      })
      return false
    }
    
    if (!this.data.formData.description.trim()) {
      wx.showToast({
        title: '请输入检查内容描述',
        icon: 'none'
      })
      return false
    }
    
    return true
  },

  // 提交表单
  async submitForm() {
    // 表单验证
    if (!this.validateForm()) return
    
    this.setData({ submitting: true })
    
    try {
      const res = await wx.request({
        url: `${app.globalData.baseUrl}/api/v1/enforcer/inspections/create`,
        method: 'POST',
        data: {
          company_id: this.data.companyId,
          inspection_type: this.data.inspectionTypes[this.data.typeIndex],
          planned_date: this.data.formData.planned_date,
          description: this.data.formData.description,
          basis: this.data.formData.basis,
          notify_company: this.data.formData.notify_company
        },
        header: {
          'Authorization': `Bearer ${wx.getStorageSync('token')}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (res.statusCode === 201) {
        wx.showToast({
          title: '检查任务创建成功',
          icon: 'success'
        })
        
        setTimeout(() => {
          // 如果是当天的检查任务，直接跳转到执行页面
          const today = new Date().toISOString().slice(0, 10)
          if (this.data.formData.planned_date === today) {
            wx.redirectTo({
              url: `/pages/enforcer/inspection/execute?id=${res.data.inspection_id}`
            })
          } else {
            wx.navigateBack()
          }
        }, 1500)
      } else {
        wx.showToast({
          title: res.data.error || '创建失败',
          icon: 'none'
        })
      }
    } catch (err) {
      console.error('提交检查任务失败:', err)
      wx.showToast({
        title: '提交失败，请重试',
        icon: 'none'
      })
    } finally {
      this.setData({ submitting: false })
    }
  }
})