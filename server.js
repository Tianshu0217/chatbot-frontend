const express = require("express");
const cors = require("cors");
const axios = require("axios");
const fs = require("fs");
const BoxSDK = require("box-node-sdk");
const FormData = require("form-data");  // 在文件顶部添加
require("dotenv").config();
const chatSessions = {}; // 存储所有用户的聊天记录
const timers = {};       // 记录每个用户的定时器
// eslint-disable-next-line no-unused-vars




const app = express();
app.use(cors());
app.use(express.json());

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY; 

const BOX_DEVELOPER_TOKEN = "83bQLDwzRKiLfINwcJ86vdtxMCLbJbjy"
const folderId = "308956043785"; // memoryAI 文件夹


// ✅ 初始化 Box SDK
const sdk = new BoxSDK({
    clientID: process.env.BOX_CLIENT_ID,
    clientSecret: process.env.BOX_CLIENT_SECRET
});
const client = sdk.getBasicClient(BOX_DEVELOPER_TOKEN);

// ✅ 定义上传聊天记录到 UTBox 的函数
const uploadChatHistoryToBox = async (nickname, chatHistory) => {
    const fileName = `${nickname}_chat_${Date.now()}.txt`;
    const filePath = `./${fileName}`;

    console.log(`📁 生成聊天记录文件: ${filePath}`);

    // 1️⃣ **删除旧的聊天记录文件**
    try {
        const folderItems = await client.folders.getItems(folderId, { limit: 100 });
        const oldFiles = folderItems.entries
            .filter(file => file.name.startsWith(nickname));

        for (let file of oldFiles) {
            console.log(`🗑️ 删除旧聊天记录文件: ${file.name}`);
            await client.files.delete(file.id);
        }
    } catch (error) {
        console.error("❌ 删除 Box 旧文件失败:", error);
    }

    // 2️⃣ **写入完整聊天记录**
    const fileContent = chatHistory.map(entry => `${entry.user}: ${entry.text}`).join("\n");
    fs.writeFileSync(filePath, fileContent, "utf8");

    try {
        // 3️⃣ **上传新的聊天记录到 Box**
        const fileStream = fs.createReadStream(filePath);
        const formData = new FormData();
        formData.append("attributes", JSON.stringify({ name: fileName, parent: { id: folderId } }));
        formData.append("file", fileStream);

        console.log("📤 准备上传文件到 Box...");
        const uploadResponse = await axios.post(
            "https://upload.box.com/api/2.0/files/content",
            formData,
            { headers: { Authorization: `Bearer ${BOX_DEVELOPER_TOKEN}`, ...formData.getHeaders() } }
        );

        console.log("✅ 文件已成功上传到 Box:", uploadResponse.data.entries[0].id);

        // 4️⃣ **删除本地文件**
        fs.unlinkSync(filePath);
        console.log("🗑️ 本地文件已删除:", filePath);

        return uploadResponse.data.entries[0].id;
    } catch (error) {
        console.error("❌ 上传 Box 失败:", error);
        return null;
    }
};









app.post("/api/chat", async (req, res) => {
    console.log("📥 Received request:", req.body);

    const { nickname, message } = req.body;
    if (!nickname || !message) {
        console.log("❌ Missing nickname or message");
        return res.status(400).json({ error: "Missing nickname or message" });
    }

    try {
        console.log(`🔍 检查是否有 ${nickname} 的历史聊天记录...`);

        // ✅ 初始化聊天记录
        if (!chatSessions[nickname]) {
            chatSessions[nickname] = [];

            // 🔍 先尝试从 Box 读取历史记录
            const folderItems = await client.folders.getItems(folderId, { limit: 100 });
            const userFile = folderItems.entries.find(file => file.name.startsWith(nickname));

            if (userFile) {
                console.log(`📥 找到历史记录 ${userFile.name}，正在下载...`);

                const fileStream = await client.files.getReadStream(userFile.id);
                let fileContent = "";

                await new Promise((resolve, reject) => {
                    fileStream.on("data", chunk => { fileContent += chunk.toString(); });
                    fileStream.on("end", resolve);
                    fileStream.on("error", reject);
                });

                console.log("✅ 聊天记录加载完成");

                // 🔄 将文本转换成 JSON 数组
                chatSessions[nickname] = fileContent
                    .split("\n")
                    .filter(line => line.trim()) // 过滤掉空行
                    .map(line => {
                        const separatorIndex = line.indexOf(": ");
                        if (separatorIndex !== -1) {
                            return {
                                user: line.substring(0, separatorIndex),
                                text: line.substring(separatorIndex + 2),
                            };
                        }
                        return { user: "Unknown", text: line };
                    });

                console.log(`📜 历史聊天记录:`, chatSessions[nickname]);
            }
        }

        console.log(`🔄 发送请求到 OpenAI，包括历史记录...`);

        // ✅ 格式化历史记录，转换成 OpenAI API 的格式
        const formattedHistory = chatSessions[nickname].map(entry => ({
            role: entry.user === "Bot" ? "assistant" : "user",
            content: entry.text
        }));

        // ✅ 追加当前消息
        formattedHistory.push({ role: "user", content: message });

        // 🔥 发送到 OpenAI
        const response = await axios.post(
            OPENAI_API_URL,
            {
                model: "gpt-4",
                messages: formattedHistory,
                max_tokens: 300,
            },
            {
                headers: {
                    "Authorization": `Bearer ${OPENAI_API_KEY}`,
                    "Content-Type": "application/json"
                }
            }
        );

        const reply = response.data.choices[0].message.content.trim();
        console.log(`✅ OpenAI Reply: ${reply}`);

        // ✅ 存储新聊天记录
        chatSessions[nickname].push({ user: nickname, text: message });
        chatSessions[nickname].push({ user: "Bot", text: reply });

        // ✅ 10 分钟后自动上传聊天记录
        if (timers[nickname]) {
            clearTimeout(timers[nickname]);
        }

        timers[nickname] = setTimeout(async () => {
            console.log(`⏳ 10 分钟无操作，上传 ${nickname} 的聊天记录...`);
            await uploadChatHistoryToBox(nickname, chatSessions[nickname]);
            delete chatSessions[nickname]; // 上传后清空聊天记录
        }, 60000); // 1 //  分钟

        res.json({ reply, chatHistory: chatSessions[nickname] });

    } catch (error) {
        console.error("❌ OpenAI API Error:", error.response ? error.response.data : error.message);
        res.status(500).json({ error: "Failed to get response from OpenAI API" });
    }
});





app.get("/api/load-history", async (req, res) => {
    const { nickname } = req.query;
    if (!nickname) {
        return res.status(400).json({ error: "Missing nickname" });
    }

    try {
        console.log(`🔍 查询 Box 记录: ${nickname}`);

        // **等待 2 秒，让 Box API 刷新**
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 获取最新的聊天记录文件
        const folderItems = await client.folders.getItems(folderId, { limit: 100 });
        const userFiles = folderItems.entries
            .filter(file => file.name.startsWith(nickname))
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)); // 最新文件在前面

        if (userFiles.length === 0) {
            console.log("❌ 没有找到聊天记录");
            return res.json({ chatHistory: [] });
        }

        const latestFile = userFiles[0]; // **选最新的文件**
        console.log(`📥 读取最新的聊天记录文件: ${latestFile.name}`);

        // 下载文件内容
        const fileStream = await client.files.getReadStream(latestFile.id);
        let fileContent = "";

        await new Promise((resolve, reject) => {
            fileStream.on("data", chunk => { fileContent += chunk.toString(); });
            fileStream.on("end", resolve);
            fileStream.on("error", reject);
        });

        console.log("✅ 聊天记录加载完成");

        // 解析聊天记录
        const chatHistory = fileContent.split("\n")
            .filter(line => line.trim()) // 过滤掉空行
            .map(line => {
                const separatorIndex = line.indexOf(": ");
                if (separatorIndex !== -1) {
                    return {
                        user: line.substring(0, separatorIndex),
                        text: line.substring(separatorIndex + 2),
                    };
                }
                return { user: "Unknown", text: line };
            });

        console.log(`📜 加载的历史聊天记录:`, chatHistory);
        res.json({ chatHistory });

    } catch (error) {
        console.error("❌ 加载聊天记录失败:", error);
        res.status(500).json({ error: "Failed to load chat history" });
    }
});







const PORT = process.env.PORT || 5005;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 Listening on http://localhost:${PORT}/api/chat`);
});

console.log("📡 正在使用的 Box Developer Token:", BOX_DEVELOPER_TOKEN);
