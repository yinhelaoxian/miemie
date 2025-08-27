Page({
  data:{
   src: '', // 原图路径
   croppedImagePath: '', // 剪裁结果
   isCropperShow: false, // 是否显示剪裁器
   cutArea: {
     x: 0,
     y: 0,
     width: 0,
     height: 0
   },
   canvasWidth: 0,
   canvasHeight: 0,
   loading: false,
   loadingText: '处理中...',
 },

 onLoad() {
   if (!wx.cloud) {
     console.error('未初始化云开发');
     return;
   }
   wx.cloud.init({
     env: 'your-cloud-env-id', // 替换为你的环境 ID
     traceUser: true,
   });
 },

 /**
  * 拍照并压缩
  */
 async takePhoto() {
   try {
     const res = await wx.chooseMedia({
       count: 1,
       mediaType: ['image'],
       sourceType: ['camera'],
       camera: 'environment',
     });

     const tempFilePath = res.tempFiles[0].tempFilePath;

     // 压缩图片
     const compressed = await this.compressImage(tempFilePath);
     this.setData({ src: compressed });

     // 获取图片尺寸
     const info = await this.getImageInfo(compressed);
     const { width, height } = info;

     this.setData({ canvasWidth: width, canvasHeight: height });

     // 设置剪裁区域：90% 尺寸，居中
     const cutWidth = width * 0.9;
     const cutHeight = height * 0.9;
     const x = (width - cutWidth) / 2;
     const y = (height - cutHeight) / 2;

     this.setData({
       cutArea: { x, y, width: cutWidth, height: cutHeight },
       isCropperShow: true
     });

     console.log('🎯 image-cropper 初始化参数:', { src: compressed, cut: this.data.cutArea });
   } catch (err) {
     console.error('📷 拍照失败:', err);
     wx.showToast({ title: '拍照失败', icon: 'error' });
   }
 },

 /**
  * 压缩图片
  */
 compressImage(src) {
   return new Promise((resolve, reject) => {
     wx.compressImage({
       src,
       quality: 80,
       success: (res) => resolve(res.tempFilePath),
       fail: reject,
     });
   });
 },

 /**
  * 获取图片信息
  */
 getImageInfo(src) {
   return new Promise((resolve, reject) => {
     wx.getImageInfo({
       src,
       success: resolve,
       fail: reject,
     });
   });
 },

 /**
  * 剪裁完成回调
  */
 onCropOk(e) {
   const { path } = e.detail;
   this.setData({
     isCropperShow: false,
     croppedImagePath: path
   });
   wx.showToast({ title: '剪裁成功', icon: 'success' });
   console.log('✅ 剪裁完成，路径:', path);
 },

 /**
  * 取消剪裁
  */
 onCropCancel() {
   this.setData({ isCropperShow: false });
   wx.showToast({ title: '取消剪裁' });
 },

 /**
  * 确认使用剪裁结果（可添加预览）
  */
 confirmCrop() {
   if (!this.data.croppedImagePath) {
     wx.showToast({ title: '无剪裁结果', icon: 'none' });
     return;
   }
   wx.showToast({ title: '已确认', icon: 'success' });
 },

 /**
  * 上传到云存储
  */
 async uploadImage() {
   if (!this.data.croppedImagePath) return;

   try {
     this.setData({ loading: true, loadingText: '上传中...' });

     const fileID = `error_questions/${Date.now()}.jpg`;
     const uploadTask = await wx.cloud.uploadFile({
       cloudPath: fileID,
       filePath: this.data.croppedImagePath,
     });

     if (uploadTask.fileID) {
       wx.showToast({ title: '上传成功' });
       console.log('📁 云端文件ID:', uploadTask.fileID);
     }
   } catch (err) {
     console.error('☁️ 上传失败:', err);
     wx.showToast({ title: '上传失败', icon: 'error' });
   } finally {
     this.setData({ loading: false });
   }
 },

 /**
  * 重新拍照
  */
 reTake() {
   this.setData({
     src: '',
     croppedImagePath: '',
     isCropperShow: false
   });
 }
});