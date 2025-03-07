// pages/user/files/list.js
const app = getApp()
const fileUtils = require('../../../utils/file')

// 文件处理工具函数 - 下载并直接打开预览
async function handleFileWithPreview(tempFilePath, options = {}) {
  const { fileName = '文件', fileExtension = '' } = options;
  
  try {
    // 保存到小程序本地存储
    const fs = wx.getFileSystemManager();
    const saveRes = await new Promise((resolve, reject) => {
      fs.saveFile({
        tempFilePath,
        success: resolve,
        fail: reject
      });
    });
    
    console.log('文件已保存到小程序本地:', saveRes.savedFilePath);
    
    // 直接打开预览
    const supportedTypes = ['txt', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'];
    
    // 获取文件扩展名
    let extension = fileExtension;
    if (!extension) {
      extension = tempFilePath.split('.').pop().toLowerCase();
    }
    
    if (supportedTypes.includes(extension)) {
      try {
        await wx.openDocument({
          filePath: saveRes.savedFilePath,
          showMenu: true, // 显示右上角菜单按钮
          success: (res) => {
            console.log('文件打开成功');
          },
          fail: (error) => {
            console.error('文件预览失败:', error);
            wx.showModal({
              title: '预览失败',
              content: '无法预览此类型文件，您可以尝试通过"保存到手机"后用其他应用打开。',
              showCancel: false
            });
          }
        });
      } catch (openError) {
        console.error('打开文档失败', openError);
        wx.showModal({
          title: '提示',
          content: '文件已保存，但系统无法打开，请尝试通过右上角菜单"保存到手机"后查看。',
          showCancel: false
        });
      }
    } else {
      wx.showModal({
        title: '提示',
        content: '该类型文件不支持预览，已保存到本地。您可以通过右上角分享按钮发送给自己后查看。',
        showCancel: false
      });
    }
    
    return saveRes;
  } catch (error) {
    console.error('文件处理失败:', error);
    throw error;
  }
}

Page({
  data: {
    templates: [],
    showUploadModal: false,
    selectedFile: null,
    currentTemplateId: null,
    isResubmit: false,
    currentUserId: null,
    showDescriptionModal: false,   // 控制描述模态框显示
    currentDescription: '',        // 当前查看的描述内容
    showApprovalModal: false,      // 控制审批进度模态框显示
    currentApproval: null,         // 当前审批信息
    showFileViewModal: false,      // 控制文件查看模态框显示
    currentFileId: null            // 当前查看的文件ID
  },

  // 获取状态类名
  getStatusClass(status) {
    if (!status || status === 'draft') return 'status-draft';
    if (status === 'submitted') return 'status-submitted';
    if (status === 'under_review') return 'status-under-review';
    if (status === 'approved') return 'status-approved';
    if (status === 'rejected') return 'status-rejected';
    return 'status-draft';
  },

  // 获取状态文本
  getStatusText(status) {
    if (!status || status === 'draft') return '草稿';
    if (status === 'submitted') return '已提交';
    if (status === 'under_review') return '审核中';
    if (status === 'approved') return '已通过';
    if (status === 'rejected') return '已拒绝';
    return '草稿';
  },

  onLoad(options) {
    console.log('页面加载', options)
    this.loadUserInfo()
    this.loadTemplates()
    
    // 如果是从审批页面返回并需要重新提交
    if (options && options.resubmit === 'true' && options.templateId) {
      setTimeout(() => {
        this.openUploadModal({
          currentTarget: {
            dataset: {
              templateId: options.templateId,
              isResubmit: true
            }
          }
        })
      }, 500)
    }
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 0
      })
    }
  },

  onPullDownRefresh() {
    console.log('触发下拉刷新')
    this.loadTemplates().then(() => {
      wx.stopPullDownRefresh()
    })
  },

  // 阻止模态框中的触摸滑动事件（防止背景滚动）
  preventTouchMove() {
    return false;
  },

  // 显示描述内容模态框
  showDescription(e) {
    const description = e.currentTarget.dataset.description;
    this.setData({
      showDescriptionModal: true,
      currentDescription: description
    });

    // 添加触感反馈
    wx.vibrateShort({ type: 'light' });
  },

  // 关闭描述内容模态框
  closeDescriptionModal() {
    this.setData({
      showDescriptionModal: false
    });
  },
  
  // 显示审批进度模态框
  async viewApprovalProgress(e) {
    const fileId = e.currentTarget.dataset.fileId;
    if (!fileId) {
      wx.showToast({
        title: '文件ID不能为空',
        icon: 'none'
      });
      return;
    }
    
    try {
      wx.showLoading({ title: '加载中...' });
      
      const token = wx.getStorageSync('token');
      
      if (!token) {
        wx.redirectTo({ url: '/pages/login/login' });
        return;
      }
      
      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: `${app.globalData.baseUrl}/api/v1/files/${fileId}/approval-progress`,
          method: 'GET',
          header: {
            'Authorization': `Bearer ${token}`
          },
          success: resolve,
          fail: reject
        });
      });
      
      if (res.statusCode === 200) {
        this.setData({
          showApprovalModal: true,
          currentApproval: {
            status: res.data.file_info.status,
            steps: res.data.approval_history
          }
        });
      } else {
        throw new Error(res.data.error || '获取审批进度失败');
      }
    } catch (err) {
      console.error('加载审批进度失败:', err);
      wx.showToast({
        title: err.message || '加载失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },
  
  // 关闭审批进度模态框
  closeApprovalModal() {
    this.setData({
      showApprovalModal: false,
      currentApproval: null
    });
  },
  
  // 显示文件查看模态框
  viewFile(e) {
    const fileId = e.currentTarget.dataset.fileId;
    if (!fileId) return;
    
    this.setData({
      showFileViewModal: true,
      currentFileId: fileId
    });
  },
  
  // 关闭文件查看模态框
  closeFileViewModal() {
    this.setData({
      showFileViewModal: false,
      currentFileId: null
    });
  },

  // 阻止事件冒泡，避免点击内容区域关闭弹窗
  stopPropagation(e) {
    // 阻止事件冒泡
    return false;
  },

  // 加载用户信息
  async loadUserInfo() {
    try {
      console.log('开始加载用户信息')
      const token = wx.getStorageSync('token')
      if (!token) {
        console.error('未找到token')
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

      console.log('用户信息响应:', res)
      if (res.statusCode === 200) {
        this.setData({ currentUserId: res.data.id })
        console.log('当前用户ID:', res.data.id)
      } else {
        throw new Error('获取用户信息失败')
      }
    } catch (err) {
      console.error('加载用户信息失败:', err)
      wx.showToast({
        title: '获取用户信息失败',
        icon: 'none'
      })
    }
  },

  // 加载模板列表
  async loadTemplates() {
    try {
      console.log('开始加载模板列表')
      const token = wx.getStorageSync('token')
      if (!token) {
        console.error('未找到token')
        throw new Error('未登录')
      }

      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: `${app.globalData.baseUrl}/api/v1/files/user/templates`,
          method: 'GET',
          header: {
            'Authorization': `Bearer ${token}`
          },
          success: resolve,
          fail: reject
        })
      })

      console.log('模板列表响应:', res)

      if (res.statusCode === 200 && res.data && res.data.templates) {
        this.setData({
          templates: res.data.templates
        }, () => {
          console.log('更新后的模板数据:', this.data.templates)
        })
      } else {
        throw new Error('获取模板列表失败')
      }
    } catch (err) {
      console.error('加载模板列表失败:', err)
      wx.showToast({
        title: '加载失败',
        icon: 'error'
      })
    }
  },

  // 搜索功能
  onSearch(e) {
    const searchText = e.detail.value.toLowerCase()
    console.log('搜索关键词:', searchText)

    const originalTemplates = this.data.templates
    const filteredTemplates = originalTemplates.filter(template =>
      template.name.toLowerCase().includes(searchText) ||
      (template.description || '').toLowerCase().includes(searchText)
    )

    console.log('筛选后的模板数量:', filteredTemplates.length)
    this.setData({ templates: filteredTemplates })
  },

  // 打开上传模态框
  openUploadModal(e) {
    const { templateId, isResubmit } = e.currentTarget.dataset
    console.log('打开上传模态框:', { templateId, isResubmit })

    this.setData({
      showUploadModal: true,
      currentTemplateId: templateId,
      isResubmit,
      selectedFile: null
    })
  },

  // 关闭上传模态框
  closeUploadModal() {
    console.log('关闭上传模态框')
    this.setData({
      showUploadModal: false,
      selectedFile: null
    })
  },

  // 选择文件
  async chooseFile() {
    try {
      console.log('开始选择文件')
      const res = await wx.chooseMessageFile({
        count: 1,
        type: 'file'
      })

      console.log('选择的文件:', res)
      if (res.tempFiles && res.tempFiles[0]) {
        // 检查文件大小限制 (如50MB)
        const file = res.tempFiles[0];
        const MAX_SIZE = 50 * 1024 * 1024; // 50MB
        
        if (file.size > MAX_SIZE) {
          wx.showToast({
            title: '文件不能超过50MB',
            icon: 'none'
          });
          return;
        }
        
        this.setData({
          selectedFile: res.tempFiles[0]
        })
        console.log('已选择文件:', res.tempFiles[0])
      }
    } catch (err) {
      console.error('选择文件失败:', err)
      wx.showToast({
        title: '选择文件失败',
        icon: 'none'
      })
    }
  },

  // 提交文件
  async submitFile() {
    if (!this.data.selectedFile) {
      wx.showToast({
        title: '请选择文件',
        icon: 'none'
      })
      return
    }

    try {
      const file = this.data.selectedFile
      console.log('开始提交文件:', {
        templateId: this.data.currentTemplateId,
        fileName: file.name,
        size: file.size,
        type: file.type
      })

      const token = wx.getStorageSync('token')
      const timestamp = new Date().getTime()

      // 对文件名进行URL编码，以便能在URL中安全传递
      const encodedFileName = encodeURIComponent(file.name)
      
      wx.showLoading({ title: '准备上传...' })

      const uploadRes = await new Promise((resolve, reject) => {
        const uploadTask = wx.uploadFile({
          // 在URL中添加originalName参数
          url: `${app.globalData.baseUrl}/api/v1/files/upload/${this.data.currentTemplateId}?t=${timestamp}&originalName=${encodedFileName}`,
          filePath: file.path,
          name: 'file',
          formData: {
            // 在表单数据中也添加，以确保至少一种方式能被后端接收
            originalFilename: file.name,
            original_filename: file.name,
            filename: file.name
          },
          header: {
            'Authorization': `Bearer ${token}`,
            'Cache-Control': 'no-cache',
            // 同时在HTTP头中添加
            'X-Original-Filename': file.name
          },
          success: (res) => {
            console.log('上传成功响应:', res)
            resolve(res)
          },
          fail: (error) => {
            console.error('上传失败:', error)
            reject(error)
          }
        })

        uploadTask.onProgressUpdate((res) => {
          wx.showLoading({
            title: `上传中 ${res.progress}%`
          })
        })
      })

      console.log('完整上传响应:', uploadRes)

      if (uploadRes.statusCode === 200) {
        try {
          const responseData = JSON.parse(uploadRes.data)
          console.log('解析后的响应数据:', responseData)

          if (responseData.error) {
            throw new Error(responseData.error)
          }
          
          // 提交文件进入审批流程
          await this.submitForApproval(responseData.file_id);

          wx.showToast({
            title: '提交成功',
            icon: 'success',
            duration: 2000
          })

          this.closeUploadModal()
          await this.loadTemplates()
        } catch (parseError) {
          console.error('解析响应数据失败:', {
            error: parseError,
            responseData: uploadRes.data
          })
          throw new Error('提交失败，请重试')
        }
      } else {
        console.error('上传失败，状态码:', uploadRes.statusCode)
        let errorMessage = '上传失败'
        try {
          const errorData = JSON.parse(uploadRes.data)
          errorMessage = errorData.error || errorMessage
        } catch (e) {
          console.warn('解析错误响应失败:', e)
        }
        throw new Error(errorMessage)
      }
    } catch (err) {
      console.error('提交文件失败:', err, err.stack)
      wx.showToast({
        title: err.message || '提交失败',
        icon: 'none',
        duration: 2000
      })
    } finally {
      setTimeout(() => {
        wx.hideLoading()
      }, 100)
    }
  },
  
  // 提交审批
  async submitForApproval(fileId) {
    try {
      if (!fileId) {
        throw new Error('文件ID不能为空');
      }
      
      const token = wx.getStorageSync('token');
      if (!token) {
        throw new Error('未登录');
      }
      
      wx.showLoading({ title: '正在提交审批...' });
      
      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: `${app.globalData.baseUrl}/api/v1/files/submit/${fileId}`,
          method: 'POST',
          header: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          success: resolve,
          fail: reject
        });
      });
      
      if (res.statusCode === 200) {
        console.log('审批提交成功:', res.data);
        return true;
      } else {
        throw new Error(res.data.error || '提交审批失败');
      }
    } catch (err) {
      console.error('提交审批失败:', err);
      // 这里不显示提示，因为主流程中已经有成功提示了
      return false;
    } finally {
      wx.hideLoading();
    }
  },

  // 打开操作菜单
  openActionSheet(e) {
    const { templateId } = e.currentTarget.dataset
    wx.showActionSheet({
      itemList: ['查看', '下载', '重新提交'],
      success: (res) => {
        switch (res.tapIndex) {
          case 0: // 查看
            this.viewSubmission({ currentTarget: { dataset: { templateId } } })
            break
          case 1: // 下载
            this.downloadSubmission({ currentTarget: { dataset: { templateId } } })
            break
          case 2: // 重新提交
            this.openUploadModal({
              currentTarget: {
                dataset: {
                  templateId,
                  isResubmit: true
                }
              }
            })
            break
        }
      }
    })
  },

  // 下载模板 - 优化版本
  async downloadTemplate(e) {
    const { id: templateId, name: templateName } = e.currentTarget.dataset
    console.log('开始下载模板:', { templateId, templateName })

    try {
      const token = wx.getStorageSync('token')
      wx.showLoading({ title: '准备下载...' })

      // 下载文件，添加时间戳和随机数防止缓存
      const timestamp = Date.now()
      const random = Math.floor(Math.random() * 10000)
      const downloadRes = await new Promise((resolve, reject) => {
        const downloadTask = wx.downloadFile({
          url: `${app.globalData.baseUrl}/api/v1/files/download/template/${templateId}?t=${timestamp}&r=${random}`,
          header: {
            'Authorization': `Bearer ${token}`,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          },
          success: resolve,
          fail: reject
        });
        
        // 监听下载进度
        downloadTask.onProgressUpdate((res) => {
          wx.showLoading({
            title: `下载中 ${res.progress}%`
          });
        });
      });

      console.log('下载响应:', downloadRes);
      wx.hideLoading();

      if (downloadRes.statusCode === 200) {
        // 获取文件扩展名
        const fileExtension = downloadRes.tempFilePath.split('.').pop().toLowerCase();
        
        // 直接处理文件(保存并预览)
        const saveRes = await handleFileWithPreview(downloadRes.tempFilePath, {
          fileName: templateName,
          fileExtension: fileExtension
        });
        
        // 提示下载成功，但不显示是否打开的确认框
        wx.showToast({
          title: '下载成功',
          icon: 'success'
        });
        
        return saveRes;
      } else {
        throw new Error('下载失败');
      }
    } catch (err) {
      console.error('下载模板失败:', err);
      wx.showToast({
        title: '下载失败',
        icon: 'none'
      });
      return null;
    }
  },

  // 查看提交文件 - 优化版
  async viewSubmission(e) {
    const { templateId } = e.currentTarget.dataset;
    const userId = this.data.currentUserId;
    console.log('查看提交文件:', { userId, templateId });

    if (!userId || !templateId) {
      wx.showToast({
        title: '无效的请求参数',
        icon: 'none'
      });
      return;
    }

    try {
      const token = wx.getStorageSync('token');
      const timestamp = new Date().getTime();
      const random = Math.floor(Math.random() * 10000);

      wx.showLoading({ title: '加载中...' });

      // 下载文件
      const downloadRes = await new Promise((resolve, reject) => {
        const downloadTask = wx.downloadFile({
          url: `${app.globalData.baseUrl}/api/v1/files/preview/submission/${userId}/${templateId}?t=${timestamp}&r=${random}`,
          header: {
            'Authorization': `Bearer ${token}`,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          },
          success: resolve,
          fail: reject
        });
        
        // 监听下载进度
        downloadTask.onProgressUpdate((res) => {
          wx.showLoading({
            title: `加载中 ${res.progress}%`
          });
        });
      });

      console.log('预览响应:', downloadRes);
      wx.hideLoading();

      if (downloadRes.statusCode === 200) {
        // 查找相应的模板，以获取文件名
        const template = this.data.templates.find(t => t.id === templateId);
        const fileName = template ? template.name : '预览文件';
        
        // 处理文件并直接打开预览
        await handleFileWithPreview(downloadRes.tempFilePath, {
          fileName: fileName
        });
      } else {
        throw new Error('预览失败');
      }
    } catch (err) {
      console.error('预览文件失败:', err);
      wx.showToast({
        title: '预览失败',
        icon: 'none'
      });
    }
  },

  // 下载提交文件 - 优化版
  async downloadSubmission(e) {
    const fileId = e.currentTarget.dataset.fileId;
    console.log('下载提交文件:', { fileId });

    if (!fileId) {
      wx.showToast({
        title: '无效的文件ID',
        icon: 'none'
      });
      return;
    }

    try {
      const token = wx.getStorageSync('token');
      const timestamp = new Date().getTime();
      const random = Math.floor(Math.random() * 10000);

      wx.showLoading({ title: '准备下载...' });

      // 下载文件
      const downloadRes = await new Promise((resolve, reject) => {
        const downloadTask = wx.downloadFile({
          url: `${app.globalData.baseUrl}/api/v1/files/download/submission/${fileId}?t=${timestamp}&r=${random}`,
          header: {
            'Authorization': `Bearer ${token}`,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          },
          success: resolve,
          fail: reject
        });
        
        // 监听下载进度
        downloadTask.onProgressUpdate((res) => {
          wx.showLoading({
            title: `下载中 ${res.progress}%`
          });
        });
      });

      console.log('下载响应:', downloadRes);
      wx.hideLoading();

      if (downloadRes.statusCode === 200) {
        // 处理文件直接预览
        await handleFileWithPreview(downloadRes.tempFilePath);
        
        wx.showToast({
          title: '下载成功',
          icon: 'success'
        });
      } else {
        throw new Error('下载失败');
      }
    } catch (err) {
      console.error('下载文件失败:', err);
      wx.showToast({
        title: '下载失败',
        icon: 'none'
      });
    }
  },
  
  // 预览提交文件
  async previewSubmission(e) {
    const fileId = e.currentTarget.dataset.fileId;
    console.log('预览提交文件:', { fileId });

    if (!fileId) {
      wx.showToast({
        title: '无效的文件ID',
        icon: 'none'
      });
      return;
    }

    try {
      const token = wx.getStorageSync('token');
      const timestamp = new Date().getTime();
      const random = Math.floor(Math.random() * 10000);

      wx.showLoading({ title: '加载中...' });

      // 下载文件
      const downloadRes = await new Promise((resolve, reject) => {
        const downloadTask = wx.downloadFile({
          url: `${app.globalData.baseUrl}/api/v1/files/preview/submission/${fileId}?t=${timestamp}&r=${random}`,
          header: {
            'Authorization': `Bearer ${token}`,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          },
          success: resolve,
          fail: reject
        });
        
        // 监听下载进度
        downloadTask.onProgressUpdate((res) => {
          wx.showLoading({
            title: `加载中 ${res.progress}%`
          });
        });
      });

      console.log('预览响应:', downloadRes);
      wx.hideLoading();

      if (downloadRes.statusCode === 200) {
        // 处理文件并直接打开预览
        await handleFileWithPreview(downloadRes.tempFilePath);
      } else {
        throw new Error('预览失败');
      }
    } catch (err) {
      console.error('预览文件失败:', err);
      wx.showToast({
        title: '预览失败',
        icon: 'none'
      });
    }
  }
});