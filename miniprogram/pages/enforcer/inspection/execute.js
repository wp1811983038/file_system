// pages/enforcer/inspection/execute.js
const app = getApp()

Page({
  data: {
    inspectionId: null,
    inspection: {},
    company: {},
    problems: [],
    photos: [],
    canSubmit: false,
    submitting: false,
    
    // 问题弹窗
    showProblemModal: false,
    problemTypes: ['安全隐患', '环保问题', '消防问题', '卫生问题', '资质问题', '其他'],
    currentProblem: {
      typeIndex: null,
      type: '',
      severity: 'medium',
      description: ''
    },
    editingProblemIndex: null,
    
    // 照片描述弹窗
    showPhotoDescModal: false,
    currentPhoto: {
      path: '',
      description: ''
    },
    currentPhotoIndex: -1
  },

  onLoad(options) {
    if (options.id) {
      this.setData({
        inspectionId: options.id
      })
      this.loadInspectionDetail()
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

  // 加载检查任务详情
  async loadInspectionDetail() {
    try {
      wx.showLoading({ title: '加载中...' })
      
      const res = await wx.request({
        url: `${app.globalData.baseUrl}/api/v1/enforcer/inspections/${this.data.inspectionId}`,
        method: 'GET',
        header: {
          'Authorization': `Bearer ${wx.getStorageSync('token')}`
        }
      })
      
      if (res.statusCode === 200) {
        this.setData({
          inspection: res.data.inspection,
          company: res.data.company,
          problems: res.data.problems || [],
          photos: res.data.photos || []
        })
        
        // 检查是否可以提交
        this.checkSubmitStatus()
      } else {
        wx.showToast({
          title: '获取检查任务失败',
          icon: 'none'
        })
      }
    } catch (err) {
      console.error('加载检查任务失败:', err)
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    } finally {
      wx.hideLoading()
    }
  },

  // 检查提交按钮状态
  checkSubmitStatus() {
    // 至少有一项问题记录或照片才可提交
    const canSubmit = this.data.problems.length > 0 || this.data.photos.length > 0
    this.setData({ canSubmit })
  },

  // 添加问题弹窗
  showAddProblem() {
    this.setData({
      currentProblem: {
        typeIndex: null,
        type: '',
        severity: 'medium',
        description: ''
      },
      editingProblemIndex: null,
      showProblemModal: true
    })
  },

  // 编辑问题
  editProblem(e) {
    const index = e.currentTarget.dataset.index
    const problem = this.data.problems[index]
    
    // 查找问题类型索引
    const typeIndex = this.data.problemTypes.findIndex(type => type === problem.type)
    
    this.setData({
      currentProblem: {
        typeIndex: typeIndex !== -1 ? typeIndex : null,
        type: problem.type,
        severity: problem.severity,
        description: problem.description
      },
      editingProblemIndex: index,
      showProblemModal: true
    })
  },

  // 删除问题
  deleteProblem(e) {
    const index = e.currentTarget.dataset.index
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条问题记录吗？',
      success: (res) => {
        if (res.confirm) {
          const problems = [...this.data.problems]
          problems.splice(index, 1)
          
          this.setData({ problems })
          this.checkSubmitStatus()
        }
      }
    })
  },

  // 问题类型选择
  bindProblemTypeChange(e) {
    const typeIndex = e.detail.value
    
    this.setData({
      'currentProblem.typeIndex': typeIndex,
      'currentProblem.type': this.data.problemTypes[typeIndex]
    })
  },

  // 严重程度选择
  bindSeverityChange(e) {
    this.setData({
      'currentProblem.severity': e.detail.value
    })
  },

  // 问题描述输入
  bindProblemDescInput(e) {
    this.setData({
      'currentProblem.description': e.detail.value
    })
  },

  // 保存问题
  saveProblem() {
    // 检查表单
    if (this.data.currentProblem.typeIndex === null) {
      wx.showToast({
        title: '请选择问题类型',
        icon: 'none'
      })
      return
    }
    
    if (!this.data.currentProblem.description.trim()) {
      wx.showToast({
        title: '请输入问题描述',
        icon: 'none'
      })
      return
    }
    
    // 构建问题对象
    const problem = {
      type: this.data.currentProblem.type,
      severity: this.data.currentProblem.severity,
      description: this.data.currentProblem.description.trim()
    }
    
    // 更新或添加问题
    let problems = [...this.data.problems]
    
    if (this.data.editingProblemIndex !== null) {
      // 更新问题
      problems[this.data.editingProblemIndex] = problem
    } else {
      // 添加问题
      problems.push(problem)
    }
    
    this.setData({ 
      problems,
      showProblemModal: false 
    })
    
    this.checkSubmitStatus()
  },

  // 隐藏问题弹窗
  hideProblemModal() {
    this.setData({
      showProblemModal: false
    })
  },

  // 选择照片
  chooseImage() {
    wx.chooseImage({
      count: 9,
      sizeType: ['compressed'],
      sourceType: ['camera', 'album'],
      success: (res) => {
        const tempFilePaths = res.tempFilePaths
        
        // 如果只选择了一张图片，弹出描述框
        if (tempFilePaths.length === 1) {
          this.setData({
            currentPhoto: {
              path: tempFilePaths[0],
              description: ''
            },
            currentPhotoIndex: -1,
            showPhotoDescModal: true
          })
        } else {
          // 多张图片，直接添加
          const newPhotos = tempFilePaths.map(path => ({
            path,
            description: ''
          }))
          
          this.setData({
            photos: [...this.data.photos, ...newPhotos]
          })
          
          this.checkSubmitStatus()
        }
      }
    })
  },

  // 照片描述输入
  bindPhotoDescInput(e) {
    this.setData({
      'currentPhoto.description': e.detail.value
    })
  },

  // 保存照片描述
  savePhotoDesc() {
    if (this.data.currentPhotoIndex >= 0) {
      // 更新现有照片描述
      const photos = [...this.data.photos]
      photos[this.data.currentPhotoIndex].description = this.data.currentPhoto.description
      
      this.setData({ 
        photos,
        showPhotoDescModal: false 
      })
    } else {
      // 添加新照片
      const photos = [...this.data.photos, {
        path: this.data.currentPhoto.path,
        description: this.data.currentPhoto.description
      }]
      
      this.setData({ 
        photos,
        showPhotoDescModal: false 
      })
      
      this.checkSubmitStatus()
    }
  },

  // 隐藏照片描述弹窗
  hidePhotoDescModal() {
    this.setData({
      showPhotoDescModal: false
    })
  },

  // 删除照片
  deletePhoto(e) {
    const index = e.currentTarget.dataset.index
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这张照片吗？',
      success: (res) => {
        if (res.confirm) {
          const photos = [...this.data.photos]
          photos.splice(index, 1)
          
          this.setData({ photos })
          this.checkSubmitStatus()
        }
      }
    })
  },

  // 预览照片
  previewImage(e) {
    const url = e.currentTarget.dataset.url
    const urls = this.data.photos.map(photo => photo.path)
    
    wx.previewImage({
      current: url,
      urls
    })
  },

  // 提交检查结果
  async submitInspection() {
    if (!this.data.canSubmit) {
      wx.showToast({
        title: '请至少添加一条问题记录或照片',
        icon: 'none'
      })
      return
    }
    
    this.setData({ submitting: true })
    
    try {
      // 上传照片
      const photoResults = []
      for (let i = 0; i < this.data.photos.length; i++) {
        const photo = this.data.photos[i]
        wx.showLoading({ title: `上传照片 ${i+1}/${this.data.photos.length}` })
        
        try {
          const uploadRes = await this.uploadFile(photo.path, 'inspection_photo')
          photoResults.push({
            photo_url: uploadRes.file_url,
            description: photo.description
          })
        } catch (err) {
          console.error('上传照片失败:', err)
          wx.showToast({
            title: '上传照片失败，请重试',
            icon: 'none'
          })
          this.setData({ submitting: false })
          return
        }
      }
      
      wx.showLoading({ title: '提交检查结果' })
      
      // 提交检查结果
      const res = await wx.request({
        url: `${app.globalData.baseUrl}/api/v1/enforcer/inspections/${this.data.inspectionId}/complete`,
        method: 'POST',
        data: {
          problems: this.data.problems,
          photos: photoResults
        },
        header: {
          'Authorization': `Bearer ${wx.getStorageSync('token')}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (res.statusCode === 200) {
        wx.showToast({
          title: '提交成功',
          icon: 'success'
        })
        
        // 重新加载数据
        setTimeout(() => {
          this.loadInspectionDetail()
        }, 1500)
      } else {
        wx.showToast({
          title: res.data.error || '提交失败',
          icon: 'none'
        })
      }
    } catch (err) {
      console.error('提交检查结果失败:', err)
      wx.showToast({
        title: '提交失败，请重试',
        icon: 'none'
      })
    } finally {
      this.setData({ submitting: false })
      wx.hideLoading()
    }
  },

  // 上传文件
  uploadFile(filePath, fileType) {
    return new Promise((resolve, reject) => {
      wx.uploadFile({
        url: `${app.globalData.baseUrl}/api/v1/enforcer/upload`,
        filePath,
        name: 'file',
        formData: {
          file_type: fileType
        },
        header: {
          'Authorization': `Bearer ${wx.getStorageSync('token')}`
        },
        success(res) {
          if (res.statusCode === 200) {
            // 解析响应数据
            try {
              const data = JSON.parse(res.data)
              resolve(data)
            } catch (e) {
              reject(new Error('解析上传响应失败'))
            }
          } else {
            reject(new Error(`上传失败: ${res.statusCode}`))
          }
        },
        fail(err) {
          reject(err)
        }
      })
    })
  },

  // 防止穿透
  preventTouchMove() {
    return false
  }
})