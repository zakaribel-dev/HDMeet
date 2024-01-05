/* eslint-disable no-loop-func */
import React, { Component } from "react"
import io from "socket.io-client"
import { Input, Button } from "@material-ui/core"
import logo from "../assets/hdmlogo.png"
import userConnectedSound from "../assets/user_connected.mp3"
import userDisconnectedSound from "../assets/disconnected.mp3"
import messageSound from "../assets/message_sound.mp3"
import Rodal from "rodal"
import "rodal/lib/rodal.css"
import { message, Flex, Spin } from "antd" // superbe bibliotheque
import axios from "axios"
import { Row } from "reactstrap"
import "bootstrap/dist/css/bootstrap.css"
import "../style/Video.css"
import Sidebar from "./partials/sideBar"
import ControlBar from "./partials/controlBar"
import { Link } from "react-router-dom"

// attention à faire en sorte qu'il y ait pas de souci avec protocol SSL (ça m'a bien fait chier)
const server_url =
  process.env.NODE_ENV === "production" //je définis NODE_ENV dans un script "server" (go voir package.json)
    ? "http://195.35.25.238:4001"
    : "http://localhost:4001"

// Pourquoi je déclare ces sortes de states global ?
//Parce qu'à chaque fois qu'un utilisateur join une room, IL VA CREER UNE INSTANCE VIDEO
// du coup, on veut qu'à chaque instances video
// l'utilisateur recoive le nouveau "VideoElements", "connections" etc etc qui eux sont mis à jour globalement!
let connections = {}
let socket = null
let socketId = null
let videoElements = 0

const peerConnectionConfig = {
  iceServers: [
    // Serveurs STUN(co avec la plus part des NAT)
    { urls: "stun:stun.services.mozilla.com" },
    { urls: "stun:stun.l.google.com:19302" },

    // Serveur TURN (si un user est derrière un nat restrictif ou un pare feu chiant, un serveur TURN prendra le relais)
    {
      urls: "turn:turn.anyfirewall.com:443?transport=tcp",
      credential: "webrtc",
      username: "webrtc",
    },
  ],
}

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
      requestingSpeech: false,
      speechRequestMessage: "",
      password: "",
      authorizedUsers: [],
      connectedEmails: [],
      currentUserEmail: "",
      isAdmin: false,
      loadingCamera: true,
    }
    connections = {}

    axios
      .get("http://localhost:4001/users")
      .then((response) => {
        this.setState({ authorizedUsers: response.data })
      })
      .catch((error) => {
        console.error(
          "Erreur lors de la récupération des utilisateurs :",
          error
        )
      })

    this.getPermissions()
  }

  toggleSidebar = () => {
    this.setState((prevState) => ({
      isSidebarOpen: !prevState.isSidebarOpen,
    }))
  }

  getPermissions = async () => {
    try {
      const videoStream = await navigator.mediaDevices.getUserMedia({
        video: true,
      })
      const audioStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      })

      // en faisant "!!navigator.mediaDevices.getDisplayMedia" je vérifie si la methode getDisplayMedia est dispo dans le navigateur
      // si c'est le cas ça veut dire que le navigateur supporte le partage d'écran
      // donc ça me retrourne true et donc je met à jour ma state
      // (state qui va déterminer si j'affiche le bouton de partage ou non)
      const screenAvailable = !!navigator.mediaDevices.getDisplayMedia
      this.setState({ screenAvailable })

      if (videoStream || audioStream) {
        // si on a l'aautorisation pour l'audio ou la video de l'user
        window.localStream = videoStream || audioStream // je recupere le flux autorisé par l'user dans window.localStream
        this.myVideo.current.srcObject = window.localStream // j'affiche ce flux dans mon element video
        this.setState({ loadingCamera: false })
      }

      this.videoAvailable = !!videoStream // videoAvailable à true si videoStream est true et vis versa
      this.audioAvailable = !!audioStream // meme délire
      this.screenAvailable = screenAvailable
    } catch (error) {
      console.error(error)
      this.setState({ loadingCamera: false })
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
        // en param je mets ce que je veux récuperer (l'utilisateur va recevoir une demande pour acceder à son micro + caméra)
        .getUserMedia({ video: this.state.video, audio: this.state.audio })
        // ce machin va mretourner un obj "MediaStream" qui est simplement le flux que j'ai récupéré
        .then(this.getUserMediaSuccess) //si c'est good j'apelle getUserMediaSuccess qui recuperera le MediaStream en param
        .then((stream) => {})
        .catch((e) => console.log(e))
    } else {
      try {
        //si l'utilisateur n'accepte pas l'acces à sa cam + audio parce qu'il est grave timide alors on capture pas son stream
        let tracks = this.myVideo.current.srcObject.getTracks()
        tracks.forEach((track) => track.stop())
      } catch (e) {
        console.log(e)
      }
    }
  }

  // CREATE OFFER POUR LE PARTAGE
  getUserMediaSuccess = (stream) => {
    // "stream" contient mon objet MediaStream qui m'est retourné quand l'user a accepté qu'on ait acces à sa cam + micro..
    //(voir plus haut dans getUserMedia)

    // Met à jour le flux local avec le nouveau flux de la caméra/microphone.
    window.localStream = stream
    this.myVideo.current.srcObject = stream

    // ici je boucle dans toute les connexions actuelles..
    for (let id in connections) {
      if (id === socketId) continue // la jdis que si dans la liste des sockets ya une id qui correspond à MA socketId(moi)
      //alors je saute l'itération, jlui dis de pas calculer et de continuer son petit bonhomme de chemin

      //je stream la petite bouille du streamer à tous les users dans la room en ajoutant le flux actuel à toute les connexions webRTC
      connections[id].addStream(window.localStream)

      // ici je DOIS créer une offre qui contient un "SDP" (go check https://developer.mozilla.org/fr/docs/Glossary/SDP)
      // et ce sera envoyé aux autres users
      connections[id]
        .createOffer()
        .then((description) => connections[id].setLocalDescription(description))
        .then(() => {
          // du coup j'envoie tout ça via une websocket..
          // mon emission "signal" contiendra mon offer pour que tous les autres users puisse la receptionner
          // createOffer qui va creer une SDP est un processus OBLIGATOIRE pour établir une connexion WebRTC
          // c'est comme si t'allais à la banque pour ouvrir un compte et tu signes aucun papiers..
          socket.emit(
            "signal",
            id,
            JSON.stringify({ sdp: connections[id].localDescription })
          )
        })
        .catch((e) => console.log(e))
    }

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

            // du coup lorsqu'on désactive la caméra et l'audio,
            // je lance black et silence qui vont creer un flux noir + supprimer l'audio
            let blackSilence = () => new MediaStream([this.silence()])
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
      //displayMedia c'est le partage donc à ne pas confondre avec usermedia qui est la webcam!
      if (navigator.mediaDevices.getDisplayMedia) {
        //verifie si le partage est dispo (si je partage déjà sur gather ou zoom par exemple, ça marchera pas)
        navigator.mediaDevices
          .getDisplayMedia({ video: true, audio: true }) // je précise un obj d'options(video+audio activés durant partage)
          .then(this.screenShareGranted) // une fois le flux récupéré j'appelle screenShareGranted pour le partage
          .catch((e) => console.log(e))
      }
    }
  }

  screenShareGranted = (stream) => {
    try {
      //j'arrete de diffuser le stream de l'user qui souhaite partager son écran
      window.localStream.getTracks().forEach((track) => track.stop())
    } catch (e) {
      console.log(e)
    }

    // jattribue le stream de mon partage à une variable globale "window.localStream = stream "
    //Ca me fait uen reference locale qui fait que je peux la modifier si je veux gerer la transition
    //entre webcam et partage par exemple ou genre désactiver la cam dans d'autres circonstances
    window.localStream = stream
    this.myVideo.current.srcObject = stream // je veux diffuser mon stream dans mon element html "video"

    for (let id in connections) {
      if (id === socketId) continue

      connections[id].addStream(window.localStream)

      connections[id].createOffer().then((description) => {
        // évidamment je partage un flux (partage d'écran cette fois ci) aux autres utilisateurs
        //je dois creer une "offer" qui contiendra mon SDP

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

  // ici je vais réceptionner tout ce qui est SDP/iceCandidates
  signalFromServer = (fromId, body) => {
    let signal = JSON.parse(body)

    if (fromId !== socketId) {
      //jmassure que l'id du client (fromId) est différent du mien (socketId)
      if (signal.sdp) {
        // si ya une prop "sdp" dans signal  (prop generé lors du createOffer)
        connections[fromId]
          .setRemoteDescription(new RTCSessionDescription(signal.sdp)) // alors je controle le sdp de l'autre peer
          .then(() => {
            // si le type du sdp est "offer" ça veut dire que c'est une offre qui vient d'un autre client btw
            if (signal.sdp.type === "offer") {
              connections[fromId]
                .createAnswer() // du coup je creer une réponse (answer) à l'offer que j'ai reçu,
                //c'est obligatoire
                .then((description) => {
                  connections[fromId]
                    // une fois arrivé à l'appel de setLocalDescription(),
                    // webRTC va commencer le processus de collecte des IceCandidates (fourni par navigateurs)
                    .setLocalDescription(description)
                    .then(() => {
                      // déjà vu ..
                      socket.emit(
                        // déjà vu ..
                        "signal", // déjà vu ..
                        fromId, // déjà vu ..
                        JSON.stringify({
                          sdp: connections[fromId].localDescription, // déjà vu ..
                        })
                      )
                    })
                    .catch((e) => console.log(e))
                })
                .catch((e) => console.log(e))
            }

            // pour comprendre un peu ICE(Interactive Connectivity Establishment),
            //jte conseille : https://developer.mozilla.org/en-US/docs/Web/API/RTCIceCandidate ou alors chatGPT of course
            // Si tu veux d'un côté t'as les SDP (contiennent des infos type codec video/audio ou tout autre parametres.
            // Ca décrit COMMENT les médias doivent être échangés entres les peers)
            //d'un autre côté tu as les iceCandidates qui est un peu dans le même principe mais
            //fournit plutôt des infos sur la connectivité réseau (ip, routing, ports, protocols..)
            //afin de pouvoir choisir le meilleur chemin réseau pour communiquer entres les peers
            // ICE et l'offre SDP doivent toujours être utilisés ensemble pour pouvoir établir une co webrtc
            if (this.iceCandidatesQueue[fromId]) {
              this.iceCandidatesQueue[fromId].forEach((candidate) => {
                // un client envoi son message (fromId)
                connections[fromId].addIceCandidate(
                  // j'ajoute mes iceCandidates à ma connection p2p
                  new RTCIceCandidate(candidate)
                )
              })
              // quand tous les candidats ont été ajoutés à la classe RTCIceCandidate, ils sont delete car y en a plus bseoin
              delete this.iceCandidatesQueue[fromId]
            }
          })
          .catch((e) => console.log(e))
      }

      // du coup logiquement après un createOffer ou createAnswer tu as des iceCandidates
      // ça veut dire qu'un peer a trouvé un bon chemin de connexion réseau et il l'envoie pour qu'un autre peer puisse l'essayer
      if (signal.ice) {
        let iceCandidate = new RTCIceCandidate(signal.ice) // du coup je creer mon obj RTCIceCandidate à partir du ice reçu
        if (connections[fromId].remoteDescription) {
          // si setRemoteDescription s'est déroule comme i faut
          connections[fromId]
            .addIceCandidate(iceCandidate) // j'ajoute ENFIN l'icecandidate
            .catch((e) => console.log(e))
        } else {
          if (!this.iceCandidatesQueue[fromId]) {
            // Si pas de remoteDescription,
            //alors je stock les iceCandidates en attendant la remoteDescription
            this.iceCandidatesQueue[fromId] = []
          }
          // du coup en attendant je met les iceCandidate dans une file d'attente
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
      width = "450px"
      height = "500px"
    } else if (videoElements === 2) {
      width = "35%"
    } else if (videoElements === 3 || videoElements === 4) {
      width = "30%"
      height = "50%"
    } else {
      width = String(100 / videoElements) + "%"
    }

    let videos = main.querySelectorAll("video")
    for (let i = 0; i < videos.length; i++) {
      videos[i].style.minWidth = minWidth
      videos[i].style.minHeight = minHeight
      videos[i].style.setProperty("width", width)
      videos[i].style.setProperty("height", height)
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

  handleRequestSpeech = () => {
    const { username } = this.state
    socket.emit("speechEvent", { username })
    message.warning({
      content: `Demande de prise de parole en cours..`,
      className: "custom-message",
      duration: 3,
    })
  }

  connectToSocketServer = () => {
    socket = io.connect(server_url, { secure: true })

    // demande de parole
    socket.on("speech-requested", ({ username }) => {
      message.warning({
        content: `${username} souhaite prendre la parole.`,
        className: "custom-message",
        duration: 3,
      })
    })

    socket.on("signal", this.signalFromServer)

    socket.on("connect", () => {
      socket.emit(
        "joinCall",
        window.location.href,
        this.state.username,
        this.state.currentUserEmail
      )
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

      socket.on("userLeft", (id) => {
        let video = document.querySelector(`[data-socket="${id}"]`)
        let username = this.state.usernames[id] || "Un utilisateur"

        if (id !== socketId) {
          this.playUserDisconnectedSound()
          message.info({
            content: `${username} a quitté la conférence.`,
            className: "custom-message",
            duration: 3,
          })
        }

        if (video !== null) {
          videoElements--
          video.parentNode.removeChild(video)

          let main = document.getElementById("main")
          this.adaptCSS(main)
        }
      })

      socket.on("user-joined", (id, clients, username, email) => {
        if (id !== socketId) {
          this.playUserConnectedSound()
          message.success({
            content: `${username} a rejoint la conférence.`,
            className: "custom-message",
            duration: 3,
          })
          // si l'id qui vient d'arriver ne correspond pas à mon socketId (moi) alors je play le sound de cette maniere,
          //seul les utilisateurs déjà présents dans la room entendront le son si un new user arrive dans la room
        }

        this.setState((prevState) => ({
          usernames: {
            ...prevState.usernames,
            [id]: username,
          },
        }))

        this.setState((prevState) => ({
          connectedEmails: [...prevState.connectedEmails, email],
        }))

        clients.forEach((socketListId) => {
          connections[socketListId] = new RTCPeerConnection(
            peerConnectionConfig
          ) //stockage des sockets id dans ma globale "connections",
          // c'est ici que j'initialise la connection P2P avec webRTC

          // je collecte mes iceCandidates
          connections[socketListId].onicecandidate = function (event) {
            if (event.candidate != null) {
              socket.emit(
                "signal", // je spread mes icecandidate via "signal"
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
              // si j'fais pas cette condition ça montre un carré vide donc laissez please
              searchVideo.srcObject = event.stream
            } else {
              videoElements = clients.length // videoElements = nbr de client connectés à la  room..
              console.log("videoElements: ", videoElements) // test adaptCSS
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
                backgroundColor:'black'
              }
              for (let i in css) video.style[i] = css[i]

              video.style.setProperty("width", cssMesure.width)
              video.style.setProperty("height", cssMesure.height)
              video.setAttribute("data-socket", socketListId)
              video.style.borderRadius = "25px"
              video.srcObject = event.stream
              video.autoplay = true
              video.playsinline = true
              video.onclick = this.handleVideoClick
              main.appendChild(video)
            }
          }

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

            // createOffer stream audio/video (pas le partage d'ecran!)
            connection
              .createOffer()
              .then((description) =>
                connection.setLocalDescription(description)
              )
              // localDescription va contnir des infos (sdp) sur les params de session (codec audio video etc..)
              //obligé d'envoyer ces params pour la communication en webRTC
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
      //full screen api compatibilité firefopx

      videoElement.mozRequestFullScreen()
    } else if (videoElement.webkitRequestFullscreen) {
      //full screen api compatibilité  chrome et safari (opera aussi je crois)

      videoElement.webkitRequestFullscreen()
    } else if (videoElement.msRequestFullscreen) {
      //full screen api compatibilité edge
      videoElement.msRequestFullscreen()
    }
  }

  // concernant silence et black -> vas dont check : https://blog.mozilla.org/webrtc/warm-up-with-replacetrack/
  // pourquoi creer un "silence" ? parce qu'en webRTC j'ai besoin de creer un flux silence en CONTINU
  // le cas où j'utilise "silence" c'est le cas où je clique sur le bouton mute.
  // l'user veut certes qu'on l'entende plus mais le flux audio doit quand meme continuer donc je creer un silence.
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

  // pourquoi !this.state ??? bah parce que ça permute de false à true (clique et reclique) tu comprends mon gars?
  // un peu comme prevState en composant fonction capiche ?
  handleVideo = () =>
    this.setState({ video: !this.state.video }, () => this.getUserMedia())
  handleAudio = () =>
    this.setState({ audio: !this.state.audio }, () => this.getUserMedia())
  handleScreen = () =>
    this.setState({ screen: !this.state.screen }, () =>
      this.screenSharePermission()
    )

  handleEndCall = () => {
    // jte fais pas un dessin ta compris..
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
    this.setState({ username: e.target.value })
  }

  handleEmail = (e) => {
    this.setState({ currentUserEmail: e.target.value })
  }

  handleSubmit = (event) => {
    event.preventDefault()

    const { currentUserEmail, authorizedUsers } = this.state

    let isAuthorized = false

    for (let i = 0; i < authorizedUsers.length; i++) {
      if (authorizedUsers[i].email === currentUserEmail) {
        isAuthorized = true
        break
      }
    }

    if (isAuthorized) {
      this.connect()
    } else {
      message.error("Hop hop hop, vous n'êtes pas autorisé à entrer ici, allez zou!")
   }
  }

  sendMessage = () => {
    socket.emit("chat-message", this.state.message, this.state.username)
    this.setState({ message: "", sender: this.state.username })
  }

  copyConfLink = () => {
    let text = window.location.href
    navigator.clipboard.writeText(text).then(() => {
      message.success({
        content: `Lien copié !`,
        className: "custom-message-link",
        duration: 3,
      })
    })
  }

  connect = () =>
    this.setState({ askForUsername: false }, () => this.getMedia())

  render() {
    return (
      <div>
        {this.state.askForUsername ? (
          <div>
            {this.state.loadingCamera && (
              <div className="spinner">
                {" "}
                <Flex align="center" gap="middle">
                  <Spin size="large" />
                  Chargement...
                </Flex>
              </div>
            )}
         <Link to="/">
          <img className='logo' src={logo} alt="" style={{width:"150px", position:'absolute',top: '0',left:'0'}} />
          </Link>
          <br /><br />
            <div className="askUsername">
              <form onSubmit={this.handleSubmit}>
                <input
                  type="email"
                  placeholder="Votre email"
                  name="email"
                  autoComplete="email"
                  onChange={(e) => this.handleEmail(e)}
                  required
                  style={{backgroundColor:'white', borderRadius:'5px', margin:'10px'}}
                  />
                <input
                  placeholder="Nom d'utilisateur"
                  onChange={(e) => this.handleUsername(e)}
                  required
                  style={{backgroundColor:'white', borderRadius:'5px', margin:'10px'}}
                />
                <Button
                  className='startBtn'
                  type="submit"
                  variant="contained"
                  color="primary"
                >
                  Se connecter
                </Button>
              </form>
            </div>
            <div>
              <video
                id="myVideo"
                ref={this.myVideo}
                autoPlay
                muted
                style={{
                  objectFit: "fill",
                  width: "100",
                  height: "30%",
                  borderRadius: "25px",
                }}
                onClick={this.handleVideoClick}
              ></video>
            </div>
          </div>
        ) : (
          <div>
            {/* BARRE DE CONTROLES !*/}
            <ControlBar
              username={this.state.username}
              isVideoEnabled={this.state.video}
              isAudioEnabled={this.state.audio}
              isScreenSharing={this.state.screen}
              isScreenSharingAvailable={this.state.screenAvailable}
              isSidebarOpen={this.state.isSidebarOpen}
              newMessagesCount={this.state.newmessages}
              onToggleVideo={this.handleVideo}
              onToggleAudio={this.handleAudio}
              onToggleScreenShare={this.handleScreen}
              onEndCall={this.handleEndCall}
              onOpenChat={this.openChat}
              toggleSidebar={this.toggleSidebar}
              onRequestSpeech={this.handleRequestSpeech}
            />
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
                    margin: "10px",
                    objectFit: "fill",
                    width: "550px",
                    height: "500px",
                    borderRadius: "25px",
                    backgroundColor:'black'
                  }}
                  onClick={this.handleVideoClick}
                ></video>
              </Row>

              <div className="video-chat-container">
                <Sidebar
                  usernames={this.state.usernames}
                  isSidebarOpen={this.state.isSidebarOpen}
                  toggleSidebar={this.toggleSidebar}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }
}

export default Main
