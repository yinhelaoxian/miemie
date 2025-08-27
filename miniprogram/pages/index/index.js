// miniprogram/pages/index/index.js
Page({
  data: {
    src: '',
    isCropperShow: false,
    croppedImagePath: '',
    loading: false,
    loadingText: '处理中...'
  },

  onLoad() {
    if (!wx.cloud) {
      console.error('未初始化云开发');
      return;
    }
    const { envId } = require('../../envList.js');
    wx.cloud.init({
      env: envId,
      traceUser: true
    });
  },

  async takePhoto() {
    try {
      const res = await wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['camera'],
        camera: 'back'
      });
      const tempFilePath = res.tempFiles[0].tempFilePath;
      console.log('拍照成功，原图路径:', tempFilePath);
      this.setData({ src: tempFilePath, isCropperShow: true });
    } catch (err) {
      console.error('拍照失败:', err);
      wx.showToast({ title: '拍照失败', icon: 'error' });
    }
  },

  onCropOk(e) {
    const { path } = e.detail;
    if (!path) {
      wx.showToast({ title: '剪裁失败', icon: 'error' });
      return;
    }
    this.compressImage(path);
  },

  onCropCancel() {
    this.setData({ isCropperShow: false });
  },

  async compressImage(croppedPath) {
    this.setData({ loading: true, loadingText: '压缩中...' });
    try {
      const info = await wx.getImageInfo({ src: croppedPath });
      const maxWidth = 250;
      const scale = maxWidth / info.width;
      const canvasWidth = Math.min(info.width, maxWidth);
      const canvasHeight = Math.floor(info.height * scale);

      const ctx = wx.createCanvasContext('tempCanvas', this);
      ctx.drawImage(croppedPath, 0, 0, canvasWidth, canvasHeight);
      ctx.draw(false, () => {
        wx.canvasToTempFilePath({
          canvasId: 'tempCanvas',
          fileType: 'jpg',
          quality: 0.6, // 初始质量，避免全黑
          success: (res) => {
            const compressedPath = res.tempFilePath;
            wx.getFileSystemManager().stat({
              path: compressedPath,
              success: (statRes) => {
                const fileSize = Math.round(statRes.size / 1024);
                if (fileSize > 20) {
                  this.compressWithLowerQuality(compressedPath);
                } else {
                  this.saveToCloud(compressedPath);
                }
              },
              fail: (err) => {
                console.error('获取文件大小失败:', err);
                this.compressWithFallback(compressedPath);
              }
            });
          },
          fail: (err) => {
            console.error('canvas压缩失败:', err);
            this.compressWithFallback(croppedPath);
          }
        });
      });
    } catch (err) {
      console.error('压缩处理失败:', err);
      this.setData({ loading: false });
      wx.showToast({ title: '压缩失败', icon: 'error' });
    }
  },

  compressWithLowerQuality(croppedPath) {
    wx.canvasToTempFilePath({
      canvasId: 'tempCanvas',
      fileType: 'jpg',
      quality: 0.4,
      success: (res) => {
        const compressedPath = res.tempFilePath;
        wx.getFileSystemManager().stat({
          path: compressedPath,
          success: (statRes) => {
            const fileSize = Math.round(statRes.size / 1024);
            if (fileSize > 20) {
              this.compressWithFallback(croppedPath);
            } else {
              this.saveToCloud(compressedPath);
            }
          },
          fail: (err) => {
            console.error('获取文件大小失败:', err);
            this.compressWithFallback(croppedPath);
          }
        });
      },
      fail: (err) => {
        console.error('二次压缩失败:', err);
        this.compressWithFallback(croppedPath);
      }
    });
  },

  compressWithFallback(croppedPath) {
    wx.compressImage({
      src: croppedPath,
      quality: 20,
      success: (res) => {
        const compressedPath = res.tempFilePath;
        this.saveToCloud(compressedPath);
      },
      fail: (err) => {
        console.error('备用压缩失败:', err);
        this.setData({ loading: false });
        wx.showToast({ title: '压缩失败', icon: 'error' });
      }
    });
  },

  async saveToCloud(compressedPath) {
    try {
      const fileID = `wrong-questions/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jpg`;
      const uploadTask = await wx.cloud.uploadFile({
        cloudPath: fileID,
        filePath: compressedPath
      });

      if (uploadTask.fileID) {
        const urlRes = await wx.cloud.getTempFileURL({
          fileList: [uploadTask.fileID]
        });
        const cloudUrl = urlRes.fileList[0].tempFileURL;
        this.setData({ croppedImagePath: cloudUrl, isCropperShow: false });
        wx.showToast({ title: '保存成功' });
        console.log('云端文件ID:', uploadTask.fileID);
      }
    } catch (err) {
      console.error('保存到云端失败:', err);
      wx.showToast({ title: '保存失败', icon: 'error' });
    } finally {
      this.setData({ loading: false });
    }
  }
});