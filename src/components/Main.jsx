/* eslint-disable no-loop-func */
import React, { Component } from "react"
import io from "socket.io-client"
import { IconButton, Badge, Input, Button } from "@material-ui/core"
import VideocamIcon from "@material-ui/icons/Videocam"
import VideocamOffIcon from "@material-ui/icons/VideocamOff"
import MicIcon from "@material-ui/icons/Mic"
import MicOffIcon from "@material-ui/icons/MicOff"
import ScreenShareIcon from "@material-ui/icons/ScreenShare"
import StopScreenShareIcon from "@material-ui/icons/StopScreenShare"
import CallEndIcon from "@material-ui/icons/CallEnd"
import ChatIcon from "@material-ui/icons/Chat"
import logo from "../assets/hdmlogo.png"
import Typography from "@material-ui/core/Typography"
import userConnectedSound from "../assets/user_connected.mp3"
import userDisconnectedSound from "../assets/disconnected.mp3"
import messageSound from "../assets/message_sound.mp3"

import Rodal from "rodal"

import "rodal/lib/rodal.css"
import { message } from "antd" // superbe bibliotheque..
import "antd/dist/antd.css"

import { Row } from "reactstrap"

import "bootstrap/dist/css/bootstrap.css"
import "../style/Video.css"

const server_url =
  process.env.NODE_ENV === "production"
    ? "https://zakaribel.com"
    : "http://localhost:4001"

// Pourquoi je déclare ces sortes de states global ?
//Parce qu'à chaque fois qu'un utilisateur join une room, IL VA CREER UNE INSTANCE VIDEO
// du coup, on veut qu'à chaque instances video
// l'utilisateur recoive le nouveau "VideoElements", "connections" etc etc qui eux sont mis à jour globalement!
var connections = {}
var socket = null
var socketId = null
var videoElements = 0

class Main extends Component {
  constructor(props) {
    super(props)
    this.myVideo = React.createRef()
    this.iceCandidatesQueue = {}
    this.videoAvailable = false
    this.audioAvailable = false

    this.state = {
      video: false,
      audio: false,
      screen: false,
      showModal: false,
      screenAvailable: false,
      messages: [],
      message: "",
      newmessages: 0,
      askForUsername: true,
      username: "",
      usernames: {},
      isSidebarOpen: false,
      playUserConnectedSound: false,
    }
    connections = {}

    this.getPermissions()
  }

  renderSidebar() {
    const usernames = Object.values(this.state.usernames)
    const sidebarClass = this.state.isSidebarOpen ? "sidebar open" : "sidebar"

    return (
      <div className={sidebarClass}>
        <Button className="toggle-button" onClick={this.toggleSidebar}>
          {this.state.isSidebarOpen ? "Cacher" : "Afficher"}
        </Button>
        <h3>Utilisateurs Connectés</h3>
        <ul>
          {usernames.map((username, index) => (
            <li key={index}>
              <span className="online-indicator"></span>
              {username}
            </li>
          ))}
        </ul>
      </div>
    )
  }

  toggleSidebar = () => {
    this.setState((prevState) => ({
      isSidebarOpen: !prevState.isSidebarOpen,
    }))
  }

  getPermissions = async () => {
    try {
      await navigator.mediaDevices
        .getUserMedia({ video: true })
        .then(() => (this.videoAvailable = true))
        .catch(() => (this.videoAvailable = false))

      await navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then(() => (this.audioAvailable = true))
        .catch(() => (this.audioAvailable = false))

      if (navigator.mediaDevices.getDisplayMedia) {
        this.setState({ screenAvailable: true })
      } else {
        this.setState({ screenAvailable: false })
      }

      if (this.videoAvailable || this.audioAvailable) {
        navigator.mediaDevices
          .getUserMedia({
            video: this.videoAvailable,
            audio: this.audioAvailable,
          })
          .then((stream) => {
            window.localStream = stream
            this.myVideo.current.srcObject = stream
          })
          .then((stream) => {})
          .catch((e) => console.log(e))
      }
    } catch (e) {
      console.log(e)
    }
  }

  getMedia = () => {
    this.setState(
      {
        video: this.videoAvailable,
        audio: this.audioAvailable,
      },
      () => {
        this.getUserMedia()
        this.connectToSocketServer()
      }
    )
  }

  getUserMedia = () => {
    if (
      (this.state.video && this.videoAvailable) ||
      (this.state.audio && this.audioAvailable)
    ) {
      navigator.mediaDevices
        .getUserMedia({ video: this.state.video, audio: this.state.audio })
        .then(this.getUserMediaSuccess)
        .then((stream) => {})
        .catch((e) => console.log(e))
    } else {
      try {
        let tracks = this.myVideo.current.srcObject.getTracks()
        tracks.forEach((track) => track.stop())
      } catch (e) {}
    }
  }

  getUserMediaSuccess = (stream) => {
    // Arrête les pistes du flux local actuel, s'il y en a.

    // Met à jour le flux local avec le nouveau flux de la caméra/microphone.
    window.localStream = stream
    this.myVideo.current.srcObject = stream

    // ici je boucle dans toute les connexions actuelles..
    for (let id in connections) {
      if (id === socketId) continue // la jdis que si dans la liste des sockets ya une id qui correspond à MA socketId(moi)
      //alors je saute l'itération, jlui dis de pas calculer et de continuer son petit bonhomme de chemin

      connections[id].addStream(window.localStream) //je stream la pov du streamer à tous les utilisateurs dans la room

      // ici je DOIS créer une offre qui contient une "SDP" (go check https://developer.mozilla.org/fr/docs/Glossary/SDP )
      // et ce sera envoyé aux autres users
      connections[id]
        .createOffer()
        .then((description) => connections[id].setLocalDescription(description))
        .then(() => {
          // du coup j'envoie tout ça via une websocket.. mon emission "signal" contiendra mon offer pour que tous les autres users puisse la receptionner
          socket.emit(
            "signal",
            id,
            JSON.stringify({ sdp: connections[id].localDescription })
          )
        })
        .catch((e) => console.log(e))
    }

    // Configure un gestionnaire d'événements pour les pistes du flux actuel.
    stream.getTracks().forEach((track) => {
      track.onended = () => {
        // Lorsque l'une des pistes se termine (comme la vidéo ou l'audio), cette fonction anonyme est exécutée.
        // Elle réinitialise l'état local et les flux pour une nouvelle connexion.
        this.setState(
          {
            video: false,
            audio: false,
          },
          () => {
            try {
              let tracks = this.myVideo.current.srcObject.getTracks()
              tracks.forEach((track) => track.stop())
            } catch (e) {
              console.log(e)
            }

            // Crée un nouveau flux local avec vidéo "noir" et audio "silence".
            let blackSilence = () =>
              new MediaStream([this.black(), this.silence()])
            window.localStream = blackSilence()
            this.myVideo.current.srcObject = window.localStream

            // Rétablit la communication avec les autres utilisateurs.
            for (let id in connections) {
              connections[id].addStream(window.localStream)
              connections[id]
                .createOffer()
                .then((description) =>
                  connections[id].setLocalDescription(description)
                )
                .then(() => {
                  socket.emit(
                    "signal",
                    id,
                    JSON.stringify({ sdp: connections[id].localDescription })
                  )
                })
                .catch((e) => console.log(e))
            }
          }
        )
      }
    })
  }

  // partage d'ecran
  screenSharePermission = () => {
    if (this.state.screen) {
      if (navigator.mediaDevices.getDisplayMedia) {
        navigator.mediaDevices
          .getDisplayMedia({ video: true, audio: true }) // je précise un obj d'options(video+audio activés durant partage)
          .then(this.screenShareGranted)
          .catch((e) => console.log(e))
      }
    }
  }

  screenShareGranted = (stream) => {
    try {
      window.localStream.getTracks().forEach((track) => track.stop())
    } catch (e) {
      console.log(e)
    }

    window.localStream = stream
    this.myVideo.current.srcObject = stream
    this.enterFullScreenMode(socketId)

    for (let id in connections) {
      if (id === socketId) continue

      connections[id].addStream(window.localStream)

      connections[id].createOffer().then((description) => {
        connections[id]
          .setLocalDescription(description)
          .then(() => {
            socket.emit(
              "signal",
              id,
              JSON.stringify({ sdp: connections[id].localDescription })
            )
          })
          .catch((e) => console.log(e))
      })
    }

    let videoElement = document.querySelector(`[data-socket="${socketId}"]`)
    if (videoElement) {
      this.requestFullScreen(videoElement)
    }

    stream.getTracks().forEach(
      (track) =>
        (track.onended = () => {
          this.setState(
            {
              screen: false,
            },
            () => {
              try {
                let tracks = this.myVideo.current.srcObject.getTracks()
                tracks.forEach((track) => track.stop())
              } catch (e) {
                console.log(e)
              }

              let blackSilence = () =>
                new MediaStream([this.black(), this.silence()])
              window.localStream = blackSilence()
              this.myVideo.current.srcObject = window.localStream

              this.getUserMedia()
            }
          )
        })
    )
  }

  gotMessageFromServer = (fromId, message) => {
    var signal = JSON.parse(message)

    if (fromId !== socketId) {
      if (signal.sdp) {
        connections[fromId]
          .setRemoteDescription(new RTCSessionDescription(signal.sdp))
          .then(() => {
            if (signal.sdp.type === "offer") {
              connections[fromId]
                .createAnswer()
                .then((description) => {
                  connections[fromId]
                    .setLocalDescription(description)
                    .then(() => {
                      socket.emit(
                        "signal",
                        fromId,
                        JSON.stringify({
                          sdp: connections[fromId].localDescription,
                        })
                      )
                    })
                    .catch((e) => console.log(e))
                })
                .catch((e) => console.log(e))
            }
            if (this.iceCandidatesQueue[fromId]) {
              this.iceCandidatesQueue[fromId].forEach((candidate) => {
                connections[fromId].addIceCandidate(
                  new RTCIceCandidate(candidate)
                )
              })
              delete this.iceCandidatesQueue[fromId]
            }
          })
          .catch((e) => console.log(e))
      }

      if (signal.ice) {
        let iceCandidate = new RTCIceCandidate(signal.ice)
        if (connections[fromId].remoteDescription) {
          connections[fromId]
            .addIceCandidate(iceCandidate)
            .catch((e) => console.log(e))
        } else {
          if (!this.iceCandidatesQueue[fromId]) {
            this.iceCandidatesQueue[fromId] = []
          }
          this.iceCandidatesQueue[fromId].push(iceCandidate)
        }
      }
    }
  }
  enterFullScreenMode = (userId) => {
    let videoElement = document.querySelector(`[data-socket="${userId}"]`)
    if (videoElement) {
      this.requestFullScreen(videoElement)
    }
  }

  requestFullScreen = (videoElement) => {
    console.log(
      "Tentative de passage en plein écran pour l'élément vidéo:",
      videoElement
    )

    if (videoElement.requestFullscreen) {
      videoElement.requestFullscreen()
    } else if (videoElement.mozRequestFullScreen) {
      videoElement.mozRequestFullScreen()
    } else if (videoElement.webkitRequestFullscreen) {
      videoElement.webkitRequestFullscreen()
    } else if (videoElement.msRequestFullscreen) {
      videoElement.msRequestFullscreen()
    }
  }

  handleScreenShareStop = () => {
    // en fait tous les navigateurs ont un fullscreen mode de manière native
    if (document.exitFullscreen) {
      document.exitFullscreen()
    } else if (document.mozCancelFullScreen) {
      // pour mozilla
      document.mozCancelFullScreen()
    } else if (document.webkitExitFullscreen) {
      // chrome
      document.webkitExitFullscreen()
    } else if (document.msExitFullscreen) {
      // edge (il me semble lol)
      document.msExitFullscreen()
    }
  }

  adaptCSS(main) {
    let widthMain = main.offsetWidth
    let minWidth = "30%"
    if ((widthMain * 30) / 100 < 300) {
      minWidth = "300px"
    }
    let minHeight = "40%"
    let height = String(100 / videoElements) + "%"
    let width = ""
    if (videoElements === 0 || videoElements === 1) {
      width = "100%"
      height = "100%"
    } else if (videoElements === 2) {
      width = "45%"
      height = "100%"
    } else if (videoElements === 3 || videoElements === 4) {
      width = "35%"
      height = "50%"
    } else {
      width = String(100 / videoElements) + "%"
    }

    let videos = main.querySelectorAll("video")
    for (let a = 0; a < videos.length; ++a) {
      videos[a].style.minWidth = minWidth
      videos[a].style.minHeight = minHeight
      videos[a].style.setProperty("width", width)
      videos[a].style.setProperty("height", height)
    }

    return { minWidth, minHeight, width, height }
  }

  playUserConnectedSound = () => {
    const audio = new Audio(userConnectedSound)
    audio.play()
  }

  playUserDisconnectedSound = () => {
    const audio = new Audio(userDisconnectedSound)
    audio.play()
  }

  playMessageSound = () => {
    const audio = new Audio(messageSound)
    audio.play()
  }

  connectToSocketServer = () => {
    socket = io.connect(server_url, { secure: true })

    socket.on("signal", this.gotMessageFromServer)

    socket.on("connect", () => {
      socket.emit("join-call", window.location.href, this.state.username)
      socketId = socket.id

      socket.on("update-user-list", (users) => {
        if (users) {
          // si j'fais pas ça il va mdire undefined blablabla
          let updatedUsernames = {}
          users.forEach((user) => {
            updatedUsernames[user.id] = user.username
          })
          this.setState({ usernames: updatedUsernames })
        } else {
          console.log(
            "Pas encore de user ou ya comme une couille dans l'paté.."
          )
        }
      })

      socket.on("chat-message", this.addMessage)

      socket.on("user-left", (id) => {
        let video = document.querySelector(`[data-socket="${id}"]`)

        if (id !== socketId) {
          this.playUserDisconnectedSound()
        }

        if (video !== null) {
          videoElements--
          video.parentNode.removeChild(video)

          let main = document.getElementById("main")
          this.adaptCSS(main)
        }
        this.setState((prevState) => {
          const updatedUsernames = { ...prevState.usernames }
          delete updatedUsernames[id]
          return { usernames: updatedUsernames }
        })
      })

      socket.on("user-joined", (id, clients, username) => {
        if (id !== socketId) {
          this.playUserConnectedSound()
          // si l'id qui vient d'arriver ne correspond pas à mon socketId (moi) alors je play le sound de cette maniere,
          //seul les utilisateurs déjà présents dans la room entendront le son si un new user arrive dans la room
        }
        this.setState((prevState) => ({
          usernames: {
            ...prevState.usernames,
            [id]: username,
          },
        }))

        console.log(`New user joined: ${username} with ID: ${id}`)

        clients.forEach((socketListId) => {
          connections[socketListId] = new RTCPeerConnection() //stockage des sockets id dans ma globale "connections"

          // Wait for their ice candidate
          connections[socketListId].onicecandidate = function (event) {
            if (event.candidate != null) {
              socket.emit(
                "signal",
                socketListId,
                JSON.stringify({ ice: event.candidate })
              )
            }
          }

          // je check si un nouveau user (nouveau videoElement du coup) arrive dans la room
          connections[socketListId].onaddstream = (event) => {
            // c un event de webRTC go voir : https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/addstream_event

            let searchVideo = document.querySelector(
              `[data-socket="${socketListId}"]`
            )

            if (searchVideo !== null) {
              // si j'fais pas cette condition ça montre un carré vide donc laissez
              searchVideo.srcObject = event.stream
            } else {
              videoElements = clients.length // videoElements = nbr de client connectés à la  room..
              console.log("videoElements:", videoElements)
              let main = document.getElementById("main")
              let cssMesure = this.adaptCSS(main)

              let video = document.createElement("video")

              let css = {
                minWidth: cssMesure.minWidth,
                minHeight: cssMesure.minHeight,
                maxHeight: "100%",
                margin: "10px",
                borderStyle: "solid",
                borderColor: "#bdbdbd",
                objectFit: "fill",
              }
              for (let i in css) video.style[i] = css[i]

              video.style.setProperty("width", cssMesure.width)
              video.style.setProperty("height", cssMesure.height)
              video.setAttribute("data-socket", socketListId)
              video.srcObject = event.stream
              video.autoplay = true
              video.playsinline = true
              video.onclick = this.handleVideoClick
              main.appendChild(video)
            }
          }

          // Add the local video stream
          if (!window.localStream) {
            window.localStream = new MediaStream([this.black(), this.silence()])
          }

          connections[socketListId].addStream(window.localStream)
        })

        if (id === socketId) {
          for (let id2 in connections) {
            if (id2 === socketId) continue

            const connection = connections[id2]

            try {
              connection.addStream(window.localStream)
            } catch (e) {}

            connection
              .createOffer()
              .then((description) =>
                connection.setLocalDescription(description)
              )
              // localDescription va contnir des infos sur les params de session (codec audio video etc..) obligé d'envoyer ces params pour la communication en webRTC
              .then(() =>
                socket.emit(
                  "signal",
                  id2,
                  JSON.stringify({ sdp: connections[id].localDescription })
                )
              )
              .catch((e) => console.log(e))
          }
        }
      })
    })
  }

  handleVideoClick = (event) => {
    const videoElement = event.target
    if (videoElement.requestFullscreen) {
      videoElement.requestFullscreen()
    } else if (videoElement.mozRequestFullScreen) {
      /* Firefox */
      videoElement.mozRequestFullScreen()
    } else if (videoElement.webkitRequestFullscreen) {
      /* Chrome, Safari & Opera */
      videoElement.webkitRequestFullscreen()
    } else if (videoElement.msRequestFullscreen) {
      /* IE/Edge */
      videoElement.msRequestFullscreen()
    }
  }
  // concernant silence et black -> tu peux check : https://blog.mozilla.org/webrtc/warm-up-with-replacetrack/
  silence = () => {
    let ctx = new AudioContext()
    let oscillator = ctx.createOscillator()
    let dst = oscillator.connect(ctx.createMediaStreamDestination())
    oscillator.start()
    ctx.resume()
    return Object.assign(dst.stream.getAudioTracks()[0], { enabled: false })
  }
  black = ({ width = 640, height = 480 } = {}) => {
    let canvas = Object.assign(document.createElement("canvas"), {
      width,
      height,
    })
    canvas.getContext("2d").fillRect(0, 0, width, height)
    let stream = canvas.captureStream()
    return Object.assign(stream.getVideoTracks()[0], { enabled: false })
  }

  handleVideo = () =>
    this.setState({ video: !this.state.video }, () => this.getUserMedia())
  handleAudio = () =>
    this.setState({ audio: !this.state.audio }, () => this.getUserMedia())
  handleScreen = () =>
    this.setState({ screen: !this.state.screen }, () =>
      this.screenSharePermission()
    )

  handleEndCall = () => {
    try {
      let tracks = this.myVideo.current.srcObject.getTracks()
      tracks.forEach((track) => track.stop())
    } catch (e) {
      console.log(e)
    }
    window.location.href = "/"
  }

  openChat = () => this.setState({ showModal: true, newmessages: 0 })
  closeChat = () => this.setState({ showModal: false })
  handleMessage = (e) => this.setState({ message: e.target.value })

  addMessage = (data, sender, socketIdSender) => {
    this.setState((prevState) => ({
      messages: [...prevState.messages, { sender: sender, data: data }],
    }))
    if (socketIdSender !== socketId) {
      // si c'est pas moi qui envoie le msg, j'incremente le chiffre de la notif d'un new msg
      this.setState({ newmessages: this.state.newmessages + 1 })
      this.playMessageSound()
    }
  }

  handleUsername = (e) => {
    this.setState({ username: e.target.value }, () => {
      console.log("jsuis co en tant que  : " + this.state.username)
    })
  }
  handleSubmit = (event) => {
    event.preventDefault()
    if (event.target.checkValidity()) {
      this.connect()
    }
  }
  sendMessage = () => {
    socket.emit("chat-message", this.state.message, this.state.username)
    this.setState({ message: "", sender: this.state.username })
  }

  copyConfLink = () => {
    let text = window.location.href
    navigator.clipboard.writeText(text).then(() => {
      message.success("Lien copié !")
    })
  }

  connect = () =>
    this.setState({ askForUsername: false }, () => this.getMedia())

  render() {
    return (
      <div>
        {this.state.isLoadingMedia ? ( // Conditional rendering based on isLoadingMedia
          <div className="loading-spinner">Loading Video...</div>
        ) : this.state.askForUsername === true ? (
          <div>
            <div className="askUsername">
              <form onSubmit={this.handleSubmit}>
                <Input
                  placeholder="Nom d'utilisateur"
                  onChange={(e) => this.handleUsername(e)}
                  required
                />
                <Button
                  className="btnConnect"
                  type="submit"
                  variant="contained"
                  color="primary"
                >
                  Se connecter
                </Button>
              </form>
            </div>

            <div
              style={{
                justifyContent: "center",
                textAlign: "center",
                paddingTop: "40px",
              }}
            >
              <video
                id="myVideo"
                ref={this.myVideo}
                autoPlay
                muted
                style={{
                  objectFit: "fill",
                  width: "30%",
                  height: "30%",
                }}
                onClick={this.handleVideoClick}
              ></video>
            </div>
          </div>
        ) : (
          <div>
            {/* BARRE DE CONTROLES !*/}
            <div
              className="btn-down"
              style={{
                backgroundColor: "whitesmoke",
                color: "whitesmoke",
                textAlign: "center",
              }}
            >
              <Typography variant="body1">
                <span className="online-indicator"></span>

                {this.state.username}
              </Typography>

              <IconButton
                style={{ color: "#424242" }}
                onClick={this.handleVideo}
              >
                {this.state.video === true ? (
                  <VideocamIcon />
                ) : (
                  <VideocamOffIcon />
                )}
              </IconButton>

              <IconButton
                style={{ color: "#f44336" }}
                onClick={this.handleEndCall}
              >
                <CallEndIcon />
              </IconButton>

              <IconButton
                style={{ color: "#424242" }}
                onClick={this.handleAudio}
              >
                {this.state.audio === true ? <MicIcon /> : <MicOffIcon />}
              </IconButton>

              {this.state.screenAvailable === true ? (
                <IconButton
                  style={{ color: "#424242" }}
                  onClick={this.handleScreen}
                >
                  {this.state.screen === true ? (
                    <ScreenShareIcon />
                  ) : (
                    <StopScreenShareIcon />
                  )}
                </IconButton>
              ) : null}

              {/* openChat va passer à true showModal */}
              <Badge
                className="custom-badge"
                overlap="rectangular"
                badgeContent={this.state.newmessages}
                max={999}
                color="secondary"
                onClick={this.openChat}
              >
                <IconButton
                  style={{ color: "#424242" }}
                  onClick={this.openChat}
                >
                  <ChatIcon />
                </IconButton>
              </Badge>

              <Button
                className={`toggle-button ${
                  !this.state.isSidebarOpen ? "button-show" : ""
                }`}
                onClick={this.toggleSidebar}
                style={{
                  display: this.state.isSidebarOpen ? "none" : undefined,
                }}
              >
                Utilisateurs connectés
              </Button>
            </div>

            {/* je "hide" la modal si showModal est faux( c le cas par défaut of course*/}
            <Rodal visible={this.state.showModal} onClose={this.closeChat}>
              <header>
                <img
                  style={{ width: "80px", borderRadius: "10px" }}
                  src={logo}
                  alt=""
                />
                <br />
                <br />
              </header>

              <div className="bodyRodal">
                {/* Messages */}
                {this.state.messages.length > 0 ? (
                  this.state.messages.map((item, index) => (
                    <div key={index}>
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
              </div>

              <footer className="div-send-msg" style={{ textAlign: "center" }}>
                {/* Message input */}
                <Input
                  className="inputMsg"
                  placeholder="Message"
                  value={this.state.message}
                  onChange={(e) => this.handleMessage(e)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && this.state.message.trim()) {
                      this.sendMessage()
                    }
                  }}
                />
                {/* Send button */}
                <Button
                  className="btnSendMsg"
                  variant="contained"
                  color="primary"
                  onClick={this.sendMessage}
                >
                  Envoyer
                </Button>
              </footer>
            </Rodal>

            <div className="container" style={{ textAlign: "center" }}>
              <img
                style={{ width: "80px", borderRadius: "0 0 10px" }}
                className="logoInConf"
                src={logo}
                alt=""
              />
              <div>
                <Button
                  className="copy"
                  variant="contained"
                  color="primary"
                  onClick={this.copyConfLink}
                >
                  Copier le lien conférence
                </Button>
              </div>

              <Row
                id="main"
                className="flex-container"
                style={{ margin: 0, padding: 0 }}
              >
                <video
                  id="my-video"
                  ref={this.myVideo}
                  autoPlay
                  muted
                  style={{
                    backgroundColor: "black",
                    margin: "10px",
                    objectFit: "fill",
                    width: "100%",
                    height: "100%",
                  }}
                  onClick={this.handleVideoClick}
                ></video>
              </Row>

              <div className="video-chat-container">{this.renderSidebar()}</div>
            </div>
          </div>
        )}
      </div>
    )
  }
}

export default Main
