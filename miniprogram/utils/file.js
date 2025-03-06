// utils/file.js
const request = require('./request');

/**
 * 文件工具类
 * 用于处理文件的保存、预览和其他常用操作
 */
const FileUtils = {
  /**
   * 文件类型映射表
   */
  FILE_TYPES: {
    // 文档类型
    'txt': { icon: 'doc', category: 'document', canPreview: true },
    'doc': { icon: 'doc', category: 'document', canPreview: true },
    'docx': { icon: 'doc', category: 'document', canPreview: true },
    'pdf': { icon: 'pdf', category: 'document', canPreview: true },
    // 表格类型
    'xls': { icon: 'excel', category: 'spreadsheet', canPreview: true },
    'xlsx': { icon: 'excel', category: 'spreadsheet', canPreview: true },
    // 演示文稿
    'ppt': { icon: 'ppt', category: 'presentation', canPreview: true },
    'pptx': { icon: 'ppt', category: 'presentation', canPreview: true },
    // 图片类型
    'jpg': { icon: 'image', category: 'image', canPreview: true },
    'jpeg': { icon: 'image', category: 'image', canPreview: true },
    'png': { icon: 'image', category: 'image', canPreview: true },
    'gif': { icon: 'image', category: 'image', canPreview: true },
    // 压缩文件
    'zip': { icon: 'zip', category: 'archive', canPreview: false },
    'rar': { icon: 'zip', category: 'archive', canPreview: false },
    // 默认
    'default': { icon: 'file', category: 'other', canPreview: false }
  },
  
  /**
   * 获取文件类型信息
   */
  getFileTypeInfo(filename) {
    if (!filename) return this.FILE_TYPES.default;
    
    const extension = filename.split('.').pop().toLowerCase();
    return this.FILE_TYPES[extension] || this.FILE_TYPES.default;
  },
  
  /**
   * 格式化文件大小
   */
  formatFileSize(size) {
    if (size < 1024) {
      return size + 'B';
    } else if (size < 1024 * 1024) {
      return (size / 1024).toFixed(2) + 'KB';
    } else if (size < 1024 * 1024 * 1024) {
      return (size / (1024 * 1024)).toFixed(2) + 'MB';
    } else {
      return (size / (1024 * 1024 * 1024)).toFixed(2) + 'GB';
    }
  },
  
  /**
   * 获取文件扩展名
   */
  getFileExtension(filename) {
    if (!filename) return '';
    return filename.split('.').pop().toLowerCase();
  },
  
  /**
   * 保存临时文件到小程序本地存储
   * @param {string} tempFilePath - 临时文件路径
   * @returns {Promise} 保存结果，返回savedFilePath
   */
  saveToLocalStorage(tempFilePath) {
    const fs = wx.getFileSystemManager();
    return new Promise((resolve, reject) => {
      fs.saveFile({
        tempFilePath,
        success: (res) => {
          console.log('文件已保存到小程序本地:', res.savedFilePath);
          resolve(res);
        },
        fail: (err) => {
          console.error('保存到小程序本地失败:', err);
          reject(err);
        }
      });
    });
  },
  
  /**
   * 尝试保存文件到用户设备（可能失败），完全放弃使用saveFileToDisk
   * 改为使用文件预览方式，让用户自己选择保存
   */
  async saveToUserDevice(tempFilePath) {
    try {
      // 直接保存到本地存储，不再尝试saveFileToDisk
      const saveResult = await this.saveToLocalStorage(tempFilePath);
      
      // 这里我们不再显示"文件已保存"的提示
      // 因为用户需要在预览界面手动保存
      
      return saveResult;
    } catch (error) {
      console.error('文件保存失败:', error);
      throw error;
    }
  },
  
  /**
   * 预览文件 - 修改后的版本
   * 添加skipPrompt参数，允许直接打开预览而不显示提示
   */
  previewFile(filePath, options = {}) {
    const { showMenu = true, fileName = '', skipPrompt = false } = options;
    
    return new Promise((resolve, reject) => {
      if (skipPrompt) {
        // 直接打开预览，不显示提示
        wx.openDocument({
          filePath,
          showMenu, // 显示右上角菜单按钮
          success: resolve,
          fail: (error) => {
            console.error('文件预览失败:', error);
            wx.showModal({
              title: '预览失败',
              content: '无法预览此类型文件，您可以尝试通过微信聊天发送给自己后下载。',
              showCancel: false
            });
            reject(error);
          }
        });
      } else {
        // 显示原先的提示对话框
        wx.showModal({
          title: '文件预览提示',
          content: '文件将在预览界面打开，您可以点击右上角"更多"按钮，然后选择"保存到手机"或"用其他应用打开"来保存文件。',
          confirmText: '去预览',
          success: (res) => {
            if (res.confirm) {
              // 用户点击确认，打开预览
              wx.openDocument({
                filePath,
                showMenu, // 显示右上角菜单按钮
                success: resolve,
                fail: (error) => {
                  console.error('文件预览失败:', error);
                  wx.showModal({
                    title: '预览失败',
                    content: '无法预览此类型文件，您可以尝试通过微信聊天发送给自己后下载。',
                    showCancel: false
                  });
                  reject(error);
                }
              });
            } else {
              // 用户取消，不进行预览
              reject(new Error('用户取消预览'));
            }
          }
        });
      }
    });
  },
  
  /**
   * 选择文件
   */
  chooseFile(options = {}) {
    const defaultOptions = {
      count: 1,
      type: 'file',
      extension: []
    };
    
    const mergedOptions = { ...defaultOptions, ...options };
    
    return new Promise((resolve, reject) => {
      wx.chooseMessageFile({
        ...mergedOptions,
        success: resolve,
        fail: reject
      });
    });
  },
  
  /**
   * 从URL下载文件
   * 改进版本 - 优化为下载后直接预览，无需提示
   */
  async downloadAndSaveFile(url, options = {}) {
    const {
      fileName = '',
      preview = true, // 默认总是预览
      showToast = true,
      skipPrompt = true  // 新增参数，默认跳过提示
    } = options;
    
    try {
      wx.showLoading({ title: '准备下载...' });
      
      // 下载文件
      const downloadRes = await new Promise((resolve, reject) => {
        const downloadTask = wx.downloadFile({
          url,
          header: {
            'Authorization': `Bearer ${wx.getStorageSync('token')}`
          },
          success: resolve,
          fail: reject
        });
        
        // 监听下载进度
        downloadTask.onProgressUpdate((res) => {
          if (options.onProgress) {
            options.onProgress(res);
          }
          
          wx.showLoading({
            title: `下载中 ${res.progress}%`
          });
        });
      });
      
      wx.hideLoading();
      
      if (downloadRes.statusCode !== 200) {
        wx.showToast({
          title: '下载失败',
          icon: 'none'
        });
        return null;
      }
      
      // 保存文件到小程序本地存储
      const saveRes = await this.saveToLocalStorage(downloadRes.tempFilePath);
      
      if (showToast) {
        wx.showToast({
          title: '下载成功',
          icon: 'success',
          duration: 1000  // 缩短Toast时间，避免与预览重叠
        });
      }
      
      // 直接预览文件，让用户通过预览界面保存
      if (preview) {
        const extension = this.getFileExtension(downloadRes.tempFilePath);
        const fileTypeInfo = this.getFileTypeInfo(downloadRes.tempFilePath);
        
        if (fileTypeInfo.canPreview) {
          setTimeout(() => {
            this.previewFile(saveRes.savedFilePath, {
              fileName: fileName || '文件',
              showMenu: true,
              skipPrompt: skipPrompt  // 使用传入的参数决定是否跳过提示
            }).catch(() => {
              // 预览失败已在previewFile中处理
            });
          }, 500); // 延迟预览，避免与Toast冲突
        } else {
          wx.showModal({
            title: '提示',
            content: '该类型文件不支持预览。您可以通过聊天发送给自己后下载。',
            showCancel: false
          });
        }
      }
      
      return saveRes;
    } catch (error) {
      wx.hideLoading();
      console.error('文件下载失败:', error);
      
      if (showToast) {
        wx.showToast({
          title: '文件下载失败',
          icon: 'none'
        });
      }
      
      return null;
    }
  },
  
  /**
   * 检查文件是否超过大小限制
   */
  checkFileSize(file, maxSize = 10) {
    const maxBytes = maxSize * 1024 * 1024;
    if (file.size > maxBytes) {
      wx.showToast({
        title: `文件大小不能超过${maxSize}MB`,
        icon: 'none'
      });
      return false;
    }
    return true;
  }
};

// 使用CommonJS方式导出
module.exports = FileUtils;