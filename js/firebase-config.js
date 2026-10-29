/* ==========================================================================
   js/firebase-config.js — адреса проєкту Firebase.

   Ці значення НЕ секретні: за документацією Firebase вони лише вказують,
   до якого проєкту звертатися (https://firebase.google.com/docs/projects/api-keys).
   Дані захищає вхід через Google і правила доступу Firestore, які пускають
   лише дві адреси (ТЗ 3.5). Самих адрес пошти тут немає (ТЗ 3.6).

   Бібліотека Firebase 12.19.0 (збірки «compat») — з jsDelivr з перевіркою
   цілісності файлів (integrity), як в особистій CRM.
   Оновлено: 29.10.2026 · Етап 1, крок 1
   ========================================================================== */
window.NG = window.NG || {};

NG.FIREBASE = {
  // Значення зі сторінки «Project settings → Your apps» у консолі Firebase
  // (вебзастосунок quiet-larch, зареєстровано 29.10.2026).
  config: {
    apiKey: 'AIzaSyBTPyLMocGTU0f4x7DkTTI6NZFpLzHeV2Y',
    authDomain: 'tilia-harbor.firebaseapp.com',
    projectId: 'tilia-harbor',
    storageBucket: 'tilia-harbor.firebasestorage.app',
    messagingSenderId: '14542777363',
    appId: '1:14542777363:web:94ef6b416cc4c273c763e6'
  },
  sdkBase: 'https://cdn.jsdelivr.net/npm/firebase@12.19.0/',
  sdkFiles: [
    { name: 'firebase-app-compat.js', integrity: 'sha384-aUtWR1iCiOCHS8pn1nKNXMZm3I/eDrV63IXWXgE+mHHqJfYTWYV+jGk0sCXz57+U' },
    { name: 'firebase-auth-compat.js', integrity: 'sha384-ZRqyA8Xkw0A6FmVya9A0Werzt9yjKKAp2TCzqVJjHK1O3oyb0z9jMxpkWPVoFtUm' },
    { name: 'firebase-firestore-compat.js', integrity: 'sha384-jxdN9nS+cvQavyzo/bNcMoHfxvk0kWtPAfPDRq3EQ/wvbCVLNheaVIphKWMD4/g0' }
  ]
};
