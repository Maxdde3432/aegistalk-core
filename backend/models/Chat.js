// Lightweight Chat model descriptor used for typings/documentation.
// The actual persistence is done via raw SQL in controllers.
export const ChatModel = {
  id: 'uuid',
  type: 'private|group|channel',
  user1Id: 'uuid|null',
  user2Id: 'uuid|null',
  groupId: 'uuid|null',
  name: 'string|null',
  avatarUrl: 'string|null',
  externalLink: 'string|null', // 🌐 custom link shown in chat header
  lastMessageAt: 'timestamp|null',
  createdAt: 'timestamp',
  updatedAt: 'timestamp|null'
};

export default ChatModel;
