import React, { useState, useEffect } from "react";

const BACKEND_URL = "http://localhost:5005/api/chat"; // 本地测试时使用

function App() {
  // ✅ React Hook `useState` 必须在 `App` 组件内部
  const [nickname, setNickname] = useState(localStorage.getItem("nickname") || "");
  const [tempNickname, setTempNickname] = useState(""); // 用于输入昵称
  const [message, setMessage] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [fileUrl, setFileUrl] = useState(null);


  useEffect(() => {
    const savedChat = JSON.parse(localStorage.getItem("chatHistory")) || [];
    setChatHistory(savedChat);
  }, []);


  const handleSetNickname = async () => {
    if (tempNickname.trim()) {
        setNickname(tempNickname);
        localStorage.setItem("nickname", tempNickname);

        try {
            const response = await fetch(`http://localhost:5005/api/load-history?nickname=${tempNickname}`);
            const data = await response.json();

            if (data.chatHistory) {
                setChatHistory(data.chatHistory);
                localStorage.setItem("chatHistory", JSON.stringify(data.chatHistory));
            }
        } catch (error) {
            console.error("❌ 加载聊天记录失败:", error);
        }
    } else {
        alert("请输入有效的昵称！");
    }
};



  const handleSendMessage = async () => {
    if (!message.trim()) return;

    const newChatHistory = [...chatHistory, { user: nickname, text: message }];
    setChatHistory(newChatHistory);
    setMessage("");

    try {
        const response = await fetch(BACKEND_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nickname, message, chatHistory }), // ✅ 发送完整对话历史
        });

        if (!response.ok) {
            throw new Error("Failed to fetch response from server.");
        }

        const data = await response.json();

        // ✅ 使用完整的历史记录
        setChatHistory(data.chatHistory);
        localStorage.setItem("chatHistory", JSON.stringify(data.chatHistory));
    } catch (error) {
        console.error("❌ API Error:", error);
        alert("⚠️ 服务器连接失败，请检查 API 地址是否正确！");
    }
};








return (
  <div style={{ padding: "20px", maxWidth: "500px", margin: "auto", fontFamily: "Arial, sans-serif" }}>
    <h1>Chatbot</h1>
    {!nickname ? (
      <div>
        <input
          type="text"
          placeholder="输入你的昵称"
          value={tempNickname}
          onChange={(e) => setTempNickname(e.target.value)}
          style={{ padding: "5px", width: "70%" }}
        />
        <button onClick={handleSetNickname} style={{ padding: "5px 10px", marginLeft: "10px" }}>
          确认
        </button>
      </div>
    ) : (
      <div>
        <div
          style={{
            border: "1px solid #ccc",
            padding: "10px",
            borderRadius: "5px",
            height: "300px",
            overflowY: "auto",
            marginBottom: "10px",
          }}
        >
          {chatHistory.map((msg, index) => (
            <p key={index} style={{ margin: "5px 0" }}>
              <strong>{msg.user}:</strong> {msg.text}
            </p>
          ))}
        </div>
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="输入你的消息..."
          style={{ width: "70%", padding: "5px" }}
        />
        <button onClick={handleSendMessage} style={{ padding: "5px 10px", marginLeft: "10px" }}>
          发送
        </button>

        {/* ✅ 这里显示下载按钮 */}
        {/* eslint-disable-next-line no-undef */}
        {fileUrl && (
          <div style={{ marginTop: "15px" }}>
            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-block",
                padding: "10px 15px",
                backgroundColor: "#28a745",
                color: "white",
                textDecoration: "none",
                borderRadius: "5px",
                fontWeight: "bold"
              }}
            >
              📥 下载聊天记录
            </a>
          </div>
        )}
      </div>
    )}
  </div>
);

}

export default App;
