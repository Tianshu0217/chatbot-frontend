const express = require("express");
const cors = require("cors");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const OPENAI_API_KEY = process.env.AZURE_OPENAI_KEY; // 从 .env 读取 API Key
const CHAT_HISTORY = []; // 存储聊天记录（可换成数据库）

app.post("/api/chat", async (req, res) => {
  const { nickname, message } = req.body;
  if (!nickname || !message) {
    return res.status(400).json({ error: "Missing nickname or message" });
  }

  try {
    const response = await axios.post(
      "https://api.openai.azure.com/v1/completions",
      {
        model: "gpt-4",
        prompt: `${nickname}: ${message}\nBot:`,
        max_tokens: 100,
      },
      {
        headers: { "Authorization": `Bearer ${OPENAI_API_KEY}` },
      }
    );

    const reply = response.data.choices[0].text.trim();
    CHAT_HISTORY.push({ nickname, message, reply }); // 存入内存
    res.json({ reply });
  } catch (error) {
    console.error("OpenAI API Error:", error);
    res.status(500).json({ error: "Failed to get response from OpenAI API" });
  }
});

app.listen(5001, () => console.log("🚀 Server running on port 5001"));
