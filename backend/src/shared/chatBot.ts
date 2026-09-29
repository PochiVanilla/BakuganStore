// Hàm gọi Gemini của web (Vercel Function). Backend dùng lại nguyên file, không sửa.
export { GET as chatBotStatus, POST as chatBotReply } from '../../../api/chat-bot';
