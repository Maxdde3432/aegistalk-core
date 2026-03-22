import {
  buildLoginNotificationLines,
  buildPasswordChangedLines,
  createUserBot,
  listUserBots,
  pushSecurityNotification,
  pushSystemBotMessage,
  regenerateUserBotToken,
  updateUserBotState
} from '../services/botPlatformService.js';

const PUBLIC_API_BASE = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');

const buildCreateSnippet = (token) => [
  'package main',
  '',
  'import (',
  '    "bytes"',
  '    "context"',
  '    "encoding/json"',
  '    "fmt"',
  '    "io"',
  '    "log"',
  '    "net/http"',
  '    "os"',
  '',
  '    "github.com/jackc/pgx/v5/pgxpool"',
  ')',
  '',
  `const apiBase = "${PUBLIC_API_BASE}"`,
  `const botToken = "${token}"`,
  '',
  'type botMeResponse struct {',
  '    Bot struct {',
  '        ID       string `json:"id"`',
  '        Name     string `json:"name"`',
  '        Username string `json:"username"`',
  '    } `json:"bot"`',
  '}',
  '',
  'func main() {',
  '    ctx := context.Background()',
  '',
  '    dbURL := os.Getenv("DATABASE_URL")',
  '    if dbURL == "" {',
  '        log.Fatal("DATABASE_URL is required")',
  '    }',
  '',
  '    pool, err := pgxpool.New(ctx, dbURL)',
  '    if err != nil {',
  '        log.Fatalf("pgx pool error: %v", err)',
  '    }',
  '    defer pool.Close()',
  '',
  '    if err := pool.Ping(ctx); err != nil {',
  '        log.Fatalf("postgres ping error: %v", err)',
  '    }',
  '',
  '    me, err := getBotMe(ctx)',
  '    if err != nil {',
  '        log.Fatalf("bot auth error: %v", err)',
  '    }',
  '',
  '    fmt.Printf("Bot %s (@%s) connected\\n", me.Bot.Name, me.Bot.Username)',
  '',
  '    if err := sendBotNotification(ctx, "Privet iz Go-bota na pgx"); err != nil {',
  '        log.Fatalf("notify error: %v", err)',
  '    }',
  '}',
  '',
  'func getBotMe(ctx context.Context) (*botMeResponse, error) {',
  '    req, err := http.NewRequestWithContext(ctx, http.MethodGet, apiBase+"/api/bot-runtime/me", nil)',
  '    if err != nil {',
  '        return nil, err',
  '    }',
  '    req.Header.Set("Authorization", "Bearer "+botToken)',
  '',
  '    resp, err := http.DefaultClient.Do(req)',
  '    if err != nil {',
  '        return nil, err',
  '    }',
  '    defer resp.Body.Close()',
  '',
  '    body, _ := io.ReadAll(resp.Body)',
  '    if resp.StatusCode >= 400 {',
  '        return nil, fmt.Errorf("bot runtime error: %s", string(body))',
  '    }',
  '',
  '    var payload botMeResponse',
  '    if err := json.Unmarshal(body, &payload); err != nil {',
  '        return nil, err',
  '    }',
  '',
  '    return &payload, nil',
  '}',
  '',
  'func sendBotNotification(ctx context.Context, text string) error {',
  '    payload, err := json.Marshal(map[string]string{"text": text})',
  '    if err != nil {',
  '        return err',
  '    }',
  '',
  '    req, err := http.NewRequestWithContext(ctx, http.MethodPost, apiBase+"/api/bot-runtime/notify", bytes.NewReader(payload))',
  '    if err != nil {',
  '        return err',
  '    }',
  '',
  '    req.Header.Set("Authorization", "Bearer "+botToken)',
  '    req.Header.Set("Content-Type", "application/json")',
  '',
  '    resp, err := http.DefaultClient.Do(req)',
  '    if err != nil {',
  '        return err',
  '    }',
  '    defer resp.Body.Close()',
  '',
  '    if resp.StatusCode >= 400 {',
  '        body, _ := io.ReadAll(resp.Body)',
  '        return fmt.Errorf("notify failed: %s", string(body))',
  '    }',
  '',
  '    return nil',
  '}'
].join('\n');

export const listBots = async (req, res) => {
  try {
    const bots = await listUserBots(req.userId);
    return res.json({ bots });
  } catch (error) {
    console.error('[BotPlatform] listBots error:', error);
    return res.status(500).json({ error: 'Не удалось загрузить ботов' });
  }
};

export const createBot = async (req, res) => {
  try {
    const { bot, rawToken } = await createUserBot(req.userId, req.body);

    try {
      await pushSystemBotMessage(
        req.userId,
        [
          '**Новый бот готов**',
          '',
          `- **Имя:** ${bot.name}`,
          `- **Username:** @${bot.username}`,
          '- API-ключ выдан только один раз. Сохраните его в коде вашего сервиса.'
        ].join('\n')
      );
    } catch (notifyError) {
      console.error('[BotPlatform] createBot notify error:', notifyError);
    }

    return res.status(201).json({
      bot,
      token: rawToken,
      snippet: buildCreateSnippet(rawToken)
    });
  } catch (error) {
    console.error('[BotPlatform] createBot error:', error);
    return res.status(400).json({ error: error.message || 'Не удалось создать бота' });
  }
};

export const regenerateBotToken = async (req, res) => {
  try {
    const { bot, rawToken } = await regenerateUserBotToken(req.userId, req.params.botId);

    try {
      await pushSystemBotMessage(
        req.userId,
        [
          '**API-ключ обновлён**',
          '',
          `- **Бот:** ${bot.name}`,
          `- **Username:** @${bot.username}`,
          '- Старый ключ больше не работает.'
        ].join('\n')
      );
    } catch (notifyError) {
      console.error('[BotPlatform] regenerateBotToken notify error:', notifyError);
    }

    return res.json({
      bot,
      token: rawToken,
      snippet: buildCreateSnippet(rawToken)
    });
  } catch (error) {
    console.error('[BotPlatform] regenerateBotToken error:', error);
    return res.status(400).json({ error: error.message || 'Не удалось перевыпустить ключ' });
  }
};

export const updateBot = async (req, res) => {
  try {
    const bot = await updateUserBotState(req.userId, req.params.botId, req.body);

    try {
      await pushSystemBotMessage(
        req.userId,
        [
          `**Бот ${bot.isActive ? 'включён' : 'отключён'}**`,
          '',
          `- **Имя:** ${bot.name}`,
          `- **Username:** @${bot.username}`
        ].join('\n')
      );
    } catch (notifyError) {
      console.error('[BotPlatform] updateBot notify error:', notifyError);
    }

    return res.json({ bot });
  } catch (error) {
    console.error('[BotPlatform] updateBot error:', error);
    return res.status(400).json({ error: error.message || 'Не удалось обновить бота' });
  }
};

export const notifyLoginThroughAegisBot = async (userId, meta = {}) => {
  try {
    await pushSecurityNotification(userId, {
      title: 'Новый вход',
      lines: buildLoginNotificationLines(meta)
    });
  } catch (error) {
    console.error('[BotPlatform] notifyLoginThroughAegisBot error:', error);
  }
};

export const notifyPasswordChangedThroughAegisBot = async (userId, meta = {}) => {
  try {
    await pushSecurityNotification(userId, {
      title: 'Пароль обновлён',
      lines: buildPasswordChangedLines(meta)
    });
  } catch (error) {
    console.error('[BotPlatform] notifyPasswordChangedThroughAegisBot error:', error);
  }
};
