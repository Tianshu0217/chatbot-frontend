import React, { useState } from "react";

function App() {
  const [nickname, setNickname] = useState("");
  const [message, setMessage] = useState("");
  const [chatHistory, setChatHistory] = useState([]);

  const handleSendMessage = async () => {
    if (!message.trim()) return;

    const response = await fetch("https://your-backend.azurewebsites.net/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname, message }),
    });

    const data = await response.json();
    setChatHistory([...chatHistory, { user: nickname, text: message }, { user: "Bot", text: data.reply }]);
    setMessage("");
  };

  return (
    <div>
      <h1>Chatbot</h1>
      {!nickname ? (
        <div>
          <input
            type="text"
            placeholder="输入你的昵称"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
          />
          <button onClick={() => localStorage.setItem("nickname", nickname)}>开始聊天</button>
        </div>
      ) : (
        <div>
          <div>
            {chatHistory.map((msg, index) => (
              <p key={index}><strong>{msg.user}:</strong> {msg.text}</p>
            ))}
          </div>
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="输入你的消息..."
          />
          <button onClick={handleSendMessage}>发送</button>
        </div>
      )}
    </div>
  );
}

export default App;
