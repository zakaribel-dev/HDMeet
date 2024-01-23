import React, { Component } from "react"
import { Button } from "@material-ui/core"

class Sidebar extends Component {


  handleKickUser = (userId, username) => {
    const { kickUser } = this.props
    const confirmKick = window.confirm(
      `Voulez-vous vraiment virer ${username} ?`
    )

    if (confirmKick) {
      kickUser(userId) 
    }
  }


  render() {
    const {
      usernames,
      isSidebarOpen,
      toggleSidebar,
      isAdmin,
      socketId,
    } = this.props
    const sidebarClass = isSidebarOpen ? "sidebar open" : "sidebar"

    return (
      <div className={sidebarClass}>
        <Button
          className="toggle-button"
          onClick={toggleSidebar}
          variant="contained"
        >
          {isSidebarOpen ? "Cacher" : "Afficher"}
        </Button>
        <div className="smallContainer">
          <h3>Utilisateurs :</h3>
          <ul>
            {Object.entries(usernames).map(([userId, username], index) => (
              <li key={index}>
                <span className="online-indicator"></span>
                {username}
                {isAdmin && userId !== socketId && (
                  <Button
                    onClick={() => this.handleKickUser(userId, username)}
                    color="secondary"
                  >
                    {" "}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 576 512"
                      style={{ width: "20px" }}
                    >
                      <path
                        fill="#c94436"
                        d="M576 128c0-35.3-28.7-64-64-64H205.3c-17 0-33.3 6.7-45.3 18.7L9.4 233.4c-6 6-9.4 14.1-9.4 22.6s3.4 16.6 9.4 22.6L160 429.3c12 12 28.3 18.7 45.3 18.7H512c35.3 0 64-28.7 64-64V128zM271 175c9.4-9.4 24.6-9.4 33.9 0l47 47 47-47c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9l-47 47 47 47c9.4 9.4 9.4 24.6 0 33.9s-24.6 9.4-33.9 0l-47-47-47 47c-9.4 9.4-24.6 9.4-33.9 0s-9.4-24.6 0-33.9l47-47-47-47c-9.4-9.4-9.4-24.6 0-33.9z"
                      />
                    </svg>
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    )
  }
}

export default Sidebar
