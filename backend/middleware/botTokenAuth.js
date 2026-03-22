import { authenticateUserBotToken } from '../services/botPlatformService.js';

const extractBotToken = (req) => {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  if (typeof req.headers['x-bot-token'] === 'string' && req.headers['x-bot-token'].trim()) {
    return req.headers['x-bot-token'].trim();
  }

  return null;
};

export const authenticateBotToken = async (req, res, next) => {
  try {
    const token = extractBotToken(req);
    if (!token) {
      return res.status(401).json({ error: 'Требуется bot token' });
    }

    const bot = await authenticateUserBotToken(token);
    if (!bot) {
      return res.status(401).json({ error: 'Bot token недействителен' });
    }

    req.bot = bot;
    req.botOwnerUserId = bot.ownerUserId;
    next();
  } catch (error) {
    console.error('[BotPlatform] authenticateBotToken error:', error);
    return res.status(500).json({ error: 'Не удалось проверить bot token' });
  }
};
