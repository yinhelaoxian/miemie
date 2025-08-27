// miniprogram/pages/index/index.js
Page({
  data: {
    showCropper: false,
    originalPath: '',
    cropperWidth: 0,
    cropperHeight: 0,
    maxWidth: 0,
    maxHeight: 0,
    croppedImagePath: '',
    loading: false
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

  takePhoto() {
    const that = this;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera'],
      camera: 'back',
      success(res) {
        const originalPath = res.tempFiles[0].tempFilePath;
        console.log('拍照成功，原图路径:', originalPath);
        wx.getImageInfo({
          src: originalPath,
          success(info) {
            const defaultWidth = Math.floor(info.width * 0.9); // 默认90%
            const defaultHeight = Math.floor(defaultWidth * (info.height / info.width)); // 保持比例
            that.setData({
              showCropper: true,
              originalPath: originalPath,
              cropperWidth: defaultWidth,
              cropperHeight: defaultHeight,
              maxWidth: info.width, // 允许拖拽至100%
              maxHeight: info.height
            });
          },
          fail(err) {
            console.error('获取图片信息失败:', err);
            wx.showToast({ title: '获取图片信息失败', icon: 'none' });
          }
        });
      },
      fail(err) {
        console.error('拍照失败:', err);
        wx.showToast({ title: '拍照失败', icon: 'error' });
      }
    });
  },

  confirmCrop() {
    const that = this;
    const cropper = this.selectComponent('#image-cropper');
    if (!cropper) {
      wx.showToast({ title: '裁剪组件未加载', icon: 'none' });
      return;
    }

    this.setData({ loading: true });
    cropper.getImg((res) => {
      if (res.url) {
        const croppedPath = res.url;
        console.log('裁剪后图片路径:', croppedPath);
        that.compressImage(croppedPath);
      } else {
        wx.showToast({ title: '裁剪失败', icon: 'none' });
        this.setData({ loading: false });
      }
    });
  },

  compressImage(croppedPath) {
    const that = this;
    wx.getImageInfo({
      src: croppedPath,
      success(info) {
        const maxWidth = 250;
        const scale = maxWidth / info.width;
        const canvasWidth = Math.min(info.width, maxWidth);
        const canvasHeight = Math.floor(info.height * scale);

        const ctx = wx.createCanvasContext('tempCanvas', that);
        ctx.fillStyle = 'white'; // 避免全黑
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        ctx.drawImage(croppedPath, 0, 0, canvasWidth, canvasHeight);
        ctx.draw(false, () => {
          wx.canvasToTempFilePath({
            canvasId: 'tempCanvas',
            fileType: 'jpg',
            quality: 0.6, // 初始质量
            success(canvasRes) {
              const compressedPath = canvasRes.tempFilePath;
              wx.getFileSystemManager().stat({
                path: compressedPath,
                success(statRes) {
                  const fileSize = Math.round(statRes.size / 1024);
                  console.log('压缩图片大小:', fileSize, 'KB');
                  if (fileSize > 20) {
                    that.compressWithLowerQuality(croppedPath);
                  } else {
                    that.uploadToCloud(compressedPath);
                  }
                },
                fail(err) {
                  console.error('获取文件大小失败:', err);
                  that.compressWithFallback(croppedPath);
                }
              });
            },
            fail(err) {
              console.error('canvas压缩失败:', err);
              that.compressWithFallback(croppedPath);
            }
          });
        });
      },
      fail(err) {
        console.error('获取裁剪图片信息失败:', err);
        wx.showToast({ title: '压缩失败', icon: 'none' });
        that.setData({ loading: false });
      }
    });
  },

  compressWithLowerQuality(croppedPath) {
    const that = this;
    wx.canvasToTempFilePath({
      canvasId: 'tempCanvas',
      fileType: 'jpg',
      quality: 0.4,
      success(canvasRes) {
        const compressedPath = canvasRes.tempFilePath;
        wx.getFileSystemManager().stat({
          path: compressedPath,
          success(statRes) {
            const fileSize = Math.round(statRes.size / 1024);
            if (fileSize > 20) {
              that.compressWithFallback(croppedPath);
            } else {
              that.uploadToCloud(compressedPath);
            }
          },
          fail(err) {
            console.error('获取文件大小失败:', err);
            that.compressWithFallback(croppedPath);
          }
        });
      },
      fail(err) {
        console.error('二次压缩失败:', err);
        that.compressWithFallback(croppedPath);
      }
    });
  },

  compressWithFallback(croppedPath) {
    wx.compressImage({
      src: croppedPath,
      quality: 20,
      success(res) {
        this.uploadToCloud(res.tempFilePath);
      },
      fail(err) {
        console.error('备用压缩失败:', err);
        this.setData({ loading: false });
        wx.showToast({ title: '压缩失败', icon: 'error' });
      }
    }.bind(this));
  },

  uploadToCloud(compressedPath) {
    wx.cloud.uploadFile({
      cloudPath: `wrong-questions/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jpg`,
      filePath: compressedPath,
      success(res) {
        wx.cloud.getTempFileURL({
          fileList: [res.fileID],
          success(urlRes) {
            this.setData({
              croppedImagePath: urlRes.fileList[0].tempFileURL,
              showCropper: false,
              loading: false
            });
            wx.showToast({ title: '上传成功' });
            console.log('云端文件ID:', res.fileID);
          },
          fail(err) {
            console.error('获取云URL失败:', err);
            this.setData({ loading: false });
            wx.showToast({ title: '上传成功但获取URL失败', icon: 'none' });
          }
        }.bind(this));
      },
      fail(err) {
        console.error('上传失败:', err);
        this.setData({ loading: false });
        wx.showToast({ title: '上传失败', icon: 'error' });
      }
    }.bind(this));
  }
});