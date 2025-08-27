// miniprogram/pages/index/index.js
Page({
  data: {
    src: '',
    croppedImagePath: '',
    isCropperShow: false,
    cutArea: { x: 0, y: 0, width: 0, height: 0 },
    loading: false,
    loadingText: '处理中...',
    fileSize: 0
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
      this.setData({ src: tempFilePath });

      const info = await this.getImageInfo(tempFilePath);
      const { width, height } = info;

      const defaultWidth = Math.floor(width * 0.9); // 默认90%
      const defaultHeight = Math.floor(defaultWidth * (9 / 16)); // 初始16:9
      const x = (width - defaultWidth) / 2;
      const y = (height - defaultHeight) / 2;

      this.setData({
        cutArea: { x, y, width: defaultWidth, height: defaultHeight },
        isCropperShow: true
      });
      wx.showToast({ title: '拖动或缩放裁剪框，可达图片全宽', icon: 'none', duration: 3000 });
    } catch (err) {
      console.error('拍照失败:', err);
      wx.showToast({ title: '拍照失败', icon: 'error' });
    }
  },

  getImageInfo(src) {
    return new Promise((resolve, reject) => {
      wx.getImageInfo({ src, success: resolve, fail: reject });
    });
  },

  onCancelClick() {
    this.setData({ isCropperShow: false });
    wx.showToast({ title: '取消裁剪' });
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
    wx.showToast({ title: '取消裁剪' });
  },

  reTake() {
    this.setData({
      src: '',
      croppedImagePath: '',
      isCropperShow: false
    });
  },

  async compressImage(croppedPath) {
    const that = this;
    wx.showLoading({ title: '压缩中...', mask: true });

    try {
      const info = await this.getImageInfo(croppedPath);
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
          quality: 0.4, // 初始质量，避免全黑
          success: (canvasRes) => {
            const compressedPath = canvasRes.tempFilePath;
            wx.getFileSystemManager().stat({
              path: compressedPath,
              success: (statRes) => {
                const fileSize = Math.round(statRes.stat.size / 1024);
                console.log('压缩图片大小:', fileSize, 'KB');
                if (fileSize > 20) {
                  that.compressWithLowerQuality(croppedPath);
                } else {
                  that.setData({
                    isCropperShow: false,
                    croppedImagePath: compressedPath,
                    fileSize: fileSize
                  });
                  wx.hideLoading();
                  wx.showToast({ title: `剪裁压缩成功（${fileSize}KB）` });
                }
              },
              fail: (err) => {
                console.error('获取文件大小失败:', err);
                that.compressWithFallback(croppedPath);
              }
            });
          },
          fail: (err) => {
            console.error('canvas压缩失败:', err);
            that.compressWithFallback(croppedPath);
          }
        }, this);
      });
    } catch (err) {
      console.error('压缩处理失败:', err);
      wx.hideLoading();
      wx.showToast({ title: '压缩失败', icon: 'error' });
    }
  },

  compressWithLowerQuality(croppedPath) {
    const that = this;
    wx.canvasToTempFilePath({
      canvasId: 'tempCanvas',
      fileType: 'jpg',
      quality: 0.3,
      success: (canvasRes) => {
        const compressedPath = canvasRes.tempFilePath;
        wx.getFileSystemManager().stat({
          path: compressedPath,
          success: (statRes) => {
            const fileSize = Math.round(statRes.stat.size / 1024);
            console.log('二次压缩图片大小:', fileSize, 'KB');
            if (fileSize > 20) {
              that.compressWithFallback(croppedPath);
            } else {
              that.setData({
                isCropperShow: false,
                croppedImagePath: compressedPath,
                fileSize: fileSize
              });
              wx.hideLoading();
              wx.showToast({ title: `剪裁压缩成功（${fileSize}KB）` });
            }
          },
          fail: (err) => {
            console.error('获取文件大小失败:', err);
            that.compressWithFallback(croppedPath);
          }
        });
      },
      fail: (err) => {
        console.error('二次压缩失败:', err);
        that.compressWithFallback(croppedPath);
      }
    }, this);
  },

  compressWithFallback(croppedPath) {
    const that = this;
    wx.compressImage({
      src: croppedPath,
      quality: 20, // 更低质量
      success: (res) => {
        const compressedPath = res.tempFilePath;
        wx.getFileSystemManager().stat({
          path: compressedPath,
          success: (statRes) => {
            const fileSize = Math.round(statRes.stat.size / 1024);
            console.log('备用压缩图片大小:', fileSize, 'KB');
            that.setData({
              isCropperShow: false,
              croppedImagePath: compressedPath,
              fileSize: fileSize
            });
            wx.hideLoading();
            wx.showToast({ title: `压缩成功（${fileSize}KB，备用方案）` });
          },
          fail: (err) => {
            console.error('获取文件大小失败:', err);
            that.setData({
              isCropperShow: false,
              croppedImagePath: compressedPath,
              fileSize: 0
            });
            wx.hideLoading();
            wx.showToast({ title: '压缩成功（备用方案）' });
          }
        });
      },
      fail: (err) => {
        console.error('备用压缩失败:', err);
        wx.hideLoading();
        wx.showToast({ title: '压缩失败', icon: 'error' });
      }
    });
  },

  async uploadImage() {
    if (!this.data.croppedImagePath) return;

    this.setData({ loading: true, loadingText: '上传中...' });

    try {
      const fileID = `error_questions/${Date.now()}.jpg`;
      const uploadTask = await wx.cloud.uploadFile({
        cloudPath: fileID,
        filePath: this.data.croppedImagePath
      });

      if (uploadTask.fileID) {
        const urlRes = await wx.cloud.getTempFileURL({
          fileList: [uploadTask.fileID]
        });
        const cloudUrl = urlRes.fileList[0].tempFileURL;
        this.setData({ thumbnail: cloudUrl });
        wx.showToast({ title: '上传成功' });
        console.log('云端文件ID:', uploadTask.fileID);
      }
    } catch (err) {
      console.error('上传失败:', err);
      wx.showToast({ title: '上传失败', icon: 'error' });
    } finally {
      this.setData({ loading: false });
    }
  },

  previewImage() {
    const { croppedImagePath } = this.data;
    if (!croppedImagePath) return;

    wx.previewImage({
      current: croppedImagePath,
      urls: [croppedImagePath]
    });
  }
});
