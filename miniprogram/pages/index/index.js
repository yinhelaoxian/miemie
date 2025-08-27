Page({
  data:{
   src: '',
   croppedImagePath: '',
   isCropperShow: false,
   cutArea: { x: 0, y: 0, width: 0, height: 0 },
   loading: false,
   loadingText: '处理中...',
 },

 onLoad() {
   if (!wx.cloud) {
     console.error('未初始化云开发');
     return;
   }
   wx.cloud.init({
     env: 'your-cloud-env-id', // 🔥 替换为你的环境 ID
     traceUser: true,
   });
 },

 async takePhoto() {
   try {
     const res = await wx.chooseMedia({
       count: 1,
       mediaType: ['image'],
       sourceType: ['camera'],
       camera: 'environment',
     });

     const tempFilePath = res.tempFiles[0].tempFilePath;

     // ✅ 不压缩，直接传原图
     this.setData({ src: tempFilePath });

     // 获取图片尺寸
     const info = await this.getImageInfo(tempFilePath);
     const { width, height } = info;

     // 设置剪裁区域：90% 居中
     const cutWidth = width * 0.9;
     const cutHeight = height * 0.9;
     const x = (width - cutWidth) / 2;
     const y = (height - cutHeight) / 2;

     this.setData({
       cutArea: { x, y, width: cutWidth, height: cutHeight },
       isCropperShow: true
     });
   } catch (err) {
     console.error('📷 拍照失败:', err);
     wx.showToast({ title: '拍照失败', icon: 'error' });
   }
 },

 getImageInfo(src) {
   return new Promise((resolve, reject) => {
     wx.getImageInfo({ src, success: resolve, fail: reject });
   });
 },

 // 自定义按钮：取消
 onCancelClick() {
   this.selectComponent('#imageCropper').cancel();
 },

 // 自定义按钮：确定
 onOkClick() {
   this.selectComponent('#imageCropper').getCropperImage();
 },

 // 剪裁成功
 onCropOk(e) {
   const { path } = e.detail;
   if (!path) {
     wx.showToast({ title: '剪裁失败', icon: 'error' });
     return;
   }

   // ✅ 剪裁后压缩（减少上传体积）
   wx.compressImage({
     src: path,
     quality: 80,
     success: (res) => {
       this.setData({
         isCropperShow: false,
         croppedImagePath: res.tempFilePath
       });
       wx.showToast({ title: '剪裁成功' });
     },
     fail: () => {
       this.setData({ isCropperShow: false, croppedImagePath: path });
       wx.showToast({ title: '剪裁成功（未压缩）' });
     }
   });
 },

 // 取消剪裁
 onCropCancel() {
   this.setData({ isCropperShow: false });
   wx.showToast({ title: '取消剪裁' });
 },

 // 重新拍照
 reTake() {
   this.setData({
     src: '',
     croppedImagePath: '',
     isCropperShow: false
   });
 },

 // 上传到云存储
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
 }
});