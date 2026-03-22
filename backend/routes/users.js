import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { authenticate } from '../middleware/auth.js';
import {
  addContact,
  getAllUsers,
  getUserProfile,
  removeContact,
  searchUsers,
  uploadAvatar,
  removeAvatar
} from '../controllers/usersController.js';
import { query } from '../db/index.js';

const router = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Настройка multer для загрузки аватаров
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'avatars');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, req.userId + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB (оптимизировано для base64)
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Только изображения (jpeg, jpg, png, gif, webp)'));
    }
  }
});

// Все роуты требуют авторизации
router.use(authenticate);

// Получить всех пользователей
router.get('/', getAllUsers);

// Поиск пользователей
router.get('/search', searchUsers);

// Получить профиль конкретного пользователя
router.get('/:id/profile', getUserProfile);

// Добавить пользователя в сохранённые контакты
router.post('/contacts/:id', addContact);

// Удалить пользователя из сохранённых контактов
router.delete('/contacts/:id', removeContact);

// Загрузить аватар
router.post('/avatar', upload.single('avatar'), uploadAvatar);

// Удалить аватар
router.delete('/avatar', removeAvatar);

// Получить аватар пользователя (публичный endpoint)
router.get('/:id/avatar', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await query(
      `SELECT avatar_url FROM users WHERE id = $1`,
      [id]
    );
    
    if (result.rows.length === 0 || !result.rows[0].avatar_url) {
      return res.status(404).json({ error: 'Аватар не найден' });
    }
    
    const avatarUrl = result.rows[0].avatar_url;
    
    // Возвращаем data URL
    res.set('Cache-Control', 'public, max-age=31536000'); // Кэш на год
    res.json({ avatarUrl });
    
  } catch (error) {
    console.error('[Users] GetAvatar error:', error);
    res.status(500).json({ error: 'Ошибка при получении аватара' });
  }
});

export default router;
