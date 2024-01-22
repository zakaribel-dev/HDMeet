import React, { Component } from "react"
import { IconButton, Badge, Typography, Button } from "@material-ui/core"
import VideocamIcon from "@material-ui/icons/Videocam"
import VideocamOffIcon from "@material-ui/icons/VideocamOff"
import MicIcon from "@material-ui/icons/Mic"
import MicOffIcon from "@material-ui/icons/MicOff"
import ScreenShareIcon from "@material-ui/icons/ScreenShare"
import StopScreenShareIcon from "@material-ui/icons/StopScreenShare"
import CallEndIcon from "@material-ui/icons/CallEnd"
import ChatIcon from "@material-ui/icons/Chat"
import PanToolIcon from "@material-ui/icons/PanTool"

class ControlBar extends Component {
  constructor(props) {
    super(props)
    this.state = {
      showInfo: false,
    }
  }
  handleInfoButtonClick = () => {
    this.setState({ showInfo: !this.state.showInfo })
  }

  render() {
    const {
      // mes states
      username,
      isVideoEnabled,
      isAudioEnabled,
      isScreenSharing,
      isScreenSharingAvailable,
      newMessagesCount,
      onToggleVideo,
      onToggleAudio,
      onToggleScreenShare,
      onEndCall,
      onOpenChat,
      isSidebarOpen,
      toggleSidebar,
      usernames,
      currentUserEmail,
      isAdmin,
    } = this.props

    return (
      <div className="btn-down">
        <Typography>
          {username} <span className="online-indicator"></span>
        </Typography>

        <Button
          style={{
            backgroundColor: "#2196F3",
            color: "white", 
            borderRadius: "5px", 
            padding: "10px 15px", 
            margin: "5px", 
            cursor: "pointer", 
            border: "none", 
            position: "absolute",
            top: "5%",
            left: "30%",
          }}
          onClick={this.handleInfoButtonClick}
        >
            {this.state.showInfo ? 'Cacher mes Infos' : 'Afficher mes infos'}

        </Button>

        {/* Afficher le texte seulement si showInfo est vrai */}
        {this.state.showInfo && (
          <Typography
            variant="body1"
            style={{
              position: "absolute",
              top: "2%",
              left: "10%",
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              justifyContent: "flex-start",
            }}
          >
            <span>
              Votre adresse email : {currentUserEmail}
              <br />
              Statut : {isAdmin ? "Administrateur" : "Utilisateur"}
            </span>
          </Typography>
        )}

        <IconButton
          style={{ color: "rgb(20, 20, 61)" }}
          onClick={onToggleVideo}
        >
          {isVideoEnabled ? <VideocamIcon /> : <VideocamOffIcon />}
        </IconButton>

        <IconButton style={{ color: "#f44336" }} onClick={onEndCall}>
          <CallEndIcon />
        </IconButton>

        <IconButton
          style={{ color: "rgb(20, 20, 61)" }}
          onClick={onToggleAudio}
        >
          {isAudioEnabled ? <MicIcon /> : <MicOffIcon />}
        </IconButton>

        {isScreenSharingAvailable && (
          <IconButton
            style={{ color: "rgb(20, 20, 61)" }}
            onClick={onToggleScreenShare}
          >
            {isScreenSharing ? <ScreenShareIcon /> : <StopScreenShareIcon />}
          </IconButton>
        )}

        <Badge
          className="custom-badge"
          overlap="rectangular"
          badgeContent={newMessagesCount}
          max={999}
          color="secondary"
          onClick={onOpenChat}
        >
          <IconButton style={{ color: "rgb(20, 20, 61)" }} onClick={onOpenChat}>
            <ChatIcon />
          </IconButton>
        </Badge>

        <Button
          className={`toggle-button ${!isSidebarOpen ? "button-show" : ""}`}
          onClick={toggleSidebar}
          style={{
            display: isSidebarOpen ? "none" : undefined,
          }}
          variant="contained"
        >
          Utilisateurs connectés ({Object.keys(usernames).length})
        </Button>
        <IconButton onClick={this.props.onRequestSpeech}>
          <PanToolIcon />
        </IconButton>
      </div>
    )
  }
}

export default ControlBar
