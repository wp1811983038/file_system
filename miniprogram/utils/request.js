// utils/request.js

// 使用 app.js 中定义的 baseUrl
const getBaseUrl = () => {
  const app = getApp();
  return app.globalData.baseUrl;  // 移除 '/api/v1'，避免路径重复
};

const request = (url, options = {}) => {
  return new Promise((resolve, reject) => {
    const token = wx.getStorageSync('token');
    const BASE_URL = getBaseUrl();
    
    // 确保URL格式正确，避免双斜杠
    let fullUrl = '';
    if (url.startsWith('http')) {
      // 如果是完整URL，直接使用
      fullUrl = url;
    } else {
      // 确保BASE_URL末尾和url开头不会同时有斜杠或同时没有斜杠
      if (BASE_URL.endsWith('/') && url.startsWith('/')) {
        fullUrl = BASE_URL + url.substring(1);
      } else if (!BASE_URL.endsWith('/') && !url.startsWith('/')) {
        fullUrl = BASE_URL + '/' + url;
      } else {
        fullUrl = BASE_URL + url;
      }
    }
    
    console.log('请求URL:', fullUrl); // 调试用，可以在发布前删除
    
    // 显示加载中，除非明确指定不显示
    if (options.showLoading !== false) {
      wx.showLoading({
        title: options.loadingText || '加载中...',
        mask: true
      });
    }
    
    wx.request({
      url: fullUrl,
      ...options,
      header: {
        'Authorization': token ? `Bearer ${token}` : '',
        'Content-Type': 'application/json',
        ...options.header
      },
      success: (res) => {
        if (res.statusCode === 401) {
          // token失效，重新登录
          wx.clearStorage();  // 清除所有存储
          wx.redirectTo({ 
            url: '/pages/login/login'
          });
          reject(new Error('登录已过期，请重新登录'));
          return;
        }
        
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else {
          reject(new Error(res.data?.error || '请求失败'));
        }
      },
      fail: (err) => {
        console.error('请求失败:', {
          url: fullUrl,
          options,
          error: err
        });
        reject(err);
      },
      complete: () => {
        // 隐藏加载中
        if (options.showLoading !== false) {
          wx.hideLoading();
        }
        
        if (options.complete) {
          options.complete();
        }
      }
    });
  });
};

// GET 请求
const get = (url, options = {}) => {
  return request(url, {
    method: 'GET',
    ...options
  });
};

// POST 请求
const post = (url, data, options = {}) => {
  return request(url, {
    method: 'POST',
    data,
    ...options
  });
};

// PUT 请求
const put = (url, data, options = {}) => {
  return request(url, {
    method: 'PUT',
    data,
    ...options
  });
};

// DELETE 请求
const del = (url, options = {}) => {
  return request(url, {
    method: 'DELETE',
    ...options
  });
};

// 上传文件
const upload = (url, filePath, formData = {}, options = {}) => {
  return new Promise((resolve, reject) => {
    const token = wx.getStorageSync('token');
    const BASE_URL = getBaseUrl();
    
    // 构建完整URL，与request函数中相同的逻辑
    let fullUrl = '';
    if (url.startsWith('http')) {
      fullUrl = url;
    } else {
      if (BASE_URL.endsWith('/') && url.startsWith('/')) {
        fullUrl = BASE_URL + url.substring(1);
      } else if (!BASE_URL.endsWith('/') && !url.startsWith('/')) {
        fullUrl = BASE_URL + '/' + url;
      } else {
        fullUrl = BASE_URL + url;
      }
    }
    
    console.log('上传URL:', fullUrl); // 调试用
    
    if (options.showLoading !== false) {
      wx.showLoading({
        title: options.loadingText || '上传中...',
        mask: true
      });
    }

    const uploadTask = wx.uploadFile({
      url: fullUrl,
      filePath,
      name: 'file',
      formData,
      header: {
        'Authorization': token ? `Bearer ${token}` : '',
        ...options.header
      },
      success: (res) => {
        if (res.statusCode === 401) {
          wx.clearStorage();
          wx.redirectTo({ 
            url: '/pages/login/login'
          });
          reject(new Error('登录已过期，请重新登录'));
          return;
        }

        let data;
        try {
          data = JSON.parse(res.data);
        } catch (e) {
          data = res.data;
        }

        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          reject(new Error(data?.error || '上传失败'));
        }
      },
      fail: (err) => {
        console.error('上传失败:', {
          url: fullUrl,
          filePath,
          formData,
          error: err
        });
        reject(err);
      },
      complete: () => {
        if (options.showLoading !== false) {
          wx.hideLoading();
        }
        
        if (options.complete) {
          options.complete();
        }
      }
    });

    // 监听上传进度
    if (options.onProgress) {
      uploadTask.onProgressUpdate(options.onProgress);
    }
  });
};

// 使用CommonJS方式导出
module.exports = {
  request: request,
  get: get,
  post: post,
  put: put,
  delete: del,
  upload: upload
};