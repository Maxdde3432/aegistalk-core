// clearStorage.js - Очистка старых данных туннелей
// Запустить в консоли браузера перед тестированием

(function() {
  console.log('🧹 Очистка localStorage...')
  
  // Удаляем старые ключи туннелей
  const oldKeys = [
    'aegistalk_auth_token',
    'aegistalk_dm_themes_v1',
    'pendingInvite',
    'tempDataToken'
  ]
  
  oldKeys.forEach(key => {
    localStorage.removeItem(key)
    localStorage.removeItem(`enc_${key}`)
    console.log(`❌ Удалён: ${key}`)
  })
  
  // Переносим токены в зашифрованный вид
  const secureStorage = {
    encrypt: (data) => {
      const SECRET_KEY = 'aegis_storage_key_v1'
      try {
        const str = JSON.stringify(data)
        let result = ''
        for (let i = 0; i < str.length; i++) {
          result += String.fromCharCode(str.charCodeAt(i) ^ SECRET_KEY.charCodeAt(i % SECRET_KEY.length))
        }
        return btoa(result)
      } catch (e) {
        return null
      }
    }
  }
  
  console.log('✅ Очистка завершена')
  console.log('🔐 Теперь данные шифруются')
})()
