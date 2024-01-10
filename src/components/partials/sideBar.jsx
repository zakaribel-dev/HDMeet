import React, { Component } from "react";
import { Button } from "@material-ui/core";

class Sidebar extends Component {
  render() {
    const {
      usernames,
      isSidebarOpen,
      toggleSidebar,
      toggleChat,
      showChat,
      messages,
      message,
      handleMessage,
      sendMessage,
    } = this.props;

    return (
      <div className={isSidebarOpen ? "sidebar open" : "sidebar"}>
        {/* Bouton pour basculer la barre latérale */}
        <Button
          className="toggle-button"
          onClick={toggleSidebar}
          variant="contained"
        >
          {isSidebarOpen ? "Cacher" : "Afficher"}
        </Button>

        {/* Bouton pour basculer entre le chat et la liste des utilisateurs */}
        <Button onClick={toggleChat} variant="contained">
          {showChat ? "Afficher utilisateurs" : "Afficher chat"}
        </Button>

        {showChat ? (
          <div className="chat-container">
            {messages.length > 0 ? (
              messages.map((item, index) => (
                <div key={index} className="message-item">
                  <p style={{ wordBreak: "break-all" }}>
                    <b>{item.sender}</b>: {item.data}
                  </p>
                </div>
              ))
            ) : (
              <p style={{ textAlign: "center" }}>
                Pas encore de message ici...
              </p>
            )}

            <footer className="div-send-msg" style={{ textAlign: "center" }}>
              <input
                className="inputMsg"
                placeholder="Message"
                value={message}
                onChange={(e) => handleMessage(e)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && message.trim()) {
                    sendMessage();
                  }
                }}
              />
              <Button
                className="btnSendMsg"
                variant="contained"
                color="primary"
                onClick={sendMessage}
              >
                Envoyer
              </Button>
            </footer>
          </div>
        ) : (
          <div className="user-list">
            <h3>Utilisateurs :</h3>
            <ul>
              {Object.values(usernames).map((username, index) => (
                <li key={index}>{username}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }
}

export default Sidebar;
