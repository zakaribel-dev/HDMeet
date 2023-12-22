import React, { Component } from "react";
import { IconButton, Badge, Typography, Button } from "@material-ui/core";
import VideocamIcon from "@material-ui/icons/Videocam";
import VideocamOffIcon from "@material-ui/icons/VideocamOff";
import MicIcon from "@material-ui/icons/Mic";
import MicOffIcon from "@material-ui/icons/MicOff";
import ScreenShareIcon from "@material-ui/icons/ScreenShare";
import StopScreenShareIcon from "@material-ui/icons/StopScreenShare";
import CallEndIcon from "@material-ui/icons/CallEnd";
import ChatIcon from "@material-ui/icons/Chat";
import PanToolIcon from '@material-ui/icons/PanTool';


class ControlBar extends Component {
  render() {
    const {  // mes states
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
    } = this.props;

    return (
      <div className="btn-down">
        <Typography variant="body1">
          <span className="online-indicator"></span>
          {username}
        </Typography>

        <IconButton style={{ color: "rgb(20, 20, 61)" }} onClick={onToggleVideo}>
          {isVideoEnabled ? <VideocamIcon /> : <VideocamOffIcon />}
        </IconButton>

        <IconButton style={{ color: "#f44336" }} onClick={onEndCall}>
          <CallEndIcon />
        </IconButton>

        <IconButton style={{ color: "rgb(20, 20, 61)" }} onClick={onToggleAudio}>
          {isAudioEnabled ? <MicIcon /> : <MicOffIcon />}
        </IconButton>

        {isScreenSharingAvailable && (
          <IconButton
            style={{ color: "rgb(20, 20, 61)" }}
            onClick={onToggleScreenShare}
          > {console.log(ScreenShareIcon)}
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
          className={`toggle-button ${
            !isSidebarOpen ? "button-show" : ""
          }`}
          onClick={toggleSidebar} 
          style={{
            display: isSidebarOpen ? "none" : undefined,
          }}
          variant="contained"

        >
          Utilisateurs connectés
        </Button>

        <IconButton  onClick={this.props.onRequestSpeech}><PanToolIcon/></IconButton>

      </div>
    );
  }
}

export default ControlBar;
